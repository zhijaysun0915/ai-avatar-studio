import { useRef, useState } from "react";
import { Image, Link2, Loader2, Mic, Plus, Trash2, Upload, User, Video, Volume2 } from "lucide-react";
import { api } from "../api";

export default function AssetPanel({
  avatars,
  voices,
  selectedAvatarId,
  selectedVoiceId,
  onSelectAvatar,
  onSelectVoice,
  onRefresh,
}) {
  const [tab, setTab] = useState("avatars");
  const [uploading, setUploading] = useState(false);

  const [avatarName, setAvatarName] = useState("");
  const avatarFileRef = useRef(null);

  const [voiceName, setVoiceName] = useState("");
  const [voiceRefText, setVoiceRefText] = useState("");
  const [voiceSource, setVoiceSource] = useState("upload"); // "upload" | "youtube"
  const [ytUrl, setYtUrl] = useState("");
  const [ytStart, setYtStart] = useState("0");
  const [ytDuration, setYtDuration] = useState("12");
  const [voiceError, setVoiceError] = useState("");
  const voiceFileRef = useRef(null);

  const handleUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await api.uploadAvatar(avatarName || file.name.replace(/\.[^.]+$/, ""), file);
      setAvatarName("");
      onSelectAvatar(created.id);
      await onRefresh();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUploadVoice = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setVoiceError("");
    try {
      const created = await api.uploadVoice(
        voiceName || file.name.replace(/\.[^.]+$/, ""),
        voiceRefText,
        file
      );
      setVoiceName("");
      setVoiceRefText("");
      onSelectVoice(created.id);
      await onRefresh();
    } catch (err) {
      setVoiceError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleYoutubeVoice = async () => {
    if (!ytUrl.trim()) {
      setVoiceError("請輸入 YouTube 影片網址");
      return;
    }
    setUploading(true);
    setVoiceError("");
    try {
      const created = await api.createVoiceFromYoutube({
        name: voiceName.trim() || "YouTube 聲音樣本",
        url: ytUrl.trim(),
        start_sec: parseFloat(ytStart) || 0,
        duration_sec: parseFloat(ytDuration) || 12,
        ref_text: voiceRefText.trim(),
      });
      setVoiceName("");
      setVoiceRefText("");
      setYtUrl("");
      onSelectVoice(created.id);
      await onRefresh();
    } catch (err) {
      setVoiceError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async (e, id) => {
    e.stopPropagation();
    await api.deleteAvatar(id);
    if (selectedAvatarId === id) onSelectAvatar(null);
    await onRefresh();
  };

  const handleDeleteVoice = async (e, id) => {
    e.stopPropagation();
    await api.deleteVoice(id);
    if (selectedVoiceId === id) onSelectVoice(null);
    await onRefresh();
  };

  return (
    <aside className="w-80 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0 h-full overflow-hidden">
      <div className="p-3 border-b border-slate-800/80 grid grid-cols-2 gap-1.5 bg-slate-950/40">
        <button
          onClick={() => setTab("avatars")}
          className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
            tab === "avatars"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          人物分身 ({avatars.length})
        </button>
        <button
          onClick={() => setTab("voices")}
          className={`py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
            tab === "voices"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          聲音模型 ({voices.length})
        </button>
      </div>

      {tab === "avatars" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800/60 space-y-2">
            <input
              type="text"
              placeholder="分身名稱（例如：演講者 A）"
              value={avatarName}
              onChange={(e) => setAvatarName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleUploadAvatar}
              className="hidden"
            />
            <button
              onClick={() => avatarFileRef.current?.click()}
              disabled={uploading}
              className="w-full py-2 rounded-lg border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-indigo-500/10 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              {uploading ? "上傳中..." : "上傳人像照片或影片"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {avatars.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                尚未上傳人物分身素材
                <br />
                支援 JPG / PNG 照片或 MP4 影片
              </div>
            ) : (
              avatars.map((a) => {
                const selected = a.id === selectedAvatarId;
                return (
                  <div
                    key={a.id}
                    onClick={() => onSelectAvatar(a.id)}
                    className={`group rounded-xl border p-2 cursor-pointer transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-2">
                      {a.media_type === "video" ? (
                        <video
                          src={a.url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={a.url}
                          alt={a.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-slate-200 flex items-center gap-1">
                        {a.media_type === "video" ? (
                          <Video className="w-2.5 h-2.5 text-cyan-400" />
                        ) : (
                          <Image className="w-2.5 h-2.5 text-indigo-400" />
                        )}
                        {a.media_type === "video" ? "影片" : "照片"}
                      </span>
                      <button
                        onClick={(e) => handleDeleteAvatar(e, a.id)}
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/70 text-slate-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="刪除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-xs font-medium text-slate-200 truncate px-0.5">
                      {a.name}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800/60 space-y-2">
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
              <button
                onClick={() => { setVoiceSource("upload"); setVoiceError(""); }}
                className={`py-1 rounded-md font-medium transition cursor-pointer ${
                  voiceSource === "upload" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                上傳音檔
              </button>
              <button
                onClick={() => { setVoiceSource("youtube"); setVoiceError(""); }}
                className={`py-1 rounded-md font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                  voiceSource === "youtube" ? "bg-rose-600/80 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Link2 className="w-3 h-3" />
                YouTube 擷取
              </button>
            </div>

            <input
              type="text"
              placeholder="聲音名稱（例如：講者聲線）"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="參考音檔的逐字稿（選填，可提升準確度）"
              value={voiceRefText}
              onChange={(e) => setVoiceRefText(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            {voiceSource === "upload" ? (
              <>
                <input
                  ref={voiceFileRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadVoice}
                  className="hidden"
                />
                <button
                  onClick={() => voiceFileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-2 rounded-lg border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 hover:bg-indigo-500/10 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  {uploading ? "上傳中..." : "上傳參考音檔 (5~30秒 WAV/MP3)"}
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="貼上 YouTube 影片網址 (https://youtu.be/...)"
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">開始秒數 (s)</label>
                    <input
                      type="number"
                      min="0"
                      value={ytStart}
                      onChange={(e) => setYtStart(e.target.value)}
                      className="w-full px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">擷取長度 (3~45s)</label>
                    <input
                      type="number"
                      min="3"
                      max="45"
                      value={ytDuration}
                      onChange={(e) => setYtDuration(e.target.value)}
                      className="w-full px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={handleYoutubeVoice}
                  disabled={uploading}
                  className="w-full py-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 disabled:opacity-50 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      擷取音訊中...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      從 YouTube 擷取聲音模型
                    </>
                  )}
                </button>
              </div>
            )}

            {voiceError && (
              <div className="text-[11px] text-rose-400 break-all">{voiceError}</div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {voices.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                尚未上傳參考聲音樣本
                <br />
                建議提供 5～15 秒清晰人聲
              </div>
            ) : (
              voices.map((v) => {
                const selected = v.id === selectedVoiceId;
                return (
                  <div
                    key={v.id}
                    onClick={() => onSelectVoice(v.id)}
                    className={`group rounded-xl border p-2.5 cursor-pointer transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {v.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteVoice(e, v.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <audio controls src={v.url} className="w-full h-7" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
