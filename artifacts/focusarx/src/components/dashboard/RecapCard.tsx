/**
 * Weekly recap card (Phase 9.11): the week in one line, a share image from
 * real stats, and a one-tap email. Everything degrades quietly when the
 * backend is unreachable or email is unconfigured.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface Recap {
  sessions: number;
  minutes: number;
  bestHour: number | null;
  currentStreak: number;
  shareImage: string;
}

export default function RecapCard() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const recap = useQuery({
    queryKey: ["weekly-recap"],
    queryFn: () => apiJson<Recap>("/api/recap/weekly"),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const copy = async () => {
    const r = recap.data;
    if (!r) return;
    const text = `My FocusArx week: ${r.sessions} sessions, ${r.minutes} focused minutes, ${r.currentStreak}-day streak.`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Recap copied.", "success");
    } catch {
      toast(text, "info");
    }
  };

  const email = async () => {
    setSending(true);
    try {
      await apiJson("/api/recap/weekly/email", { method: "POST" });
      toast("Recap on its way.", "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Could not send recap.", "error");
    } finally {
      setSending(false);
    }
  };

  const r = recap.data;
  if (recap.isError || (!recap.isLoading && !r)) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Share2 size={16} /> Weekly recap</CardTitle>
          <CardDescription>
            {recap.isLoading || !r
              ? "Tallying your week…"
              : `${r.sessions} sessions · ${r.minutes} min · ${r.currentStreak}-day streak${r.bestHour != null ? ` · sharpest at ${r.bestHour}:00` : ""}`}
          </CardDescription>
        </div>
      </CardHeader>
      {r && (
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copy()} className="min-h-[44px]">
              Copy summary
            </Button>
            <a
              href={r.shareImage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-xs font-bold ring-1 ring-[var(--border-subtle)]"
            >
              Share image
            </a>
            <Button size="sm" variant="outline" onClick={() => void email()} disabled={sending} className="min-h-[44px]">
              <Mail size={14} /> {sending ? "Sending…" : "Email me"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
