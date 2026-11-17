import { useRef, useState } from "react";
import { FileAudio, Languages, Loader2, Sparkles, Type, Upload, Wand2 } from "lucide-react";
import { api } from "../api";

export default function StudioWorkspace({
  selectedAvatar,
  selectedVoice,
  onJobCreated,
}) {
  const [mode, setMode] = useState("text_to_video");
  const [scriptText, setScriptText] = useState(
    "大家好，歡迎來到 AI Avatar Studio。只要輸入文字，就能透過聲音克隆與人物對嘴技術，快速生成專屬的數位分身影片。"
  );
  const [language, setLanguage] = useState("zh");
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const audioInputRef = useRef(null);

  const handleUploadAudio = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    setError("");
    try {
      const res = await api.uploadAudioInput(file);
      setUploadedAudio({ name: file.name, ...res });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAudio(false);
      e.target.value = "";
    }
  };

  const handleGenerate = async () => {
    setError("");
    if (!selectedAvatar) {
      setError("請先從左側選擇或上傳一個「人物分身」");
      return;
    }
    if (mode === "text_to_video") {
      if (!selectedVoice) {
        setError("文字轉語音模式需要從左側選擇一個「聲音模型」");
        return;
      }
      if (!scriptText.trim()) {
        setError("請輸入要生成的台詞內容");
        return;
      }
    } else if (!uploadedAudio) {
      setError("請先上傳要對嘴的驅動語音檔");
      return;
    }

    setSubmitting(true);
    try {
      const job = await api.generate({
        mode,
        avatar_id: selectedAvatar.id,
        voice_id: mode === "text_to_video" ? selectedVoice?.id : null,
        script_text: mode === "text_to_video" ? scriptText : null,
        language,
        uploaded_audio_filename: mode === "audio_to_video" ? uploadedAudio.filename : null,
        tts_speed: ttsSpeed,
      });
      onJobCreated(job);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-950 overflow-y-auto p-6">
      <div className="max-w-2xl w-full mx-auto space-y-5">
        {/* Selected Assets Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center gap-3">
            {selectedAvatar ? (
              <>
                {selectedAvatar.media_type === "video" ? (
                  <video
                    src={selectedAvatar.url}
                    className="w-12 h-12 rounded-lg object-cover bg-slate-950 shrink-0"
                    muted
                  />
                ) : (
                  <img
                    src={selectedAvatar.url}
                    alt={selectedAvatar.name}
                    className="w-12 h-12 rounded-lg object-cover bg-slate-950 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">已選人物分身</div>
                  <div className="text-sm font-medium text-white truncate">
                    {selectedAvatar.name}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                ← 請從左側選擇或上傳人物分身
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center gap-3">
            {mode === "audio_to_video" ? (
              <div className="text-xs text-cyan-300">
                目前為「直接語音對嘴」模式，將使用下方上傳的音檔
              </div>
            ) : selectedVoice ? (
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400">已選聲音模型</div>
                <div className="text-sm font-medium text-cyan-300 truncate">
                  {selectedVoice.name}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                ← 請從左側選擇或上傳參考聲音
              </div>
            )}
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 gap-1">
          <button
            onClick={() => setMode("text_to_video")}
            className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              mode === "text_to_video"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Type className="w-4 h-4" />
            文字腳本 + 聲音克隆 → 對嘴影片
          </button>
          <button
            onClick={() => setMode("audio_to_video")}
            className={`py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              mode === "audio_to_video"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileAudio className="w-4 h-4" />
            直接上傳語音 → 對嘴影片
          </button>
        </div>

        {mode === "text_to_video" ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                輸入台詞腳本
              </label>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Languages className="w-3.5 h-3.5" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="zh">繁體/簡體中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="auto">中英混讀 (Auto)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>語速 {ttsSpeed.toFixed(1)}x</span>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            <textarea
              rows={7}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="輸入要讓數位分身說出的台詞..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
            />
            <div className="text-right text-[11px] text-slate-500">
              {scriptText.length} 字元
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center space-y-3">
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={handleUploadAudio}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">
                上傳已經錄好的語音檔
              </div>
              <div className="text-xs text-slate-400 mt-1">
                支援 WAV / MP3 / M4A，系統將直接把人物嘴型對齊此音檔
              </div>
            </div>
            <button
              onClick={() => audioInputRef.current?.click()}
              disabled={uploadingAudio}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
            >
              {uploadingAudio ? "上傳中..." : "選擇音檔"}
            </button>
            {uploadedAudio && (
              <div className="pt-2 space-y-2">
                <div className="text-xs text-emerald-400">
                  已就緒：{uploadedAudio.name}
                </div>
                <audio controls src={uploadedAudio.url} className="w-full h-8" />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              建立任務中...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              開始生成對嘴影片
            </>
          )}
        </button>
      </div>
    </main>
  );
}
