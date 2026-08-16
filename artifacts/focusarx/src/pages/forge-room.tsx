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
    <div className="relative min-h-screen overflow-hidden bg-[#030308] text-white">
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <ThreeBackground />
        </Suspense>
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <header className="mb-12 flex flex-col items-center text-center">
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#06D6A0]/30 bg-[#06D6A0]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#06D6A0]"
           >
             <div className="h-1.5 w-1.5 rounded-full bg-[#06D6A0] animate-pulse" />
             Live Forge Room
           </motion.div>
           <h1 className="text-5xl font-black tracking-tight sm:text-7xl">Collective <br /><span className="text-[#06D6A0]">Flow State</span></h1>
           <div className="mt-8 flex items-center gap-8">
              <div className="text-center group cursor-help">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[#4B5563] mb-1 group-hover:text-[#06D6A0] transition-colors">Participants</p>
                 <p className="text-3xl font-black text-white group-hover:scale-110 transition-transform">{participants.length}</p>
              </div>
              <div className="h-10 w-px bg-white/5" />
              <div className="text-center group cursor-help relative">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[#4B5563] mb-1 group-hover:text-[#06D6A0] transition-colors">Group Resonance</p>
                 <p className="text-3xl font-black text-[#06D6A0] group-hover:scale-110 transition-transform">{collectiveFlow}%</p>
                 {collectiveFlow > 80 && (
                    <motion.div 
                      className="absolute -inset-4 rounded-full border border-[#06D6A0]/20"
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
                      className={`relative rounded-3xl border p-6 backdrop-blur-xl ${p.isMe ? "border-[#06D6A0]/40 bg-[#06D6A0]/5" : "border-white/5 bg-white/[0.02]"}`}
                    >
                       <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black ${p.isMe ? "bg-[#06D6A0] text-black" : "bg-white/5 text-[#4B5563]"}`}>
                                {p.name.charAt(0)}
                             </div>
                             <div>
                                <h3 className="font-bold text-white">{p.name} {p.isMe && "(You)"}</h3>
                                <p className="text-[10px] uppercase tracking-widest text-[#4B5563] mt-0.5">{p.mode}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-black text-[#06D6A0]">{p.focusScore}%</p>
                             <div className="mt-1 h-1 w-12 rounded-full bg-white/5 overflow-hidden">
                                <motion.div 
                                  className="h-full bg-[#06D6A0]"
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
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-xl">
                 <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                    <Target size={18} className="text-rose-400" /> Room Objectives
                 </h2>
                 <div className="space-y-4">
                    {[
                      { label: "Reach 90% Resonance", progress: 85, reward: "+20% XP Multiplier" },
                      { label: "1,000 Combined Focus Min", progress: 640, reward: "Exclusive Room Badge" },
                    ].map((goal, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                           <span className="text-[#94A3B8]">{goal.label}</span>
                           <span className="text-rose-400">{goal.reward}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                           <motion.div 
                             className="h-full bg-rose-500"
                             initial={{ width: 0 }}
                             animate={{ width: `${(goal.progress / (i === 0 ? 90 : 1000)) * 100}%` }}
                           />
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="rounded-3xl border border-[#A78BFA]/20 bg-[#A78BFA]/5 p-8 backdrop-blur-xl">
                 <h2 className="text-xl font-bold mb-4">Join the Flow</h2>
                 <p className="text-sm text-[#94A3B8] mb-8 leading-relaxed">
                    Collaborative focus increases neural synchrony. When the room hits 90% resonance, every member receives an XP multiplier.
                 </p>
                 <Link href="/">
                    <button className="w-full rounded-2xl bg-white py-4 text-black font-black text-lg hover:scale-105 transition-all">
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
