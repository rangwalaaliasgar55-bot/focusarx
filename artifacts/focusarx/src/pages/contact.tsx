import { PageTransition } from "@/components/PageTransition";
import { Link } from "wouter";
import { ArrowLeft, Mail, Phone, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, whatsApp } from "@/lib/contact";

const CONTACT_OPTIONS = [
  {
    icon: Mail,
    title: "Email Support",
    desc: "For account, feedback, or technical issues",
    contact: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    cta: "Send Email",
    external: false,
  },
  {
    icon: Phone,
    title: "Call Us",
    desc: "Mon–Sat, 9am–7pm IST",
    contact: CONTACT_PHONE_DISPLAY,
    href: `tel:${CONTACT_PHONE_TEL}`,
    cta: "Call Now",
    external: false,
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    desc: "Fastest way to reach the team",
    contact: CONTACT_PHONE_DISPLAY,
    href: whatsApp("Hi FocusArx! I'd like to get in touch."),
    cta: "Chat on WhatsApp",
    external: true,
  },
];

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to send message");
      }
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send message. Please email us directly.");
    }
  };

  return (
    <div className="relative min-h-[100dvh] forge-bg-glow">
      <PageSEO {...PAGE_SEO.contact} />
      <main id="main-content" className="relative z-[var(--z-content)] mx-auto max-w-5xl px-4 py-10">
        <PageTransition>
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors">
            <ArrowLeft size={13} /> Back to FocusArx
          </Link>

          <header className="mb-10 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--palette-purple-500)]/30 bg-[var(--palette-purple-500)]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--palette-purple-300)]"
            >
              Get In Touch
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-3 text-4xl font-black tracking-tight text-[var(--foreground)]"
            >
              We'd love to hear from you
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-sm text-[var(--palette-6b7280)]"
            >
              A question, a bug report, or a feature idea — we read every message.
            </motion.p>
          </header>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact form */}
            <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-12-14-28-0_8)] p-6 backdrop-blur-sm">
              <h2 className="mb-5 text-base font-bold text-[var(--foreground)]">Send a Message</h2>
              {status === "sent" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-12 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--palette-emerald-500)]/20">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="font-semibold text-[var(--foreground)]">Message sent!</p>
                  <p className="text-sm text-[var(--palette-6b7280)]">We'll get back to you soon.</p>
                  <button onClick={() => setStatus("idle")} className="text-xs text-[var(--brand-400)] hover:underline">Send another message</button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Name</label>
                      <input
                        required value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className="w-full rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_04)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--rgba-255-255-255-0_20)] outline-none focus:border-[var(--brand-600)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Email</label>
                      <input
                        required type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_04)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--rgba-255-255-255-0_20)] outline-none focus:border-[var(--brand-600)] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Subject</label>
                    <input
                      required value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder="What's this about?"
                      className="w-full rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_04)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--rgba-255-255-255-0_20)] outline-none focus:border-[var(--brand-600)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Message</label>
                    <textarea
                      required rows={5} value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us everything…"
                      className="w-full resize-none rounded-xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_04)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--rgba-255-255-255-0_20)] outline-none focus:border-[var(--brand-600)] transition-colors"
                    />
                  </div>
                  {status === "error" && (
                    <p className="text-xs text-[var(--palette-red-400)]">{error}</p>
                  )}
                  <motion.button
                    type="submit"
                    disabled={status === "sending"}
                    whileHover={{ scale: 1.02, boxShadow: "0 0 30px 6px var(--rgba-124-58-237-0_3)" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-e879f9)] py-3 text-sm font-bold text-[var(--palette-white)] disabled:opacity-60"
                  >
                    {status === "sending" ? "Sending…" : "Send Message →"}
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
                  target={opt.external ? "_blank" : undefined}
                  rel={opt.external ? "noopener noreferrer" : undefined}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-4 rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-12-14-28-0_8)] p-5 backdrop-blur-sm transition-colors hover:border-[var(--rgba-124-58-237-0_35)] group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rgba-124-58-237-0_15)]">
                    <opt.icon size={18} className="text-[var(--brand-400)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--foreground)]">{opt.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--palette-6b7280)]">{opt.desc}</p>
                    <p className="mt-1.5 text-xs font-medium text-[var(--brand-400)]">{opt.contact}</p>
                  </div>
                  <span className="text-xs text-[var(--foreground-subtle)] group-hover:text-[var(--brand-400)] transition-colors shrink-0 self-center">→</span>
                </motion.a>
              ))}

              <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-12-14-28-0_6)] p-5">
                <p className="text-sm font-semibold text-[var(--foreground)] mb-1.5">Response Times</p>
                <ul className="space-y-1 text-xs text-[var(--palette-6b7280)]">
                  <li>🟢 General enquiries — within 24 hours</li>
                  <li>🟡 Account issues — within 12 hours</li>
                  <li>🔴 Security concerns — within 4 hours</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--rgba-124-58-237-0_1)] pt-6 text-xs text-[var(--foreground-subtle)]">
            {[["/support","Support"], ["/privacy","Privacy"], ["/terms","Terms"], ["/about","About"]].map(([href, label]) => (
              <Link key={href} href={href} className="hover:text-[var(--brand-400)] transition-colors">{label}</Link>
            ))}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
