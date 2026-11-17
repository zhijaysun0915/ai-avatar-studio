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

export const api = {
  getSettings: () => request("/api/settings"),
  updateSettings: (payload) =>
    request("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  testColab: (payload) =>
    request("/api/settings/test-colab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  listAvatars: () => request("/api/avatars"),
  uploadAvatar: (name, file) => {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("file", file);
    return request("/api/avatars", { method: "POST", body: fd });
  },
  deleteAvatar: (id) => request(`/api/avatars/${id}`, { method: "DELETE" }),

  listVoices: () => request("/api/voices"),
  uploadVoice: (name, refText, file) => {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("ref_text", refText);
    fd.append("file", file);
    return request("/api/voices", { method: "POST", body: fd });
  },
  deleteVoice: (id) => request(`/api/voices/${id}`, { method: "DELETE" }),

  uploadAudioInput: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/audio-inputs", { method: "POST", body: fd });
  },

  listJobs: () => request("/api/jobs"),
  getJob: (id) => request(`/api/jobs/${id}`),
  generate: (payload) =>
    request("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
