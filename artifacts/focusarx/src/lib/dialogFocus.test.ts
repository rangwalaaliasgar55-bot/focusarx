/**
 * The focus-return contract for trigger-less dialogs.
 *
 * Radix cancels its own focus restore and points at `<Dialog.Trigger>`, which
 * promise-based dialogs do not have — so without this helper every confirmation
 * dropped the keyboard user onto `<body>`. These cases pin the behaviour,
 * including the two ways it must NOT override the app: restoring to `<body>`
 * (meaningless) and restoring to a node that has since been unmounted.
 */
import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDialogFocusReturn } from "./dialogFocus";

afterEach(() => {
  document.body.innerHTML = "";
});

function makeButton(label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  document.body.appendChild(b);
  return b;
}

/** A focus event, as Radix's AUTOFOCUS_ON_UNMOUNT CustomEvent arrives. */
function unmountFocusEvent(): Event {
  return new Event("focus", { cancelable: true });
}

describe("useDialogFocusReturn", () => {
  it("returns focus to the element that was focused when the dialog opened", () => {
    const trigger = makeButton("open");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { result } = renderHook(() => useDialogFocusReturn());
    result.current.capture();

    // The dialog takes focus while open.
    const field = makeButton("inside");
    field.focus();
    expect(document.activeElement).toBe(field);

    result.current.onCloseAutoFocus(unmountFocusEvent());
    expect(document.activeElement).toBe(trigger);
  });

  it("prevents the default so Radix does not focus its absent Trigger", () => {
    const trigger = makeButton("open");
    trigger.focus();

    const { result } = renderHook(() => useDialogFocusReturn());
    result.current.capture();

    const event = unmountFocusEvent();
    result.current.onCloseAutoFocus(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not remember <body> and leaves focus alone", () => {
    // A click on a non-focusable row leaves activeElement on body; remembering
    // it would be a no-op that reads as a bug in the trace.
    (document.activeElement as HTMLElement | null)?.blur?.();
    expect(document.activeElement).toBe(document.body);

    const { result } = renderHook(() => useDialogFocusReturn());
    result.current.capture();

    const event = unmountFocusEvent();
    result.current.onCloseAutoFocus(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("skips an element that was unmounted while the dialog was open", () => {
    // Confirming "delete row" removes the row that opened the dialog.
    const row = makeButton("row");
    row.focus();

    const { result } = renderHook(() => useDialogFocusReturn());
    result.current.capture();

    row.remove();
    expect(row.isConnected).toBe(false);

    const fallback = makeButton("elsewhere");
    fallback.focus();

    result.current.onCloseAutoFocus(unmountFocusEvent());
    expect(document.activeElement).toBe(fallback);
  });

  it("consumes the remembered element so a second close cannot re-focus it", () => {
    const first = makeButton("first");
    first.focus();

    const { result } = renderHook(() => useDialogFocusReturn());
    result.current.capture();

    const interim = makeButton("interim");
    interim.focus();
    result.current.onCloseAutoFocus(unmountFocusEvent());
    expect(document.activeElement).toBe(first);

    // No second capture: a repeat close must not yank focus back to `first`.
    const later = makeButton("later");
    later.focus();
    result.current.onCloseAutoFocus(unmountFocusEvent());
    expect(document.activeElement).toBe(later);
  });
});
