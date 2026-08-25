import { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search as SearchIcon, Timer, BookOpen, Calculator, Info } from "lucide-react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

interface Entry {
  title: string;
  description: string;
  path: string;
  section: "Guides" | "Tools" | "Features" | "Company";
  keywords: string;
}

const INDEX: Entry[] = [
  { path: "/exam", section: "Guides", title: "Exam Prep Guides — JEE, NEET, UPSC, SSC, GATE, CAT, Boards & More", description: "14 practical India-first exam guides: patterns, study plans, daily focus routines, mock protocols, and FAQ.", keywords: "exam preparation jee neet upsc ssc cbse boards gate cat nda ctet ibps study plan india" },
  { path: "/exam/jee-main", section: "Guides", title: "JEE Main Study Plan & Prep Guide", description: "JEE Main pattern, 6-month plan, daily focus routine, subject strategy, mock protocol, and the final 30 days.", keywords: "jee main study plan preparation 2027 daily routine tips" },
  { path: "/exam/jee-advanced", section: "Guides", title: "JEE Advanced Study Plan & Strategy", description: "Paper pattern, the mental shift from Main, 12-week post-Main plan, problem strategy under -1/3, exam-day tactics.", keywords: "jee advanced preparation strategy 2027 mocks top rank" },
  { path: "/exam/neet-ug", section: "Guides", title: "NEET UG Study Plan & Prep Guide", description: "NCERT-first method, subject weightage, daily routine for Class 12 and droppers, mock protocol, last 30 days.", keywords: "neet study plan preparation 2027 dropper ncert mock" },
  { path: "/exam/cbse-class-12", section: "Guides", title: "CBSE Class 12 Boards Study Plan", description: "90-day plan, chapter priorities, answer-writing habits worth 10+ marks, practicals and internals, exam week.", keywords: "cbse class 12 boards study plan 2027 answer writing internals" },
  { path: "/exam/cbse-class-10", section: "Guides", title: "CBSE Class 10 Boards Study Plan", description: "Subject priorities, 90-day plan, daily routine, answer-writing tips, and the phone problem, handled.", keywords: "class 10 study plan cbse boards maths science tips" },
  { path: "/exam/gate", section: "Guides", title: "GATE Study Plan & Strategy", description: "Normalised score explained, 6-month working-professional plan, PYQ method, section timing, GA strategy.", keywords: "gate study plan 2027 working professional pyq strategy" },
  { path: "/exam/cat", section: "Guides", title: "CAT Study Plan & Mock Strategy", description: "Sectional adaptivity, percentile benchmarks, 6-month plan, the 40-mock protocol, VARC/DILR/QA strategy.", keywords: "cat study plan 2027 percentile dilr varc qa mocks" },
  { path: "/exam/upsc-cse", section: "Guides", title: "UPSC CSE Study Plan & Strategy", description: "Prelims-Mains-Interview structure, source system, 12-month plan, answer-writing, the focus system for month 10.", keywords: "upsc cse study plan 2027 preparation answer writing routine" },
  { path: "/exam/ssc-cgl", section: "Guides", title: "SSC CGL Study Plan & Strategy", description: "Tier 1 & 2 pattern, speed-math system, 30-minute daily GK routine, 40-mock protocol, exam-day architecture.", keywords: "ssc cgl study plan 2027 speed math gk tier 1 tier 2" },
  { path: "/exam/nda", section: "Guides", title: "NDA & NA Study Plan & SSB Guide", description: "Written pattern (Math + GAT), 6-month in-school plan, SSB 5 days explained, fitness prep for young aspirants.", keywords: "nda study plan 2027 ssb preparation class 10 fitness" },
  { path: "/exam/ctet", section: "Guides", title: "CTET Study Plan & Preparation Guide", description: "Paper 1 & 2 pattern, the no-negative-marking strategy, CDP framework, subject weightage, 4-month plan.", keywords: "ctet study plan 2027 paper 1 paper 2 preparation teacher" },
  { path: "/exam/ibps-po", section: "Guides", title: "IBPS PO/MT Study Plan & Strategy", description: "Prelims & Mains pattern, 100 questions in 60 minutes, section timing, 30-mock protocol, daily routine.", keywords: "ibps po study plan 2027 prelims mains banking strategy" },
  { path: "/exam/exam-anxiety", section: "Guides", title: "How to Beat Exam Anxiety", description: "The physiology of test panic and 12 techniques: box breathing, the in-exam protocol, sleep floor, the no-discussion rule.", keywords: "exam anxiety test anxiety tips panic control nervous students" },
  { path: "/exam/last-minute-revision", section: "Guides", title: "Last-Minute Exam Revision Protocol", description: "The 72/48/24-hour protocol: active recall over rereading, the 80/20 triage, why all-nighters lose, exam morning.", keywords: "last minute revision night before exam 24 hour study all nighter" },
  { path: "/focus-guide", section: "Guides", title: "How to Focus: The Complete Science-Based Guide", description: "Why focus is hard, the neuroscience of attention, and a complete system to rebuild concentration.", keywords: "focus concentration attention how to focus deep work improve" },
  { path: "/pomodoro-guide", section: "Guides", title: "The Pomodoro Technique: Complete Guide", description: "How to run 25/5 focus sprints correctly, and when to use longer deep-work intervals instead.", keywords: "pomodoro timer technique 25 minutes breaks sprint study" },
  { path: "/study-techniques", section: "Guides", title: "Best Study Techniques, Ranked by Evidence", description: "Active recall, spaced repetition, interleaving — which methods work and how to combine them.", keywords: "study techniques methods active recall spaced repetition learning" },
  { path: "/deep-study-guide", section: "Guides", title: "Deep Study Guide", description: "Sustained concentration, memory retention, and peak academic performance in one playbook.", keywords: "deep study learning exam retention concentration academics" },
  { path: "/two-hour-study-method", section: "Guides", title: "The 2-Hour Study Method", description: "A structured two-hour block — warm-up, deep study, retrieval, review — that beats scattered hours.", keywords: "2 hour study method session structure block" },
  { path: "/science-of-deep-work", section: "Guides", title: "The Science of Deep Work", description: "What happens in your brain during deep work — myelin, neurotransmitters, and the flow state.", keywords: "deep work neuroscience science brain flow state myelin" },
  { path: "/feynman-technique", section: "Guides", title: "The Feynman Technique", description: "Learn anything deeply by explaining it in plain language and attacking the gaps.", keywords: "feynman technique learning explain teach simple" },
  { path: "/adhd-focus-tips", section: "Guides", title: "How to Focus with ADHD", description: "15 strategies engineered for ADHD brains — body doubling, the 10-minute rule, dopamine-friendly systems.", keywords: "adhd focus add concentration hyperfocus dopamine body doubling" },
  { path: "/stop-procrastinating", section: "Guides", title: "How to Stop Procrastinating", description: "Why you procrastinate (it's not laziness) and 12 proven methods to stop — starting today.", keywords: "procrastination procrastinate lazy motivation start 2 minute rule" },
  { path: "/focus-music", section: "Guides", title: "Best Music for Studying & Focus", description: "What research actually says about focus music, lo-fi, binaural beats, noise, and silence.", keywords: "music study focus lofi binaural beats noise playlist concentration" },
  { path: "/study-with-me", section: "Guides", title: "Study With Me: Live Sessions", description: "How live study-with-me sessions work and why they make focusing feel effortless.", keywords: "study with me live session body doubling together" },
  { path: "/virtual-study-room", section: "Features", title: "Virtual Study Rooms", description: "Study alongside other learners live — accountability and the body-doubling effect.", keywords: "virtual study room co-working body double online room" },
  { path: "/guides", section: "Guides", title: "All Focus & Study Guides", description: "The complete free FocusArx guide library — focus, studying, ADHD, procrastination, and more.", keywords: "guides library all resources free" },
  { path: "/study-method-quiz", section: "Tools", title: "Study Method Quiz", description: "Two minutes to find which study method fits your brain, schedule, and goals.", keywords: "quiz which study method learning style test" },
  { path: "/study-calculator", section: "Tools", title: "Study Time Calculator", description: "Enter your exam date and topics — get a personalized, retention-optimized schedule.", keywords: "calculator study time hours schedule exam planner" },
  { path: "/breathe", section: "Tools", title: "2-Minute Breathing Reset", description: "A guided breathing tool to reset your nervous system between study blocks.", keywords: "breathe breathing meditation calm reset box breathing" },
  { path: "/break-free", section: "Tools", title: "Break-Free Distraction Tool", description: "Recover quickly when you've fallen into a distraction spiral.", keywords: "distraction break free scroll phone reset" },
  { path: "/study-rooms", section: "Features", title: "Live Study Rooms", description: "Join or create live study rooms with synchronized focus timers.", keywords: "study rooms live join create focus together" },
  { path: "/leaderboard", section: "Features", title: "Focus Leaderboard", description: "See who's leading in focus time, streaks, and XP.", keywords: "leaderboard ranking top champions compete" },
  { path: "/flashcards", section: "Features", title: "Flashcards", description: "Spaced-repetition flashcards built for active recall.", keywords: "flashcards spaced repetition cards memorize" },
  { path: "/pricing", section: "Company", title: "Pricing — Free Forever", description: "FocusArx is free forever; premium unlocks with coins you earn by focusing.", keywords: "pricing free cost premium price plan" },
  { path: "/about", section: "Company", title: "About FocusArx", description: "Our mission, values, and the story behind the platform.", keywords: "about company mission team story" },
  { path: "/contact", section: "Company", title: "Contact", description: "Get in touch for support, feedback, or business enquiries.", keywords: "contact email support message touch" },
  { path: "/support", section: "Company", title: "Help Center & FAQ", description: "Answers to common questions about FocusArx features and your account.", keywords: "help support faq questions account troubleshoot" },
  { path: "/roadmap", section: "Company", title: "Product Roadmap", description: "What's next for FocusArx — upcoming features and recent releases.", keywords: "roadmap upcoming features future releases" },
  { path: "/privacy", section: "Company", title: "Privacy Policy", description: "How FocusArx collects, uses, and protects your data.", keywords: "privacy policy data gdpr cookies" },
  { path: "/terms", section: "Company", title: "Terms of Service", description: "The terms governing your use of FocusArx.", keywords: "terms of service conditions legal" },
];

