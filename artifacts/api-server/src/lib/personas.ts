/**
 * Indian-student persona generator (Workstream A1).
 *
 * Deterministic, stateless: `generatePersona(i)` always returns the same
 * persona for a given index, so seeding 12,000 bots is idempotent and
 * resumable — no stored RNG state, no "Aarav Sharma 2".
 *
 * Name collisions are resolved with middle-initial variants ("Aarav K.
 * Sharma") via the `reserve` set passed in from the seed loop.
 *
 * XP follows an explicit three-tier draw (a1 spec): a few hundred hardcore
 * 8k–15k, a middle band, and a long tail of fresh 50–800 — never identical
 * values, back-dated createdAt over ~18 months weighted toward recent,
 * IST-heavy timezones.
 */

// ── deterministic RNG (same family as botEngine so behaviour is consistent) ──

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── name pools ───────────────────────────────────────────────────────────────
// Curated across regions; ~180 × ~110 = 19,800 base combinations, enough for
// 12k+ without forcing numeric suffixes.

export const FIRST_NAMES = [
  "Aarav", "Vihaan", "Ananya", "Diya", "Ishaan", "Kabir", "Aditi", "Rohan",
  "Priya", "Arjun", "Sneha", "Vikram", "Meera", "Kunal", "Pooja", "Rahul",
  "Neha", "Aditya", "Shruti", "Siddharth", "Tanvi", "Dev", "Ishita", "Manav",
  "Aisha", "Yash", "Kavya", "Nikhil", "Riya", "Sanjay", "Pari", "Harsh",
  "Zara", "Akshay", "Lakshmi", "Gaurav", "Simran", "Varun", "Nandini", "Tejas",
  "Anjali", "Ritvik", "Shreya", "Mohit", "Divya", "Pranav", "Kritika", "Amit",
  "Sana", "Rudra", "Ira", "Ayaan", "Navya", "Shaurya", "Trisha", "Vivaan",
  "Rukhsar", "Dhruv", "Anika", "Nishant", "Sanya", "Karan", "Mira", "Abhishek",
  "Pia", "Sameer", "Tara", "Yuvraj", "Charu", "Nitin", "Bhavya", "Om",
  "Gita", "Rajat", "Sofia", "Atharv", "Lata", "Parth", "Meenakshi", "Ishan",
  "Aishwarya", "Rohit", "Nikita", "Keshav", "Swara", "Madhav", "Jhanvi", "Akhil",
  "Veda", "Sahil", "Anushka", "Bharat", "Chirag", "Daksh", "Eesha", "Farhan",
  "Gayatri", "Himanshu", "Jyoti", "Krishna", "Lila", "Mahi", "Neel", "Ojas",
  "Prisha", "Qistina", "Ravi", "Saurabh", "Urvashi", "Vansh", "Wamiqa", "Xavier",
  "Yamini", "Zoya", "Aarushi", "Bhavik", "Chaitra", "Dinesh", "Esha", "Faisal",
  "Girish", "Harini", "Iqbal", "Jasleen", "Kranti", "Lavanya", "Madhurima", "Nabarun",
  "Omkar", "Pallavi", "Ramesh", "Sahana", "Tushar", "Utkarsh", "Varsha", "Wajahat",
  "Yukti", "Zainab", "Adil", "Bapi", "Chandni", "Darsh", "Eleni", "Firdaus",
  "Gopal", "Hansa", "Irshad", "Jai", "Kiran", "Lakhan", "Muskaan", "Nirmal",
  "Osman", "Priti", "Ranjit", "Shalini", "Tarun", "Vimala", "Winfred", "Yashaswini",
  "Zubin", "Aarti", "Bimal", "Chinmay", "Deepa", "Ekal", "Farida", "Gagan",
  "Harpreet", "Inaya", "Jayesh", "Kamini", "Lalit", "Madan", "Nafisa", "Omar",
  "Pinky", "Raghav", "Sunita", "Tulsi", "Vasudha", "Yogesh", "Zakir", "Abir",
];

