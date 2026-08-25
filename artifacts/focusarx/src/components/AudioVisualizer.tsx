/**
 * AudioVisualizer (Workstream D) — 12-bar canvas visualizer fed by the
 * ambient engine's analyser. Respects prefers-reduced-motion (renders a
 * calm static bar field instead of animating) and pauses when the tab
 * is hidden.
 */
import { useEffect, useRef } from "react";
import { ambientEngine } from "@/lib/ambientEngine";

const BARS = 12;

export default function AudioVisualizer({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let smooth = new Array<number>(BARS).fill(0.06);
    let data: Uint8Array<ArrayBuffer> | null = null;

    function draw() {
      const c = canvasRef.current;
      if (!c) return;
      const analyser = ambientEngine.getAnalyser();
      const w = c.width;
      const h = c.height;
      ctx2d!.clearRect(0, 0, w, h);

      if (analyser && !reduced) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(data);
        // Map the lower half of the spectrum (where ambience lives) into 12 bars.
        const usable = Math.floor(data!.length / 2);
        const per = Math.max(1, Math.floor(usable / BARS));
        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let j = 0; j < per; j++) sum += data![(i * per + j) % usable] ?? 0;
          const level = sum / per / 255;
          // Smooth: fast attack, slow release — feels like a real meter.
          smooth[i] = level > smooth[i]! ? level : smooth[i]! * 0.92 + level * 0.08;
        }
      } else if (analyser && reduced) {
        // Reduced motion: a single gentle breathing level, no per-frame flicker.
        const t = performance.now() / 4000;
        const base = 0.08 + 0.05 * (Math.sin(t) * 0.5 + 0.5);
        smooth = smooth.map((v, i) => v * 0.9 + base * (1 - Math.abs(i - BARS / 2) / BARS) * 0.1);
      }

      const gap = 3;
      const bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        const level = Math.max(0.04, Math.min(1, smooth[i]!));
        const bh = Math.max(2, level * (h - 4));
        const x = i * (bw + gap);
        const y = h - bh;
        const grad = ctx2d!.createLinearGradient(0, y, 0, h);
        grad.addColorStop(0, "var(--brand-400)");
        grad.addColorStop(1, "var(--rgba-124-58-237-0_25)");
        ctx2d!.fillStyle = grad;
        ctx2d!.fillRect(x, y, bw, bh);
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    }

    if (reduced) {
      // Static-ish: update at 4fps instead of 60 to stay cheap.
      draw();
      const iv = setInterval(draw, 250);
      return () => clearInterval(iv);
    }
    raf = requestAnimationFrame(draw);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={264}
      height={36}
      className={className}
      aria-hidden
    />
  );
}