const SECTION_ICONS: Record<Entry["section"], React.ReactNode> = {
  Guides: <BookOpen size={14} />,
  Tools: <Calculator size={14} />,
  Features: <Timer size={14} />,
  Company: <Info size={14} />,
};

export default function SearchPage() {
  const [location] = useLocation();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") || "";
    setQuery(q);
  }, [location]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDEX;
    const terms = q.split(/\s+/);
    return INDEX.map((entry) => {
      const haystack = `${entry.title} ${entry.description} ${entry.keywords} ${entry.path}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (entry.title.toLowerCase().includes(t)) score += 3;
        if (entry.keywords.includes(t)) score += 2;
        if (haystack.includes(t)) score += 1;
      }
      return { entry, score };
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.entry);
  }, [query]);

  return (
    <div className="min-h-screen bg-[var(--rgba-255-255-255-0_02)] text-[var(--foreground)]">
      <PageSEO {...PAGE_SEO.search} noindex />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--brand-600)]/30 bg-[var(--brand-600)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand-400)]">
          <SearchIcon size={12} /> Search FocusArx
        </div>
        <h1 className="mb-3 text-3xl font-black text-[var(--foreground)] sm:text-4xl">Find what you need</h1>
        <p className="mb-6 text-[var(--foreground-muted)]">Search every guide, tool, and feature — from Pomodoro technique to ADHD focus strategies.</p>

        <div className="relative mb-8">
          <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--palette-6b7280)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try 'pomodoro', 'adhd', 'procrastination'…"
            aria-label="Search FocusArx guides and tools"
            className="w-full rounded-2xl border border-[var(--rgba-255-255-255-0_08)] bg-[var(--rgba-255-255-255-0_03)] py-4 pl-11 pr-4 text-[var(--foreground)] outline-none placeholder:text-[var(--palette-6b7280)] focus:border-[var(--brand-600)]/50"
          />
        </div>

        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--palette-6b7280)]">
          {query.trim() ? `${results.length} result${results.length === 1 ? "" : "s"} for “${query.trim()}”` : `${results.length} pages`}
        </p>

        <div className="space-y-3">
          {results.map((r) => (
            <Link
              key={r.path}
              href={r.path}
              className="group block rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-5 transition-all hover:border-[var(--brand-600)]/40 hover:bg-[var(--rgba-124-58-237-0_06)]"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-400)]">
                {SECTION_ICONS[r.section]} {r.section}
              </div>
              <p className="mt-1 font-bold text-[var(--foreground)] group-hover:text-[var(--brand-400)]">{r.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--palette-6b7280)]">{r.description}</p>
            </Link>
          ))}
          {results.length === 0 && (
            <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-8 text-center">
              <p className="font-bold text-[var(--foreground)]">No results for “{query}”</p>
              <p className="mt-1 text-sm text-[var(--palette-6b7280)]">Try “focus”, “study”, “pomodoro”, or browse the <Link href="/guides" className="text-[var(--brand-400)] hover:underline">full guide library</Link>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
