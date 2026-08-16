import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Target, Zap, Brain, Clock, ChevronRight, RefreshCw, Star, ShieldCheck, ArrowRight } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";
import { BLUR_IN, STAGGER, STAGGER_CHILD } from "@/lib/animations";

const QUESTIONS = [
  {
    id: 1,
    text: "How long can you focus before feeling restless?",
    options: [
      { label: "15-20 minutes", value: "short", points: { pomodoro: 3, flowtime: 1, deepwork: 0 } },
      { label: "40-60 minutes", value: "medium", points: { pomodoro: 1, flowtime: 3, deepwork: 1 } },
      { label: "90+ minutes", value: "long", points: { pomodoro: 0, flowtime: 1, deepwork: 3 } },
    ],
  },
  {
    id: 2,
    text: "What's your primary study environment like?",
    options: [
      { label: "Noisy/Chaotic", value: "noisy", points: { pomodoro: 3, flowtime: 0, deepwork: 0 } },
      { label: "Variable", value: "variable", points: { pomodoro: 1, flowtime: 2, deepwork: 1 } },
      { label: "Silent/Controlled", value: "silent", points: { pomodoro: 0, flowtime: 1, deepwork: 3 } },
    ],
  },
  {
    id: 3,
    text: "What is your main goal for today?",
    options: [
      { label: "Clearing small tasks", value: "tasks", points: { pomodoro: 3, flowtime: 1, deepwork: 0 } },
      { label: "Learning a new concept", value: "learning", points: { pomodoro: 1, flowtime: 3, deepwork: 2 } },
      { label: "Writing or Coding", value: "creative", points: { pomodoro: 0, flowtime: 2, deepwork: 3 } },
    ],
  },
];

const RESULTS = {
  pomodoro: {
    title: "The Classic Pomodoro",
    desc: "You thrive in high-intensity bursts. The 25/5 rhythm will prevent mental fatigue and keep your momentum high.",
    icon: <Clock className="text-orange-400" size={40} />,
    color: "text-orange-400",
  },
  flowtime: {
    title: "The Flowtime Method",
    desc: "You have a natural ability to enter deep states. Don't let a timer break your concentration—work until your focus naturally dips.",
    icon: <Zap className="text-blue-400" size={40} />,
    color: "text-blue-400",
  },
  deepwork: {
    title: "Monastic Deep Work",
    desc: "You are a marathoner. You need long, uninterrupted blocks (90-120 min) to produce your best work. Eliminate all noise.",
    icon: <Brain className="text-purple-400" size={40} />,
    color: "text-purple-400",
  },
};

export default function StudyMethodQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [scores, setScores] = useState({ pomodoro: 0, flowtime: 0, deepwork: 0 });
  const [result, setResult] = useState<keyof typeof RESULTS | null>(null);

  const handleAnswer = (points: Record<string, number>) => {
    const newScores = { ...scores };
    Object.entries(points).forEach(([key, val]) => {
      newScores[key as keyof typeof scores] += val;
    });
    setScores(newScores);

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      const winner = Object.entries(newScores).reduce((a, b) => (a[1] > b[1] ? a : b))[0] as keyof typeof RESULTS;
      setResult(winner);
    }
  };

  const restart = () => {
    setCurrentQuestion(0);
    setScores({ pomodoro: 0, flowtime: 0, deepwork: 0 });
    setResult(null);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Quiz",
    "name": "The Ultimate Study Method Quiz",
    "description": "Find the perfect productivity system for your brain type in 60 seconds.",
    "educationalAlignment": "Productivity",
    "interactivityType": "active"
  };

  return (
    <div className="min-h-screen bg-[#030308] text-[#E2E8F0]">
      <PageSEO 
        title="Study Method Quiz | Find Your Perfect Productivity System | FocusArx"
        description="Take our 60-second quiz to discover if you should use Pomodoro, Flowtime, or Deep Work blocks. Science-backed study method recommendation."
        canonical="/study-method-quiz"
        keywords="study method quiz, best study technique, pomodoro vs flowtime, deep work test, focus test"
        structuredData={structuredData}
      />

      <div className="max-w-3xl mx-auto px-6 py-20">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="quiz" variants={STAGGER} initial="initial" animate="animate" exit="exit" className="space-y-12">
              <header className="text-center">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4B5563] mb-4">Assessment Engine</p>
                 <h1 className="text-4xl sm:text-6xl font-black tracking-tight">Which Method <br /><span className="text-[#A78BFA]">Fits You?</span></h1>
                 <p className="mt-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2">
                    <ShieldCheck size={12} className="text-emerald-500" /> Based on cognitive load theory
                 </p>
                 <div className="mt-8 flex justify-center gap-2">
                    {QUESTIONS.map((_, i) => (
                      <div key={i} className={`h-1 w-12 rounded-full transition-colors ${i === currentQuestion ? "bg-[#A78BFA]" : i < currentQuestion ? "bg-[#A78BFA]/40" : "bg-white/5"}`} />
                    ))}
                 </div>
              </header>

              <motion.div variants={STAGGER_CHILD} className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-12 backdrop-blur-xl">
                 <h2 className="text-2xl font-bold mb-8 text-center">{QUESTIONS[currentQuestion].text}</h2>
                 <div className="space-y-4">
                    {QUESTIONS[currentQuestion].options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(opt.points)}
                        className="w-full flex items-center justify-between group p-6 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-[#A78BFA]/30 transition-all text-left"
                      >
                         <span className="font-bold text-lg">{opt.label}</span>
                         <ChevronRight className="text-[#4B5563] group-hover:text-[#A78BFA] group-hover:translate-x-1 transition-all" size={20} />
                      </button>
                    ))}
                 </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="result" variants={BLUR_IN} initial="initial" animate="animate" className="text-center py-12">
               <div className="mx-auto mb-8 h-24 w-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
                  {RESULTS[result].icon}
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4B5563] mb-2">The Verdict</p>
               <h2 className={`text-4xl sm:text-6xl font-black mb-6 ${RESULTS[result].color}`}>{RESULTS[result].title}</h2>
               <p className="text-lg text-[#94A3B8] leading-relaxed max-w-xl mx-auto mb-12">
                  {RESULTS[result].desc}
               </p>

               <div className="grid gap-4 sm:grid-cols-2">
                  <Link href="/signup">
                    <button className="w-full h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 font-black text-lg shadow-xl hover:scale-105 transition-all">
                       Start with {RESULTS[result].title.split(' ')[2] || 'Flow'}
                    </button>
                  </Link>
                  <button onClick={restart} className="flex items-center justify-center gap-2 w-full h-16 rounded-2xl border border-white/10 bg-white/5 font-black text-lg hover:bg-white/10 transition-all">
                     <RefreshCw size={18} /> Retake Quiz
                  </button>
               </div>

               <div className="mt-20 pt-12 border-t border-white/5">
                  <p className="text-sm text-[#4B5563] mb-6">Learn more about other systems:</p>
                  <div className="flex flex-wrap justify-center gap-4">
                     <Link href="/pomodoro-guide" className="text-xs font-bold text-[#94A3B8] hover:text-white uppercase tracking-widest">Pomodoro</Link>
                     <Link href="/science-of-deep-work" className="text-xs font-bold text-[#94A3B8] hover:text-white uppercase tracking-widest">Deep Work</Link>
                     <Link href="/feynman-technique" className="text-xs font-bold text-[#94A3B8] hover:text-white uppercase tracking-widest">Feynman</Link>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
