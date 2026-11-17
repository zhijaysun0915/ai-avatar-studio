import asyncio
import math
import shutil
import struct
import subprocess
import wave
from pathlib import Path
from typing import Dict, Optional
import httpx

from config import AUDIO_INPUTS_DIR, AVATARS_DIR, OUTPUTS_DIR, VOICES_DIR
from models import ColabSettings, JobRecord
from store import now_iso, store


def _auth_headers(settings: ColabSettings) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if settings.api_token.strip():
        headers["Authorization"] = f"Bearer {settings.api_token.strip()}"
    return headers


async def check_colab_health(settings: ColabSettings) -> dict:
    url = settings.worker_url.strip().rstrip("/")
    if not url:
        return {"ok": False, "error": "尚未設定 Colab Worker URL"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{url}/health", headers=_auth_headers(settings))
            resp.raise_for_status()
            data = resp.json()
            return {"ok": True, "worker": data}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def _generate_demo_wav(dest: Path, duration_sec: float = 3.0) -> None:
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    with wave.open(str(dest), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            t = i / sample_rate
            # Gentle harmonic chime so demo audio is audible and non-harsh
            env = min(1.0, t * 4) * max(0.0, 1.0 - (t / duration_sec))
            val = int(4500 * env * (0.6 * math.sin(2 * math.pi * 220 * t) + 0.4 * math.sin(2 * math.pi * 330 * t)))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))


