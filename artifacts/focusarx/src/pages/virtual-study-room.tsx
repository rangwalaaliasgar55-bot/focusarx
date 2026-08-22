import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Radio, Users, Globe, Clock, Zap } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

async function fetchPublicRooms() {
  const res = await fetch("/api/study-rooms");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const FEATURED_CATEGORIES = [
  { emoji: "📐", name: "JEE / Engineering", desc: "Mathematics, Physics, Chemistry — IIT-JEE prep", tag: "jee", color: "var(--color-warning)" },
  { emoji: "🩺", name: "NEET / Medical", desc: "Biology, Organic Chemistry — NEET aspirants", tag: "neet", color: "var(--palette-f87171)" },
  { emoji: "⚖️", name: "UPSC / Civil Services", desc: "General Studies, Current Affairs, Essay", tag: "upsc", color: "var(--info)" },
  { emoji: "💻", name: "Coding & CS", desc: "DSA, Web Dev, Competitive Programming", tag: "coding", color: "var(--brand-400)" },
  { emoji: "📚", name: "General Study", desc: "All subjects — open for everyone", tag: "general", color: "var(--palette-22d387)" },
  { emoji: "🌐", name: "Language Learning", desc: "English, Spanish, French, Japanese", tag: "language", color: "var(--palette-fb923c)" },
];

export default function VirtualStudyRoomPage() {
  const { data: rooms = [] } = useQuery({
    queryKey: ["public-rooms-landing"],
    queryFn: fetchPublicRooms,
    staleTime: 60_000,
  });

  const totalStudying = rooms.reduce((acc: number, r: any) => acc + (r.participantCount ?? r.activeCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.virtualStudyRoom} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[var(--rgba-255-255-255-0_06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_var(--rgba-124-58-237-0_15),_transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--palette-emerald-400)] mb-6 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-[var(--palette-emerald-400)]" />
            {totalStudying > 0 ? `${totalStudying} people studying now` : "Open study rooms"}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[var(--foreground)] mb-4 leading-tight">
            Virtual Study Rooms<br />
            <span className="bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] bg-clip-text text-transparent">Study Together, Online</span>
          </h1>
          <p className="text-lg text-[var(--palette-6b7280)] max-w-xl mx-auto mb-8">
            Join a live study room, see who's studying right now, and stay accountable. Free to browse — sign up to join and chat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/study-rooms" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-6 py-3 text-sm font-bold text-[var(--palette-white)] hover:opacity-90 transition-opacity">
              <Radio size={15} /> Browse Live Rooms
            </Link>
            <Link href="/register" className="flex items-center gap-2 rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] px-6 py-3 text-sm font-medium text-[var(--brand-400)] hover:border-[var(--brand-600)]/40 transition-colors">
              <Users size={14} /> Create Free Account
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-[var(--rgba-255-255-255-0_06)] bg-[var(--palette-0d0f16)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-8 flex-wrap">
          {[
            { icon: Radio, label: `${rooms.length || "—"} live rooms`, color: "var(--brand-600)" },
            { icon: Users, label: `${totalStudying || "—"} studying now`, color: "var(--palette-22d387)" },
            { icon: Globe, label: "Public & free to browse", color: "var(--info)" },
            { icon: Clock, label: "Active 24/7", color: "var(--color-warning)" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-sm text-[var(--palette-6b7280)]">
              <Icon size={14} style={{ color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live rooms */}
      {rooms.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="text-xl font-black text-[var(--foreground)] mb-1">Live Rooms Right Now</h2>
          <p className="text-[var(--palette-6b7280)] text-sm mb-6">Click to preview — sign in to join and chat.</p>
          <div className="space-y-3">
            {rooms.slice(0, 6).map((room: any) => (
              <Link key={room.id} href="/study-rooms" className="flex items-center gap-4 rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4 hover:border-[var(--brand-600)]/40 transition-colors group">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-[var(--brand-600)]/10 border border-[var(--brand-600)]/20 flex items-center justify-center">
                  <Radio size={16} className="text-[var(--brand-400)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--foreground)] truncate">{room.name}</p>
                  {room.description && <p className="text-xs text-[var(--palette-6b7280)] truncate">{room.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--palette-emerald-400)] shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--palette-emerald-400)] animate-pulse" />
                  {room.participantCount ?? room.activeCount ?? 0} online
                </div>
                <ArrowRight size={14} className="text-[var(--foreground-subtle)] group-hover:text-[var(--brand-400)] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
          {rooms.length > 6 && (
            <Link href="/study-rooms" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[var(--rgba-255-255-255-0_06)] py-2.5 text-sm text-[var(--brand-400)] hover:border-[var(--brand-600)]/40 transition-colors">
              View all {rooms.length} rooms <ArrowRight size={13} />
            </Link>
          )}
        </div>
      )}

      {/* Featured categories */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 border-t border-[var(--rgba-255-255-255-0_06)]">
        <h2 className="text-xl font-black text-[var(--foreground)] mb-1">Study Room Categories</h2>
        <p className="text-[var(--palette-6b7280)] text-sm mb-6">Browse by subject or create your own themed room in seconds.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURED_CATEGORIES.map(cat => (
            <Link key={cat.tag} href="/study-rooms" className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5 hover:border-[var(--brand-600)]/40 transition-colors group">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{cat.emoji}</span>
                <div>
                  <p className="font-bold text-[var(--foreground)] group-hover:text-[var(--brand-400)] transition-colors">{cat.name}</p>
                  <p className="text-sm text-[var(--palette-6b7280)] mt-0.5">{cat.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Why study together */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 border-t border-[var(--rgba-255-255-255-0_06)]">
        <h2 className="text-xl font-black text-[var(--foreground)] mb-2">Why Study with Others?</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Accountability", body: "Knowing others can see you working makes it far harder to slack. Research shows a 65% increase in goal completion with an accountability partner.", color: "var(--brand-600)" },
            { icon: Clock, title: "Longer Sessions", body: "People in virtual study rooms report 40% longer average session times compared to studying alone. The group energy is contagious.", color: "var(--color-warning)" },
            { icon: Users, title: "Instant Help", body: "Stuck on a problem? Ask in the room chat and get help from someone studying the same topic — often in under 2 minutes.", color: "var(--palette-22d387)" },
          ].map(({ icon: Icon, title, body, color }) => (
            <div key={title} className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5">
              <Icon size={18} style={{ color }} className="mb-3" />
              <p className="font-bold text-[var(--foreground)] mb-2">{title}</p>
              <p className="text-sm text-[var(--palette-6b7280)] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl border border-[var(--brand-600)]/30 bg-gradient-to-br from-[var(--brand-600)]/10 to-[var(--palette-4f46e5)]/5 p-10 text-center">
          <Radio size={32} className="text-[var(--brand-600)] mx-auto mb-4" />
          <h2 className="text-2xl font-black text-[var(--foreground)] mb-3">Ready to study smarter?</h2>
          <p className="text-[var(--palette-6b7280)] mb-6 max-w-md mx-auto text-sm">Join FocusArx free — Pomodoro timer, gamification, AI coaching, and live study rooms all in one place.</p>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] px-8 py-3 text-sm font-bold text-[var(--palette-white)] hover:opacity-90 transition-opacity">
            Join Free <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="border-t border-[var(--rgba-255-255-255-0_06)] py-6 text-center space-x-4 text-xs text-[var(--foreground-subtle)]">
        <Link href="/" className="hover:text-[var(--brand-600)]">Home</Link>
        <Link href="/study-rooms" className="hover:text-[var(--brand-600)]">Study Rooms</Link>
        <Link href="/focus-guide" className="hover:text-[var(--brand-600)]">Focus Guide</Link>
        <Link href="/pomodoro-guide" className="hover:text-[var(--brand-600)]">Pomodoro Guide</Link>
        <Link href="/leaderboard" className="hover:text-[var(--brand-600)]">Leaderboard</Link>
        <Link href="/privacy" className="hover:text-[var(--brand-600)]">Privacy</Link>
      </div>
    </div>
  );
}
