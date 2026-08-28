
import { motion } from "framer-motion";

interface SessionDotsProps {
  completed: number;
  total: number;
}

export function SessionDots({ completed, total }: SessionDotsProps) {
  if (total <= 0) return null;

  const cycle = completed % total;
  const allFilledThisCycle = completed > 0 && completed % total === 0;

  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={`${completed} focus sessions completed in total`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const filled = allFilledThisCycle || i < cycle;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={{
              scale: filled ? 1 : 0.92,
              opacity: filled ? 1 : 0.35,
            }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className={`h-2 w-2 rounded-full ${
              filled ? "bg-[var(--palette-rose-500)] shadow-[0_0_12px_var(--rgba-244-63-94-0_45)]" : "bg-[var(--palette-zinc-600)]/80"
            }`}
          />
        );
      })}
    </div>
  );
}
