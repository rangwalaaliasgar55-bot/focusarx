import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Target, Clock, Brain, ArrowRight } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";

export default function StudyMethodCalculator() {
  const [examDays, setExamDays] = useState(30);
  const [materialVolume, setMaterialVolume] = useState(500); // pages or topics
  const [retentionLevel, setLevel] = useState(2); // 1-3

  const hoursPerDay = Math.ceil((materialVolume * retentionLevel) / (examDays * 3));
  const recommendedMethod = hoursPerDay > 4 ? "Monastic Deep Work" : hoursPerDay > 2 ? "Flowtime" : "Classic Pomodoro";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--palette-white)] py-20 px-6">
      <PageSEO
        title="Study Method Calculator | Optimize Your Prep | FocusArx"
        description="Calculate exactly how many hours you need to study per day and get a science-backed method recommendation based on your exam deadline."
        canonical="/study-calculator"
        keywords="study calculator, exam prep calculator, how many hours to study, study method recommender"
      />

      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-16">
           <Calculator className="mx-auto mb-6 text-[var(--brand-400)]" size={48} />
           <h1 className="text-4xl font-black mb-4">Study Volume <span className="text-[var(--brand-400)]">Calculator</span></h1>
           <p className="text-[var(--foreground-muted)]">Input your constraints to find your optimal study velocity.</p>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
           <div className="space-y-6 rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-8 backdrop-blur-xl">
              <div>
                 <label className="block text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Days until Deadline</label>
                 <input
                   type="range" min="1" max="180"
                   value={examDays} onChange={(e) => setExamDays(parseInt(e.target.value))}
                   className="w-full accent-[var(--brand-400)]"
                 />
                 <div className="mt-2 flex justify-between text-sm font-bold text-[var(--palette-white)]"><span>{examDays} Days</span></div>
              </div>

              <div>
                 <label className="block text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Material Volume (Pages/Topics)</label>
                 <input
                   type="range" min="50" max="2000" step="10"
                   value={materialVolume} onChange={(e) => setMaterialVolume(parseInt(e.target.value))}
                   className="w-full accent-[var(--brand-400)]"
                 />
                 <div className="mt-2 flex justify-between text-sm font-bold text-[var(--palette-white)]"><span>~{materialVolume} units</span></div>
              </div>

              <div>
                 <label className="block text-xs font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-3">Target Retention</label>
                 <div className="flex gap-2">
                    {[1, 2, 3].map(v => (
                       <button
                         key={v}
                         onClick={() => setLevel(v)}
                         className={`flex-1 py-3 rounded-xl border transition-all text-xs font-bold ${retentionLevel === v ? "bg-[var(--brand-400)] text-[var(--palette-black)] border-[var(--brand-400)]" : "bg-[var(--palette-white)]/5 border-[var(--palette-white)]/5 text-[var(--foreground-subtle)]"}`}
                       >
                         {v === 1 ? "Passing" : v === 2 ? "High" : "Mastery"}
                       </button>
                    ))}
                 </div>
              </div>
           </div>

           <div className="flex flex-col justify-center items-center text-center p-8 rounded-3xl border border-[var(--brand-400)]/20 bg-[var(--brand-400)]/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-400)] mb-2">Recommended Strategy</p>
              <h2 className="text-3xl font-black mb-6">{recommendedMethod}</h2>

              <div className="space-y-4 mb-8">
                 <div className="flex items-center gap-3 text-left">
                    <Clock size={20} className="text-[var(--brand-400)]" />
                    <div>
                       <p className="text-xl font-black text-[var(--palette-white)]">{hoursPerDay} Hours</p>
                       <p className="text-[10px] uppercase text-[var(--foreground-subtle)]">Daily Study Volume</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 text-left">
                    <Target size={20} className="text-[var(--brand-400)]" />
                    <div>
                       <p className="text-xl font-black text-[var(--palette-white)]">{Math.ceil(hoursPerDay * 2.4)} Sessions</p>
                       <p className="text-[10px] uppercase text-[var(--foreground-subtle)]">Average Daily Blocks</p>
                    </div>
                 </div>
              </div>

              <button className="w-full rounded-2xl bg-[var(--palette-white)] py-4 text-[var(--palette-black)] font-black hover:scale-105 transition-all flex items-center justify-center gap-2">
                 Generate Schedule <ArrowRight size={18} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
