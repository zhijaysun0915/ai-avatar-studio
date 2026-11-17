from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
AVATARS_DIR = UPLOADS_DIR / "avatars"
VOICES_DIR = UPLOADS_DIR / "voices"
AUDIO_INPUTS_DIR = UPLOADS_DIR / "audio_inputs"
OUTPUTS_DIR = DATA_DIR / "outputs"
DB_FILE = DATA_DIR / "db.json"

for d in (DATA_DIR, UPLOADS_DIR, AVATARS_DIR, VOICES_DIR, AUDIO_INPUTS_DIR, OUTPUTS_DIR):
    d.mkdir(parents=True, exist_ok=True)
