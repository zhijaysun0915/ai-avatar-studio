// Supports both local FastAPI backend (/api/*) and standalone static mode (GitHub Pages + direct Colab CORS)

const STORAGE_KEY = "ai_avatar_studio_settings";

let hasLocalBackend = null;
const memAvatars = [];
const memVoices = [];
const memAudioInputs = new Map();
const memJobs = [];

async function detectBackend() {
  if (hasLocalBackend !== null) return hasLocalBackend;
  try {
    const res = await fetch("/api/health");
    const ct = res.headers.get("content-type") || "";
    hasLocalBackend = res.ok && ct.includes("application/json");
  } catch {
    hasLocalBackend = false;
  }
  return hasLocalBackend;
}

function getLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { worker_url: "", api_token: "", demo_mode: true };
}

function saveLocalSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  return s;
}

function colabHeaders(settings) {
  const h = {};
  if (settings.api_token?.trim()) {
    h["Authorization"] = `Bearer ${settings.api_token.trim()}`;
  }
  return h;
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || data.error || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

async function runStandaloneJob(job, payload) {
  const settings = getLocalSettings();
  const useColab = Boolean(settings.worker_url?.trim()) && !settings.demo_mode;
  const workerUrl = settings.worker_url?.trim().replace(/\/$/, "");
  const avatar = memAvatars.find((a) => a.id === payload.avatar_id);
  const voice = memVoices.find((v) => v.id === payload.voice_id);

  try {
    let audioBlob = null;

    if (payload.mode === "text_to_video") {
      job.status = "cloning_voice";
      job.progress = 25;
      job.step_message = useColab
        ? "正在 Colab GPU 進行聲音克隆 (F5-TTS)..."
        : "[靜態 Demo] 瀏覽器模擬聲音克隆中...";

      if (useColab) {
        const fd = new FormData();
        fd.append("text", payload.script_text || "");
        fd.append("language", payload.language || "zh");
        fd.append("speed", String(payload.tts_speed || 1.0));
        fd.append("ref_text", voice?.ref_text || "");
        fd.append("ref_audio", voice._file);
        const res = await fetch(`${workerUrl}/api/tts`, {
          method: "POST",
          headers: colabHeaders(settings),
          body: fd,
        });
        if (!res.ok) throw new Error(`Colab TTS HTTP ${res.status}`);
        audioBlob = await res.blob();
        job.audio_url = URL.createObjectURL(audioBlob);
      } else {
        await new Promise((r) => setTimeout(r, 900));
        job.audio_url = voice?.url || null;
      }
      job.progress = 55;
    } else {
      const file = memAudioInputs.get(payload.uploaded_audio_filename);
      audioBlob = file;
      job.audio_url = file ? URL.createObjectURL(file) : null;
    }

    job.status = "generating_lipsync";
    job.progress = 70;
    job.step_message = useColab
      ? "正在 Colab GPU 生成人物對嘴影片 (Wav2Lip)..."
      : "[靜態 Demo] 完成預覽（請設定 Colab URL 以進行真實對嘴生成）";

    if (useColab) {
      const fd = new FormData();
      fd.append("avatar", avatar._file);
      fd.append("audio", audioBlob, "speech.wav");
      const res = await fetch(`${workerUrl}/api/lipsync`, {
        method: "POST",
        headers: colabHeaders(settings),
        body: fd,
      });
      if (!res.ok) throw new Error(`Colab LipSync HTTP ${res.status}`);
      const videoBlob = await res.blob();
      job.video_url = URL.createObjectURL(videoBlob);
    } else {
      await new Promise((r) => setTimeout(r, 900));
      if (avatar?.media_type === "video") {
        job.video_url = avatar.url;
      }
    }

    job.status = "completed";
    job.progress = 100;
    job.step_message = job.video_url
      ? "生成完成！"
      : "Demo 語音已完成（純靜態網頁模式需連接 Colab GPU 才能合成 MP4）";
  } catch (err) {
    job.status = "failed";
    job.error = err.message;
    job.step_message = "生成失敗";
  }
}

export const api = {
  getSettings: async () => {
    if (await detectBackend()) return request("/api/settings");
    return getLocalSettings();
  },
  updateSettings: async (payload) => {
    if (await detectBackend()) {
      return request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    return saveLocalSettings(payload);
  },
  testColab: async (payload) => {
    if (await detectBackend()) {
      return request("/api/settings/test-colab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const url = (payload.worker_url || "").trim().replace(/\/$/, "");
    if (!url) return { ok: false, error: "尚未設定 Colab Worker URL" };
    try {
      const res = await fetch(`${url}/health`, { headers: colabHeaders(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, worker: await res.json() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  listAvatars: async () => {
    if (await detectBackend()) return request("/api/avatars");
    return [...memAvatars];
  },
  uploadAvatar: async (name, file) => {
    if (await detectBackend()) {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("file", file);
      return request("/api/avatars", { method: "POST", body: fd });
    }
    const isVideo = file.type.startsWith("video/");
    const item = {
      id: Math.random().toString(36).slice(2, 10),
      name,
      filename: file.name,
      media_type: isVideo ? "video" : "image",
      url: URL.createObjectURL(file),
      _file: file,
    };
    memAvatars.unshift(item);
    return item;
  },
  deleteAvatar: async (id) => {
    if (await detectBackend()) return request(`/api/avatars/${id}`, { method: "DELETE" });
    const idx = memAvatars.findIndex((a) => a.id === id);
    if (idx !== -1) memAvatars.splice(idx, 1);
    return { deleted: true };
  },

  listVoices: async () => {
    if (await detectBackend()) return request("/api/voices");
    return [...memVoices];
  },
  uploadVoice: async (name, refText, file) => {
    if (await detectBackend()) {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("ref_text", refText);
      fd.append("file", file);
      return request("/api/voices", { method: "POST", body: fd });
    }
    const item = {
      id: Math.random().toString(36).slice(2, 10),
      name,
      filename: file.name,
      ref_text: refText,
      url: URL.createObjectURL(file),
      _file: file,
    };
    memVoices.unshift(item);
    return item;
  },
  createVoiceFromYoutube: async ({ name, url, start_sec, duration_sec, ref_text }) => {
    if (await detectBackend()) {
      return request("/api/voices/from-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, start_sec, duration_sec, ref_text }),
      });
    }
    const settings = getLocalSettings();
    const workerUrl = (settings.worker_url || "").trim().replace(/\/$/, "");
    if (!workerUrl) {
      throw new Error("純靜態網頁模式需先在右上角設定 Colab Worker URL 才能從 YouTube 擷取音訊");
    }
    const fd = new FormData();
    fd.append("url", url);
    fd.append("start_sec", String(start_sec ?? 0));
    fd.append("duration_sec", String(duration_sec ?? 12));
    const res = await fetch(`${workerUrl}/api/youtube-audio`, {
      method: "POST",
      headers: colabHeaders(settings),
      body: fd,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch {
        // ignore
      }
      if (detail.includes("cookies") || detail.includes("authentication")) {
        throw new Error(
          "YouTube 封鎖了 Google Colab 機房 IP（需登入驗證）。請改用本機網址 http://127.0.0.1:5173 進行 YouTube 擷取，或手動上傳音檔。"
        );
      }
      throw new Error(`Colab YouTube 擷取失敗: ${detail}`);
    }
    const blob = await res.blob();
    const file = new File([blob], "youtube_voice.wav", { type: "audio/wav" });
    const item = {
      id: Math.random().toString(36).slice(2, 10),
      name: name || "YouTube 聲音樣本",
      filename: file.name,
      ref_text: ref_text || "",
      url: URL.createObjectURL(file),
      _file: file,
    };
    memVoices.unshift(item);
    return item;
  },
  deleteVoice: async (id) => {
    if (await detectBackend()) return request(`/api/voices/${id}`, { method: "DELETE" });
    const idx = memVoices.findIndex((v) => v.id === id);
    if (idx !== -1) memVoices.splice(idx, 1);
    return { deleted: true };
  },

  uploadAudioInput: async (file) => {
    if (await detectBackend()) {
      const fd = new FormData();
      fd.append("file", file);
      return request("/api/audio-inputs", { method: "POST", body: fd });
    }
    const key = `${Date.now()}_${file.name}`;
    memAudioInputs.set(key, file);
    return { filename: key, url: URL.createObjectURL(file) };
  },

  listJobs: async () => {
    if (await detectBackend()) return request("/api/jobs");
    return memJobs.map((j) => ({ ...j }));
  },
  getJob: async (id) => {
    if (await detectBackend()) return request(`/api/jobs/${id}`);
    return { ...memJobs.find((j) => j.id === id) };
  },
  generate: async (payload) => {
    if (await detectBackend()) {
      return request("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const settings = getLocalSettings();
    const avatar = memAvatars.find((a) => a.id === payload.avatar_id);
    const voice = memVoices.find((v) => v.id === payload.voice_id);
    const job = {
      id: Math.random().toString(36).slice(2, 12),
      mode: payload.mode,
      avatar_id: payload.avatar_id,
      avatar_name: avatar?.name || "Avatar",
      voice_id: payload.voice_id,
      voice_name: voice?.name || null,
      script_text: payload.script_text,
      language: payload.language,
      status: "queued",
      progress: 5,
      step_message: "任務已排入佇列...",
      audio_url: null,
      video_url: null,
      error: null,
      used_colab: Boolean(settings.worker_url?.trim()) && !settings.demo_mode,
    };
    memJobs.unshift(job);
    runStandaloneJob(job, payload);
    return { ...job };
  },
};
