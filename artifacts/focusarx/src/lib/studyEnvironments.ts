import {
  BookOpen,
  Brain,
  Coffee,
  CloudRain,
  GraduationCap,
  Moon,
  Sunrise,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Study environments.
 *
 * This is the answer to a question the product never asked: *what kind of room
 * do I want to be in?* A room list with a name, a mode and an ambiance asks the
 * student to assemble a study space out of settings — "silent + silence + 50
 * min" — which is a configuration problem, not a decision anyone makes. Students
 * don't want options, they want a *place*: a library at 2am, a café with rain on
 * the window, an exam hall where the clock is running. Each of these is a
 * complete, named, describable environment with an expectation attached, and
 * picking one takes a single tap.
 *
 * Structurally an environment is nothing more than a preset for a room (mode +
 * ambiance + session length + seats), which is why this file is small: the value
 * is entirely in the framing and in the fact that a room created from one is
 * *legible* to the next student ("The Silent Library · 50 min · chat off"),
 * rather than a set of settings they have to decode.
 *
 * Icons are lucide glyphs, never emoji: the app-wide emoji ratchet is a budget
 * (src/emoji-ui.test.ts) and a pictograph cannot inherit the accent colour this
 * card is tinted with.
 */

export type EnvironmentMode = "silent" | "pomodoro" | "open_chat" | "accountability";
export type EnvironmentAmbiance = "silence" | "lofi" | "rain" | "cafe" | "forest" | "binaural";

export interface StudyEnvironment {
  id: string;
  /** The place, named the way a student would say it. */
  name: string;
  /** One line: what this room promises. */
  tagline: string;
  /** How it feels to be in it — the line that makes someone choose it. */
  vibe: string;
  /** What everyone in the room does. Concrete, checkable expectations. */
  houseRules: string[];
  mode: EnvironmentMode;
  ambiance: EnvironmentAmbiance;
  /** Session length in minutes — the room's rhythm. */
  sessionMinutes: number;
  seats: number;
  icon: LucideIcon;
  /** CSS custom property used as the card accent. Must exist in index.css. */
  accent: string;
  /** Who it is for, in the student's own words. */
  bestFor: string;
}

export const STUDY_ENVIRONMENTS: StudyEnvironment[] = [
  {
    id: "first-session",
    name: "First Session",
    tagline: "New here? Start in this one.",
    vibe: "The room we keep warm. Someone is almost always in it, the cycles are short, and nothing is expected of you except showing up.",
    houseRules: ["25 minutes on, 5 off, together", "Nobody asks what you're working on"],
    mode: "pomodoro",
    ambiance: "lofi",
    sessionMinutes: 25,
    seats: 100,
    icon: Sunrise,
    accent: "var(--brand-400)",
    bestFor: "Your first day, or your first day back",
  },
  {
    id: "silent-library",
    name: "The Silent Library",
    tagline: "Nobody talks. Everyone works.",
    vibe: "The closest thing to a library at 2am: no chat, no calls, no music unless it's in your own headphones. Just the sound of other people concentrating.",
    houseRules: ["Chat stays off", "Headphones on, phone face-down", "Leave quietly if you're done"],
    mode: "silent",
    ambiance: "silence",
    sessionMinutes: 50,
    seats: 50,
    icon: BookOpen,
    accent: "var(--brand-teal)",
    bestFor: "Long reading, revision, problem sets",
  },
  {
    id: "rainy-cafe",
    name: "Rainy Café",
    tagline: "Rain on the window, low chatter, warm light.",
    vibe: "A working café on a wet afternoon. There's background noise and the occasional question across the table, so it's easier to start than a silent room.",
    houseRules: ["Small talk is fine between blocks", "Long questions go to the Doubt Corner"],
    mode: "open_chat",
    ambiance: "rain",
    sessionMinutes: 50,
    seats: 20,
    icon: Coffee,
    accent: "var(--brand-gold)",
    bestFor: "Starting when you don't feel like it",
  },
  {
    id: "night-owl",
    name: "Night Owl",
    tagline: "For 11pm to 3am. No judgement about the hour.",
    vibe: "Late-night company for people whose best hours come after everyone else sleeps. Warm lo-fi, no chat, sessions long enough to matter.",
    houseRules: ["Quiet — most people here are the only one awake in their house", "No streak guilt if you vanish at 4am"],
    mode: "silent",
    ambiance: "lofi",
    sessionMinutes: 90,
    seats: 50,
    icon: Moon,
    accent: "var(--brand-violet)",
    bestFor: "Night owls, hostellers, exam-eve crammers",
  },
  {
    id: "exam-hall",
    name: "Exam Hall",
    tagline: "Timed conditions. State it, sit it, report back.",
    vibe: "Run like the real thing: you write down what you're sitting, the clock runs, and you come back and say how it went. Accountability without a teacher.",
    houseRules: ["Post your paper before you start", "Report your score when the block ends"],
    mode: "accountability",
    ambiance: "silence",
    sessionMinutes: 90,
    seats: 30,
    icon: GraduationCap,
    accent: "var(--warning)",
    bestFor: "Mock tests and full-length papers",
  },
  {
    id: "deep-work",
    name: "Deep Work",
    tagline: "Two hours, one task, no notifications.",
    vibe: "For work that doesn't survive being interrupted. Binaural background, silent room, a 90-minute block that most people here take straight through.",
    houseRules: ["One task, written down before you start", "No chat until the block ends"],
    mode: "silent",
    ambiance: "binaural",
    sessionMinutes: 90,
    seats: 20,
    icon: Brain,
    accent: "var(--info)",
    bestFor: "Thesis, coding, one hard chapter",
  },
  {
    id: "doubt-corner",
    name: "Doubt Corner",
    tagline: "Ask it, explain it, move on.",
    vibe: "A working room where the useful half of studying happens: someone explains the thing, someone else explains it back, and then everyone goes quiet again.",
    houseRules: ["Ask the question — someone here has it too", "Explain, don't just answer"],
    mode: "open_chat",
    ambiance: "cafe",
    sessionMinutes: 50,
    seats: 20,
    icon: CloudRain,
    accent: "var(--brand-teal)",
    bestFor: "Concepts you keep getting wrong",
  },
  {
    id: "forest-focus",
    name: "Forest Focus",
    tagline: "Open air, birds, 50-minute blocks.",
    vibe: "Outdoor-quiet: forest and birds instead of café noise, chat off, blocks short enough to keep the momentum going all afternoon.",
    houseRules: ["Quiet work — the sound is the scenery", "50 on, 10 off"],
    mode: "pomodoro",
    ambiance: "forest",
    sessionMinutes: 50,
    seats: 50,
    icon: Users,
    accent: "var(--success)",
    bestFor: "Afternoon slumps and revision sprints",
  },
];

/**
 * Which environment a room was created from, if any.
 *
 * Rooms store their settings, not their environment — deliberately: an
 * environment is a starting point, and a host is free to change the mode or the
 * ambiance afterwards. So the match is by the settings that define the
 * environment, and a room that matches none is still perfectly valid, it just
 * shows its own settings instead of a name.
 */
export function matchEnvironment(room: {
  mode?: string | null;
  ambiance?: string | null;
  timerDuration?: number | null;
}): StudyEnvironment | null {
  const minutes = room.timerDuration ? Math.round(room.timerDuration / 60) : null;
  return (
    STUDY_ENVIRONMENTS.find(
      (env) =>
        env.mode === room.mode &&
        env.ambiance === room.ambiance &&
        (minutes === null || env.sessionMinutes === minutes),
    ) ?? null
  );
}

/** Environments that match a room's vibe, ignoring session length (looser match). */
export function environmentsForRoom(room: { mode?: string | null; ambiance?: string | null }): StudyEnvironment[] {
  return STUDY_ENVIRONMENTS.filter((env) => env.mode === room.mode && env.ambiance === room.ambiance);
}

/** Rooms whose settings match this environment. Used to filter the room list. */
export function roomMatchesEnvironment(
  room: { mode?: string | null; ambiance?: string | null },
  environmentId: string,
): boolean {
  const env = STUDY_ENVIRONMENTS.find((e) => e.id === environmentId);
  if (!env) return true;
  return room.mode === env.mode && room.ambiance === env.ambiance;
}

/** A room name suggestion for a new room in this environment. */
export function suggestedRoomName(env: StudyEnvironment, topic?: string): string {
  const trimmed = topic?.trim();
  return trimmed ? `${env.name} · ${trimmed}` : env.name;
}

/** Lucide icon used as a neutral fallback when a room has no environment. */
export const DEFAULT_ENVIRONMENT_ICON = Timer;
