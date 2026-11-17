import asyncio
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import List

import httpx
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import AUDIO_INPUTS_DIR, AVATARS_DIR, DATA_DIR, OUTPUTS_DIR, VOICES_DIR
from models import AvatarAsset, ColabSettings, GenerateRequest, JobRecord, VoiceAsset, YoutubeVoiceRequest
from store import now_iso, store
from worker_client import _auth_headers, check_colab_health, run_generation_pipeline

app = FastAPI(title="AI Avatar Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(DATA_DIR)), name="media")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/settings", response_model=ColabSettings)
async def get_settings():
    return store.get_settings()


@app.put("/api/settings", response_model=ColabSettings)
async def update_settings(payload: ColabSettings):
    return store.update_settings(payload)


@app.post("/api/settings/test-colab")
async def test_colab(payload: ColabSettings):
    return await check_colab_health(payload)


@app.get("/api/avatars", response_model=List[AvatarAsset])
async def list_avatars():
    return store.list_avatars()


@app.post("/api/avatars", response_model=AvatarAsset)
async def upload_avatar(
    name: str = Form(...),
    file: UploadFile = File(...),
):
    ext = Path(file.filename or "avatar.png").suffix.lower() or ".png"
    media_type = "video" if ext in {".mp4", ".mov", ".webm", ".avi"} else "image"
    avatar_id = uuid.uuid4().hex[:10]
    filename = f"{avatar_id}{ext}"
    dest = AVATARS_DIR / filename
    dest.write_bytes(await file.read())

    asset = AvatarAsset(
        id=avatar_id,
        name=name.strip() or file.filename or "未命名分身",
        filename=filename,
        media_type=media_type,
        url=f"/media/uploads/avatars/{filename}",
        created_at=now_iso(),
    )
    return store.add_avatar(asset)


@app.delete("/api/avatars/{avatar_id}")
async def delete_avatar(avatar_id: str):
    avatar = store.get_avatar(avatar_id)
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    (AVATARS_DIR / avatar.filename).unlink(missing_ok=True)
    store.delete_avatar(avatar_id)
    return {"deleted": True}


@app.get("/api/voices", response_model=List[VoiceAsset])
async def list_voices():
    return store.list_voices()


@app.post("/api/voices", response_model=VoiceAsset)
async def upload_voice(
    name: str = Form(...),
    ref_text: str = Form(""),
    file: UploadFile = File(...),
):
    ext = Path(file.filename or "voice.wav").suffix.lower() or ".wav"
    voice_id = uuid.uuid4().hex[:10]
    filename = f"{voice_id}{ext}"
    dest = VOICES_DIR / filename
    dest.write_bytes(await file.read())

    asset = VoiceAsset(
        id=voice_id,
        name=name.strip() or file.filename or "未命名聲音",
        filename=filename,
        ref_text=ref_text.strip(),
        url=f"/media/uploads/voices/{filename}",
        created_at=now_iso(),
    )
    return store.add_voice(asset)


