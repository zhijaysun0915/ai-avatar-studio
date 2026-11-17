import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Header from "./components/Header";
import ColabModal from "./components/ColabModal";
import AssetPanel from "./components/AssetPanel";
import StudioWorkspace from "./components/StudioWorkspace";
import OutputPanel from "./components/OutputPanel";

export default function App() {
  const [settings, setSettings] = useState({
    worker_url: "",
    api_token: "",
    demo_mode: true,
  });
  const [colabOnline, setColabOnline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [avatars, setAvatars] = useState([]);
  const [voices, setVoices] = useState([]);
  const [jobs, setJobs] = useState([]);

  const [selectedAvatarId, setSelectedAvatarId] = useState(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);

  const loadAll = useCallback(async () => {
    const [s, avs, vcs, jbs] = await Promise.all([
      api.getSettings(),
      api.listAvatars(),
      api.listVoices(),
      api.listJobs(),
    ]);
    setSettings(s);
    setAvatars(avs);
    setVoices(vcs);
    setJobs(jbs);

    if (s.worker_url?.trim() && !s.demo_mode) {
      const health = await api.testColab(s);
      setColabOnline(Boolean(health.ok));
    } else {
      setColabOnline(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll jobs while any job is in progress
  useEffect(() => {
    const hasRunning = jobs.some(
      (j) => !["completed", "failed"].includes(j.status)
    );
    if (!hasRunning) return;

    const timer = setInterval(async () => {
      const updated = await api.listJobs();
      setJobs(updated);
    }, 1500);
    return () => clearInterval(timer);
  }, [jobs]);

  const selectedAvatar = avatars.find((a) => a.id === selectedAvatarId) || null;
  const selectedVoice = voices.find((v) => v.id === selectedVoiceId) || null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <Header
        settings={settings}
        colabOnline={colabOnline}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <AssetPanel
          avatars={avatars}
          voices={voices}
          selectedAvatarId={selectedAvatarId}
          selectedVoiceId={selectedVoiceId}
          onSelectAvatar={setSelectedAvatarId}
          onSelectVoice={setSelectedVoiceId}
          onRefresh={loadAll}
        />

        <StudioWorkspace
          selectedAvatar={selectedAvatar}
          selectedVoice={selectedVoice}
          onJobCreated={(job) => {
            setJobs((prev) => [job, ...prev]);
            setActiveJobId(job.id);
          }}
        />

        <OutputPanel
          jobs={jobs}
          activeJobId={activeJobId}
          onSelectJob={setActiveJobId}
        />
      </div>

      <ColabModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={async (updated) => {
          setSettings(updated);
          if (updated.worker_url?.trim() && !updated.demo_mode) {
            const health = await api.testColab(updated);
            setColabOnline(Boolean(health.ok));
          } else {
            setColabOnline(false);
          }
        }}
      />
    </div>
  );
}
