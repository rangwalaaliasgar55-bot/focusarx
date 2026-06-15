import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, Mail, MessageSquare, Twitter, Github } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

const CONTACT_OPTIONS = [
  { icon: Mail, title: "Email Support", desc: "For billing, account, or technical issues", contact: "support@focusarx.app", href: "mailto:support@focusarx.app", cta: "Send Email" },
  { icon: MessageSquare, title: "Feature Requests", desc: "Tell us what you'd like to see built next", contact: "feedback@focusarx.app", href: "mailto:feedback@focusarx.app", cta: "Send Feedback" },
  { icon: Twitter, title: "Twitter / X", desc: "Follow us for updates and tips", contact: "@focusarx", href: "https://twitter.com/focusarx", cta: "Follow Us" },
  { icon: Github, title: "Bug Reports", desc: "Found a bug? Let us know directly", contact: "bugs@focusarx.app", href: "mailto:bugs@focusarx.app", cta: "Report Bug" },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.contact} />
      <main id="main-content" className="relative z-10 mx-auto max-w-5xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-10 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-purple-300"
            >
              Get In Touch
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-3 text-4xl font-black tracking-tight text-[#E2E8F0]"
            >
              We'd love to hear from you
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-sm text-[#6b7280]"
            >
              Whether you have a question, a bug report, or just want to say hi — we read every message.
            </motion.p>
          </header>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact form */}
            <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(12,14,28,0.8)] p-6 backdrop-blur-sm">
              <h2 className="mb-5 text-base font-bold text-[#E2E8F0]">Send a Message</h2>
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-12 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="font-semibold text-[#E2E8F0]">Message sent!</p>
                  <p className="text-sm text-[#6b7280]">We'll get back to you within 1–2 business days.</p>
                  <button onClick={() => setSubmitted(false)} className="text-xs text-[#A78BFA] hover:underline">Send another message</button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">Name</label>
                      <input
                        required value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className="w-full rounded-xl border border-[#1e2130] bg-[#0d0e14] px-3.5 py-2.5 text-sm text-[#E2E8F0] placeholder-[#2d3148] outline-none focus:border-[#7c3aed] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">Email</label>
                      <input
                        required type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-[#1e2130] bg-[#0d0e14] px-3.5 py-2.5 text-sm text-[#E2E8F0] placeholder-[#2d3148] outline-none focus:border-[#7c3aed] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">Subject</label>
                    <input
                      required value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder="What's this about?"
                      className="w-full rounded-xl border border-[#1e2130] bg-[#0d0e14] px-3.5 py-2.5 text-sm text-[#E2E8F0] placeholder-[#2d3148] outline-none focus:border-[#7c3aed] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">Message</label>
                    <textarea
                      required rows={5} value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us everything…"
                      className="w-full resize-none rounded-xl border border-[#1e2130] bg-[#0d0e14] px-3.5 py-2.5 text-sm text-[#E2E8F0] placeholder-[#2d3148] outline-none focus:border-[#7c3aed] transition-colors"
                    />
                  </div>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02, boxShadow: "0 0 30px 6px rgba(124,58,237,0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#e879f9] py-3 text-sm font-bold text-white"
                  >
                    Send Message →
                  </motion.button>
                </form>
              )}
            </div>

            {/* Contact options */}
            <div className="space-y-4">
              {CONTACT_OPTIONS.map((opt, i) => (
                <motion.a
                  key={i}
                  href={opt.href}
                  target={opt.href.startsWith("http") ? "_blank" : undefined}
                  rel={opt.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-4 rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[rgba(12,14,28,0.8)] p-5 backdrop-blur-sm transition-colors hover:border-[rgba(124,58,237,0.35)] group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(124,58,237,0.15)]">
                    <opt.icon size={18} className="text-[#A78BFA]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#E2E8F0]">{opt.title}</p>
                    <p className="mt-0.5 text-xs text-[#6b7280]">{opt.desc}</p>
                    <p className="mt-1.5 text-xs font-medium text-[#A78BFA]">{opt.contact}</p>
                  </div>
                  <span className="text-xs text-[#4B5563] group-hover:text-[#A78BFA] transition-colors shrink-0 self-center">→</span>
                </motion.a>
              ))}

              <div className="rounded-2xl border border-[rgba(124,58,237,0.1)] bg-[rgba(12,14,28,0.6)] p-5">
                <p className="text-sm font-semibold text-[#E2E8F0] mb-1.5">Response Times</p>
                <ul className="space-y-1 text-xs text-[#6b7280]">
                  <li>🟢 General enquiries — within 24 hours</li>
                  <li>🟡 Billing & account issues — within 12 hours</li>
                  <li>🔴 Security concerns — within 4 hours</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-[rgba(124,58,237,0.1)] pt-6 text-xs text-[#374151]">
            {[["/support","Support"], ["/privacy","Privacy"], ["/terms","Terms"], ["/about","About"]].map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-[#A78BFA] transition-colors">{label}</Link>
            ))}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
