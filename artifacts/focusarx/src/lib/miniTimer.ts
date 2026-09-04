/**
 * Document Picture-in-Picture mini-timer (Phase 3, desktop).
 *
 * Pops the running countdown into a tiny always-on-top window:
 * time remaining, current task, progress ring. Chrome/Edge 116+ via
 * `documentPictureInPicture`; everywhere else the button hides itself.
 * The PiP document is same-origin, so it shares localStorage — the snapshot
 * below is written by the opener right before opening.
 */

export interface PipPayload {
  secondsLeft: number;
  task: string;
  mode: string;
  status: string;
}

const PIP_KEY = "focusarx-pip-snapshot";

export function isDocumentPipSupported(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      "documentPictureInPicture" in window &&
      typeof (window as unknown as { documentPictureInPicture?: { requestWindow?: unknown } })
        .documentPictureInPicture?.requestWindow === "function"
    );
  } catch {
    return false;
  }
}

export function writePipSnapshot(payload: PipPayload): void {
  try {
    window.localStorage.setItem(PIP_KEY, JSON.stringify({ ...payload, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function readPipSnapshot(): (PipPayload & { at: number }) | null {
  try {
    const raw = window.localStorage.getItem(PIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PipPayload & { at?: unknown };
    if (typeof parsed.secondsLeft !== "number" || !Number.isFinite(parsed.secondsLeft)) return null;
    return { ...parsed, at: typeof parsed.at === "number" ? parsed.at : 0 };
  } catch {
    return null;
  }
}

function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Open (or focus) the PiP mini-timer. The PiP window re-reads the snapshot
 * every second, so it tracks pause/resume in the opener without messaging.
 * Returns false when unsupported or blocked (caller hides the button then).
 */
export async function openMiniTimer(): Promise<boolean> {
  try {
    const pip = (
      window as unknown as {
        documentPictureInPicture?: {
          window?: Window | null;
          requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;
    if (!pip) return false;
    if (pip.window) {
      pip.window.focus();
      return true;
    }
    const win = await pip.requestWindow({ width: 320, height: 180 });
    const doc = win.document;
    doc.title = "FocusArx mini-timer";
    const style = doc.createElement("style");
    style.textContent = [
      "*{margin:0;box-sizing:border-box}",
      "body{background:#0a0a0f;color:#f5f5f7;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh}",
      ".wrap{text-align:center}",
      ".time{font-size:56px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.02em}",
      ".task{margin-top:6px;font-size:13px;color:#a8b3c5;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".bar{margin:10px auto 0;width:180px;height:4px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}",
      ".fill{height:100%;background:#8b5cf6;border-radius:99px}",
    ].join("");
    doc.head.appendChild(style);
    const wrap = doc.createElement("div");
    wrap.className = "wrap";
    wrap.innerHTML = `<div class="time">--:--</div><div class="task"></div><div class="bar"><div class="fill" style="width:0%"></div></div>`;
    doc.body.appendChild(wrap);
    const timeEl = wrap.querySelector(".time")!;
    const taskEl = wrap.querySelector(".task")!;
    const render = () => {
      const snap = readPipSnapshot();
      if (!snap) return;
      timeEl.textContent = fmt(snap.secondsLeft);
      doc.title = `${fmt(snap.secondsLeft)} · FocusArx`;
      taskEl.textContent = snap.task || (snap.mode === "focus" ? "Focusing" : "On a break");
    };
    render();
    const id = win.setInterval(render, 1000);
    win.addEventListener("pagehide", () => win.clearInterval(id));
    return true;
  } catch {
    return false;
  }
}
