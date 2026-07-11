/**
 * FocusArx Design System — Style Guide
 * Route: /style-guide
 *
 * Review Phase 1 tokens, typography, motion primitives, and core components
 * before rolling the system out app-wide.
 */
import { useState } from "react"
import { motion } from "framer-motion"
import {
  Zap, Star, Trophy, Heart, AlertCircle, CheckCircle2,
  Search, Mail, Eye, EyeOff, Loader2, ArrowRight, Bell, Plus,
  Settings, Trash2, Download, Upload, Sparkles, Shield, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { PAGE, STAGGER, STAGGER_CHILD, CARD, FADE_UP } from "@/lib/animations"

/* ── Section wrapper ────────────────────────────────────────────────────── */
function Section({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <motion.section variants={STAGGER_CHILD} className="space-y-5">
      <div className="pb-3 border-b border-[var(--border)]">
        <h2 className="text-h3 text-[var(--foreground)] mb-1">{title}</h2>
        {description && (
          <p className="text-sm text-[var(--foreground-muted)]">{description}</p>
        )}
      </div>
      {children}
    </motion.section>
  )
}

/* ── Row helper ─────────────────────────────────────────────────────────── */
function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-mono text-[var(--foreground-subtle)] uppercase tracking-widest">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function StyleGuidePage() {
  const [showPass, setShowPass] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  function simulateLoad() {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <motion.div
      variants={PAGE}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-5xl mx-auto px-4 py-10 space-y-16"
    >
      {/* Header */}
      <motion.div variants={FADE_UP} className="space-y-2">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.22)] text-[var(--brand-violet-light)] text-xs font-semibold">
            <Sparkles className="size-3" />
            Phase 1 — Design System
          </span>
        </div>
        <h1 className="text-display text-[var(--foreground)]">
          FocusArx{" "}
          <span className="gradient-violet">Style Guide</span>
        </h1>
        <p className="text-lg text-[var(--foreground-muted)] max-w-2xl">
          Shared design tokens, motion primitives, and core components.
          Review and approve before Phase 2 rollout.
        </p>
      </motion.div>

      {/* ── Sections ── */}
      <motion.div variants={STAGGER} initial="initial" animate="animate" className="space-y-16">

        {/* ── COLOR TOKENS ─────────────────────────────────────────────────── */}
        <Section title="Color Tokens" description="Brand palette, surfaces, and semantic colors.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "--brand-violet",       bg: "#7C3AED", text: "white" },
              { label: "--brand-violet-light", bg: "#A78BFA", text: "white" },
              { label: "--brand-teal",         bg: "#06D6A0", text: "#09091A" },
              { label: "--brand-gold",         bg: "#FFB800", text: "#09091A" },
              { label: "--color-success",      bg: "#22C55E", text: "white" },
              { label: "--color-warning",      bg: "#F59E0B", text: "white" },
              { label: "--color-error",        bg: "#EF4444", text: "white" },
              { label: "--color-info",         bg: "#3B82F6", text: "white" },
            ].map(({ label, bg, text }) => (
              <div key={label} className="space-y-1.5">
                <div
                  className="h-16 w-full rounded-[var(--radius-md)]"
                  style={{ background: bg }}
                />
                <p className="text-[10px] font-mono text-[var(--foreground-subtle)] truncate">{label}</p>
                <p className="text-xs font-mono text-[var(--foreground-muted)]">{bg}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: "--surface-0", bg: "var(--surface-0)", border: true },
              { label: "--surface-1", bg: "var(--surface-1)", border: true },
              { label: "--surface-2", bg: "var(--surface-2)", border: true },
              { label: "--surface-3", bg: "var(--surface-3)", border: true },
            ].map(({ label, bg, border }) => (
              <div key={label} className="space-y-1.5">
                <div
                  className="h-16 w-full rounded-[var(--radius-md)]"
                  style={{
                    background: bg,
                    border: border ? "1px solid var(--border)" : undefined,
                  }}
                />
                <p className="text-[10px] font-mono text-[var(--foreground-subtle)]">{label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── TYPOGRAPHY ───────────────────────────────────────────────────── */}
        <Section title="Typography Scale" description="Geist sans for UI text. Geist Mono for metrics and data.">
          <div className="space-y-4">
            {[
              { cls: "text-display",  label: "Display — 3rem / 700",     sample: "Build your focus." },
              { cls: "text-h1",       label: "H1 — 2.25rem / 700",       sample: "Master deep work." },
              { cls: "text-h2",       label: "H2 — 1.875rem / 600",      sample: "AI-powered sessions." },
              { cls: "text-h3",       label: "H3 — 1.5rem / 600",        sample: "Track your progress." },
              { cls: "text-h4",       label: "H4 — 1.25rem / 600",       sample: "Today's focus goal." },
              { cls: "text-body",     label: "Body — 0.9375rem / 400",   sample: "FocusArx helps you build deep focus habits through Pomodoro sessions and AI insights." },
              { cls: "text-caption",  label: "Caption — 0.75rem / 400",  sample: "Last session 2 hours ago · 94 min streak" },
            ].map(({ cls, label, sample }) => (
              <div key={cls} className="flex items-baseline gap-6 py-2 border-b border-[var(--border)] last:border-0">
                <span className="w-48 shrink-0 text-[10px] font-mono text-[var(--foreground-subtle)] uppercase tracking-wider">{label}</span>
                <span className={cls}>{sample}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-[var(--radius-lg)] bg-[rgba(255,255,255,0.025)] border border-[var(--border)]">
            <p className="text-xs text-[var(--foreground-subtle)] mb-3 font-mono uppercase tracking-widest">Monospace (metrics / timer)</p>
            <div className="flex gap-8 flex-wrap">
              <span className="font-metric text-5xl font-bold text-[var(--foreground)]">24:59</span>
              <span className="font-metric text-2xl text-[var(--brand-violet-light)]">847 XP</span>
              <span className="font-metric text-2xl text-[var(--brand-gold)]">12 🔥</span>
              <span className="font-metric text-lg text-[var(--brand-teal)]">98.4%</span>
            </div>
          </div>
        </Section>

        {/* ── SHADOW / ELEVATION ───────────────────────────────────────────── */}
        <Section title="Elevation Scale" description="Consistent shadow progression from xs to xl.">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {(["xs","sm","md","lg","xl"] as const).map((s) => (
              <div key={s} className="space-y-3">
                <div
                  className="h-20 w-full rounded-[var(--radius-lg)] bg-[var(--surface-1)]"
                  style={{ boxShadow: `var(--shadow-${s})` }}
                />
                <p className="text-xs font-mono text-center text-[var(--foreground-muted)]">--shadow-{s}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── BUTTONS ──────────────────────────────────────────────────────── */}
        <Section title="Buttons" description="All variants at default size. Hover/active/disabled/loading states.">
          <Row label="variants">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="glow"><Sparkles className="size-4" /> Glow CTA</Button>
            <Button variant="link">Link</Button>
          </Row>

          <Row label="sizes">
            <Button size="xs">XS</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">XL</Button>
            <Button size="icon"><Plus /></Button>
            <Button size="icon" variant="outline"><Bell /></Button>
            <Button size="icon" variant="secondary"><Settings /></Button>
          </Row>

          <Row label="states">
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>Disabled outline</Button>
            <Button loading onClick={simulateLoad}>Loading button</Button>
            <Button loading variant="secondary">Processing</Button>
          </Row>

          <Row label="with icons">
            <Button><ArrowRight className="size-4" /> Start Session</Button>
            <Button variant="outline"><Download className="size-4" /> Export</Button>
            <Button variant="secondary"><Upload className="size-4" /> Upload</Button>
            <Button variant="destructive"><Trash2 className="size-4" /> Delete</Button>
          </Row>
        </Section>

        {/* ── BADGES ───────────────────────────────────────────────────────── */}
        <Section title="Badges" description="Status indicators, labels, and rarity tags.">
          <Row label="variants">
            <Badge variant="default">Violet</Badge>
            <Badge variant="teal">Teal</Badge>
            <Badge variant="gold">Gold</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
          </Row>

          <Row label="with icons">
            <Badge variant="default"><Zap className="size-3" /> AI-Powered</Badge>
            <Badge variant="gold"><Trophy className="size-3" /> Legend</Badge>
            <Badge variant="teal"><CheckCircle2 className="size-3" /> Verified</Badge>
            <Badge variant="error"><AlertCircle className="size-3" /> Overdue</Badge>
            <Badge variant="success"><Shield className="size-3" /> Secure</Badge>
          </Row>

          <Row label="rank / rarity">
            {[
              ["Beginner", "--rank-beginner"],
              ["Apprentice", "--rank-apprentice"],
              ["Scholar", "--rank-scholar"],
              ["Expert", "--rank-expert"],
              ["Master", "--rank-master"],
              ["Legend", "--rank-legend"],
            ].map(([name, token]) => (
              <span
                key={name}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                style={{ color: `var(${token})`, borderColor: `var(${token})`, background: `color-mix(in srgb, var(${token}) 12%, transparent)` }}
              >
                {name}
              </span>
            ))}
          </Row>
        </Section>

        {/* ── INPUTS ───────────────────────────────────────────────────────── */}
        <Section title="Inputs" description="Form fields with all validation states and slot adornments.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">Default</label>
              <Input placeholder="Enter something..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">With left icon</label>
              <Input placeholder="Search..." leftSlot={<Search className="size-4" />} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">Email</label>
              <Input type="email" placeholder="ali@focusarx.com" leftSlot={<Mail className="size-4" />} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">Password</label>
              <Input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                leftSlot={<Lock className="size-4" />}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-red-400 uppercase tracking-wider">Error state</label>
              <Input placeholder="Invalid input" error defaultValue="bad@email" />
              <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="size-3" /> Please enter a valid email address.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Success state</label>
              <Input placeholder="Valid input" success defaultValue="ali@focusarx.com" />
              <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="size-3" /> Looks good!</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--foreground-subtle)] uppercase tracking-wider">Disabled</label>
              <Input placeholder="Cannot edit" disabled defaultValue="Read only" />
            </div>
          </div>
        </Section>

        {/* ── CARDS ────────────────────────────────────────────────────────── */}
        <Section title="Cards" description="Surface elevation levels and interactive variants.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Default Card</CardTitle>
                <CardDescription>Elevation 1 — glass surface with subtle violet border.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground-muted)]">Main content area for data, stats, or any rich content you need to display.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="outline">Action</Button>
              </CardFooter>
            </Card>

            <Card elevation="elevated">
              <CardHeader>
                <CardTitle>Elevated Card</CardTitle>
                <CardDescription>Elevation 2 — deeper surface with stronger blur and shadow.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground-muted)]">Used for popovers, dropdowns, and floating panels.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="secondary">Action</Button>
              </CardFooter>
            </Card>

            <Card elevation="glow" pulsing>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="size-4 text-[var(--brand-violet-light)]" />
                  Glow Card
                </CardTitle>
                <CardDescription>Featured or active state. Pulsing neon border animation.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground-muted)]">Used to highlight important metrics, active sessions, or premium features.</p>
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="glow"><Sparkles className="size-4" /> Premium</Button>
              </CardFooter>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Card interactive elevation="default">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="size-4 text-[var(--brand-teal)]" />
                  Interactive Card
                </CardTitle>
                <CardDescription>Hover me — lift effect with shadow transition.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground-muted)]">Used for clickable list items, navigation cards, or selectable options.</p>
              </CardContent>
            </Card>

            <Card elevation="flat">
              <CardHeader>
                <CardTitle>Flat Card</CardTitle>
                <CardDescription>Minimal border — for nested panels and inner sections.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--foreground-muted)]">No backdrop blur, no shadow. Clean and lightweight for inner layouts.</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── DIALOG ───────────────────────────────────────────────────────── */}
        <Section title="Dialog / Modal" description="Accessible modal with overlay blur, spring animation, and proper focus management.">
          <Row>
            <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm session end</DialogTitle>
                  <DialogDescription>
                    You have 14 minutes remaining. Are you sure you want to end this session early? Your progress will still be saved.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <Card elevation="flat" className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-[var(--radius-md)] bg-[rgba(124,58,237,0.12)]">
                        <Zap className="size-4 text-[var(--brand-violet-light)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">+47 XP earned so far</p>
                        <p className="text-xs text-[var(--foreground-muted)]">Completing will award +12 bonus XP</p>
                      </div>
                    </div>
                  </Card>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Keep going</Button>
                  <Button variant="destructive" onClick={() => setDialogOpen(false)}>End session</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DialogTrigger asChild>
              <Button variant="outline">
                <DialogDemoTrigger />
              </Button>
            </DialogTrigger>
          </Row>
        </Section>

        {/* ── MOTION PRIMITIVES ────────────────────────────────────────────── */}
        <Section title="Motion Primitives" description="All variants are spring-based. Hover the cards to see hover states.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: "PAGE",       desc: "Fade + slide-up. Every page entrance." },
              { name: "CARD",       desc: "Scale + slide-up. Card/panel entrance." },
              { name: "STAGGER",    desc: "Stagger container (65ms gap)." },
              { name: "POP",        desc: "Spring pop. Badges, tooltips, rewards." },
              { name: "SLIDE_UP",   desc: "Fade + slide-up. Section reveals." },
              { name: "FADE_IN",    desc: "Opacity only. Subtlest entrance." },
              { name: "MODAL",      desc: "Scale + slide. Dialogs & sheets." },
              { name: "TOAST",      desc: "Snappy spring. Notifications." },
            ].map(({ name, desc }) => (
              <motion.div
                key={name}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer p-4 rounded-[var(--radius-lg)] bg-[rgba(124,58,237,0.06)] border border-[rgba(124,58,237,0.14)] hover:border-[rgba(124,58,237,0.30)] transition-colors"
              >
                <p className="text-sm font-mono font-semibold text-[var(--brand-violet-light)] mb-1">{name}</p>
                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── RADIUS SCALE ─────────────────────────────────────────────────── */}
        <Section title="Radius Scale" description="Consistent corner radii across the system.">
          <div className="flex flex-wrap gap-4">
            {[
              { token: "xs", px: "4px" },
              { token: "sm", px: "6px" },
              { token: "md", px: "10px" },
              { token: "lg", px: "14px" },
              { token: "xl", px: "18px" },
              { token: "2xl", px: "24px" },
              { token: "full", px: "9999px" },
            ].map(({ token, px }) => (
              <div key={token} className="text-center space-y-2">
                <div
                  className="w-16 h-16 bg-[rgba(124,58,237,0.20)] border border-[rgba(124,58,237,0.30)]"
                  style={{ borderRadius: `var(--radius-${token})` }}
                />
                <p className="text-[10px] font-mono text-[var(--foreground-muted)]">--radius-{token}</p>
                <p className="text-[10px] font-mono text-[var(--foreground-subtle)]">{px}</p>
              </div>
            ))}
          </div>
        </Section>

      </motion.div>
    </motion.div>
  )
}

/* ── Inline trigger for second dialog demo ──────────────────────────────── */
function DialogDemoTrigger() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <span>Trigger variant</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger variant</DialogTitle>
          <DialogDescription>This dialog was opened with DialogTrigger asChild pattern.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-[var(--foreground-muted)]">Works correctly with Radix focus management and keyboard navigation.</p>
        </DialogBody>
        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline">Close</Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
