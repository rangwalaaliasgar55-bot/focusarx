import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { Shield, Plus, Trash2, Wifi, X } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";

type Profile = {
  id: string;
  name: string;
  ssid: string | null;
  blockedDomains: string[];
  whitelist: string[];
  isActive: boolean;
};

const PRESET_PROFILES = [
  { name: "🏢 Office", ssid: "", blockedDomains: ["reddit.com", "twitter.com", "instagram.com", "youtube.com"], whitelist: [] },
  { name: "🏠 Home", ssid: "", blockedDomains: ["twitter.com", "tiktok.com"], whitelist: ["youtube.com"] },
  { name: "☕ Cafe", ssid: "", blockedDomains: ["reddit.com", "twitter.com", "instagram.com", "tiktok.com", "youtube.com", "netflix.com"], whitelist: [] },
];

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", ssid: "", blockedDomains: "", whitelist: "" });
  const [saving, setSaving] = useState(false);
  const [flipCard, setFlipCard] = useState<string | null>(null);
  const { toast } = useToast();

  const headers = () => {
    const token = getToken();
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const load = () => {
    fetch("/api/profiles", { headers: headers() })
      .then(r => r.ok ? r.json() : { profiles: [] })
      .then((d: { profiles?: Profile[] }) => { setProfiles(d.profiles ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activate = async (id: string, name: string) => {
    setActivating(id);
    await fetch(`/api/profiles/${id}/activate`, { method: "POST", headers: headers() });
    setFlipCard(id);
    setTimeout(() => setFlipCard(null), 2500);
    setProfiles(ps => ps.map(p => ({ ...p, isActive: p.id === id })));
    setActivating(null);
    toast(`Profile Activated: ${name} 🔒`, "success");
  };

  const remove = async (id: string) => {
    await fetch(`/api/profiles/${id}`, { method: "DELETE", headers: headers() });
    setProfiles(ps => ps.filter(p => p.id !== id));
  };

  const createPreset = async (preset: typeof PRESET_PROFILES[0]) => {
    const r = await fetch("/api/profiles", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: preset.name, ssid: preset.ssid, blockedDomains: preset.blockedDomains, whitelist: preset.whitelist }),
    });
    const d = await r.json() as { profile?: Profile };
    if (d.profile) setProfiles(ps => [...ps, d.profile!]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const r = await fetch("/api/profiles", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: form.name,
        ssid: form.ssid || null,
        blockedDomains: form.blockedDomains.split(",").map(s => s.trim()).filter(Boolean),
        whitelist: form.whitelist.split(",").map(s => s.trim()).filter(Boolean),
      }),
    });
    const d = await r.json() as { profile?: Profile };
    if (d.profile) { setProfiles(ps => [...ps, d.profile!]); setShowForm(false); setForm({ name: "", ssid: "", blockedDomains: "", whitelist: "" }); }
    setSaving(false);
  };

  const activeProfile = profiles.find(p => p.isActive);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <PageTransition>
          <header className="mb-8 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#4B5563]">Focus Profiles</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#E2E8F0] sm:text-3xl">
                <Shield size={22} className="text-[#A78BFA]" /> Network Profiles
              </h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Plus size={14} /> New
            </button>
          </header>

          {activeProfile && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)] px-4 py-3">
              <Shield size={16} className="text-[#A78BFA]" />
              <div>
                <p className="text-xs text-[#4B5563]">Active profile</p>
                <p className="text-sm font-semibold text-[#E2E8F0]">{activeProfile.name}</p>
              </div>
              {activeProfile.blockedDomains.length > 0 && (
                <span className="ml-auto text-xs text-[#A78BFA]">{activeProfile.blockedDomains.length} blocks</span>
              )}
            </div>
          )}

          {profiles.length === 0 && !loading && (
            <div className="mb-6 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6">
              <p className="mb-4 text-sm text-[#4B5563]">No profiles yet. Start with a preset:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_PROFILES.map(p => (
                  <button key={p.name} onClick={() => void createPreset(p)}
                    className="rounded-xl border border-[rgba(124,58,237,0.2)] px-3 py-2 text-sm text-[#94A3B8] transition hover:border-[rgba(124,58,237,0.5)] hover:text-[#E2E8F0]"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {profiles.map(profile => (
                <motion.div key={profile.id} layout
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all ${
                    profile.isActive
                      ? "border-[rgba(124,58,237,0.5)] bg-[rgba(124,58,237,0.08)] shadow-[0_0_20px_rgba(124,58,237,0.15)]"
                      : "border-[var(--forge-border)] bg-[var(--card)]"
                  }`}
                >
                  <AnimatePresence>
                    {flipCard === profile.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[rgba(124,58,237,0.92)] backdrop-blur-xl"
                      >
                        <Shield size={28} className="text-white" />
                        <p className="text-sm font-bold text-white">Profile Activated</p>
                        <p className="text-base font-semibold text-purple-200">{profile.name} 🔒</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#E2E8F0]">{profile.name}</h3>
                      <div className="flex items-center gap-2">
                        {profile.isActive && (
                          <span className="rounded-full bg-[rgba(124,58,237,0.2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#A78BFA]">Active</span>
                        )}
                        <button onClick={() => void remove(profile.id)} className="text-[#4B5563] hover:text-[#F87171] transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {profile.ssid && (
                      <div className="mb-2 flex items-center gap-1.5 text-xs text-[#4B5563]">
                        <Wifi size={11} /> <span>{profile.ssid}</span>
                      </div>
                    )}

                    {profile.blockedDomains.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1">
                        {profile.blockedDomains.slice(0, 4).map(d => (
                          <span key={d} className="rounded-md bg-[rgba(239,68,68,0.1)] px-1.5 py-0.5 text-[9px] text-red-400">{d}</span>
                        ))}
                        {profile.blockedDomains.length > 4 && (
                          <span className="text-[9px] text-[#4B5563]">+{profile.blockedDomains.length - 4} more</span>
                        )}
                      </div>
                    )}

                    {!profile.isActive && (
                      <button
                        disabled={activating === profile.id}
                        onClick={() => void activate(profile.id, profile.name)}
                        className="w-full rounded-xl border border-[rgba(124,58,237,0.25)] py-2 text-xs font-semibold text-[#A78BFA] transition hover:bg-[rgba(124,58,237,0.12)] disabled:opacity-50"
                      >
                        {activating === profile.id ? "Activating…" : "Activate"}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 16 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-sm rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[rgba(8,12,28,0.98)] p-6 shadow-2xl"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#E2E8F0]">New Profile</h3>
                    <button onClick={() => setShowForm(false)} className="text-[#4B5563] hover:text-[#94A3B8]"><X size={16} /></button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: "name", label: "Profile name", placeholder: "e.g. Office" },
                      { key: "ssid", label: "Wi-Fi SSID (optional)", placeholder: "e.g. OfficeWiFi" },
                      { key: "blockedDomains", label: "Blocked domains (comma-separated)", placeholder: "reddit.com, twitter.com" },
                      { key: "whitelist", label: "Whitelist exceptions (comma-separated)", placeholder: "github.com" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="mb-1 block text-xs text-[#4B5563]">{f.label}</label>
                        <input
                          value={form[f.key as keyof typeof form]}
                          onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] px-3 py-2 text-sm text-[#E2E8F0] placeholder-[#4B5563] focus:border-[#7C3AED] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving || !form.name.trim()}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Create profile"}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </PageTransition>
      </main>
    </div>
  );
}
