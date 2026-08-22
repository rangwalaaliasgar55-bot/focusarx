import { useEffect, useRef } from "react";

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "rect" | "circle";
}

const COLORS = [
  "var(--brand-600)", "var(--brand-400)", "var(--brand-teal)", "var(--brand-gold)",
  "var(--brand-pink)", "var(--info)", "var(--success)", "var(--warning)",
];

function createParticles(count: number, origin: { x: number; y: number }): ConfettiParticle[] {
  return Array.from({ length: count }, () => ({
    x: origin.x,
    y: origin.y,
    vx: (Math.random() - 0.5) * 12,
    vy: Math.random() * -14 - 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    size: Math.random() * 7 + 4,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    opacity: 1,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));
}

interface ConfettiCelebrationProps {
  active: boolean;
  originY?: number;
  count?: number;
  duration?: number;
}

export default function ConfettiCelebration({
  active,
  originY = 0.4,
  count = 80,
  duration = 3000,
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = [
      ...createParticles(count / 2, { x: canvas.width * 0.25, y: canvas.height * originY }),
      ...createParticles(count / 2, { x: canvas.width * 0.75, y: canvas.height * originY }),
    ];
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.vy += 0.35;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - progress * 1.4);

        if (p.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }

        ctx.restore();
      });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [active, count, duration, originY]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[var(--z-modal)]"
      aria-hidden
    />
  );
}
