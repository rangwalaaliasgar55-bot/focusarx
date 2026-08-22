import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Undo2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "info" | "warning" | "danger" | "error";

interface ToastAction {
  label?: string;
  onClick: () => void;
}

interface ToastRecord {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);
const MAX_TOASTS = 4;

const visuals: Record<ToastType, { icon: typeof Info; color: string; soft: string; label: string }> = {
  success: { icon: CheckCircle2, color: "var(--success)", soft: "var(--success-soft)", label: "Success" },
  info: { icon: Info, color: "var(--info)", soft: "var(--info-soft)", label: "Information" },
  warning: { icon: AlertTriangle, color: "var(--warning)", soft: "var(--warning-soft)", label: "Warning" },
  danger: { icon: XCircle, color: "var(--danger)", soft: "var(--danger-soft)", label: "Error" },
  error: { icon: XCircle, color: "var(--danger)", soft: "var(--danger-soft)", label: "Error" },
};

function ToastItem({ record, onRemove }: { record: ToastRecord; onRemove: (id: string) => void }) {
  const visual = visuals[record.type];
  const Icon = visual.icon;

  useEffect(() => {
    const timeout = window.setTimeout(() => onRemove(record.id), record.duration);
    return () => window.clearTimeout(timeout);
  }, [record.duration, record.id, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-auto relative flex w-[min(calc(100vw-2rem),24rem)] items-start gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-4 text-[var(--foreground)] shadow-[var(--shadow-xl)] backdrop-blur-xl"
      role={record.type === "danger" || record.type === "error" ? "alert" : "status"}
      aria-label={visual.label}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)]" style={{ color: visual.color, background: visual.soft }}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-medium leading-snug">{record.message}</p>
        {record.action && (
          <button
            type="button"
            onClick={() => { record.action?.onClick(); onRemove(record.id); }}
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-md text-xs font-semibold text-[var(--brand-strong)] hover:underline"
          >
            <Undo2 size={13} /> {record.action.label ?? "Undo"}
          </button>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={() => onRemove(record.id)} aria-label="Dismiss notification">
        <X size={14} />
      </Button>
      <motion.span
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left"
        style={{ background: visual.color }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: record.duration / 1000, ease: "linear" }}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 4000, action?: ToastAction) => {
    const record: ToastRecord = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message, type, duration, action };
    setToasts((current) => [...current, record].slice(-MAX_TOASTS));
  }, []);

  const remove = useCallback((id: string) => setToasts((current) => current.filter((item) => item.id !== id)), []);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      toast(detail?.message || "We couldn't refresh this data. Try again in a moment.", "danger");
    };
    window.addEventListener("focusarx:api-error", handleApiError);
    return () => window.removeEventListener("focusarx:api-error", handleApiError);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={cn("pointer-events-none fixed bottom-24 right-4 z-[var(--z-toast)] flex flex-col items-end gap-2 md:bottom-6")} aria-live="polite" aria-relevant="additions">
        <AnimatePresence mode="popLayout">{toasts.map((record) => <ToastItem key={record.id} record={record} onRemove={remove} />)}</AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
