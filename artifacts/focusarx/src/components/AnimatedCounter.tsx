import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({ value, duration = 1.2, decimals = 0, prefix = "", suffix = "", className = "" }: AnimatedCounterProps) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const prevValue = useRef<number>(0);

  useEffect(() => {
    if (!isInView) return;
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (now: number) => {
      const elapsed = (now - startTime) / (duration * 1000);
      const progress = Math.min(1, elapsed);
      const eased = easeOutQuart(progress);
      setCurrent(start + (end - start) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, isInView, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{current.toFixed(decimals)}{suffix}
    </span>
  );
}

export function PulseNumber({ value, className = "" }: { value: number | string; className?: string }) {
  const [key, setKey] = useState(0);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setKey(k => k + 1);
      prevRef.current = value;
    }
  }, [value]);

  return (
    <span key={key} className={`inline-block animate-pulse-once ${className}`}>
      {value}
    </span>
  );
}
