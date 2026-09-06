import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({ value, duration = 0.4, decimals = 0, prefix = "", suffix = "", className = "" }: AnimatedCounterProps) {
  const reduceMotion = useReducedMotion();
  const [current, setCurrent] = useState(reduceMotion ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const frame = useRef(0);
  const previous = useRef(0);

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) {
      previous.current = value;
      return;
    }
    const start = previous.current;
    const startedAt = performance.now();
    const milliseconds = Math.min(400, Math.max(150, duration * 1000));
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / milliseconds);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCurrent(start + (value - start) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
      else previous.current = value;
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current);
  }, [duration, isInView, reduceMotion, value]);

  const shown = reduceMotion ? value : current;
  return <span ref={ref} className={className}>{prefix}{shown.toFixed(decimals)}{suffix}</span>;
}

export function PulseNumber({ value, className = "" }: { value: number | string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const [key, setKey] = useState(0);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current !== value) {
      setKey((current) => current + 1);
      previous.current = value;
    }
  }, [value]);
  return <span key={key} className={reduceMotion ? className : `inline-block animate-pulse-once ${className}`}>{value}</span>;
}
