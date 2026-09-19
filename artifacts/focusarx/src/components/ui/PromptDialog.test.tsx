/**
 * The two promise-based dialog primitives.
 *
 * These exist because `window.prompt` / `window.confirm` are dropped by in-app
 * browsers and cannot be made accessible. The behaviour worth locking down is
 * therefore (a) the promise contract — cancel is `null`/`false`, never a hang,
 * and (b) the modal accessibility contract that a hand-rolled overlay gets
 * wrong: focus enters the dialog, Tab stays inside it, focus returns to the
 * trigger, and the dialog is announced as a modal.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";
import { PromptProvider, usePrompt, checkPromptValue } from "./PromptDialog";

afterEach(cleanup);

/* ── checkPromptValue (pure) ──────────────────────────────────────────────── */

describe("checkPromptValue", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(checkPromptValue({ title: "t" }, "")).toMatch(/enter a value/i);
    expect(checkPromptValue({ title: "t" }, "   ")).toMatch(/enter a value/i);
  });

  it("accepts any non-empty text when no type is given", () => {
    expect(checkPromptValue({ title: "t" }, "anything")).toBeNull();
  });

  it("rejects values parseInt would have silently accepted", () => {
    // The old call site used parseInt, so "12abc" became 12 and "1e5" became 1.
    expect(checkPromptValue({ title: "t", type: "number" }, "12abc")).toMatch(/enter a number/i);
    expect(checkPromptValue({ title: "t", type: "number" }, "abc")).toMatch(/enter a number/i);
    expect(checkPromptValue({ title: "t", type: "number" }, "1e5")).toBeNull();
  });

  it("enforces min and max inclusively", () => {
    expect(checkPromptValue({ title: "t", type: "number", min: 1, max: 240 }, "0")).toMatch(/at least 1/);
    expect(checkPromptValue({ title: "t", type: "number", min: 1, max: 240 }, "241")).toMatch(/at most 240/);
    expect(checkPromptValue({ title: "t", type: "number", min: 1, max: 240 }, "1")).toBeNull();
    expect(checkPromptValue({ title: "t", type: "number", min: 1, max: 240 }, "240")).toBeNull();
  });

  it("runs a caller-supplied validator last, on the trimmed value", () => {
    const seen: string[] = [];
    const validate = (v: string) => {
      seen.push(v);
      return v === "no" ? "nope" : null;
    };
    expect(checkPromptValue({ title: "t", validate }, " yes ")).toBeNull();
    expect(checkPromptValue({ title: "t", validate }, "no")).toBe("nope");
    expect(seen).toEqual(["yes", "no"]);
  });
});

/* ── Harnesses ────────────────────────────────────────────────────────────── */

function PromptHarness({ opts, onResult }: { opts: Parameters<ReturnType<typeof usePrompt>>[0]; onResult: (v: string | null) => void }) {
  const prompt = usePrompt();
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={btn}
      type="button"
      onClick={async () => onResult(await prompt(opts))}
    >
      open prompt
    </button>
  );
}

function ConfirmHarness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onResult(await confirm({ title: "Delete it?", danger: true }))}>
      open confirm
    </button>
  );
}

/* ── PromptDialog ─────────────────────────────────────────────────────────── */

