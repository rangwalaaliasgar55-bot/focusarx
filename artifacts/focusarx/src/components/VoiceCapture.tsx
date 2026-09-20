import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Mic, MicOff, Plus, Sparkles, Trash2 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OPEN_VOICE_CAPTURE_EVENT, openVoiceCapture } from "@/lib/voiceCapture";

export { OPEN_VOICE_CAPTURE_EVENT };

type Priority = "low" | "medium" | "high" | "urgent";
type Draft = {
  id: string; kind: "task" | "goal"; title: string; sourceText: string;
  dueDate: string | null; estimatedMinutes: number | null; priority: Priority;
  category: string; recurring: string | null; description: string | null;
  confidence: number; warnings: string[];
};
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function speechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

function errorMessage(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone access was denied. Allow it in browser settings, or type your plan below.";
  if (error === "no-speech") return "No speech was detected. Move closer to the microphone or use the text box.";
  if (error === "audio-capture") return "No working microphone was found. You can still type your plan.";
  if (error === "network") return "Speech recognition lost its network connection. Your typed plan is still available.";
  return "Speech recognition stopped unexpectedly. You can retry or type instead.";
}

export function VoiceCaptureLauncher({ className, label = "Plan by voice" }: { className?: string; label?: string }) {
  return <Button type="button" variant="secondary" className={className} onClick={() => openVoiceCapture()}><Mic size={16} /> {label}</Button>;
}

