import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Flame, HeartHandshake, MessageSquare, SmilePlus, Wind } from "lucide-react";
import BreakFreeStreak from "@/components/break-free/BreakFreeStreak";
import MoodCheckin from "@/components/break-free/MoodCheckin";
import PledgeWall from "@/components/break-free/PledgeWall";
import UrgeSurfing from "@/components/break-free/UrgeSurfing";
import WhyItMatters from "@/components/break-free/WhyItMatters";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBreakFreeAuthReady } from "@/hooks/useBreakFreeAuthReady";

const TABS = [
  { id: "streak", label: "Progress", icon: Flame, component: BreakFreeStreak },
  { id: "urge", label: "Urge surfing", icon: Wind, component: UrgeSurfing },
  { id: "mood", label: "Mood check-in", icon: SmilePlus, component: MoodCheckin },
  { id: "why", label: "Why it matters", icon: BookOpen, component: WhyItMatters },
  { id: "pledges", label: "Pledge wall", icon: MessageSquare, component: PledgeWall },
];

export default function BreakFreePage() {
  const { loading } = useBreakFreeAuthReady();
  return (
    <div className="page-container break-free-suite">
      <PageHeader
        eyebrow="Digital wellbeing"
        title="Break Free"
        subtitle="A private, shame-free space to notice patterns, ride out urges, and keep one promise at a time."
        icon={<HeartHandshake />}
        actions={<Button asChild variant="ghost"><Link href="/dashboard"><ArrowLeft /> Back to dashboard</Link></Button>}
      />

      <div className="rounded-[var(--radius-2xl)] border border-[color-mix(in_srgb,var(--brand-teal)_20%,transparent)] bg-[color-mix(in_srgb,var(--brand-teal)_4%,var(--surface))] p-2 shadow-[var(--shadow-sm)] sm:p-4">
        <Tabs defaultValue="streak">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-[var(--surface-hover)] p-1 sm:grid-cols-5" aria-label="Break Free tools">
            {TABS.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="min-h-11 gap-2 rounded-[var(--radius-md)] data-[state=active]:bg-[var(--surface-raised)] data-[state=active]:text-[var(--brand-teal)]"><Icon size={15} /> <span>{label}</span></TabsTrigger>)}
          </TabsList>

          {loading ? (
            <div className="space-y-4 p-4 sm:p-8" role="status" aria-label="Loading Break Free tools"><Skeleton className="h-10 w-48" /><Skeleton className="h-56" /><Skeleton className="h-24" /></div>
          ) : TABS.map(({ id, component: Component }) => (
            <TabsContent key={id} value={id} className="mt-2 focus-visible:outline-none">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                <Component />
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-[var(--foreground-subtle)]">Your wellbeing data stays private. Camera processing elsewhere in FocusArx is completely separate from this suite.</p>
    </div>
  );
}
