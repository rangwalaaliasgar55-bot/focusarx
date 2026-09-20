import { shiftDayKey } from "./timezone";

export type VoiceCapturePriority = "low" | "medium" | "high" | "urgent";
export type VoiceCaptureDraft = {
  id: string;
  kind: "task" | "goal";
  title: string;
  sourceText: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  priority: VoiceCapturePriority;
  category: string;
  recurring: string | null;
  description: string | null;
  confidence: number;
  warnings: string[];
};

const WEEKDAYS: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

function splitCapture(transcript: string): string[] {
  const marked = transcript
    .replace(/\b(?:and then|then|also)\b/gi, "|")
    .replace(/[;\n]+/g, "|")
    .replace(/,\s*(?:and\s+)?/gi, "|")
    .replace(/\s+(?=(?:add|create|new|set|remember to|remind me to)\s+(?:a\s+)?(?:task|goal)\b)/gi, "|");
  return marked.split("|").map((part) => part.trim()).filter(Boolean).slice(0, 12);
}

function upcomingWeekday(today: string, weekday: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const current = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const offset = ((weekday - current + 7) % 7) || 7;
  return shiftDayKey(today, offset);
}

function validDateKey(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function extractDate(text: string, today: string): { text: string; dueDate: string | null; matched: boolean } {
  let dueDate: string | null = null;
  let matched = false;
  let cleaned = text;
  const consume = (pattern: RegExp, resolve: (match: RegExpMatchArray) => string | null) => {
    if (matched) return;
    const match = cleaned.match(pattern);
    if (!match) return;
    const value = resolve(match);
    if (!value) return;
    dueDate = value; matched = true; cleaned = cleaned.replace(match[0], " ");
  };
  consume(/\b(?:due\s+|by\s+|on\s+)?day after tomorrow\b/i, () => shiftDayKey(today, 2));
  consume(/\b(?:due\s+|by\s+|on\s+)?tomorrow\b/i, () => shiftDayKey(today, 1));
  consume(/\b(?:due\s+|by\s+|on\s+)?(?:today|tonight)\b/i, () => today);
  consume(/\b(?:due\s+|by\s+|on\s+)?in\s+(\d{1,3})\s+days?\b/i, (m) => shiftDayKey(today, Math.min(365, Number(m[1]))));
  consume(/\b(?:due\s+|by\s+|on\s+)?(\d{4})-(\d{1,2})-(\d{1,2})\b/i, (m) => validDateKey(Number(m[1]), Number(m[2]), Number(m[3])));
  consume(new RegExp(`\\b(?:due\\s+|by\\s+|on\\s+|next\\s+)?(${Object.keys(WEEKDAYS).join("|")})\\b`, "i"), (m) => upcomingWeekday(today, WEEKDAYS[m[1]!.toLowerCase()]!));
  consume(new RegExp(`\\b(?:due\\s+|by\\s+|on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${Object.keys(MONTHS).join("|")})(?:\\s+(\\d{4}))?\\b`, "i"), (m) => {
    const [currentYear] = today.split("-").map(Number);
    let value = validDateKey(Number(m[3] ?? currentYear), MONTHS[m[2]!.toLowerCase()]!, Number(m[1]));
    if (value && !m[3] && value < today) value = validDateKey(currentYear! + 1, MONTHS[m[2]!.toLowerCase()]!, Number(m[1]));
    return value;
  });
  consume(new RegExp(`\\b(?:due\\s+|by\\s+|on\\s+)?(${Object.keys(MONTHS).join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"), (m) => {
    const [currentYear] = today.split("-").map(Number);
    let value = validDateKey(Number(m[3] ?? currentYear), MONTHS[m[1]!.toLowerCase()]!, Number(m[2]));
    if (value && !m[3] && value < today) value = validDateKey(currentYear! + 1, MONTHS[m[1]!.toLowerCase()]!, Number(m[2]));
    return value;
  });
  return { text: cleaned, dueDate, matched };
}

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").replace(/^[\s,:-]+|[\s,.-]+$/g, "").trim();
}

export function parseVoiceCapture(transcript: string, today: string): VoiceCaptureDraft[] {
  return splitCapture(transcript).map((sourceText, index) => {
    const goalPrefix = /^(?:please\s+)?(?:add|create|new|set)?\s*(?:a\s+)?goal\s*(?:to|for|:)?\s*/i;
    const taskPrefix = /^(?:please\s+)?(?:(?:add|create|new)\s+(?:a\s+)?task|remember to|remind me to|task)\s*(?:to|:)?\s*/i;
    const kind: "task" | "goal" = goalPrefix.test(sourceText) ? "goal" : "task";
    let working = sourceText.replace(kind === "goal" ? goalPrefix : taskPrefix, " ");
    const warnings: string[] = [];

    let priority: VoiceCapturePriority = "medium";
    const priorityMatch = working.match(/\b(urgent|high|medium|low)(?:\s+priority)?\b/i);
    if (priorityMatch) {
      priority = priorityMatch[1]!.toLowerCase() as VoiceCapturePriority;
      working = working.replace(priorityMatch[0], " ");
    }

    let estimatedMinutes: number | null = null;
    const duration = working.match(/\b(?:for\s+)?(\d{1,3}(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/i);
    const naturalDuration = duration ? null : working.match(/\b(?:for\s+)?(half an hour|an hour|one hour)\b/i);
    if (duration) {
      const amount = Number(duration[1]);
      estimatedMinutes = Math.min(1440, Math.max(1, Math.round(amount * (/h/i.test(duration[2]!) ? 60 : 1))));
      working = working.replace(duration[0], " ");
    } else if (naturalDuration) {
      estimatedMinutes = naturalDuration[1]!.toLowerCase() === "half an hour" ? 30 : 60;
      working = working.replace(naturalDuration[0], " ");
    }

    let recurring: string | null = null;
    const recurrence = working.match(/\b(every day|daily|every week|weekly|every (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i);
    if (recurrence) {
      recurring = recurrence[1]!.toLowerCase().replace("every day", "daily").replace("every week", "weekly");
      working = working.replace(recurrence[0], " ");
    }

    let category = "General";
    const explicitCategory = working.match(/\b(?:category|under|in)\s+(study|school|work|personal|health|fitness|finance)\b/i);
    if (explicitCategory) {
      category = explicitCategory[1]![0]!.toUpperCase() + explicitCategory[1]!.slice(1).toLowerCase();
      working = working.replace(explicitCategory[0], " ");
    } else if (/\b(?:study|revise|exam|chapter|assignment|homework|lecture|practice)\b/i.test(working)) category = "Study";
    else if (/\b(?:workout|gym|run|medicine|doctor|sleep)\b/i.test(working)) category = "Health";
    else if (/\b(?:email|meeting|report|client|office)\b/i.test(working)) category = "Work";

    const dateResult = extractDate(working, today);
    working = dateResult.text;
    const timeMention = working.match(/\b(?:at\s+)?(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)?\b/i);
    if (timeMention && /(?:am|pm|at\s+)/i.test(timeMention[0])) warnings.push("FocusArx tasks currently save the date; the spoken time remains in the title.");

    let title = cleanTitle(working.replace(/^(?:i need to|i have to|i should|to)\s+/i, ""));
    if (!title) { title = kind === "goal" ? "New goal" : "New task"; warnings.push("No clear title was detected. Edit this before saving."); }
    const max = kind === "goal" ? 100 : 500;
    if (title.length > max) { title = title.slice(0, max).trim(); warnings.push("The title was shortened to fit the saved item."); }
    if (kind === "goal" && (estimatedMinutes || recurring)) warnings.push("Duration and recurrence apply to tasks, so they will not be saved on this goal.");
    const description = kind === "goal" && dateResult.dueDate ? `Target date: ${dateResult.dueDate}` : null;
    const signals = [dateResult.matched, !!duration || !!naturalDuration, !!priorityMatch, !!recurrence, explicitCategory !== null].filter(Boolean).length;
    return {
      id: `voice-${index}-${Buffer.from(sourceText).toString("base64url").slice(0, 10)}`,
      kind, title, sourceText, dueDate: dateResult.dueDate, estimatedMinutes: kind === "task" ? estimatedMinutes : null,
      priority, category, recurring: kind === "task" ? recurring : null, description,
      confidence: title === "New task" || title === "New goal" ? .35 : Math.min(.98, .72 + signals * .05), warnings,
    };
  });
}