export function VoiceCaptureManager() {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [items, setItems] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const parseRef = useRef<((value?: string) => Promise<void>) | null>(null);
  const transcriptRef = useRef(transcript);
  const qc = useQueryClient();
  const { toast } = useToast();
  const SpeechRecognition = speechRecognitionConstructor();
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const reset = useCallback(() => {
    recognitionRef.current?.stop(); recognitionRef.current = null;
    setTranscript(""); setInterim(""); setItems([]); setError(null); setListening(false); setBusy(null);
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  useEffect(() => {
    const show = (event?: Event) => {
      reset(); setOpen(true);
      const supplied = (event as CustomEvent<{ transcript?: string }> | undefined)?.detail?.transcript;
      if (supplied?.trim()) { setTranscript(supplied.trim()); void parseRef.current?.(supplied.trim()); }
    };
    const hotkey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "m") { event.preventDefault(); show(); }
    };
    window.addEventListener(OPEN_VOICE_CAPTURE_EVENT, show);
    window.addEventListener("keydown", hotkey);
    return () => { window.removeEventListener(OPEN_VOICE_CAPTURE_EVENT, show); window.removeEventListener("keydown", hotkey); recognitionRef.current?.stop(); };
  }, [reset]);

  const parse = useCallback(async (value = transcriptRef.current) => {
    if (!value.trim()) { setError("Say or type at least one task or goal."); return; }
    setBusy("parse"); setError(null);
    try {
      const data = await apiJson<{ items: Draft[] }>("/api/voice-capture/parse", { method: "POST", body: JSON.stringify({ transcript: value.trim() }) });
      setItems(data.items);
      setIdempotencyKey(crypto.randomUUID());
    } catch { setError("FocusArx could not structure that plan. Check your connection and try again."); }
    finally { setBusy(null); }
  }, []);
  useEffect(() => { parseRef.current = parse; }, [parse]);

  const listen = () => {
    if (!SpeechRecognition) { setError("Voice recognition is not supported in this browser. Type your plan below—everything else works the same."); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    setError(null); setInterim("");
    try {
      const recognition = new SpeechRecognition(); recognitionRef.current = recognition;
      recognition.lang = navigator.language || "en-IN"; recognition.continuous = false; recognition.interimResults = true;
      let finalText = "";
      recognition.onresult = (event) => {
        let live = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]; const text = result?.[0]?.transcript ?? "";
          if (result?.isFinal !== false) finalText += `${text} `; else live += text;
        }
        setInterim(live || finalText);
      };
      recognition.onerror = (event) => { setError(errorMessage(event.error)); setListening(false); };
      recognition.onend = () => {
        setListening(false); setInterim(""); recognitionRef.current = null;
        const fullTranscript = `${transcriptRef.current.trim()} ${finalText.trim()}`.trim();
        if (fullTranscript) { setTranscript(fullTranscript); void parse(fullTranscript); }
      };
      recognition.start(); setListening(true);
    } catch { setError("The microphone is already in use or unavailable. Close other recordings, then retry—or type instead."); setListening(false); }
  };

  const update = (index: number, patch: Partial<Draft>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const remove = (index: number) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const addBlank = () => setItems((current) => [...current, { id: crypto.randomUUID(), kind: "task", title: "", sourceText: "", dueDate: null, estimatedMinutes: null, priority: "medium", category: "General", recurring: null, description: null, confidence: 1, warnings: [] }]);

  const save = async () => {
    if (!items.length || items.some((item) => !item.title.trim())) { setError("Every item needs a title before it can be saved."); return; }
    setBusy("save"); setError(null);
    try {
      const result = await apiJson<{ createdCount: number; replayed: boolean }>("/api/voice-capture/commit", {
        method: "POST", body: JSON.stringify({ transcript: transcript.trim() || "Manually edited capture", idempotencyKey, items }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }), qc.invalidateQueries({ queryKey: ["goals"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }), qc.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      toast(result.replayed ? "This plan was already saved—no duplicates created." : `${result.createdCount} ${result.createdCount === 1 ? "item" : "items"} added to your plan.`, "success");
      setOpen(false); reset();
    } catch { setError("Nothing was saved. Check your connection and retry safely—FocusArx will prevent duplicates."); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles size={19} /> Voice planner</DialogTitle>
          <DialogDescription>Speak naturally or type. FocusArx structures your tasks and goals, but saves nothing until you review and confirm.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4 sm:px-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <Textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setItems([]); }} rows={3} maxLength={2000} placeholder="Try: Revise physics for 45 minutes tomorrow, high priority; create a goal to finish the semester strong by Friday." aria-label="Spoken or typed plan" />
            {interim && <p className="mt-2 text-sm italic text-[var(--foreground-muted)]" aria-live="polite">Hearing: {interim}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant={listening ? "destructive" : "secondary"} onClick={listen} aria-pressed={listening}>
                {listening ? <><MicOff size={16} /> Stop listening</> : <><Mic size={16} /> {SpeechRecognition ? "Speak plan" : "Voice unavailable"}</>}
              </Button>
              <Button type="button" onClick={() => void parse()} disabled={!transcript.trim() || busy !== null}>
                {busy === "parse" ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Structure plan
              </Button>
              <span className="ml-auto text-xs text-[var(--foreground-subtle)]">Alt + M opens this planner</span>
            </div>
          </div>

          {error && <div role="alert" className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

          {items.length > 0 && <section aria-labelledby="voice-review-title" className="space-y-3">
            <div className="flex items-center justify-between"><h3 id="voice-review-title" className="font-semibold">Review before saving ({items.length})</h3><Button type="button" variant="ghost" size="sm" onClick={addBlank}><Plus size={15} /> Add item</Button></div>
            {items.map((item, index) => <article key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3">
              <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                <select value={item.kind} onChange={(event) => update(index, { kind: event.target.value as Draft["kind"] })} className="h-11 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" aria-label={`Item ${index + 1} type`}><option value="task">Task</option><option value="goal">Goal</option></select>
                <Input value={item.title} maxLength={item.kind === "goal" ? 100 : 500} onChange={(event) => update(index, { title: event.target.value })} aria-label={`Item ${index + 1} title`} />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label={`Remove ${item.title || `item ${index + 1}`}`}><Trash2 size={16} /></Button>
              </div>
              {item.kind === "task" ? <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <label htmlFor={`voice-due-${item.id}`} className="text-xs text-[var(--foreground-muted)]">Due date<Input id={`voice-due-${item.id}`} type="date" value={item.dueDate ?? ""} onChange={(event) => update(index, { dueDate: event.target.value || null })} className="mt-1" /></label>
                <label htmlFor={`voice-minutes-${item.id}`} className="text-xs text-[var(--foreground-muted)]">Minutes<Input id={`voice-minutes-${item.id}`} type="number" min={1} max={1440} value={item.estimatedMinutes ?? ""} onChange={(event) => update(index, { estimatedMinutes: event.target.value ? Number(event.target.value) : null })} className="mt-1" /></label>
                <label htmlFor={`voice-priority-${item.id}`} className="text-xs text-[var(--foreground-muted)]">Priority<select id={`voice-priority-${item.id}`} value={item.priority} onChange={(event) => update(index, { priority: event.target.value as Priority })} className="mt-1 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2"><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></label>
                <label htmlFor={`voice-category-${item.id}`} className="text-xs text-[var(--foreground-muted)]">Category<Input id={`voice-category-${item.id}`} value={item.category} maxLength={50} onChange={(event) => update(index, { category: event.target.value })} className="mt-1" /></label>
                <label htmlFor={`voice-repeat-${item.id}`} className="text-xs text-[var(--foreground-muted)]">Repeat<select id={`voice-repeat-${item.id}`} value={item.recurring ?? ""} onChange={(event) => update(index, { recurring: event.target.value || null })} className="mt-1 h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2"><option value="">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option>{item.recurring && !["daily", "weekly"].includes(item.recurring) && <option value={item.recurring}>{item.recurring}</option>}</select></label>
              </div> : <label htmlFor={`voice-notes-${item.id}`} className="mt-3 block text-xs text-[var(--foreground-muted)]">Goal notes<Input id={`voice-notes-${item.id}`} value={item.description ?? ""} maxLength={300} onChange={(event) => update(index, { description: event.target.value || null })} className="mt-1" /></label>}
              {item.warnings.map((warning) => <p key={warning} className="mt-2 flex items-start gap-1 text-xs text-[var(--warning)]"><CalendarDays size={13} className="mt-0.5 shrink-0" />{warning}</p>)}
            </article>)}
          </section>}
        </div>
        <DialogFooter className="border-t border-[var(--border)] px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={!items.length || busy !== null}>{busy === "save" && <Loader2 className="animate-spin" size={16} />} Save {items.length || ""} {items.length === 1 ? "item" : "items"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
