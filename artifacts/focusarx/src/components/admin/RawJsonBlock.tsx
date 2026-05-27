"use client";

import { useState } from "react";

export function RawJsonBlock({ data, label }: { data: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(data, null, 2);

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-900/50"
      >
        {label}
        <span className="text-xs text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <pre className="max-h-80 overflow-auto border-t border-zinc-800/80 p-4 text-xs leading-relaxed text-zinc-400">
          {text}
        </pre>
      )}
    </div>
  );
}