@app.post("/api/voices/from-youtube", response_model=VoiceAsset)
async def create_voice_from_youtube(payload: YoutubeVoiceRequest):
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="請輸入有效的 YouTube 網址")

    voice_id = uuid.uuid4().hex[:10]
    filename = f"{voice_id}.wav"
    dest = VOICES_DIR / filename

    settings = store.get_settings()
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        try:
            import imageio_ffmpeg
            ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_bin = None
    ytdlp_bin = shutil.which("yt-dlp") or str(Path(__file__).resolve().parent / ".venv" / "Scripts" / "yt-dlp.exe")

    if Path(ytdlp_bin).exists() or shutil.which("yt-dlp"):
        raw_tmp = VOICES_DIR / f"{voice_id}_raw.%(ext)s"
        dl_cmd = [
            ytdlp_bin if Path(ytdlp_bin).exists() else "yt-dlp",
            "-f", "bestaudio/best",
            "--no-playlist",
            "-o", str(raw_tmp),
            url,
        ]
        proc = await asyncio.to_thread(subprocess.run, dl_cmd, capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            raise HTTPException(status_code=400, detail=f"YouTube 下載失敗: {proc.stderr[-300:]}")

        downloaded = next(VOICES_DIR.glob(f"{voice_id}_raw.*"), None)
        if not downloaded:
            raise HTTPException(status_code=500, detail="找不到下載的音訊檔案")

        try:
            if ffmpeg_bin:
                ff_cmd = [
                    ffmpeg_bin, "-y",
                    "-ss", str(payload.start_sec),
                    "-t", str(payload.duration_sec),
                    "-i", str(downloaded),
                    "-ar", "24000", "-ac", "1",
                    str(dest),
                ]
                ff_proc = await asyncio.to_thread(subprocess.run, ff_cmd, capture_output=True, text=True, timeout=60)
                if ff_proc.returncode != 0 or not dest.exists():
                    raise HTTPException(status_code=500, detail="FFmpeg 音訊裁切失敗")
            else:
                filename = f"{voice_id}{downloaded.suffix}"
                dest = VOICES_DIR / filename
                downloaded.rename(dest)
        finally:
            if downloaded.exists() and downloaded != dest:
                downloaded.unlink(missing_ok=True)
    elif settings.worker_url.strip() and not settings.demo_mode:
        worker_url = settings.worker_url.strip().rstrip("/")
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{worker_url}/api/youtube-audio",
                headers=_auth_headers(settings),
                data={
                    "url": url,
                    "start_sec": str(payload.start_sec),
                    "duration_sec": str(payload.duration_sec),
                },
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Colab 擷取失敗: {resp.text[:300]}")
            dest.write_bytes(resp.content)
    else:
        raise HTTPException(status_code=400, detail="本機未安裝 yt-dlp 或未連線 Colab Worker")

    asset = VoiceAsset(
        id=voice_id,
        name=payload.name.strip() or "YouTube 聲音樣本",
        filename=filename,
        ref_text=payload.ref_text.strip(),
        url=f"/media/uploads/voices/{filename}",
        created_at=now_iso(),
    )
    return store.add_voice(asset)


@app.delete("/api/voices/{voice_id}")
async def delete_voice(voice_id: str):
    voice = store.get_voice(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    (VOICES_DIR / voice.filename).unlink(missing_ok=True)
    store.delete_voice(voice_id)
    return {"deleted": True}


@app.post("/api/audio-inputs")
async def upload_audio_input(file: UploadFile = File(...)):
    ext = Path(file.filename or "speech.wav").suffix.lower() or ".wav"
    filename = f"{uuid.uuid4().hex[:10]}{ext}"
    dest = AUDIO_INPUTS_DIR / filename
    dest.write_bytes(await file.read())
    return {"filename": filename, "url": f"/media/uploads/audio_inputs/{filename}"}


@app.get("/api/jobs", response_model=List[JobRecord])
async def list_jobs():
    return store.list_jobs()


@app.get("/api/jobs/{job_id}", response_model=JobRecord)
async def get_job(job_id: str):
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/generate", response_model=JobRecord)
async def create_generate_job(req: GenerateRequest, background_tasks: BackgroundTasks):
    avatar = store.get_avatar(req.avatar_id)
    if not avatar:
        raise HTTPException(status_code=404, detail="找不到人物分身素材")

    voice = store.get_voice(req.voice_id) if req.voice_id else None
    if req.mode == "text_to_video":
        if not voice:
            raise HTTPException(status_code=400, detail="請選擇一個參考聲音模型")
        if not (req.script_text or "").strip():
            raise HTTPException(status_code=400, detail="請輸入要生成的台詞文字")
    else:
        if not req.uploaded_audio_filename:
            raise HTTPException(status_code=400, detail="請上傳驅動語音檔")

    job_id = uuid.uuid4().hex[:12]
    job = JobRecord(
        id=job_id,
        mode=req.mode,
        engine=req.engine,
        avatar_id=avatar.id,
        avatar_name=avatar.name,
        voice_id=voice.id if voice else None,
        voice_name=voice.name if voice else None,
        script_text=req.script_text,
        language=req.language,
        status="queued",
        progress=5,
        step_message="任務已排入佇列...",
        created_at=now_iso(),
        updated_at=now_iso(),
    )
    store.save_job(job)
    background_tasks.add_task(
        run_generation_pipeline,
        job_id,
        req.uploaded_audio_filename,
        req.tts_speed,
    )
    return job
