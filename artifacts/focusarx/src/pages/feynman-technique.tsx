import { Link } from "wouter";
import { ArrowRight, Brain, Clock, Zap, CheckCircle, GraduationCap, MessageSquare } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";

export default function FeynmanTechniquePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO
        title="The Feynman Technique | Master Any Subject Faster | FocusArx"
        description="Learn the Feynman Technique — the ultimate method for rapid learning. 4 simple steps to understand complex topics by teaching them to others."
        canonical="/feynman-technique"
        keywords="feynman technique, rapid learning, study methods, richard feynman, how to learn anything"
      />

      <div className="max-w-4xl mx-auto px-6 py-24">
        <header className="text-center mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--palette-emerald-300)] mb-8">
            <GraduationCap size={12} /> Study Methodology
          </div>
          <h1 className="text-4xl sm:text-7xl font-black tracking-tight mb-6">
            The Feynman <br /><span className="text-[var(--palette-emerald-400)]">Technique</span>
          </h1>
          <p className="text-lg text-[var(--foreground-muted)] max-w-2xl mx-auto">
            "If you can't explain it simply, you don't understand it well enough." — Richard Feynman.
          </p>
        </header>

        <div className="grid gap-12 lg:grid-cols-2 mb-24">
           <div className="relative aspect-video rounded-3xl overflow-hidden border border-[var(--palette-white)]/5 bg-[var(--palette-zinc-900)] shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1454165833767-027ffea9e61b?auto=format&fit=crop&q=80&w=1200"
                alt="Studying the Feynman Technique"
                className="object-cover w-full h-full opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] to-transparent" />
           </div>
           <div className="flex flex-col justify-center">
              <h2 className="text-3xl font-bold mb-4">Why it Works</h2>
              <p className="text-[var(--foreground-muted)] leading-relaxed">
                The Feynman Technique is a mental model designed to help you learn a concept by explaining it in plain language. It forces you to identify gaps in your knowledge and simplifies complex ideas into intuitive mental frameworks.
              </p>
           </div>
        </div>

        <div className="space-y-24">
          {[
            { step: "01", title: "Pick a Concept", desc: "Write the name of a concept you want to learn at the top of a blank sheet of paper. Be specific.", icon: <Zap /> },
            { step: "02", title: "Teach a Child", desc: "Explain the concept in simple terms, avoiding jargon. Use language that a 12-year-old would understand.", icon: <MessageSquare /> },
            { step: "03", title: "Identify Gaps", desc: "When you get stuck or find yourself using technical terms to hide complexity, go back to the source material to refine your understanding.", icon: <Brain /> },
            { step: "04", title: "Simplify & Analogize", desc: "Create simple analogies to bridge the gap between complex ideas and common knowledge. Tell a story.", icon: <Clock /> },
          ].map((s, i) => (
            <div key={i} className="flex gap-8 items-start">
               <div className="text-6xl font-black text-[var(--palette-white)]/[0.05] select-none shrink-0">{s.step}</div>
               <div className="pt-2">
                 <h3 className="text-2xl font-bold mb-4 text-[var(--palette-white)]">{s.title}</h3>
                 <p className="text-[var(--foreground-muted)] leading-relaxed text-lg">{s.desc}</p>
               </div>
            </div>
          ))}
        </div>

        <div className="mt-32 rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-12 text-center relative overflow-hidden group">
           <div className="absolute inset-0 bg-gradient-to-br from-[var(--palette-emerald-500)]/10 to-[var(--palette-blue-500)]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="relative z-[var(--z-content)]">
              <h2 className="text-3xl font-black mb-6">Master it with FocusArx</h2>
              <p className="text-[var(--muted-fg)] mb-10 max-w-lg mx-auto">Use our "Explain" mode to practice the Feynman Technique while your AI coach monitors your clarity and identifies logical leaps.</p>
              <Link href="/signup">
                <button className="h-14 px-10 rounded-2xl bg-[var(--palette-white)] text-[var(--palette-black)] font-black hover:bg-[var(--palette-zinc-200)] transition-all shadow-xl">
                  Start Learning Now
                </button>
              </Link>
           </div>
        </div>
      </div>
    </div>
  );
}
