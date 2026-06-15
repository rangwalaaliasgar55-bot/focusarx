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
  { emoji: "📐", name: "JEE / Engineering", desc: "Mathematics, Physics, Chemistry — IIT-JEE prep", tag: "jee", color: "#f59e0b" },
  { emoji: "🩺", name: "NEET / Medical", desc: "Biology, Organic Chemistry — NEET aspirants", tag: "neet", color: "#f87171" },
  { emoji: "⚖️", name: "UPSC / Civil Services", desc: "General Studies, Current Affairs, Essay", tag: "upsc", color: "#60a5fa" },
  { emoji: "💻", name: "Coding & CS", desc: "DSA, Web Dev, Competitive Programming", tag: "coding", color: "#a78bfa" },
  { emoji: "📚", name: "General Study", desc: "All subjects — open for everyone", tag: "general", color: "#22d387" },
  { emoji: "🌐", name: "Language Learning", desc: "English, Spanish, French, Japanese", tag: "language", color: "#fb923c" },
];

export default function VirtualStudyRoomPage() {
  const { data: rooms = [] } = useQuery({
    queryKey: ["public-rooms-landing"],
    queryFn: fetchPublicRooms,
    staleTime: 60_000,
  });

  const totalStudying = rooms.reduce((acc: number, r: any) => acc + (r.participantCount ?? r.activeCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-[rgba(255,255,255,0.02)] text-[#E2E8F0]">
      <PageSEO {...PAGE_SEO.virtualStudyRoom} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(124,58,237,0.15),_transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 mb-6 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {totalStudying > 0 ? `${totalStudying} people studying now` : "Open study rooms"}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#E2E8F0] mb-4 leading-tight">
            Virtual Study Rooms<br />
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#a78bfa] bg-clip-text text-transparent">Study Together, Online</span>
          </h1>
          <p className="text-lg text-[#6b7280] max-w-xl mx-auto mb-8">
            Join a live study room, see who's studying right now, and stay accountable. Free to browse — sign up to join and chat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/study-rooms" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
              <Radio size={15} /> Browse Live Rooms
            </Link>
            <Link href="/register" className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-6 py-3 text-sm font-medium text-[#a78bfa] hover:border-[#7C3AED]/40 transition-colors">
              <Users size={14} /> Create Free Account
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#0d0f16]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-8 flex-wrap">
          {[
            { icon: Radio, label: `${rooms.length || "—"} live rooms`, color: "#7C3AED" },
            { icon: Users, label: `${totalStudying || "—"} studying now`, color: "#22d387" },
            { icon: Globe, label: "Public & free to browse", color: "#60a5fa" },
            { icon: Clock, label: "Active 24/7", color: "#f59e0b" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-sm text-[#6b7280]">
              <Icon size={14} style={{ color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live rooms */}
      {rooms.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="text-xl font-black text-[#E2E8F0] mb-1">Live Rooms Right Now</h2>
          <p className="text-[#6b7280] text-sm mb-6">Click to preview — sign in to join and chat.</p>
          <div className="space-y-3">
            {rooms.slice(0, 6).map((room: any) => (
              <Link key={room.id} href="/study-rooms" className="flex items-center gap-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-4 hover:border-[#7C3AED]/40 transition-colors group">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center">
                  <Radio size={16} className="text-[#a78bfa]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#E2E8F0] truncate">{room.name}</p>
                  {room.description && <p className="text-xs text-[#6b7280] truncate">{room.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {room.participantCount ?? room.activeCount ?? 0} online
                </div>
                <ArrowRight size={14} className="text-[#4B5563] group-hover:text-[#a78bfa] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
          {rooms.length > 6 && (
            <Link href="/study-rooms" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] py-2.5 text-sm text-[#a78bfa] hover:border-[#7C3AED]/40 transition-colors">
              View all {rooms.length} rooms <ArrowRight size={13} />
            </Link>
          )}
        </div>
      )}

      {/* Featured categories */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 border-t border-[rgba(255,255,255,0.06)]">
        <h2 className="text-xl font-black text-[#E2E8F0] mb-1">Study Room Categories</h2>
        <p className="text-[#6b7280] text-sm mb-6">Browse by subject or create your own themed room in seconds.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURED_CATEGORIES.map(cat => (
            <Link key={cat.tag} href="/study-rooms" className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5 hover:border-[#7C3AED]/40 transition-colors group">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{cat.emoji}</span>
                <div>
                  <p className="font-bold text-[#E2E8F0] group-hover:text-[#a78bfa] transition-colors">{cat.name}</p>
                  <p className="text-sm text-[#6b7280] mt-0.5">{cat.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Why study together */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 border-t border-[rgba(255,255,255,0.06)]">
        <h2 className="text-xl font-black text-[#E2E8F0] mb-2">Why Study with Others?</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Accountability", body: "Knowing others can see you working makes it far harder to slack. Research shows a 65% increase in goal completion with an accountability partner.", color: "#7C3AED" },
            { icon: Clock, title: "Longer Sessions", body: "People in virtual study rooms report 40% longer average session times compared to studying alone. The group energy is contagious.", color: "#f59e0b" },
            { icon: Users, title: "Instant Help", body: "Stuck on a problem? Ask in the room chat and get help from someone studying the same topic — often in under 2 minutes.", color: "#22d387" },
          ].map(({ icon: Icon, title, body, color }) => (
            <div key={title} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5">
              <Icon size={18} style={{ color }} className="mb-3" />
              <p className="font-bold text-[#E2E8F0] mb-2">{title}</p>
              <p className="text-sm text-[#6b7280] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl border border-[#7C3AED]/30 bg-gradient-to-br from-[#7C3AED]/10 to-[#4F46E5]/5 p-10 text-center">
          <Radio size={32} className="text-[#7C3AED] mx-auto mb-4" />
          <h2 className="text-2xl font-black text-[#E2E8F0] mb-3">Ready to study smarter?</h2>
          <p className="text-[#6b7280] mb-6 max-w-md mx-auto text-sm">Join FocusArx free — Pomodoro timer, gamification, AI coaching, and live study rooms all in one place.</p>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Join Free <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.06)] py-6 text-center space-x-4 text-xs text-[#374151]">
        <Link href="/" className="hover:text-[#7C3AED]">Home</Link>
        <Link href="/study-rooms" className="hover:text-[#7C3AED]">Study Rooms</Link>
        <Link href="/focus-guide" className="hover:text-[#7C3AED]">Focus Guide</Link>
        <Link href="/pomodoro-guide" className="hover:text-[#7C3AED]">Pomodoro Guide</Link>
        <Link href="/leaderboard" className="hover:text-[#7C3AED]">Leaderboard</Link>
        <Link href="/privacy" className="hover:text-[#7C3AED]">Privacy</Link>
      </div>
    </div>
  );
}