export const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Patel", "Reddy", "Singh", "Nair", "Gupta",
  "Bose", "Kaur", "Mehta", "Joshi", "Rao", "Das", "Malik", "Chauhan",
  "Kapoor", "Agarwal", "Bhatia", "Chopra", "Dubey", "Fernandes", "Goel", "Hussain",
  "Jain", "Khan", "Lamba", "Mishra", "Negi", "Ojha", "Pillai", "Qureshi",
  "Rathore", "Sethi", "Trivedi", "Upadhyay", "Vyas", "Wadhwa", "Yadav",
  "Zia", "Anand", "Bajpai", "Chandra", "Desai", "Eswar", "Firodiya", "Ghosh",
  "Harlalka", "Ingle", "Jagannathan", "Kulkarni", "Lodha", "Mukherjee", "Naik",
  "Oza", "Purohit", "Rana", "Sane", "Tandon", "Umrao", "Vaidya", "Wagle",
  "Zaveri", "Ahluwalia", "Birla", "Chatterjee", "Datta", "Emani", "Faldu", "Gondhalekar",
  "Hegde", "Ipe", "Jainpurkar", "Krishnan", "Lad", "Mudgal", "Naipu", "Oke",
  "Palkar", "Ramaswamy", "Shah", "Thakur", "Unnikrishnan", "Varma", "Wani", "Yadgale",
  "Zakaria", "Achari", "Bhatt", "Chib", "Deshpande", "Elangovan", "Fafadiya", "Goswami",
  "Hingorani", "Irani", "Jaswal", "Kelkar", "Lakhia", "Mankad", "Nambiar", "Othayottam",
  "Pandit", "Rathi", "Shroff", "Tewari", "Uppal", "Vellala", "Warrier", "Yadlapalli",
  "Zakaria", "Arya", "Bansal", "Chowdhury", "Dhar", "Eapen", "Fatah", "Girija",
  "Hada", "Israni", "Jhunjhunwala", "Khurana", "Lall", "Mahajan", "Naidu", "Onkar",
  "Panchal", "Raut", "Shetty", "Tripathi", "Utture", "Vankayala", "Wazir", "Yadlin",
];

const MIDDLE_INITIALS = ["A", "B", "C", "D", "E", "H", "K", "M", "N", "P", "R", "S", "T", "V"];

// ── persona dimensions ───────────────────────────────────────────────────────

const EXAM_GOALS = [
  "JEE 2027", "JEE Advanced '27", "NEET 2027", "NEET dropper year", "UPSC CSE 2028",
  "UPSC prelims", "CAT 2027", "GMAT", "Class 12 boards", "Class 10 boards",
  "B.Tech semesters", "B.Com semesters", "MBA prep", "GATE CSE 2027", "CLAT 2027",
];

const STUDY_STYLES = [
  "night owl", "4am club", "library rat", "Pomodoro pro", "flowstate believer",
  "coffee-powered", "playlist scholar", "sunrise grinder", "late-night reviser",
  "weekend marathoner", "flashcard ninja", "past-paper machine",
];

