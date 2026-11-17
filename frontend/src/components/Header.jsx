import { Cpu, Settings, Sparkles, Wifi, WifiOff } from "lucide-react";

export default function Header({ settings, colabOnline, onOpenSettings }) {
  const isColabMode = Boolean(settings.worker_url?.trim()) && !settings.demo_mode;

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur px-5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-white">
            AI Avatar Studio
          </h1>
          <p className="text-[11px] text-slate-400">
            一站式聲音克隆 × 人物對嘴影片平台
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
            isColabMode
              ? colabOnline
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              : "bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {isColabMode ? (
            colabOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Colab GPU 已連線</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Colab 未連線 / 點此設定</span>
              </>
            )
          ) : (
            <>
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Demo 模擬模式</span>
            </>
          )}
          <Settings className="w-3.5 h-3.5 opacity-70 ml-1" />
        </button>
      </div>
    </header>
  );
}
