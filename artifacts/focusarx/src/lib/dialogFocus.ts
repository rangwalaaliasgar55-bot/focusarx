/**
 * Focus return for trigger-less dialogs.
 *
 * Radix's modal Content closes by running:
 *
 *   onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
 *     event.preventDefault();
 *     context.triggerRef.current?.focus();
 *   })
 *
 * i.e. it suppresses the FocusScope's generic "restore whatever was focused
 * before" behaviour and instead focuses `<Dialog.Trigger>`. That is right for a
 * dialog opened by a trigger button, and wrong for the promise-based dialogs
 * this app uses (`useConfirm` / `usePrompt`): they are opened from arbitrary
 * code — a table row's handler, a mutation callback, a keyboard shortcut — and
 * there is no Trigger to point at, so `triggerRef.current` is null, the
 * `?.focus()` is a no-op, AND the generic restore has already been cancelled.
 * Focus lands on `<body>`. A keyboard user is dropped at the top of the
 * document after every confirmation.
 *
 * The fix is to do the remembering ourselves: capture the active element at the
 * moment the dialog is opened, then hand Radix an `onCloseAutoFocus` that uses
 * it. Returning focus to the element the user came from is WCAG 2.1 AA §2.4.3
 * (Focus Order) and §3.2.2 (On Input).
 *
 * Usage:
 *   const focusReturn = useDialogFocusReturn();
 *   open(): focusReturn.capture();
 *   <Content onCloseAutoFocus={focusReturn.onCloseAutoFocus} …>
 */
import { useCallback, useRef } from "react";

export interface DialogFocusReturn {
  /** Call as the dialog opens, before the state update that mounts it. */
  capture: () => void;
  /** Spread onto the dialog Content's `onCloseAutoFocus`. */
  onCloseAutoFocus: (event: Event) => void;
}

export function useDialogFocusReturn(): DialogFocusReturn {
  const restoreToRef = useRef<HTMLElement | null>(null);

  const capture = useCallback(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    // `<body>` means nothing meaningful was focused (a click on a non-focusable
    // row leaves activeElement on body); remembering it is the same as not
    // remembering, and restoring to it would be a no-op anyway.
    restoreToRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    // Runs before Radix's own handler via composeEventHandlers; preventing
    // default is what stops Radix from trying (and failing) to focus its
    // absent Trigger.
    event.preventDefault();
    const target = restoreToRef.current;
    restoreToRef.current = null;
    // The element may have been unmounted while the dialog was open — a list
    // row deleted by the action being confirmed, for instance. Only restore
    // focus if it is still in the document.
    if (target && target.isConnected && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  }, []);

  return { capture, onCloseAutoFocus };
}