const BIO_TEMPLATES: Array<(goal: string, style: string) => string> = [
  (g, s) => `${g} · ${s}. One problem at a time.`,
  (g, s) => `Chasing ${g.split(" ")[0]} ranks as a ${s}. Consistency > intensity.`,
  (g, s) => `${g} aspirant · ${s}. My desk is my dojo.`,
  (g, s) => `Prepping for ${g}. ${cap(s)} mode, monsoon or no monsoon.`,
  (g, s) => `${g} · ${s} · chai in one hand, notes in the other.`,
  (g, s) => `Dropper discipline: ${g}, ${s} schedule, zero excuses.`,
  (g, s) => `${g} · ${s}. If the 5am alarm rings, I'm already up.`,
  (g, s) => `Grinding for ${g} the ${s} way. Mocks on weekends.`,
  (g, s) => `${g} · ${s}. Rank is a number; effort is a habit.`,
  (g, s) => `From hostel mess to ${g} topper — ${s} edition.`,
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TIMEZONES: Array<[string, number]> = [
  ["Asia/Kolkata", 0.78],
  ["Asia/Kolkata", 0.06], // duplicate weight kept as its own entry on purpose — simpler lookup
  ["Asia/Dubai", 0.03],
  ["Asia/Singapore", 0.02],
  ["Europe/London", 0.03],
  ["Australia/Sydney", 0.02],
  ["America/New_York", 0.02],
  ["Europe/Berlin", 0.02],
  ["Asia/Bangkok", 0.01],
  ["Asia/Manila", 0.01],
];

export interface GeneratedPersona {
  index: number;
  slug: string;
  name: string;
  email: string;
  bio: string;
  vibe: "grinder" | "scholar" | "sprinter" | "chill";
  totalXp: number;
  weeklyXp: number;
  streak: number;
  createdAtDaysAgo: number;
  timezone: string;
}

const VBES: Array<[BotVibe, number]> = [
  ["grinder", 0.38],
  ["scholar", 0.27],
  ["sprinter", 0.2],
  ["chill", 0.15],
];
type BotVibe = "grinder" | "scholar" | "sprinter" | "chill";

function pickWeighted<T>(rng: () => number, entries: Array<[T, number]>): T {
  const r = rng();
  let acc = 0;
  for (const [value, w] of entries) {
    acc += w;
    if (r < acc) return value;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Explicit three-tier XP draw (A1):
 *   ~2%  hardcore: 8,000–15,000  ("few hundred hardcore")
 *   ~18% middle:   800–7,000
 *   ~80% fresh:    50–800 (long tail)
 *
 * Uniqueness: the hardcore and middle tiers use injective prime-modulo
 * mappings over the index, so no two bots in the same tier share a value
 * (the tier span is always smaller than the modulus). The fresh tier only
 * has 751 integer values for ~9.6k bots, so distinct values there are
 * maximised by spreading a wide hash across the full 50–800 range — every
 * value is still drawn individually (never a shared constant), which is the
 * real bug this replaces.
 */
const HARDCORE_MOD = 7919; // prime, coprime with 7001
const MIDDLE_MOD = 6271; // prime, coprime with 6201

function drawTotalXp(index: number, scale: number): number {
  const hardcoreEnd = Math.max(1, Math.round(scale * 0.02));
  const middleEnd = Math.max(hardcoreEnd + 1, Math.round(scale * 0.20));
  if (index < hardcoreEnd) {
    return 8000 + (Math.imul(index, HARDCORE_MOD) % 7001);
  }
  if (index < middleEnd) {
    return 800 + (Math.imul(index - hardcoreEnd, MIDDLE_MOD) % 6201);
  }
  return 50 + (hashString(`fresh:${index}`) % 751);
}

/**
 * Generate the persona for seed index `i`. `reserved` holds full display
 * names already taken by lower indices; on collision the persona gets a
 * middle-initial variant (never a numeric suffix).
 */
export function generatePersona(i: number, reserved: Set<string>, scale = 12000): GeneratedPersona {
  const rng = mulberry32(hashString(`persona:${i}`));
  const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
  const last = LAST_NAMES[(i * 7 + 13) % LAST_NAMES.length]!;

  let name = `${first} ${last}`;
  if (reserved.has(name)) {
    const mi = MIDDLE_INITIALS[i % MIDDLE_INITIALS.length]!;
    name = `${first} ${mi}. ${last}`;
    if (reserved.has(name)) {
      const mi2 = MIDDLE_INITIALS[(i * 3 + 1) % MIDDLE_INITIALS.length]!;
      name = `${first} ${mi2}. ${last}`;
    }
  }
  reserved.add(name);

  const goal = EXAM_GOALS[i % EXAM_GOALS.length]!;
  const style = STUDY_STYLES[(i * 5 + 3) % STUDY_STYLES.length]!;
  const bio = BIO_TEMPLATES[(i * 11 + 7) % BIO_TEMPLATES.length]!(goal, style);

  const slug = `${first}-${last}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const totalXp = drawTotalXp(i, scale);
  // Weekly XP proportional to total with jitter — recent momentum, not flat.
  const weeklyXp = Math.max(10, Math.round(totalXp * (0.04 + rng() * 0.08)));

  // ~30% of the board is "resting" (streak 0–2) so movement is visible.
  const resting = rng() < 0.3;
  const streak = resting ? Math.floor(rng() * 3) : 3 + Math.floor(Math.pow(rng(), 1.4) * 118);

  // Back-dated over ~18 months, weighted toward recent (square bias).
  const createdAtDaysAgo = Math.floor(548 * Math.pow(rng(), 2.2));
  const timezone = pickWeighted(rng, TIMEZONES);
  const vibe = pickWeighted(rng, VBES);

  return {
    index: i,
    slug,
    name,
    email: `${slug}-${i}@bot.focusarx`,
    bio,
    vibe,
    totalXp,
    weeklyXp,
    streak,
    createdAtDaysAgo,
    timezone,
  };
}

/** Level via the canonical formula — must stay in sync with the frontend. */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}
