from typing import Literal, Optional
from pydantic import BaseModel, Field


class ColabSettings(BaseModel):
    worker_url: str = ""
    api_token: str = ""
    demo_mode: bool = True


class AvatarAsset(BaseModel):
    id: str
    name: str
    filename: str
    media_type: Literal["image", "video"]
    url: str
    created_at: str


class VoiceAsset(BaseModel):
    id: str
    name: str
    filename: str
    ref_text: str = ""
    url: str
    created_at: str


class YoutubeVoiceRequest(BaseModel):
    name: str = ""
    url: str
    start_sec: float = Field(default=0.0, ge=0.0)
    duration_sec: float = Field(default=12.0, ge=3.0, le=45.0)
    ref_text: str = ""


class JobRecord(BaseModel):
    id: str
    mode: Literal["text_to_video", "audio_to_video"]
    avatar_id: str
    avatar_name: str
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    script_text: Optional[str] = None
    language: str = "zh"
    status: Literal["queued", "cloning_voice", "generating_lipsync", "completed", "failed"]
    progress: int = 0
    step_message: str = "等待中..."
    audio_url: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    used_colab: bool = False
    created_at: str
    updated_at: str


class GenerateRequest(BaseModel):
    mode: Literal["text_to_video", "audio_to_video"] = "text_to_video"
    avatar_id: str
    voice_id: Optional[str] = None
    script_text: Optional[str] = None
    language: str = "zh"
    uploaded_audio_filename: Optional[str] = None
    tts_speed: float = Field(default=1.0, ge=0.5, le=2.0)
