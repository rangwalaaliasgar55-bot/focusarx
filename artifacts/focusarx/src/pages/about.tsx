import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, Zap, Heart, Globe, Users } from "lucide-react";
import { motion } from "framer-motion";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const VALUES = [
  { icon: Zap, title: "Deep Work First", desc: "We believe that focused, uninterrupted work is the most powerful skill a person can develop. Every feature we build serves that single purpose." },
  { icon: Heart, title: "Built for Humans", desc: "Productivity tools should reduce stress, not add to it. FocusArx is designed to feel like a supportive partner, not a demanding taskmaster." },
  { icon: Globe, title: "Accessible to Everyone", desc: "Great focus tools shouldn't require a subscription. Our core features are free forever — premium is for those who want to go further." },
  { icon: Users, title: "Community Driven", desc: "Our users shape FocusArx. We read every piece of feedback, build features users actually ask for, and ship fast." },
];

const TEAM = [
  { initials: "FX", name: "FocusArx Team", role: "Product & Engineering", gradient: "from-[#7c3aed] to-[#e879f9]" },
];

export default function AboutPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.about} />
      <main id="main-content" className="relative z-10 mx-auto max-w-4xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          {/* Hero */}
          <div className="mb-16 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300"
            >
              Our Mission
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-5 text-4xl sm:text-5xl font-black tracking-tight text-[#E2E8F0]"
            >
              We exist to help humans
              <br />
              <span className="bg-gradient-to-r from-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">
                do their best work.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto max-w-2xl text-base leading-relaxed text-[#6b7280]"
            >
              FocusArx was built by a team of developers and researchers who were frustrated with traditional productivity tools. Too complex. Too distracting. Too expensive. We set out to build something different — an AI-powered focus engine that actually gets out of your way.
            </motion.p>
          </div>

          {/* Story */}
          <div className="mb-16 rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.05)] p-8">
            <h2 className="mb-4 text-xl font-bold text-[#E2E8F0]">The Story</h2>
            <div className="space-y-4 text-sm leading-relaxed text-[#94A3B8]">
              <p>In 2024, our founding team noticed a paradox: we had more productivity tools than ever, yet most people felt less productive than ever. Apps were gamifying the wrong things — notifications, streaks for engagement rather than depth, metrics that looked good but meant nothing.</p>
              <p>We asked: what if a productivity app was built around <em className="text-[#E2E8F0]">deep work</em> as the primary metric? Not time spent, but quality of focus. Not how many tasks you added, but how many you actually completed while in a genuine flow state.</p>
              <p>FocusArx is the answer to that question. Built on the Pomodoro technique but supercharged with AI coaching, webcam attention tracking, and a gamification system designed to reward actual depth of work — not just showing up.</p>
            </div>
          </div>

          {/* Values */}
          <div className="mb-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-[#E2E8F0]">Our Values</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {VALUES.map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(12,14,28,0.8)] p-6 backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.15)]">
                    <v.icon size={18} className="text-[#A78BFA]" />
                  </div>
                  <h3 className="mb-2 font-bold text-[#E2E8F0]">{v.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6b7280]">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="mb-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[["50K+", "Active Users"], ["2.4M+", "Sessions Logged"], ["4.9★", "Average Rating"], ["100%", "Free Core"]].map(([val, label], i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5 text-center"
              >
                <span className="text-3xl font-black bg-gradient-to-r from-[#a78bfa] to-[#e879f9] bg-clip-text text-transparent">{val}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4b5563]">{label}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-[rgba(124,58,237,0.25)] bg-gradient-to-br from-[rgba(124,58,237,0.1)] to-[rgba(232,121,249,0.05)] p-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-[#E2E8F0]">Ready to build deep focus?</h2>
            <p className="mb-6 text-sm text-[#6b7280]">Join tens of thousands of learners already using FocusArx to do their best work.</p>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 40px 8px rgba(124,58,237,0.4)" }}
                whileTap={{ scale: 0.97 }}
                className="rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] px-8 py-3 text-sm font-bold text-white shadow-lg"
              >
                Get Started Free
              </motion.button>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-[rgba(124,58,237,0.1)] pt-6 text-xs text-[#374151]">
            {[["/contact","Contact"], ["/support","Support"], ["/privacy","Privacy"], ["/terms","Terms"]].map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-[#A78BFA] transition-colors">{label}</Link>
            ))}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
