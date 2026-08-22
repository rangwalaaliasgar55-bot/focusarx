"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "success" | "info" | "error";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
};

const COLORS: Record<ToastType, { bg: string; ring: string; bar: string }> = {
  success: { bg: "bg-zinc-900/95 text-emerald-300", ring: "ring-emerald-500/30", bar: "bg-emerald-500" },
  error:   { bg: "bg-zinc-900/95 text-rose-300",    ring: "ring-rose-500/30",    bar: "bg-rose-500"    },
  info:    { bg: "bg-zinc-900/95 text-zinc-200",    ring: "ring-zinc-600/50",    bar: "bg-[#7C3AED]"   },
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const c = COLORS[t.type];
  useEffect(() => {
    const id = setTimeout(() => onRemove(t.id), t.duration);
    return () => clearTimeout(id);
  }, [t.id, t.duration, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className={`pointer-events-auto relative flex min-w-[260px] max-w-sm items-start gap-3 overflow-hidden rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-xl ring-1 ${c.bg} ${c.ring}`}
    >
      <span className="shrink-0 text-base leading-none mt-0.5">{ICONS[t.type]}</span>
      <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
      <button
        type="button"
        onClick={() => onRemove(t.id)}
        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors text-xs leading-none mt-0.5"
        aria-label="Dismiss"
      >✕</button>
      {/* Progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-[2px] rounded-full ${c.bar}`}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: t.duration / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      toast(detail?.message || "We couldn't refresh this data. Please try again.", "error");
    };
    window.addEventListener("focusarx:api-error", onApiError);
    return () => window.removeEventListener("focusarx:api-error", onApiError);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none md:bottom-6">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onRemove={remove} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
