/**
 * ShareCardModal (Workstream K) — OG-style share card for a completed session.
 *
 * Renders a 1200×630 SVG entirely client-side (no server round-trip, no
 * auth headaches with <img>/window.open), then offers:
 *   - Download as PNG (SVG → Image → canvas → blob)
 *   - Native share with the image file (navigator.share when supported)
 *   - Copy share text (fallback, pre-existing behavior)
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Download, Image as ImageIcon, Share2, X } from "lucide-react";

export type ShareCardStats = {
  userName?: string | null;
  durationSeconds: number;
  focusScore?: number | null;
  earnedXp?: number;
  earnedCoins?: number;
  streakDays?: number | null;
  date: Date;
};

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildShareCardSvg(s: ShareCardStats): string {
  const mins = Math.max(1, Math.round(s.durationSeconds / 60));
  const timeLabel =
    s.durationSeconds >= 3600
      ? `${Math.floor(s.durationSeconds / 3600)}h ${String(Math.round((s.durationSeconds % 3600) / 60)).padStart(2, "0")}m`
      : `${String(mins).padStart(2, "0")}:${String(Math.round(s.durationSeconds % 60)).padStart(2, "0")}`;
  const dateLabel = s.date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const score = s.focusScore != null ? `${Math.round(s.focusScore)}%` : "—";
  const xp = s.earnedXp ?? 0;
  const coins = s.earnedCoins ?? 0;
  const name = s.userName ? esc(s.userName) : "A FocusArx learner";
  const streakChip =
    (s.streakDays ?? 0) >= 2
      ? `<g transform="translate(72, 470)">
           <rect x="0" y="0" width="${40 + s.streakDays!.toString().length * 34}" height="52" rx="26" fill="#7C3AED" fill-opacity="0.16" stroke="#8B5CF6" stroke-opacity="0.4"/>
           <text x="24" y="34" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="26" fill="#C4B5FD">🔥 ${s.streakDays}-day streak</text>
         </g>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0B14"/>
      <stop offset="0.55" stop-color="#0E0C1C"/>
      <stop offset="1" stop-color="#171032"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.9">
      <stop offset="0" stop-color="#7C3AED" stop-opacity="0.35"/>
      <stop offset="0.5" stop-color="#7C3AED" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8B5CF6"/>
      <stop offset="1" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="1050" cy="90" r="220" fill="none" stroke="url(#ring)" stroke-opacity="0.14" stroke-width="40"/>
  <circle cx="120" cy="560" r="160" fill="none" stroke="#8B5CF6" stroke-opacity="0.08" stroke-width="30"/>

  <!-- brand -->
  <g transform="translate(72, 64)">
    <text font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="40" font-weight="700" fill="#A78BFA">⚡ FocusArx</text>
    <text y="44" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="20" font-weight="600" letter-spacing="4" fill="#6D6A85">DEEP WORK REPORT</text>
  </g>

  <!-- headline -->
  <text x="72" y="290" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="30" fill="#B4B2C8">${name} just locked in</text>
  <text x="72" y="400" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="118" font-weight="700" fill="#F5F4FF" letter-spacing="-3">${timeLabel}</text>
  <text x="74" y="446" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="26" fill="#8B88A5">of uninterrupted deep focus</text>

  ${streakChip}

  <!-- stat row -->
  <g transform="translate(72, 530)">
    <text font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="#E4E2F2">${score}</text>
    <text y="38" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="18" fill="#6D6A85">focus score</text>
    <text x="300" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="#C4B5FD">+${xp}</text>
    <text x="300" y="38" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="18" fill="#6D6A85">XP earned</text>
    <text x="520" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="34" font-weight="700" fill="#FCD34D">+${coins}</text>
    <text x="520" y="38" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="18" fill="#6D6A85">coins earned</text>
  </g>

  <!-- footer -->
  <line x1="72" y1="584" x2="1128" y2="584" stroke="#2A2740" stroke-width="1"/>
  <text x="72" y="614" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="19" fill="#6D6A85">${esc(dateLabel)}</text>
  <text x="1128" y="614" text-anchor="end" font-family="-apple-system, 'SF Pro Display', 'Geist Variable', Inter, system-ui, sans-serif" font-size="19" font-weight="700" fill="#8B5CF6">focusarx.site</text>
</svg>`;
}

function svgToPngBlob(svg: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        }, "image/png");
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e as Error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG rasterization failed"));
    };
    img.src = url;
  });
}

export function ShareCardModal({
  open,
  stats,
  onClose,
}: {
  open: boolean;
  stats: ShareCardStats;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const svg = useMemo(() => (open ? buildShareCardSvg(stats) : ""), [open, stats]);
  const dataUrl = useMemo(
    () => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ""),
    [svg]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const downloadPng = async () => {
    setBusy(true);
    try {
      const blob = await svgToPngBlob(svg, 1200, 630);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `focusarx-session-${stats.date.toISOString().slice(0, 10)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      /* download unavailable */
    } finally {
      setBusy(false);
    }
  };

  const shareImage = async () => {
    setBusy(true);
    try {
      const blob = await svgToPngBlob(svg, 1200, 630);
      const file = new File([blob], "focusarx-session.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My FocusArx session", text: "Just locked in a deep work session on FocusArx ⚡ focusarx.site" });
      } else {
        await downloadPng();
      }
    } catch {
      /* cancelled or unsupported — download fallback covers it */
    } finally {
      setBusy(false);
    }
  };

  const shareText = async () => {
    const mins = Math.max(1, Math.round(stats.durationSeconds / 60));
    const scoreText = stats.focusScore != null ? ` · ${Math.round(stats.focusScore)}% focus score` : "";
    const xpText = (stats.earnedXp ?? 0) > 0 ? ` · +${stats.earnedXp} XP` : "";
    const text = `🎯 Just completed a ${mins}-min focus session on FocusArx${scoreText}${xpText} 🔥\nBuilding the deep work habit one block at a time. focusarx.site`;
    if (navigator.share) {
      try { await navigator.share({ text, url: "https://focusarx.site" }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl border border-[var(--palette-white)]/10 bg-[#0B0B14] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-[var(--palette-violet-400)]" />
                <p className="text-sm font-bold">Share card</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--foreground-subtle)] hover:bg-white/5" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--palette-white)]/8">
              <img src={dataUrl} alt="FocusArx session share card" className="w-full" width={1200} height={630} />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => void shareImage()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                <Share2 size={14} /> Share image
              </button>
              <button
                onClick={() => void downloadPng()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--palette-white)]/10 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                onClick={() => void shareText()}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--palette-white)]/10 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                {copied ? "Copied!" : "Share text"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ShareCardModal;
