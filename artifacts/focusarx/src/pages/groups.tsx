import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Users, Plus, Globe, Lock, Trophy, ArrowRight, X, Crown, Shield, Hash, Video, Zap, ChevronRight, Radio } from "lucide-react";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const txt = await res.text(); throw new Error(txt); }
  return res.json();
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown size={11} className="text-[var(--palette-amber-400)]" />,
  admin: <Shield size={11} className="text-[var(--palette-blue-400)]" />,
  moderator: <Shield size={11} className="text-[var(--palette-emerald-400)]" />,
  member: null,
};

function GroupCard({ group, onJoin, isMember }: { group: any; onJoin: (id: string) => void; isMember?: boolean }) {
  const level = Math.floor((group.groupXp ?? 0) / 2000) + 1;
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 hover:border-[var(--brand-600)]/40 transition-all">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{group.avatarEmoji || "🎯"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[var(--foreground)] truncate">{group.name}</p>
            {group.isPublic ? <Globe size={11} className="text-[var(--foreground-subtle)] shrink-0" /> : <Lock size={11} className="text-[var(--foreground-subtle)] shrink-0" />}
          </div>
          {group.description && <p className="text-xs text-[var(--foreground-subtle)] mt-0.5 line-clamp-2">{group.description}</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-[var(--foreground-subtle)]"><Users size={10} className="inline mr-1" />{group.memberCount ?? 0}/{group.maxMembers}</span>
            <span className="text-xs text-[var(--foreground-subtle)]">⚡ Level {level}</span>
            <span className="text-xs text-[var(--foreground-subtle)]">{(group.groupXp ?? 0).toLocaleString()} XP</span>
          </div>
          {(group.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {group.tags.slice(0, 3).map((t: string) => <span key={t} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] text-[var(--foreground-subtle)]">{t}</span>)}
            </div>
          )}
        </div>
        {!isMember && (
          <button onClick={() => onJoin(group.id)} className="shrink-0 rounded-xl bg-[var(--brand-600)]/20 border border-[var(--brand-600)]/30 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)] hover:bg-[var(--brand-600)]/30 transition-colors flex items-center gap-1">
            Join <ArrowRight size={11} />
          </button>
        )}
        {isMember && <span className="shrink-0 text-[10px] font-semibold text-[var(--palette-emerald-400)] bg-[var(--palette-emerald-500)]/10 border border-[var(--palette-emerald-500)]/20 rounded-full px-2 py-0.5">Member</span>}
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [form, setForm] = useState({ name: "", description: "", avatarEmoji: "🎯", isPublic: true, maxMembers: 20, tagInput: "", tags: [] as string[] });
  const emojis = ["🎯", "📚", "💻", "🧠", "🏆", "🚀", "⚡", "🎮", "🔬", "🎨"];
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Create Study Group</h2>
          <button onClick={onClose} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Avatar</label>
            <div className="flex gap-2 flex-wrap">{emojis.map(e => <button key={e} onClick={() => setForm(f => ({ ...f, avatarEmoji: e }))} className={`text-2xl rounded-lg p-1.5 transition-all ${form.avatarEmoji === e ? "bg-[var(--brand-600)]/30 ring-1 ring-[var(--brand-600)]" : "hover:bg-[var(--rgba-255-255-255-0_06)]"}`}>{e}</button>)}</div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Study group name…" className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-600)]" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's this group about?" rows={2} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-600)] resize-none" />
          </div>
          {/*
            Real radio inputs. The previous version used two plain divs with an
            onClick: unreachable by keyboard, and a screen reader announced the
            option text with no hint that it was selectable or which was chosen.
          */}
          <fieldset className="flex gap-4">
            <legend className="sr-only">Group visibility</legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="group-visibility"
                className="peer sr-only"
                checked={form.isPublic}
                onChange={() => setForm(f => ({ ...f, isPublic: true }))}
              />
              <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface-1)] ${form.isPublic ? "border-[var(--brand-600)] bg-[var(--brand-600)]" : "border-[var(--palette-2a2d3a)]"}`} />
              <span className="text-sm text-[var(--foreground)]">Public</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="group-visibility"
                className="peer sr-only"
                checked={!form.isPublic}
                onChange={() => setForm(f => ({ ...f, isPublic: false }))}
              />
              <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--surface-1)] ${!form.isPublic ? "border-[var(--brand-600)] bg-[var(--brand-600)]" : "border-[var(--palette-2a2d3a)]"}`} />
              <span className="text-sm text-[var(--foreground)]">Private (invite only)</span>
            </label>
          </fieldset>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">Cancel</button>
            <button onClick={() => { if (form.name.trim()) onCreate(form); }} disabled={!form.name.trim()} className="flex-1 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-[var(--palette-white)] disabled:opacity-50 hover:bg-[var(--palette-6d31d4)]">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session } = useAuth();
  const [tab, setTab] = useState<"discover" | "mine" | "rooms">("discover");
  const [showCreate, setShowCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [search, setSearch] = useState("");

  const { data: allGroups = [], isLoading } = useQuery({ queryKey: ["groups-all"], queryFn: () => apiFetch("/api/groups"), staleTime: 30_000 });
  const { data: myGroups = [] } = useQuery({ queryKey: ["groups-mine"], queryFn: () => apiFetch("/api/groups/mine"), staleTime: 30_000 });
  const { data: studyRooms = [], isLoading: roomsLoading, refetch: refetchRooms } = useQuery({ queryKey: ["study-rooms"], queryFn: () => apiFetch("/api/study-rooms"), staleTime: 15_000, enabled: tab === "rooms" });
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const joinGroup = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/groups/${id}/join`, { method: "POST" }),
    onSuccess: () => { toast("Joined group!", "success"); qc.invalidateQueries({ queryKey: ["groups-all"] }); qc.invalidateQueries({ queryKey: ["groups-mine"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const joinInvite = useMutation({
    mutationFn: () => apiFetch("/api/groups/join-invite", { method: "POST", body: JSON.stringify({ inviteCode }) }),
    onSuccess: () => { toast("Joined group!", "success"); setInviteCode(""); qc.invalidateQueries({ queryKey: ["groups-mine"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const createGroup = useMutation({
    mutationFn: (data: any) => apiFetch("/api/groups", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast("Group created!", "success"); setShowCreate(false); qc.invalidateQueries({ queryKey: ["groups-mine"] }); qc.invalidateQueries({ queryKey: ["groups-all"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const createRoom = useMutation({
    mutationFn: (data: any) => apiFetch("/api/study-rooms", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast("Study room created! 🚀", "success"); qc.invalidateQueries({ queryKey: ["study-rooms"] }); setShowCreateRoom(false); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const joinRoom = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/study-rooms/${id}/join`, { method: "POST" }),
    onSuccess: () => { toast("Joined room!", "success"); qc.invalidateQueries({ queryKey: ["study-rooms"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const joinRoomByCode = useMutation({
    mutationFn: () => apiFetch("/api/study-rooms/join-code", { method: "POST", body: JSON.stringify({ inviteCode: joinCode }) }),
    onSuccess: () => { toast("Joined room!", "success"); setJoinCode(""); qc.invalidateQueries({ queryKey: ["study-rooms"] }); },
    onError: (e: any) => toast(e.message, "error"),
  });

  const leaveRoom = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/study-rooms/${id}/leave`, { method: "DELETE" }),
    onSuccess: () => { toast("Left room", "success"); qc.invalidateQueries({ queryKey: ["study-rooms"] }); },
  });

  const myGroupIds = new Set(myGroups.map((g: any) => g.id));
  const filtered = allGroups.filter((g: any) => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)] p-4 sm:p-6 max-w-3xl mx-auto">
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={d => createGroup.mutate(d)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Study Groups</h1>
          <p className="text-sm text-[var(--foreground-subtle)] mt-1">Team up, compete, and level up together</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)] transition-colors">
          <Plus size={15} /> Create
        </button>
      </div>

      {/* Join by invite code */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)] mb-2">Join by Invite Code</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Enter 6-digit code…" maxLength={6} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--muted)] pl-8 pr-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--palette-3a3d4a)] outline-none focus:border-[var(--brand-600)] uppercase tracking-widest" />
          </div>
          <button onClick={() => joinInvite.mutate()} disabled={inviteCode.length !== 6 || joinInvite.isPending} className="rounded-xl bg-[var(--brand-600)]/20 border border-[var(--brand-600)]/30 px-4 py-2 text-sm font-semibold text-[var(--brand-400)] disabled:opacity-50 hover:bg-[var(--brand-600)]/30">
            {joinInvite.isPending ? "…" : "Join"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[var(--surface-hover)] rounded-xl border border-[var(--border-subtle)] p-1">
        <button onClick={() => setTab("discover")} className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${tab === "discover" ? "bg-[var(--brand-600)] text-[var(--palette-white)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"}`}>
          <Globe size={12} className="inline mr-1.5" />Discover
        </button>
        <button onClick={() => setTab("mine")} className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${tab === "mine" ? "bg-[var(--brand-600)] text-[var(--palette-white)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"}`}>
          <Users size={12} className="inline mr-1.5" />My Groups {myGroups.length > 0 && `(${myGroups.length})`}
        </button>
        <button onClick={() => setTab("rooms")} className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${tab === "rooms" ? "bg-[var(--brand-600)] text-[var(--palette-white)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"}`}>
          <Radio size={12} className="inline mr-1.5" />Study Rooms
        </button>
      </div>

      {tab === "discover" && (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…" className="w-full mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--palette-3a3d4a)] outline-none focus:border-[var(--brand-600)]" />
          {isLoading ? <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--brand-600)]" /></div> : (
            <div className="space-y-3">
              {filtered.length === 0 && <div className="text-center py-12 text-[var(--foreground-subtle)]"><Users size={40} className="mx-auto mb-3 opacity-30" /><p>No groups found</p></div>}
              {filtered.map((g: any) => <GroupCard key={g.id} group={g} onJoin={(id) => joinGroup.mutate(id)} isMember={myGroupIds.has(g.id)} />)}
            </div>
          )}
        </div>
      )}

      {tab === "mine" && (
        <div className="space-y-3">
          {myGroups.length === 0 && <div className="text-center py-12 text-[var(--foreground-subtle)]"><Users size={40} className="mx-auto mb-3 opacity-30" /><p>You haven't joined any groups yet</p><button onClick={() => setTab("discover")} className="mt-3 text-xs text-[var(--brand-600)] hover:underline">Discover groups →</button></div>}
          {myGroups.map((g: any) => (
            <div key={g.id} className="rounded-2xl border border-[var(--brand-600)]/30 bg-[var(--surface-hover)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{g.avatarEmoji}</span>
                <div className="flex-1"><p className="font-bold text-[var(--foreground)]">{g.name}</p><p className="text-xs text-[var(--foreground-subtle)]">{g.memberCount} members · {g.groupXp?.toLocaleString() ?? 0} XP</p></div>
                {g.inviteCode && <div className="text-right"><p className="text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wider mb-0.5">Invite</p><p className="text-sm font-bold text-[var(--brand-600)] font-mono tracking-widest">{g.inviteCode}</p></div>}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {(g.members ?? []).slice(0, 5).map((m: any) => (
                  <div key={m.userId} className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1">{ROLE_ICONS[m.role]}</span>
                    <span className="text-[var(--foreground-subtle)] flex-1 truncate">{m.name}</span>
                    <span className="text-[var(--foreground-subtle)]">{m.xpContribution?.toLocaleString() ?? 0} XP</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "rooms" && (
        <div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Join by code…" maxLength={6}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] pl-8 pr-3 py-2 text-sm text-[var(--foreground)] uppercase tracking-widest outline-none focus:border-[var(--brand-600)]" />
            </div>
            <button onClick={() => joinRoomByCode.mutate()} disabled={joinCode.length < 4 || joinRoomByCode.isPending}
              className="rounded-xl bg-[var(--brand-600)]/20 border border-[var(--brand-600)]/30 px-3 py-2 text-sm text-[var(--brand-400)] disabled:opacity-50 hover:bg-[var(--brand-600)]/30 font-semibold">
              Join
            </button>
            <button onClick={() => createRoom.mutate({ name: "Quick Study Room", mode: "silent", isPublic: true })}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3 py-2 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)]">
              <Plus size={14} /> Create
            </button>
          </div>

          {roomsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />)}</div>
          ) : (studyRooms as any[]).length === 0 ? (
            <div className="text-center py-16">
              <Radio size={40} className="mx-auto mb-4 text-[var(--brand-600)] opacity-30" />
              <p className="text-lg font-semibold text-[var(--foreground)] mb-2">No active rooms</p>
              <p className="text-sm text-[var(--foreground-subtle)] mb-5">Start a study room and invite others to join</p>
              <button onClick={() => createRoom.mutate({ name: "My Study Room", mode: "silent", isPublic: true })}
                className="rounded-xl bg-[var(--brand-600)] px-5 py-2 text-sm font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)]">
                Create a Room
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(studyRooms as any[]).map((r: any) => (
                <div key={r.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 hover:border-[var(--brand-600)]/30 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[var(--foreground)]">{r.name}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-[var(--palette-emerald-500)]/10 text-[var(--palette-emerald-400)] border border-[var(--palette-emerald-500)]/20 rounded-full px-2 py-0.5">LIVE</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-[var(--foreground-subtle)] capitalize">{r.mode?.replace("_", " ")}</span>
                        <span className="text-xs text-[var(--foreground-subtle)]">👤 {r.participantCount}/{r.maxParticipants}</span>
                        <span className="text-xs text-[var(--foreground-subtle)]">by {r.hostName}</span>
                      </div>
                    </div>
                    <button onClick={() => joinRoom.mutate(r.id)} disabled={joinRoom.isPending}
                      className="shrink-0 rounded-xl bg-[var(--brand-600)] px-3 py-1.5 text-xs font-semibold text-[var(--palette-white)] hover:bg-[var(--palette-6d31d4)] disabled:opacity-50">
                      Join
                    </button>
                  </div>
                  {r.participants?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {r.participants.slice(0, 8).map((p: any) => (
                        <div key={p.userId} className="text-[10px] bg-[var(--muted)] text-[var(--foreground-subtle)] border border-[var(--border-subtle)] rounded-lg px-1.5 py-0.5 flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-[var(--palette-emerald-400)]" />
                          {p.name}
                        </div>
                      ))}
                      {r.participants.length > 8 && <span className="text-[10px] text-[var(--foreground-subtle)]">+{r.participants.length - 8} more</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
