import { Link } from "wouter";
import { Brain, Clock, Zap, Shield, Lightbulb } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`max-w-4xl mx-auto px-6 ${className}`}>{children}</section>;
}

export default function ScienceOfDeepWorkPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PageSEO
        title="The Neuroscience of Deep Work"
        description="Explore the biological mechanisms behind deep work. Learn about myelin, neurotransmitters, and how FocusArx helps you enter the flow state faster."
        canonical="/science-of-deep-work"
        keywords="science of focus, deep work neuroscience, myelin study, flow state biology, FocusArx science"
      />

      <div className="relative overflow-hidden border-b border-[var(--palette-white)]/5 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--rgba-124-58-237-0_15),transparent_70%)]" />
        <Section className="relative text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-purple-500)]/30 bg-[var(--palette-purple-500)]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-purple-300)] mb-8">
            <Brain size={12} className="text-[var(--palette-purple-400)]" /> Cognitive Research
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight mb-6">
            The Science of <br /><span className="text-[var(--brand-400)]">Deep Work</span>
          </h1>
          <p className="text-lg text-[var(--foreground-muted)] max-w-2xl mx-auto leading-relaxed">
            Deep work isn't just a habit—it's a biological state. Discover how intense focus triggers neurological changes that accelerate mastery and rewire your neural circuits.
          </p>
        </Section>
      </div>

      <Section className="py-24 grid gap-16 lg:grid-cols-2">
        <div className="space-y-8 flex flex-col justify-center">
          <h2 className="text-4xl font-semibold tracking-tight">The Myelin Factor</h2>
          <p className="text-[var(--foreground-muted)] leading-relaxed text-lg">
            When you focus intensely on a specific skill, you trigger the growth of <strong>myelin</strong>—a fatty tissue that wraps around your neurons. Think of it as high-performance insulation for your brain's electrical circuits.
          </p>
          <div className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-8 backdrop-blur-xl">
             <div className="flex gap-6 items-start">
               <div className="h-12 w-12 rounded-2xl bg-[var(--palette-yellow-500)]/10 flex items-center justify-center shrink-0">
                  <Zap className="text-[var(--palette-yellow-500)]" size={24} />
               </div>
               <div>
                 <p className="font-bold text-[var(--palette-white)] mb-2 text-xl">High Insulation = High Speed</p>
                 <p className="text-[var(--muted-fg)] leading-relaxed">More myelin allows neural signals to travel up to 10x faster. This is the physiological basis of "Expertise." FocusArx sessions are designed to maximize myelin production.</p>
               </div>
             </div>
          </div>
        </div>
        <div className="relative">
           <div className="aspect-square rounded-full bg-[var(--palette-purple-600)]/5 border border-[var(--palette-purple-500)]/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle,var(--rgba-124-58-237-0_1)_0%,transparent_70%)]" />
              <img
                src="https://images.unsplash.com/photo-1559757175-570098bc579b?auto=format&fit=crop&q=80&w=800"
                alt="Human Brain Visualization"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover opacity-40 mix-blend-screen"
              />
              <Brain size={120} className="text-[var(--palette-purple-400)] absolute" />
           </div>
        </div>
      </Section>

      <Section className="py-24 bg-[var(--palette-white)]/[0.01] border-y border-[var(--palette-white)]/5">
         <h2 className="text-4xl font-semibold text-center mb-20 tracking-tight text-[var(--palette-white)]">Attention Residue Theory</h2>
         <div className="grid gap-12 md:grid-cols-3">
            {[
              { icon: <Clock />, title: "The 23-Min Rule", desc: "It takes an average of 23 minutes and 15 seconds to fully recover focus after a single task-switch or interruption." },
              { icon: <Shield />, title: "Cognitive Bandwidth", desc: "Switching tasks leaves 'residue' from the previous task, clogging your mental bandwidth and reducing IQ by up to 15 points." },
              { icon: <Lightbulb />, title: "The Flow Pathway", desc: "Deep work is the biological gateway to Flow—where time disappears and productivity spikes by 500%." },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-[var(--palette-purple-500)]/5 border border-[var(--palette-purple-500)]/10 flex items-center justify-center text-[var(--palette-purple-400)] group-hover:scale-110 group-hover:border-[var(--palette-purple-500)]/30 transition-all mb-8">
                   {item.icon}
                </div>
                <h3 className="font-bold text-2xl mb-4 text-[var(--palette-white)]">{item.title}</h3>
                <p className="text-[var(--muted-fg)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
         </div>
      </Section>

      <Section className="py-32 text-center">
         <h2 className="text-4xl sm:text-6xl font-semibold mb-10 tracking-tight">Ready to rewire <br />your focus?</h2>
         <Link href="/signup">
           <button className="h-16 px-12 rounded-2xl bg-gradient-to-r from-[var(--palette-purple-500)] to-[var(--palette-blue-500)] font-semibold text-lg shadow-2xl hover:scale-105 transition-transform">
             Initialize Deep Work
           </button>
         </Link>
         <p className="mt-6 text-[11px] uppercase font-bold tracking-[0.2em] text-[var(--foreground-subtle)]">Science-Backed · Free Forever · No Credit Card</p>
      </Section>
    </div>
  );
}
