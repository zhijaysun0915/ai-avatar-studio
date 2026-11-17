import { CheckCircle2, Clock, Download, Film, Loader2, XCircle } from "lucide-react";

export default function OutputPanel({ jobs, activeJobId, onSelectJob }) {
  const activeJob = jobs.find((j) => j.id === activeJobId) || jobs[0] || null;

  return (
    <aside className="w-96 border-l border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0 h-full overflow-hidden">
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Film className="w-4 h-4 text-cyan-400" />
          生成預覽與任務紀錄
        </div>
        <span className="text-[11px] text-slate-500">{jobs.length} 筆任務</span>
      </div>

      {/* Active Job Preview */}
      <div className="p-4 border-b border-slate-800/80 space-y-3">
        {!activeJob ? (
          <div className="aspect-video rounded-xl border border-dashed border-slate-800 bg-slate-950/60 flex items-center justify-center text-xs text-slate-500 text-center px-4">
            尚未有任何生成任務
            <br />
            在左側選好分身與聲音後點擊「開始生成」
          </div>
        ) : (
          <>
            {activeJob.video_url ? (
              <video
                key={activeJob.video_url}
                src={activeJob.video_url}
                controls
                autoPlay
                className="w-full aspect-video rounded-xl bg-black border border-slate-800"
              />
            ) : (
              <div className="aspect-video rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                {activeJob.status === "failed" ? (
                  <>
                    <XCircle className="w-8 h-8 text-rose-400 mb-2" />
                    <div className="text-xs text-rose-300 font-medium">生成失敗</div>
                    <div className="text-[11px] text-slate-400 mt-1 break-all">
                      {activeJob.error}
                    </div>
                  </>
                ) : activeJob.status === "completed" ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                    <div className="text-xs text-slate-300">
                      {activeJob.step_message}
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-7 h-7 text-indigo-400 animate-spin mb-2" />
                    <div className="text-xs text-slate-200 font-medium">
                      {activeJob.step_message}
                    </div>
                    <div className="w-48 h-1.5 rounded-full bg-slate-800 mt-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${activeJob.progress}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeJob.audio_url && (
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400">生成 / 驅動語音軌：</div>
                <audio controls src={activeJob.audio_url} className="w-full h-8" />
              </div>
            )}

            {activeJob.video_url && (
              <a
                href={activeJob.video_url}
                download={`avatar-${activeJob.id}.mp4`}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                下載 MP4 影片
              </a>
            )}
          </>
        )}
      </div>

      {/* Job History List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {jobs.map((job) => {
          const isActive = activeJob?.id === job.id;
          return (
            <button
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                isActive
                  ? "border-indigo-500/60 bg-indigo-500/10"
                  : "border-slate-800/80 bg-slate-950/50 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200 truncate">
                  {job.avatar_name}
                  {job.voice_name ? ` × ${job.voice_name}` : ""}
                </span>
                {job.status === "completed" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : job.status === "failed" ? (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-1">
                {job.script_text || "直接語音驅動對嘴"}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                <span>{job.used_colab ? "Colab GPU" : "Demo 模式"}</span>
                <span>{job.progress}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