def _try_ffmpeg_demo_video(avatar_path: Path, media_type: str, audio_path: Path, dest_mp4: Path) -> bool:
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return False
    try:
        if media_type == "image":
            cmd = [
                ffmpeg_bin, "-y",
                "-loop", "1", "-i", str(avatar_path),
                "-i", str(audio_path),
                "-c:v", "libx264", "-tune", "stillimage",
                "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-shortest", str(dest_mp4),
            ]
        else:
            cmd = [
                ffmpeg_bin, "-y",
                "-stream_loop", "-1", "-i", str(avatar_path),
                "-i", str(audio_path),
                "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "libx264", "-c:a", "aac", "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-shortest", str(dest_mp4),
            ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return proc.returncode == 0 and dest_mp4.exists()
    except Exception:
        return False


def _update_job(job: JobRecord, **kwargs) -> JobRecord:
    for k, v in kwargs.items():
        setattr(job, k, v)
    job.updated_at = now_iso()
    return store.save_job(job)


async def run_generation_pipeline(
    job_id: str,
    uploaded_audio_filename: Optional[str] = None,
    tts_speed: float = 1.0,
) -> None:
    job = store.get_job(job_id)
    if not job:
        return

    settings = store.get_settings()
    avatar = store.get_avatar(job.avatar_id)
    voice = store.get_voice(job.voice_id) if job.voice_id else None

    if not avatar:
        _update_job(job, status="failed", error="找不到指定的人物分身素材", step_message="失敗")
        return

    avatar_path = AVATARS_DIR / avatar.filename
    if not avatar_path.exists():
        _update_job(job, status="failed", error="人物分身檔案遺失", step_message="失敗")
        return

    use_colab = bool(settings.worker_url.strip()) and not settings.demo_mode
    _update_job(job, used_colab=use_colab)

    try:
        audio_path: Optional[Path] = None

        # Step 1: Voice Cloning / Audio Preparation
        if job.mode == "text_to_video":
            if not voice:
                raise RuntimeError("文字轉語音模式需要選擇一個參考聲音模型")
            voice_path = VOICES_DIR / voice.filename
            if not voice_path.exists():
                raise RuntimeError("參考聲音檔案不存在")

            _update_job(
                job,
                status="cloning_voice",
                progress=20,
                step_message="正在進行聲音克隆與文字轉語音 (TTS)..." if use_colab else "[Demo 模式] 正在模擬聲音克隆...",
            )

            out_wav = OUTPUTS_DIR / f"{job.id}.wav"
            if use_colab:
                worker_url = settings.worker_url.strip().rstrip("/")
                async with httpx.AsyncClient(timeout=300.0) as client:
                    data = {
                        "text": job.script_text or "",
                        "language": job.language,
                        "speed": str(tts_speed),
                        "ref_text": voice.ref_text or "",
                        "engine": job.engine,
                    }
                    with open(voice_path, "rb") as vf:
                        start_resp = await client.post(
                            f"{worker_url}/api/tts/start",
                            headers=_auth_headers(settings),
                            data=data,
                            files={"ref_audio": (voice_path.name, vf, "audio/wav")},
                        )
                    if start_resp.status_code == 200:
                        remote_id = start_resp.json()["job_id"]
                        while True:
                            await asyncio.sleep(2)
                            st = await client.get(
                                f"{worker_url}/api/tts/status/{remote_id}",
                                headers=_auth_headers(settings),
                            )
                            st.raise_for_status()
                            st_data = st.json()
                            if st_data["status"] == "done":
                                res_resp = await client.get(
                                    f"{worker_url}/api/tts/result/{remote_id}",
                                    headers=_auth_headers(settings),
                                )
                                res_resp.raise_for_status()
                                out_wav.write_bytes(res_resp.content)
                                break
                            if st_data["status"] == "failed":
                                raise RuntimeError(st_data.get("error") or "Colab TTS failed")
                    else:
                        with open(voice_path, "rb") as vf:
                            resp = await client.post(
                                f"{worker_url}/api/tts",
                                headers=_auth_headers(settings),
                                data=data,
                                files={"ref_audio": (voice_path.name, vf, "audio/wav")},
                            )
                            resp.raise_for_status()
                            out_wav.write_bytes(resp.content)
            else:
                await asyncio.sleep(1.2)
                _generate_demo_wav(out_wav, duration_sec=3.0)

            audio_path = out_wav
            _update_job(job, audio_url=f"/media/outputs/{out_wav.name}", progress=50)

        else:
            if not uploaded_audio_filename:
                raise RuntimeError("直接語音對嘴模式需要上傳音檔")
            audio_path = AUDIO_INPUTS_DIR / uploaded_audio_filename
            if not audio_path.exists():
                raise RuntimeError("找不到上傳的音檔")
            _update_job(job, audio_url=f"/media/audio_inputs/{audio_path.name}", progress=40)

        # Step 2: Lip-Sync Video Generation
        _update_job(
            job,
            status="generating_lipsync",
            progress=65,
            step_message="正在 Colab GPU 生成人物對嘴影片..." if use_colab else "[Demo 模式] 正在合成示範影片...",
        )

        out_mp4 = OUTPUTS_DIR / f"{job.id}.mp4"
        if use_colab:
            worker_url = settings.worker_url.strip().rstrip("/")
            async with httpx.AsyncClient(timeout=600.0) as client:
                with open(avatar_path, "rb") as avf, open(audio_path, "rb") as auf:
                    files = {
                        "avatar": (avatar_path.name, avf, "application/octet-stream"),
                        "audio": (audio_path.name, auf, "audio/wav"),
                    }
                    start_resp = await client.post(
                        f"{worker_url}/api/lipsync/start",
                        headers=_auth_headers(settings),
                        data={"engine": job.engine},
                        files=files,
                    )
                if start_resp.status_code == 200:
                    remote_id = start_resp.json()["job_id"]
                    while True:
                        await asyncio.sleep(3)
                        st = await client.get(
                            f"{worker_url}/api/lipsync/status/{remote_id}",
                            headers=_auth_headers(settings),
                        )
                        st.raise_for_status()
                        st_data = st.json()
                        if st_data["status"] == "done":
                            res_resp = await client.get(
                                f"{worker_url}/api/lipsync/result/{remote_id}",
                                headers=_auth_headers(settings),
                            )
                            res_resp.raise_for_status()
                            out_mp4.write_bytes(res_resp.content)
                            break
                        if st_data["status"] == "failed":
                            raise RuntimeError(st_data.get("error") or "Colab video generation failed")
                else:
                    with open(avatar_path, "rb") as avf, open(audio_path, "rb") as auf:
                        files = {
                            "avatar": (avatar_path.name, avf, "application/octet-stream"),
                            "audio": (audio_path.name, auf, "audio/wav"),
                        }
                        resp = await client.post(
                            f"{worker_url}/api/lipsync",
                            headers=_auth_headers(settings),
                            data={"engine": job.engine},
                            files=files,
                        )
                        resp.raise_for_status()
                        out_mp4.write_bytes(resp.content)
            video_url = f"/media/outputs/{out_mp4.name}"
        else:
            await asyncio.sleep(1.5)
            created = _try_ffmpeg_demo_video(avatar_path, avatar.media_type, audio_path, out_mp4)
            if created:
                video_url = f"/media/outputs/{out_mp4.name}"
            elif avatar.media_type == "video":
                shutil.copyfile(avatar_path, out_mp4)
                video_url = f"/media/outputs/{out_mp4.name}"
            else:
                video_url = None

        _update_job(
            job,
            status="completed",
            progress=100,
            video_url=video_url,
            step_message="生成完成！" if video_url else "Demo 語音完成（本機無 ffmpeg，無法合成示範 MP4，請連接 Colab GPU 生成真實對嘴影片）",
        )

    except Exception as exc:
        _update_job(
            job,
            status="failed",
            error=str(exc),
            step_message="生成失敗",
        )
