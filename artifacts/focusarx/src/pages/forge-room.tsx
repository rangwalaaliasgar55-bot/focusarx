import { useState, useEffect, useRef, useMemo, Suspense, lazy } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { Users, Zap, Target, Star, MessageCircle, ArrowRight, ChevronDown } from "lucide-react";
import { BLUR_IN, STAGGER, STAGGER_CHILD } from "@/lib/animations";
import { playCoachVoice } from "@/lib/soundEngine";

const ThreeBackground = lazy(() => import("@/components/ThreeBackground"));

interface Participant {
  id: string;
  name: string;
  focusScore: number;
  mode: string;
  isMe?: boolean;
}

export default function ForgeRoomPage() {
  const { data: session } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", name: "Alex R.", focusScore: 92, mode: "Deep Work" },
    { id: "2", name: "Sarah K.", focusScore: 84, mode: "Flow" },
    { id: "3", name: "Li Wei", focusScore: 78, mode: "Pomodoro" },
    { id: "4", name: "Elena G.", focusScore: 95, mode: "Reading" },
  ]);

  useEffect(() => {
    playCoachVoice("forge");
  }, []);

  useEffect(() => {
    if (session?.user) {
       setParticipants(prev => [
         ...prev.filter(p => !p.isMe),
         { id: session.user.id, name: "You", focusScore: 85, mode: "Flow", isMe: true }
       ]);
    }
  }, [session]);

  const collectiveFlow = useMemo(() => {
     return Math.round(participants.reduce((acc, p) => acc + p.focusScore, 0) / participants.length);
  }, [participants]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--palette-white)]">
      <div className="absolute inset-0 z-[var(--z-base)]">
        <Suspense fallback={null}>
          <ThreeBackground />
        </Suspense>
      </div>

      <main className="relative z-[var(--z-content)] mx-auto max-w-7xl px-6 py-12">
        <header className="mb-12 flex flex-col items-center text-center">
           <motion.div
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-teal)]"
           >
             <div className="h-1.5 w-1.5 rounded-full bg-[var(--brand-teal)] animate-pulse" />
             Live Forge Room
           </motion.div>
           <h1 className="text-5xl font-black tracking-tight sm:text-7xl">Collective <br /><span className="text-[var(--brand-teal)]">Flow State</span></h1>
           <div className="mt-8 flex items-center gap-8">
              <div className="text-center group cursor-help">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1 group-hover:text-[var(--brand-teal)] transition-colors">Participants</p>
                 <p className="text-3xl font-black text-[var(--palette-white)] group-hover:scale-110 transition-transform">{participants.length}</p>
              </div>
              <div className="h-10 w-px bg-[var(--palette-white)]/5" />
              <div className="text-center group cursor-help relative">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-1 group-hover:text-[var(--brand-teal)] transition-colors">Group Resonance</p>
                 <p className="text-3xl font-black text-[var(--brand-teal)] group-hover:scale-110 transition-transform">{collectiveFlow}%</p>
                 {collectiveFlow > 80 && (
                    <motion.div
                      className="absolute -inset-4 rounded-full border border-[var(--brand-teal)]/20"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                 )}
              </div>
           </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
           {/* Participants Grid */}
           <div className="lg:col-span-2 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                 {participants.map((p, i) => (
                    <motion.div
                      key={p.id}
                      variants={BLUR_IN}
                      initial="initial"
                      animate="animate"
                      transition={{ delay: i * 0.1 }}
                      className={`relative rounded-3xl border p-6 backdrop-blur-xl ${p.isMe ? "border-[var(--brand-teal)]/40 bg-[var(--brand-teal)]/5" : "border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02]"}`}
                    >
                       <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black ${p.isMe ? "bg-[var(--brand-teal)] text-[var(--palette-black)]" : "bg-[var(--palette-white)]/5 text-[var(--foreground-subtle)]"}`}>
                                {p.name.charAt(0)}
                             </div>
                             <div>
                                <h3 className="font-bold text-[var(--palette-white)]">{p.name} {p.isMe && "(You)"}</h3>
                                <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-subtle)] mt-0.5">{p.mode}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-black text-[var(--brand-teal)]">{p.focusScore}%</p>
                             <div className="mt-1 h-1 w-12 rounded-full bg-[var(--palette-white)]/5 overflow-hidden">
                                <motion.div
                                  className="h-full bg-[var(--brand-teal)]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${p.focusScore}%` }}
                                />
                             </div>
                          </div>
                       </div>
                    </motion.div>
                 ))}
              </div>
           </div>

           {/* Sidebar: Group Goals */}
           <div className="space-y-6">
              <div className="rounded-3xl border border-[var(--palette-white)]/5 bg-[var(--palette-white)]/[0.02] p-8 backdrop-blur-xl">
                 <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                    <Target size={18} className="text-[var(--palette-rose-400)]" /> Room Objectives
                 </h2>
                 <div className="space-y-4">
                    {[
                      { label: "Reach 90% Resonance", progress: 85, reward: "+20% XP Multiplier" },
                      { label: "1,000 Combined Focus Min", progress: 640, reward: "Exclusive Room Badge" },
                    ].map((goal, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                           <span className="text-[var(--foreground-muted)]">{goal.label}</span>
                           <span className="text-[var(--palette-rose-400)]">{goal.reward}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--palette-white)]/5 overflow-hidden">
                           <motion.div
                             className="h-full bg-[var(--palette-rose-500)]"
                             initial={{ width: 0 }}
                             animate={{ width: `${(goal.progress / (i === 0 ? 90 : 1000)) * 100}%` }}
                           />
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="rounded-3xl border border-[var(--brand-400)]/20 bg-[var(--brand-400)]/5 p-8 backdrop-blur-xl">
                 <h2 className="text-xl font-bold mb-4">Join the Flow</h2>
                 <p className="text-sm text-[var(--foreground-muted)] mb-8 leading-relaxed">
                    Collaborative focus increases neural synchrony. When the room hits 90% resonance, every member receives an XP multiplier.
                 </p>
                 <Link href="/">
                    <button className="w-full rounded-2xl bg-[var(--palette-white)] py-4 text-[var(--palette-black)] font-black text-lg hover:scale-105 transition-all">
                       Start Syncing
                    </button>
                 </Link>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
