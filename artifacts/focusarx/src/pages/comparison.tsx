import { Check, Minus } from "lucide-react";
import { useLocation } from "wouter";
import { PageSEO } from "@/components/PageSEO";

const comparisons = {
  forest: { name: "Forest", title: "FocusArx vs Forest", description: "Compare FocusArx with Forest for deep work, study planning, analytics, and accountability.", rows: [["Focus timer", true, true], ["Tasks and goals", true, false], ["AI roadmap and coach", true, false], ["Session replay", true, false], ["Flashcards", true, false], ["Social study rooms", true, false], ["Virtual tree planting", false, true]] },
  "focus-to-do": { name: "Focus To-Do", title: "FocusArx vs Focus To-Do", description: "Compare FocusArx and Focus To-Do for planning, Pomodoro sessions, learning tools, and progress intelligence.", rows: [["Pomodoro timer", true, true], ["Task management", true, true], ["AI learning roadmap", true, false], ["On-device attention option", true, false], ["Session replay", true, false], ["Spaced-repetition flashcards", true, false], ["Traditional project lists", true, true]] },
} as const;

export default function ComparisonPage() {
  const [location] = useLocation();
  const key = location.includes("focus-todo") ? "focus-to-do" : "forest";
  const data = comparisons[key];
  return <main className="mx-auto max-w-4xl px-4 py-12"><PageSEO title={`${data.title} — Honest Productivity App Comparison`} description={data.description} />
    <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-400)]">Product comparison</p><h1 className="mt-2 text-4xl font-black">{data.title}</h1><p className="mt-4 max-w-2xl text-[var(--foreground-muted)]">{data.description} Choose based on the workflow you actually need; both products can be useful for different people.</p>
    <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--border)]"><div className="grid grid-cols-[1fr_7rem_7rem] bg-[var(--surface-raised)] p-4 text-sm font-bold"><span>Capability</span><span>FocusArx</span><span>{data.name}</span></div>{data.rows.map(([label, ours, theirs]) => <div key={label} className="grid min-h-14 grid-cols-[1fr_7rem_7rem] items-center border-t border-[var(--border)] px-4 text-sm"><span>{label}</span><span>{ours ? <Check className="text-[var(--success)]" /> : <Minus />}</span><span>{theirs ? <Check className="text-[var(--success)]" /> : <Minus />}</span></div>)}</div>
    <nav aria-label="Related learning guides" className="mt-8 flex flex-wrap gap-3 text-sm"><a className="text-[var(--brand-400)]" href="/focus-guide">Focus guide</a><a className="text-[var(--brand-400)]" href="/pomodoro-guide">Pomodoro guide</a><a className="text-[var(--brand-400)]" href="/study-techniques">Study techniques</a><a className="text-[var(--brand-400)]" href="/science-of-deep-work">Science of deep work</a></nav>
    <section className="mt-10 rounded-2xl bg-[var(--brand-soft)] p-6"><h2 className="text-xl font-bold">When FocusArx is the better fit</h2><p className="mt-2 text-sm text-[var(--foreground-muted)]">Choose FocusArx when you want one system connecting focused time, tasks, learning roadmaps, flashcards, analytics, session reflection, and optional social accountability.</p><a href="/signup" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-600)] px-5 font-semibold text-white">Try FocusArx free</a></section>
  </main>;
}
