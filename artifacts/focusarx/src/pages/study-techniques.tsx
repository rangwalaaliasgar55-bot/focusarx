import { Link } from "wouter";
import { ArrowRight, BookOpen, Repeat, Layers, PenTool, Eye, Cpu } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

type Technique = {
  icon: React.ComponentType<any>;
  name: string;
  tagline: string;
  when: string;
  how: string;
  color: string;
};

const TECHNIQUES: Technique[] = [
  {
    icon: Repeat,
    name: "Spaced Repetition",
    tagline: "The single most effective learning technique known to science",
    when: "Memorizing facts, vocabulary, formulas, historical dates, anatomy",
    how: "Review material at increasing intervals: 1 day → 3 days → 7 days → 14 days → 30 days. Each review just before forgetting cements it deeply. Use Anki or FocusArx task tagging to schedule reviews.",
    color: "#7C3AED",
  },
  {
    icon: PenTool,
    name: "Active Recall",
    tagline: "Retrieval practice beats re-reading by 2–3×",
    when: "Any subject — especially effective right after learning new material",
    how: "Close your notes and write, speak, or draw everything you remember. Check accuracy. Repeat. The effort of retrieval — not re-reading — is what builds memory. Use the 'blank page' method: one topic, blank sheet, dump everything.",
    color: "#f59e0b",
  },
  {
    icon: Layers,
    name: "Feynman Technique",
    tagline: "If you can't explain it simply, you don't understand it",
    when: "Complex concepts — physics, algorithms, economics, philosophy",
    how: "Pick a concept. Explain it to a 12-year-old in plain language. Find the gaps where you stumble. Go back to the source material. Simplify further. Repeat until the explanation is clean and complete.",
    color: "#22d387",
  },
  {
    icon: Eye,
    name: "Mind Mapping",
    tagline: "Visual thinking for connected, non-linear knowledge",
    when: "Summarizing chapters, brainstorming essay structure, understanding systems",
    how: "Start with a central concept. Branch out into main ideas. Branch those into sub-ideas. Use colour and images. The act of creating the map forces you to organize relationships — the map itself is secondary.",
    color: "#60a5fa",
  },
  {
    icon: BookOpen,
    name: "SQ3R Reading",
    tagline: "Active reading that triples retention over passive skimming",
    when: "Dense textbooks, academic papers, long articles",
    how: "Survey (skim headings and summary), Question (turn headings into questions), Read (actively find answers), Recite (close the book, summarise), Review (check notes against text). Each step takes less than 3 minutes per chapter section.",
    color: "#f87171",
  },
  {
    icon: Cpu,
    name: "Interleaving",
    tagline: "Mixing topics feels harder but builds deeper mastery",
    when: "Math, science problem sets, language learning",
    how: "Instead of practising 30 calculus problems in a row, alternate: 10 calculus → 10 statistics → 10 algebra → back to calculus. Performance on practice drops, but long-term retention and transfer to new problems dramatically improves.",
    color: "#a78bfa",
  },
];

export default function StudyTechniquesPage() {
  return (
    <div className="min-h-screen bg-[rgba(255,255,255,0.02)] text-[#E2E8F0]">
      <PageSEO {...PAGE_SEO.studyTechniques} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(34,211,135,0.12),_transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 mb-6">
            <BookOpen size={12} /> Evidence-Based Learning
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-[#E2E8F0] mb-4 leading-tight">
            Study Smarter,<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Not Harder</span>
          </h1>
          <p className="text-lg text-[#6b7280] max-w-xl mx-auto mb-8">
            Six science-backed study techniques used by medical students, competitive programmers, and top exam scorers — with a practical how-to for each.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Track Your Study Sessions Free <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Techniques */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-6">
        <h2 className="text-xl font-black text-[#E2E8F0] mb-2">The 6 Techniques</h2>
        <p className="text-[#6b7280] text-sm mb-8">Ranked roughly by evidence strength. Spaced repetition and active recall consistently outperform all other methods in randomized controlled studies.</p>
        {TECHNIQUES.map((t, i) => (
          <div key={t.name} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-6 hover:border-[#7C3AED]/30 transition-colors">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${t.color}18`, border: `1px solid ${t.color}30` }}>
                <t.icon size={18} style={{ color: t.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#4B5563]">#{i + 1}</span>
                  <h3 className="font-black text-[#E2E8F0] text-lg">{t.name}</h3>
                </div>
                <p className="text-sm italic text-[#6b7280] mb-4">{t.tagline}</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#4B5563] mb-1">Best for</p>
                    <p className="text-sm text-[#8b8fa8]">{t.when}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#4B5563] mb-1">How to do it</p>
                    <p className="text-sm text-[#8b8fa8] leading-relaxed">{t.how}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-teal-500/5 p-10 text-center">
          <BookOpen size={32} className="text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-[#E2E8F0] mb-3">Put these techniques into practice</h2>
          <p className="text-[#6b7280] mb-6 max-w-md mx-auto text-sm">FocusArx helps you schedule sessions, track focus quality with AI, and stay accountable with friends — all free.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
              Start Free <ArrowRight size={15} />
            </Link>
            <Link href="/pomodoro-guide" className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] px-6 py-3 text-sm font-medium text-[#a78bfa] hover:border-[#7C3AED]/40 transition-colors">
              Pomodoro Technique →
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.06)] py-6 text-center space-x-4 text-xs text-[#374151]">
        <Link href="/" className="hover:text-[#7C3AED]">Home</Link>
        <Link href="/focus-guide" className="hover:text-[#7C3AED]">Focus Guide</Link>
        <Link href="/pomodoro-guide" className="hover:text-[#7C3AED]">Pomodoro Guide</Link>
        <Link href="/leaderboard" className="hover:text-[#7C3AED]">Leaderboard</Link>
        <Link href="/study-rooms" className="hover:text-[#7C3AED]">Study Rooms</Link>
      </div>
    </div>
  );
}
