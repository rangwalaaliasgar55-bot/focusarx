/**
 * In-app confirmation dialog — replaces `window.confirm`, which renders as a
 * jarring native sheet, is blocked inside some in-app browsers (Instagram,
 * Facebook), and cannot be styled or made accessible.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete habit?", confirmLabel: "Delete", danger: true })) …
 *
 * Built on Radix Dialog. The previous hand-rolled overlay listened for Escape
 * and focused the confirm button, but that is only part of what a modal owes a
 * keyboard or screen-reader user — Tab walked straight out of the dialog into
 * the page behind it, focus was not restored to the trigger on close, and the
 * background was never `aria-hidden`, so a screen reader read the whole page
 * underneath as though the dialog were not there (WCAG 2.1 AA §2.1.2 No
 * Keyboard Trap is satisfied by *trapping* focus here, and §2.4.3 / §3.2.2
 * need the focus order and the return).
 *
 * Radix supplies, unconditionally:
 *   • focus trap — Tab and Shift+Tab cycle within the dialog;
 *   • focus restore — focus returns to whatever opened it;
 *   • `role="dialog"` + `aria-modal="true"` + title/description wiring;
 *   • `aria-hidden` on the rest of the page while open;
 *   • Escape and overlay-click dismiss (both resolve `false`).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { useDialogFocusReturn } from "@/lib/dialogFocus";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

type Resolver = (ok: boolean) => void;
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending {
  opts: ConfirmOptions;
  resolve: Resolver;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // `pending` drives rendering; `pendingRef` drives resolution. Resolving from
  // inside a `setState` updater would be a side effect during render — React is
  // free to invoke an updater more than once, and a second request arriving
  // before the first updater flushed would leave the first caller awaiting a
  // promise that never settles. The ref makes "cancel the previous request"
  // synchronous and exact.
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const focusReturn = useDialogFocusReturn();

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      // Remember where focus came from before the dialog mounts and steals it.
      focusReturn.capture();
      const next: Pending = { opts, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, [focusReturn]);

  const close = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(ok);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <DialogPrimitive.Root
        open={Boolean(pending)}
        onOpenChange={(open) => {
          // Escape, the overlay and the X all arrive here — every dismissal
          // path resolves as "declined".
          if (!open) close(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[calc(var(--z-modal)+5)] bg-black/55" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[calc(var(--z-modal)+5)] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)]"
            // Radix makes the background inert by setting aria-hidden on the
            // siblings, but it does not declare the modality itself. Screen
            // readers on Windows and Android honour aria-modal directly, so set
            // it rather than relying on the sibling hiding alone.
            aria-modal="true"
            onCloseAutoFocus={focusReturn.onCloseAutoFocus}
            // The dialog reports the decision; the confirm button is where a
            // keyboard user wants to be, not the dialog container.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              confirmBtnRef.current?.focus();
            }}
          >
            <div className="flex items-start gap-3">
              {pending?.opts.danger && (
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-error)]/12 text-[var(--color-error)]"
                  aria-hidden="true"
                >
                  <AlertTriangle size={17} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-base font-bold text-[var(--foreground)]">
                  {pending?.opts.title ?? ""}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description
                  className={pending?.opts.description ? "mt-1 text-sm text-[var(--foreground-muted)]" : "sr-only"}
                >
                  {pending?.opts.description ?? "Confirm to continue."}
                </DialogPrimitive.Description>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="min-h-11 flex-1 rounded-xl border border-[var(--border-strong)] text-sm font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                {pending?.opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={`min-h-11 flex-1 rounded-xl text-sm font-bold text-white transition-colors ${pending?.opts.danger ? "bg-[var(--color-error)] hover:brightness-110" : "bg-[var(--brand-600)] hover:bg-[var(--brand-700)]"}`}
              >
                {pending?.opts.confirmLabel ?? "Confirm"}
              </button>
            </div>

            <DialogPrimitive.Close
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              aria-label="Close"
            >
              <span aria-hidden="true" className="text-lg leading-none">×</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful fallback outside the provider (tests, storybook).
    return (opts: ConfirmOptions) => Promise.resolve(typeof window !== "undefined" ? window.confirm(opts.title) : false);
  }
  return ctx;
}