describe("PromptDialog", () => {
  it("resolves the trimmed value on submit and closes", async () => {
    const results: (string | null)[] = [];
    render(
      <PromptProvider>
        <PromptHarness opts={{ title: "Custom duration", label: "Minutes" }} onResult={(v) => results.push(v)} />
      </PromptProvider>,
    );

    fireEvent.click(screen.getByText("open prompt"));
    const field = await screen.findByLabelText("Minutes");
    fireEvent.change(field, { target: { value: "  35  " } });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(results).toEqual(["35"]));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resolves null when cancelled — the promise never hangs", async () => {
    const results: (string | null)[] = [];
    render(
      <PromptProvider>
        <PromptHarness opts={{ title: "Custom duration" }} onResult={(v) => results.push(v)} />
      </PromptProvider>,
    );

    fireEvent.click(screen.getByText("open prompt"));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => expect(results).toEqual([null]));
  });

  it("keeps the dialog open and explains the problem when a value violates its bounds", async () => {
    const results: (string | null)[] = [];
    render(
      <PromptProvider>
        <PromptHarness
          opts={{ title: "Custom duration", label: "Minutes", type: "number", min: 1, max: 240 }}
          onResult={(v) => results.push(v)}
        />
      </PromptProvider>,
    );

    fireEvent.click(screen.getByText("open prompt"));
    const field = await screen.findByLabelText("Minutes");

    fireEvent.change(field, { target: { value: "999" } });
    fireEvent.click(screen.getByText("Confirm"));

    // Reported in place: the old flow closed the prompt first and lost the typing.
    expect(await screen.findByText(/at most 240/i)).toBeDefined();
    expect(results).toEqual([]);
    expect(screen.getByRole("dialog")).toBeDefined();

    // Correcting the value clears the error rather than stacking a second one.
    fireEvent.change(field, { target: { value: "45" } });
    expect(screen.queryByText(/at most 240/i)).toBeNull();
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => expect(results).toEqual(["45"]));
  });

  it("is announced as a modal and labelled by its title", async () => {
    render(
      <PromptProvider>
        <PromptHarness opts={{ title: "Gift this item", description: "They pay nothing." }} onResult={() => {}} />
      </PromptProvider>,
    );

    fireEvent.click(screen.getByText("open prompt"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("Gift this item");
  });

  it("moves focus into the field on open and returns it to the trigger on close", async () => {
    render(
      <PromptProvider>
        <PromptHarness opts={{ title: "Custom duration", label: "Minutes" }} onResult={() => {}} />
      </PromptProvider>,
    );

    const trigger = screen.getByText("open prompt");
    trigger.focus();
    fireEvent.click(trigger);

    const field = await screen.findByLabelText("Minutes");
    await waitFor(() => expect(document.activeElement).toBe(field));

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("cancels the first request when a second one is opened", async () => {
    const results: (string | null)[] = [];
    render(
      <PromptProvider>
        <PromptHarness opts={{ title: "First" }} onResult={(v) => results.push(v)} />
      </PromptProvider>,
    );

    // Two explicit clicks: `fireEvent.doubleClick` fires a single `dblclick`
    // and does not exercise the second `confirm()` call.
    const trigger = screen.getByText("open prompt");
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    // The first promise must settle, or its caller awaits forever.
    await waitFor(() => expect(results).toEqual([null]));
  });
});

/* ── ConfirmDialog ────────────────────────────────────────────────────────── */

describe("ConfirmDialog", () => {
  it("resolves true on confirm and false on cancel", async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={(v) => results.push(v)} />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByText("open confirm"));
    fireEvent.click(await screen.findByText("Confirm"));
    await waitFor(() => expect(results).toEqual([true]));

    fireEvent.click(screen.getByText("open confirm"));
    fireEvent.click(await screen.findByText("Cancel"));
    await waitFor(() => expect(results).toEqual([true, false]));
  });

  it("treats Escape as a decline", async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={(v) => results.push(v)} />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByText("open confirm"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    await waitFor(() => expect(results).toEqual([false]));
  });

  it("moves focus to the confirm button and restores it to the trigger", async () => {
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={() => {}} />
      </ConfirmProvider>,
    );

    const trigger = screen.getByText("open confirm");
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    const confirmBtn = screen.getByText("Confirm");
    await waitFor(() => expect(document.activeElement).toBe(confirmBtn));
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("cancels the first request when a second one is opened", async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={(v) => results.push(v)} />
      </ConfirmProvider>,
    );

    const trigger = screen.getByText("open confirm");
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    await waitFor(() => expect(results).toEqual([false]));
  });
});

/* ── Fallbacks outside a provider ─────────────────────────────────────────── */

describe("missing-provider fallbacks", () => {
  it("usePrompt falls back to window.prompt instead of throwing", async () => {
    const spy = vi.spyOn(window, "prompt").mockReturnValue("fallback");
    let got: string | null = "unset";
    function Bare() {
      const prompt = usePrompt();
      return <button type="button" onClick={async () => { got = await prompt({ title: "t" }); }}>go</button>;
    }
    render(<Bare />);
    fireEvent.click(screen.getByText("go"));
    await waitFor(() => expect(got).toBe("fallback"));
    spy.mockRestore();
  });

  it("useConfirm falls back to window.confirm instead of throwing", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    let got: boolean | null = null;
    function Bare() {
      const confirm = useConfirm();
      return <button type="button" onClick={async () => { got = await confirm({ title: "t" }); }}>go</button>;
    }
    render(<Bare />);
    fireEvent.click(screen.getByText("go"));
    await waitFor(() => expect(got).toBe(true));
    spy.mockRestore();
  });
});
