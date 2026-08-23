import { useEffect, useState } from "react";
import { Crown, SmilePlus } from "lucide-react";
import { getToken } from "@/lib/auth";

type Emote = { id: string; emoji: string; name: string; premiumOnly: boolean; unlocked: boolean };

export function EmotePicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [emotes, setEmotes] = useState<Emote[]>([]);

  useEffect(() => {
    if (!open || emotes.length) return;
    const token = getToken();
    void fetch("/api/emotes", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setEmotes(data.emotes ?? []))
      .catch(() => setEmotes([]));
  }, [open, emotes.length]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Choose an emote" aria-expanded={open}
        className="grid min-h-11 min-w-11 place-items-center rounded-xl text-[var(--foreground-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
        <SmilePlus size={18} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-[var(--z-popover)] mb-2 grid w-64 grid-cols-5 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl" role="dialog" aria-label="Emotes">
          {emotes.map((emote) => (
            <button key={emote.id} type="button" disabled={!emote.unlocked}
              title={emote.unlocked ? emote.name : `${emote.name} — Premium`}
              aria-label={emote.unlocked ? emote.name : `${emote.name}, Premium locked`}
              onClick={() => { onSelect(emote.emoji); setOpen(false); }}
              className="relative grid aspect-square place-items-center rounded-lg text-xl hover:bg-[var(--surface-hover)] disabled:grayscale disabled:opacity-35">
              {emote.emoji}{emote.premiumOnly && <Crown size={8} className="absolute right-0 top-0 text-[var(--color-warning)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
