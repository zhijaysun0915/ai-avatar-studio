import json
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from config import DB_FILE
from models import AvatarAsset, ColabSettings, JobRecord, VoiceAsset


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class JsonStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        if not DB_FILE.exists():
            self._write_raw({
                "settings": ColabSettings().model_dump(),
                "avatars": [],
                "voices": [],
                "jobs": [],
            })

    def _read_raw(self) -> Dict[str, Any]:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_raw(self, data: Dict[str, Any]) -> None:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_settings(self) -> ColabSettings:
        with self._lock:
            data = self._read_raw()
            return ColabSettings(**data.get("settings", {}))

    def update_settings(self, settings: ColabSettings) -> ColabSettings:
        with self._lock:
            data = self._read_raw()
            data["settings"] = settings.model_dump()
            self._write_raw(data)
            return settings

    def list_avatars(self) -> List[AvatarAsset]:
        with self._lock:
            data = self._read_raw()
            return [AvatarAsset(**item) for item in data.get("avatars", [])]

    def get_avatar(self, avatar_id: str) -> Optional[AvatarAsset]:
        return next((a for a in self.list_avatars() if a.id == avatar_id), None)

    def add_avatar(self, avatar: AvatarAsset) -> AvatarAsset:
        with self._lock:
            data = self._read_raw()
            data.setdefault("avatars", []).insert(0, avatar.model_dump())
            self._write_raw(data)
            return avatar

    def delete_avatar(self, avatar_id: str) -> bool:
        with self._lock:
            data = self._read_raw()
            before = len(data.get("avatars", []))
            data["avatars"] = [a for a in data.get("avatars", []) if a["id"] != avatar_id]
            self._write_raw(data)
            return len(data["avatars"]) < before

    def list_voices(self) -> List[VoiceAsset]:
        with self._lock:
            data = self._read_raw()
            return [VoiceAsset(**item) for item in data.get("voices", [])]

    def get_voice(self, voice_id: str) -> Optional[VoiceAsset]:
        return next((v for v in self.list_voices() if v.id == voice_id), None)

    def add_voice(self, voice: VoiceAsset) -> VoiceAsset:
        with self._lock:
            data = self._read_raw()
            data.setdefault("voices", []).insert(0, voice.model_dump())
            self._write_raw(data)
            return voice

    def delete_voice(self, voice_id: str) -> bool:
        with self._lock:
            data = self._read_raw()
            before = len(data.get("voices", []))
            data["voices"] = [v for v in data.get("voices", []) if v["id"] != voice_id]
            self._write_raw(data)
            return len(data["voices"]) < before

    def list_jobs(self) -> List[JobRecord]:
        with self._lock:
            data = self._read_raw()
            return [JobRecord(**item) for item in data.get("jobs", [])]

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        return next((j for j in self.list_jobs() if j.id == job_id), None)

    def save_job(self, job: JobRecord) -> JobRecord:
        with self._lock:
            data = self._read_raw()
            jobs = data.setdefault("jobs", [])
            idx = next((i for i, j in enumerate(jobs) if j["id"] == job.id), None)
            if idx is None:
                jobs.insert(0, job.model_dump())
            else:
                jobs[idx] = job.model_dump()
            self._write_raw(data)
            return job


store = JsonStore()
