/**
 * In-app text prompt — replaces `window.prompt`.
 *
 * `window.prompt` is a hard stop in the flows that matter most: it renders as a
 * native sheet, it is silently discarded inside in-app browsers (Instagram,
 * Facebook, Gmail webview), and a dismissed prompt is indistinguishable from an
 * empty answer. The custom-duration control on the timer and gifting in the
 * marketplace both depended on it, so both could look "broken" with no error.
 *
 * Built on Radix Dialog, which supplies the modal behaviour that makes this
 * accessible for free and that a hand-rolled overlay usually gets wrong:
 *   • focus trap — Tab cannot reach the page behind the dialog;
 *   • focus restore — focus returns to the trigger on close;
 *   • `role="dialog"` + `aria-modal` + `aria-labelledby` from the title;
 *   • the background is `aria-hidden` while the dialog is open;
 *   • Escape closes it (and `onOpenChange(false)` resolves the promise).
 *
 * Usage:
 *   const prompt = usePrompt();
 *   const value = await prompt({ title: "Custom duration", type: "number", min: 1, max: 240 });
 *   if (value === null) return;              // cancelled
 *
 * Resolves `null` on cancel/dismiss, never a rejected promise, so callers can
 * `if (value === null) return;` without a try/catch.
 *
 * Validation runs on submit and blocks the dialog (with an assertive
 * announcement) instead of closing and discarding the user's typing — the
 * failure mode that made the old `parseInt` + toast dance so easy to get wrong.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle } from "lucide-react";
import { useDialogFocusReturn } from "@/lib/dialogFocus";

const PROMPT_FIELD_ID = "fx-prompt-field";

export interface PromptOptions {
  title: string;
  /** Supporting copy under the title. */
  description?: string;
  /** Visible label for the field. Defaults to the title. */
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "text" | "number" | "email";
  /** `min`/`max` are enforced by the input AND checked in `validateNumericBounds`. */
  min?: number;
  max?: number;
  /** Extra validation. Return an error message to block submit, or `null`. */
  validate?: (value: string) => string | null;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

type Resolver = (value: string | null) => void;
type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const PromptContext = createContext<PromptFn | null>(null);

/** Bounds check shared by the dialog and by unit tests. */
export function checkPromptValue(opts: PromptOptions, raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Please enter a value.";

  if (opts.type === "number") {
    // `Number` rather than `parseInt`, so "12abc" and "1e5" do not silently
    // become valid numbers the way the old parseInt call site did.
    const n = Number(value);
    if (!Number.isFinite(n)) return "Please enter a number.";
    if (opts.min !== undefined && n < opts.min) return `Must be at least ${opts.min}.`;
    if (opts.max !== undefined && n > opts.max) return `Must be at most ${opts.max}.`;
  }

  return opts.validate?.(value) ?? null;
}

interface Pending {
  opts: PromptOptions;
  resolve: Resolver;
}

export function PromptProvider({ children }: { children: React.ReactNode }) {
  // `pending` drives rendering; `pendingRef` drives resolution. Resolving from
  // inside a `setState` updater would be a render-phase side effect — React may
  // re-invoke updaters, and a second request arriving before the first flushed
  // would leave the first caller awaiting a promise that never settles.
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const focusReturn = useDialogFocusReturn();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const prompt = useCallback<PromptFn>((opts) => {
    return new Promise<string | null>((resolve) => {
      pendingRef.current?.resolve(null);
      // Remember where focus came from before the dialog mounts and steals it.
      focusReturn.capture();
      const next: Pending = { opts, resolve };
      pendingRef.current = next;
      setPending(next);
      setValue(opts.defaultValue ?? "");
      setError(null);
    });
  }, [focusReturn]);

  const close = useCallback((result: string | null) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(result);
  }, []);

  const submit = useCallback(() => {
    if (!pending) return;
    const problem = checkPromptValue(pending.opts, value);
    if (problem) {
      setError(problem);
      return;
    }
    close(value.trim());
  }, [pending, value, close]);

  const ctxValue = useMemo(() => prompt, [prompt]);

  return (
    <PromptContext.Provider value={ctxValue}>
      {children}
      <DialogPrimitive.Root
        open={Boolean(pending)}
        onOpenChange={(open) => {
          // Radix emits false for Escape, the overlay, and the X — every
          // dismissal path funnels through here and resolves as "cancelled".
          if (!open) close(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[calc(var(--z-modal)+5)] bg-black/55" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[calc(var(--z-modal)+5)] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)]"
            // Radix hides the background by setting aria-hidden on the siblings
            // but does not declare modality itself; screen readers honour the
            // attribute directly, so set it.
            aria-modal="true"
            onCloseAutoFocus={focusReturn.onCloseAutoFocus}
            // Radix focuses the first tabbable child; the field is the only
            // sensible target, and focusing it is what lets the user just type.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              const field = document.getElementById(PROMPT_FIELD_ID);
              if (field instanceof HTMLInputElement) {
                field.focus();
                field.select();
              }
            }}
          >
            <DialogPrimitive.Title className="text-base font-bold text-[var(--foreground)]">
              {pending?.opts.title ?? ""}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              className={pending?.opts.description ? "mt-1 text-sm text-[var(--foreground-muted)]" : "sr-only"}
            >
              {pending?.opts.description ?? "Enter a value to continue."}
            </DialogPrimitive.Description>

            <form
              // A number input with min/max aborts implicit form submission in
              // the browser BEFORE our submit handler runs, so the user got the
              // native bubble instead of the message below — and the value was
              // never announced. `noValidate` hands validation back to
              // checkPromptValue so the message is ours, styled and read out.
              noValidate
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label htmlFor={PROMPT_FIELD_ID} className="block text-xs font-semibold text-[var(--foreground-muted)]">
                {pending?.opts.label ?? "Value"}
              </label>
              <input
                id={PROMPT_FIELD_ID}
                type={pending?.opts.type ?? "text"}
                value={value}
                min={pending?.opts.min}
                max={pending?.opts.max}
                placeholder={pending?.opts.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "prompt-error" : undefined}
                onChange={(e) => {
                  setValue(e.target.value);
                  // Clear on edit: leaving a stale error under a field the user
                  // has already corrected reads as a second failure.
                  if (error) setError(null);
                }}
                className="mt-1.5 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus-visible:border-[var(--brand-500)] focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
              />

              <div aria-live="assertive" className="min-h-[1.25rem]">
                {error && (
                  <p id="prompt-error" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-error)]">
                    <AlertCircle size={13} aria-hidden="true" />
                    {error}
                  </p>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => close(null)}
                  className="min-h-11 flex-1 rounded-xl border border-[var(--border-strong)] text-sm font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  {pending?.opts.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="submit"
                  className={`min-h-11 flex-1 rounded-xl text-sm font-bold text-white transition-colors ${pending?.opts.danger ? "bg-[var(--color-error)] hover:brightness-110" : "bg-[var(--brand-600)] hover:bg-[var(--brand-700)]"}`}
                >
                  {pending?.opts.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </form>

            <DialogPrimitive.Close
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              aria-label="Close"
            >
              <span aria-hidden="true" className="text-lg leading-none">×</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </PromptContext.Provider>
  );
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext);
  if (!ctx) {
    // Graceful fallback outside the provider (tests, storybook) — mirrors
    // useConfirm, and keeps a missing provider from crashing a page.
    return (opts: PromptOptions) =>
      Promise.resolve(typeof window !== "undefined" ? window.prompt(opts.title, opts.defaultValue) : null);
  }
  return ctx;
}
