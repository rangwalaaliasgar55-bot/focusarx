/**
 * In-app confirmation dialog — replaces `window.confirm`, which renders as a
 * jarring native sheet, is blocked inside some in-app browsers (Instagram,
 * Facebook), and cannot be styled or made accessible.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete habit?", confirmLabel: "Delete", danger: true })) …
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

type Resolver = (ok: boolean) => void;

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: Resolver } | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        // A second request while one is open cancels the first.
        prev?.resolve(false);
        return { opts, resolve };
      });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [pending, close]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[calc(var(--z-modal)+5)] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => close(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby={pending.opts.description ? "confirm-desc" : undefined}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                {pending.opts.danger && (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-error)]/12 text-[var(--color-error)]" aria-hidden>
                    <AlertTriangle size={17} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 id="confirm-title" className="text-base font-bold text-[var(--foreground)]">{pending.opts.title}</h2>
                  {pending.opts.description && (
                    <p id="confirm-desc" className="mt-1 text-sm text-[var(--foreground-muted)]">{pending.opts.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="min-h-11 flex-1 rounded-xl border border-[var(--border-strong)] text-sm font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  {pending.opts.cancelLabel ?? "Cancel"}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={() => close(true)}
                  className={`min-h-11 flex-1 rounded-xl text-sm font-bold text-white transition-colors ${pending.opts.danger ? "bg-[var(--color-error)] hover:brightness-110" : "bg-[var(--brand-600)] hover:bg-[var(--brand-700)]"}`}
                >
                  {pending.opts.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful fallback outside the provider (tests, storybook).
    return (opts: ConfirmOptions) => Promise.resolve(typeof window !== "undefined" ? window.confirm(opts.title) : false);
  }
  return ctx;
}
