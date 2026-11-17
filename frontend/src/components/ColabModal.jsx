import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Server, X, AlertTriangle } from "lucide-react";
import { api } from "../api";

export default function ColabModal({ open, settings, onClose, onSaved }) {
  const [form, setForm] = useState(settings);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setForm(settings);
    setTestResult(null);
  }, [settings, open]);

  if (!open) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testColab(form);
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(form);
      onSaved(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              Google Colab GPU 串接設定
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3.5 text-xs text-indigo-200 leading-relaxed">
            請在 Google Colab 開啟專案內的{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300">
              colab/AI_Avatar_Colab_Worker.ipynb
            </code>
            ，執行所有儲存格後，將產生的公開 Tunnel URL（例如{" "}
            <code className="text-cyan-300">https://xxxx.trycloudflare.com</code>）貼到下方。
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <div>
              <div className="font-medium text-slate-200">啟用 Demo 模擬模式</div>
              <div className="text-xs text-slate-400 mt-0.5">
                未連接 Colab GPU 時，使用本機模擬管線測試完整操作流程
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.demo_mode}
              onChange={(e) => setForm({ ...form, demo_mode: e.target.checked })}
              className="w-4 h-4 accent-indigo-500"
            />
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Colab Worker URL
            </label>
            <input
              type="url"
              placeholder="https://xxxx-xxxx.trycloudflare.com"
              value={form.worker_url}
              onChange={(e) => setForm({ ...form, worker_url: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              API Token（選填，需與 Colab 一致）
            </label>
            <input
              type="password"
              placeholder="若 Colab 有設定驗證金鑰請填入"
              value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.ok
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">連線成功！</div>
                    <div className="opacity-80 mt-0.5">
                      GPU：{testResult.worker?.gpu || "偵測中"} ｜ 引擎：
                      {testResult.worker?.engines?.join(", ") || "Ready"}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">連線失敗</div>
                    <div className="opacity-80 mt-0.5">{testResult.error}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleTest}
            disabled={testing || !form.worker_url.trim()}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            測試 Colab 連線
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
