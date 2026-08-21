import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, Zap, Heart, Globe, Users, ShieldCheck, Mail, Phone, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const VALUES = [
  { icon: Zap, title: "Deep Work First", desc: "We believe that focused, uninterrupted work is the most powerful skill a person can develop. Every feature we build serves that single purpose." },
  { icon: Heart, title: "Built for Humans", desc: "Productivity tools should reduce stress, not add to it. FocusArx is designed to feel like a supportive partner, not a demanding taskmaster." },
  { icon: Globe, title: "Accessible to Everyone", desc: "Great focus tools shouldn't require a subscription. Our core features are free forever — premium is for those who want to go further." },
  { icon: Users, title: "Community Driven", desc: "Our users shape FocusArx. We read every piece of feedback, build features users actually ask for, and ship fast." },
];

export default function AboutPage() {
  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.about} />
      <main id="main-content" className="relative z-10 mx-auto max-w-5xl px-4 py-10 md:py-20">
        <PageTransition>
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to Hub
          </Link>

          {/* Hero */}
          <div className="mb-24 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-purple-300"
            >
              Our Mission
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-8 text-5xl sm:text-7xl font-black tracking-tight text-white leading-[0.9]"
            >
              Restoring the world's <br />
              <span className="text-gradient">Attention Span.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto max-w-2xl text-lg leading-relaxed text-[#94A3B8]"
            >
              FocusArx was born in 2024 from a simple realization: in an era of infinite distraction, the ability to focus is the ultimate competitive advantage. We build tools that help you reclaim your time and achieve true mastery.
            </motion.p>
          </div>

          {/* Values Grid */}
          <div className="mb-24 grid sm:grid-cols-2 gap-6">
            {VALUES.map((v, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-[32px] border border-white/5 bg-white/[0.01] p-8 backdrop-blur-xl glass-heavy"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C3AED]/10 border border-[#7C3AED]/20">
                  <v.icon size={20} className="text-[#A78BFA]" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{v.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748B]">{v.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Contact & Legal Details */}
          <div className="mb-24 grid gap-8 lg:grid-cols-3">
             <div className="lg:col-span-2 space-y-8">
                <div className="rounded-[32px] border border-white/5 bg-white/[0.01] p-10 glass">
                   <h2 className="text-2xl font-black text-white mb-6">Verified Information</h2>
                   <div className="grid sm:grid-cols-2 gap-10">
                      <div className="space-y-6">
                         <div className="flex items-start gap-4">
                            <Globe className="text-[#A78BFA] mt-1" size={18} />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-1">Based In</p>
                               <p className="text-sm text-zinc-300">India</p>
                               <p className="text-sm text-zinc-500">Serving learners worldwide</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-4">
                            <ShieldCheck className="text-[#A78BFA] mt-1" size={18} />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-1">Privacy</p>
                               <p className="text-sm text-zinc-300">On-device vision processing</p>
                               <p className="text-sm text-zinc-500">No video ever leaves your browser</p>
                            </div>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="flex items-start gap-4">
                            <Mail className="text-[#A78BFA] mt-1" size={18} />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-1">Email</p>
                               <a href="mailto:focusarx@gmail.com" className="text-sm text-zinc-300 hover:text-[#A78BFA] transition-colors">focusarx@gmail.com</a>
                               <p className="text-sm text-zinc-500">We reply fast</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-4">
                            <Phone className="text-[#A78BFA] mt-1" size={18} />
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-[#4B5563] mb-1">Phone / WhatsApp</p>
                               <a href="tel:+917725004639" className="text-sm text-zinc-300 hover:text-[#A78BFA] transition-colors">+91 77250 04639</a>
                               <p className="text-sm text-zinc-500">Mon–Sat · 9am–7pm IST</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
             
             <div className="rounded-[32px] border border-white/5 bg-gradient-to-br from-[#7C3AED]/10 to-[#F472B6]/5 p-10 flex flex-col justify-center text-center">
                <h3 className="text-2xl font-black text-white mb-4 italic">Join the Elite.</h3>
                <p className="text-sm text-[#94A3B8] mb-8">Ready to transform your cognitive output? Start your first session today.</p>
                <Link href="/signup">
                  <button className="w-full py-4 rounded-2xl bg-white text-black font-black hover:scale-105 transition-all shadow-xl shadow-purple-950/20">
                    Get Started Free
                  </button>
                </Link>
             </div>
          </div>

          <div className="px-6 py-12 border-t border-white/5 text-center">
             <p className="text-[10px] text-zinc-700 leading-relaxed uppercase tracking-[0.2em] max-w-3xl mx-auto">
               *FocusArx is a productivity app built by an independent team. AI-generated coaching is for educational and motivational purposes only — it is not professional advice. Focus responsibly.
             </p>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
