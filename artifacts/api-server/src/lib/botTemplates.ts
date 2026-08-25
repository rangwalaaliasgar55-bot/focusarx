/**
 * Conversation template pool (Workstream A2).
 *
 * The base layer of the bot social simulator: deterministic, no AI keys
 * needed. Gemini (workstream G) can generate *new* packs that admins review
 * and activate — but this file is the always-on floor.
 *
 * Everything here is encouragement-first by design: bots celebrate, nudge,
 * disagree playfully and rally — they never discourage, and no template
 * contains moderation-triggering language (they still pass moderateText on
 * the way in).
 */

// ── topic families (keyword → family) ────────────────────────────────────────

export const TOPIC_KEYWORDS: Record<string, string[]> = {
  jee: ["jee", "iit", "advanced", "mains", "rank", "percentile", "iitd", "nit"],
  neet: ["neet", "mbbs", "bds", "pharm", "biotech", "biology", "ncert", "dams"],
  upsc: ["upsc", "ias", "prelims", "mains", "csat", "optional", "syllabus"],
  boards: ["boards", "class 12", "class 10", "cbse", "icse", "state board", "marks"],
  cat: ["cat", "xat", "mat", "gmw", "quant", "vaar", "iim"],
  backlogs: ["backlog", "failed", "resit", "semester", "re-semester", "attendance"],
  phone: ["phone", "instagram", "reels", "shorts", "youtub", "addiction", "scroll", "tiktok"],
  hostel: ["hostel", "warden", "mess", "roommate", "dorm", "college"],
  morning: ["4am", "5am", "morning", "sunrise", "early", "wake up", "alarm"],
  pomodoro: ["pomodoro", "25 min", "25-min", "break", "timer", "focus timer"],
  flow: ["flow", "deep work", "concentration", "distraction", "focus"],
  monsoon: ["monsoon", "rain", "thunder", "cloudy", "humidity"],
  results: ["result", "marks", "score", "rank", "declaration", "grade"],
  mocks: ["mock", "test series", "attempted", "accuracy"],
  motivation: ["motivat", "lazy", "tired", "burnt", "burnout", "give up", "discipline"],
  general: ["study", "book", "notes", "chapter", "revision", "syllabus", "prep"],
};

export function topicForContent(content: string): string {
  const c = content.toLowerCase();
  let best = "general";
  let bestHits = 0;
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
    if (topic === "general") continue;
    let hits = 0;
    for (const w of words) if (c.includes(w)) hits++;
    if (hits > bestHits) {
      best = topic;
      bestHits = hits;
    }
  }
  return best;
}

// ── daily posts (per topic family) ───────────────────────────────────────────
// Template receives the author's first name; keep lines short + one emoji max.

export const POST_TEMPLATES: Record<string, Array<(name: string, rng: () => number) => string>> = {
  jee: [
    () => `JEE mock #12 done. Physics 58, Chem 64, Maths 41. Maths is my final boss 😤`,
    () => `Calculus chapter cleared in 4 days. IIT dreams a little closer today 🎯`,
    () => `Rule of the JEE year: 4pm mock, 8pm error log, 11pm sleep. Repeat.`,
    (name) => `${name} here — percentile is a number, daily accuracy is a habit. Focusing on the habit 📈`,
  ],
  neet: [
    () => `NCERT Biology line-by-line, round 3. Diagrams first, text second 🧬`,
    () => `Human Physiology marathon done before the warden's light went off. NEET 2027, wait for me 🔬`,
    () => `Dams + NCERT + 40 pyqs = my NEET triangle. What's yours?`,
    () => `150 mins, 180 questions. Timing practice beats content practice in week 1 of the last month ⏱️`,
  ],
  upsc: [
    () => `Optional: finished 2 chapters, made 30 flashcards. The optional is where ranks are made 📚`,
    () => `CSAT mock tomorrow. Strategy: 25 mins on the easy half, then hunt the rest.`,
    () => `Current affairs digest done at 6am with the mess chai. UPSC mornings hit different ☕`,
  ],
  boards: [
    () => `60 days to boards. Day 14 done: physics practicals + 2 sample papers ✅`,
    () => `Writing answers in full sentences is 40% of the marks. Everyone forgets that ✍️`,
    () => `Class 12 revision plan is on my wall. Circle crossed: Chemistry organic. Who's with me?`,
  ],
  cat: [
    () => `Quant accuracy at 68% this week. Slow but the curve is bending the right way 📊`,
    () => `VAR section: 11/15. English is my strength, quant is my penance 🧮`,
    () => `CAT mocks are just expensive feedback. Today's feedback: speed in DI. Noted.`,
  ],
  backlogs: [
    () => `Backlog clearing week: 2/3 resits done. The third one can keep its distance 💪`,
    () => `Attendance maths: 62% → 74% in 9 days. Shortcuts are a strategy too 📋`,
    () => `Failed a subject last year. Cleared it this year with an A. Backlogs aren't verdicts 🌱`,
  ],
  phone: [
    () => `Phone in the drawer for 3 hours today. Screen time: 22 min. The silence was loud 📵`,
    () => `Reels are the enemy of the last 50 minutes of your day. Move them to 9pm. Thank me later.`,
    () => `Tried "one more scroll" at 1am. It's 2:40 now. Tomorrow I'm a different student 😅`,
  ],
  hostel: [
    () => `Hostel study corner at 11pm: 8 people, 0 noise, 1 shared wifi. Best desk on campus 🏢`,
    () => `Mess food + 5am alarm + one shared dream. Hostel life is its own exam 🍛`,
    () => `Roommate and I study in silence till 10, then argue about whose turn it is to wash the mug 🫗`,
  ],
  morning: [
    () => `Day 19 of the 4am club. The sky is grey and the to-do list is not 🌄`,
    () => `Sunrise study session. The world is quiet, that's when the hardest chapters get read`,
    () => `Alarm at 4:45, chai at 5:15, first problem at 5:30. The early hours compound ☀️`,
  ],
  pomodoro: [
    () => `6 pomodoros today. That's 2.5 hours of actual work. Small number, real number 🍅`,
    () => `Pomodoro rule that changed me: break is mandatory, not a reward. Rest is part of the plan`,
    () => `25 minutes, phone in the other room, one task. That's the whole system 🔁`,
  ],
  flow: [
    () => `Found the flow at 9:30pm and lost track of time for 3 hours. The chapter just… moved 🌊`,
    () => `Deep work update: 2 hours, zero tabs, one playlist. Focus score 94. The system works`,
    () => `Flowstate is a place you return to, not a place you find. Same desk, same time, same silence`,
  ],
  monsoon: [
    () => `Monsoon on the hostel roof + one chapter of Organic. Perfect study weather 🌧️`,
    () => `Thunder outside, NCERT inside. Rainy days are when the reading gets done`,
    () => `The windows leaked and the notes are fine. Monsoon has better aim than me 😂`,
  ],
  results: [
    () => `Results declared: 91.2. Not the top of the class, but the top of *me*. Grateful 🙏`,
    () => `Mock score up 14 points from last month. The graph doesn't lie, it just waits 📈`,
    () => `Scored well, but I know the questions I shouldn't have missed. Results teach better than they praise`,
  ],
  mocks: [
    () => `Mock day check-in: test at 10, analysis at 3, error log before sleep. That's the real exam 📝`,
    () => `Attempted 34/50 today with 80% accuracy. I'm trading speed for now — accuracy first, speed later`,
    () => `The mock isn't to rank you. It's to show you exactly where to spend the next week 🎯`,
  ],
  motivation: [
    () => `Motivation is a visitor. Discipline is the landlord. Showing up on the off days too 🔥`,
    () => `Had a day where nothing clicked. Did the bare minimum: 25 focused minutes. That's allowed 🌱`,
    () => `You're not behind. You're on your own timeline, and it's still early ⏳`,
  ],
  general: [
    () => `New rule: notes are for recall, not for comfort. If I can't explain it, I didn't learn it 🧠`,
    () => `Cleared 3 chapters, 1 practice sheet, 0 notifications. A quiet, good day ✅`,
    () => `Studying the same topic 3 different ways beats studying 3 topics once 📖`,
    () => `Small win of the day: started the hard chapter first, before the brain made excuses 💪`,
    () => `Revision > new content in the last 30 days. Marked my calendar. Who's doing the same?`,
  ],
};

// ── thread scripts: genuine bot-to-bot back-and-forth ────────────────────────
// Each script is a conversation (2–6 lines) that reads like friends.
// First line = the post; the rest are replies from other bots.
// {name} is replaced with the first name of the *speaker* of that line.

export interface ThreadScript {
  topic: string;
  lines: string[];
}

export const THREAD_SCRIPTS: ThreadScript[] = [
  {
    topic: "jee",
    lines: [
      "Honest question: for JEE Advanced, is it better to finish the whole syllabus once, or go 60% of topics to full depth?",
      "Depth. Every topper I've talked to says the same — 150 questions on 12 chapters beats 200 half-remembered concepts.",
      "Counterpoint: in 2026 the Advanced paper actually rewards breadth. I lost 12 marks to 3 chapters I hadn't touched.",
      "Both are true, which is exactly the point. Breadth for the first pass, depth in the last 3 months. The calendar decides, not the ego 📅",
      "Okay that actually untangled it in my head. Thanks you two. Closing the tab before I overthink it 😄",
    ],
  },
  {
    topic: "neet",
    lines: [
      "NEET droppers: what changed in your second year that actually worked? Be honest, no guru-speak please.",
      "Stopped collecting resources. One source per subject, NCERT first, mocks from month 4. Boring and it worked.",
      "Mine was the 4am slot. Morning person I became, and Biology retention doubled. Weirdly the biggest lever for me.",
      "Same with the error log — I started writing *why* I missed each question, not just the answer. Accuracy jumped 9 points.",
      "So: fewer resources, earlier mornings, and an error log that's honest. The boring trifecta 🌱",
    ],
  },
  {
    topic: "phone",
    lines: [
      "Can't stop scrolling after 10pm. Have tried everything. What actually works for you guys?",
      "Phone charges in the kitchen now. Annoying, works. The 2-minute walk to grab it is the whole trick.",
      "I use grayscale mode at 10. It makes reels look like a 2009 novel. Instantly boring 😂",
      "Try the 90-minute rule — no phone for 90 mins before sleep. My sleep quality is the real exam, turns out.",
      "Kitchen charging + grayscale. Stole both ideas, they're mine now. Goodnight scrollers 🌙",
    ],
  },
  {
    topic: "monsoon",
    lines: [
      "It's monsoon in Delhi and my concentration is 40%. Anyone else finding rain both a focus tool and a distraction?",
      "Depends on the chapter. Light reading + rain = chef's kiss. Heavy problem sets = put on headphones. Rain is a seasoning, not a meal 🌧️",
      "The rain makes the hostel quiet though. Everyone's inside, everyone's studying. Best free study room in the country.",
      "Haha 'seasoning, not a meal' is going on my sticky note. Rain study playlist + one problem sheet. Here we go.",
    ],
  },
  {
    topic: "morning",
    lines: [
      "Day 30 of waking at 4am. Some mornings I regret it so hard. What keeps you going?",
      "The 5:30 quiet. Nobody has the internet's noise yet. It's the most peaceful hour of the entire day.",
      "I tie it to chai. No chai, no session. The ritual carries me when the motivation doesn't ☕",
      "Also: you sleep better when you wake early. That's the compounding no one talks about. Energy at 11am feels like a different timezone.",
      "Chai + quiet + better sleep. Okay I'm setting the alarm for 4am tonight. Day 1 of my 30. Wish me luck 🌄",
    ],
  },
  {
    topic: "backlogs",
    lines: [
      "Two backlogs entering my final semester. How do you people stay calm about it?",
      "You don't stay calm, you just keep the calendar honest. 40 min a day on the resit, protected like a class. It's small and it works.",
      "Also: talk to a friend who cleared one. Hearing 'it's fine' from someone who *did* is different from hearing it from me.",
      "I made a 'debt' column in my planner. Seeing the number shrink is its own motivation. 2 → 1 → 0 💪",
      "The debt column. I'm making that right now. Thanks, this thread is doing more for me than a podcast ever did.",
    ],
  },
  {
    topic: "pomodoro",
    lines: [
      "Pomodoro or 2-hour flow blocks? My brain keeps flip-flopping.",
      "25 min when you're avoiding starting. 90 min when you're actually in it. The tool should fit the day, not the other way around.",
      "I do 3 pomodoros then one long block. The short ones are the on-ramp, the long one is the highway 🛣️",
      "Whatever you pick: the break is not optional. A 45-min sprint with 0 rest is a 45-min sprint. Rest is in the system.",
    ],
  },
  {
    topic: "results",
    lines: [
      "My mock percentile dropped this week and I'm spiralling. How do you not let one number own your day?",
      "Write the error log and look at *what* you missed. If it's 3 silly slips, it's not a trend, it's noise.",
      "Also perspective: every topper's graph has a dip. The ones who finish are the ones who read the dip as data, not verdict 📉",
      "I keep a 'wins' list next to the scores. 14 of them this month. One bad mock vs 14 good weeks — the week wins.",
      "Error log + wins list. Doing both tonight. Thanks you three, the spiral is officially paused ✍️",
    ],
  },
  {
    topic: "upsc",
    lines: [
      "UPSC: 11 hours a day but I feel like I'm going in circles. Is the revision loop real or am I doing it wrong?",
      "If after 2 weeks of 'revision' you can't explain the chapter to a wall, it's rereading, not revision. Output is the test 🧱",
      "I switched to 50-minute recall sessions: close the book, write everything. Painful for a week, then it stopped being painful.",
      "And the loops *are* real. The syllabus is wide. 3 passes is normal. Pass 1 is messy by design.",
    ],
  },
  {
    topic: "hostel",
    lines: [
      "Hostel study corner is packed at 10pm. Best free study infrastructure in India, honestly.",
      "Right? The shared wifi is the only thing wrong with it. And the one guy whose fan clicks 🫠",
      "I get the same seat every night. The chair knows me. That's commitment, friends 🪑",
      "Pro tip: bring one extra pen. The corner has a pen economy right now, it's basically a market 😂",
    ],
  },
  {
    topic: "motivation",
    lines: [
      "Had zero energy today. Managed 25 minutes. Is that enough or am I making excuses?",
      "25 focused minutes on a dead day is a win, not an excuse. The streak counts the day, the quality comes back 🌱",
      "Same here last week. Did the 'minimum viable study': 1 chapter skimmed, 10 problems, done. The next day the energy returned.",
      "The bar on bad days is 'show up', not 'perform'. You did show up. That's the whole system 💪",
    ],
  },
  {
    topic: "cat",
    lines: [
      "CAT quant: my accuracy is fine but I'm 15 questions short on speed. What drills actually helped?",
      "Daily 30-min timed sets, 3 days a week. Boring, effective. Speed is reps, not talent ⏱️",
      "I also started a '5-second rule' for easy questions — if I can't see the path in 5 seconds, I skip. Stopped me from bleeding marks.",
      "Skip discipline is underrated. The toppers I know all have a strict skip threshold. It protects the 80% that's actually winnable.",
    ],
  },
];

// ── comments: topic-matched replies to human posts ───────────────────────────
// {name} = commenter's first name. Keep 1–2 sentences, warm, specific.

export const COMMENT_REPLIES: Record<string, string[]> = {
  jee: [
    "That's a serious mock score — the error log is where the next 10 marks are hiding 🎯",
    "Physics 58 and climbing? Consistency like that compounds faster than anyone expects 📈",
    "I'd say trust the process. 12 mocks in and the curve is bending your way 🔥",
    "Solid. Whatever that 'final boss' chapter is, 4 days a go like your Calculus one 💪",
  ],
  neet: [
    "NCERT line-by-line round 3 is the real work. Most people stop at round 2 — you're already ahead 🧬",
    "Biology retention is a morning person's game, and you're playing it right 🔬",
    "That timing practice in the last month will save more marks than any new source ⏱️",
    "The triangle strategy is clean. Add one full mock every Sunday and it's complete ✅",
  ],
  upsc: [
    "Optional done chapter-by-chapter like that is how prelims get cleared. Respect 📚",
    "6am chai + current affairs is a legitimate superpower. Don't break the ritual ☕",
    "30 flashcards from 2 chapters — that's the right density. Keep the optional sharp ✍️",
  ],
  boards: [
    "60-day plan on the wall = a serious player. Cross that Chemistry circle first, it's the big one ✅",
    "Full-sentence answers — yeah, that detail is free marks most people leave on the table ✍️",
    "Day 14 done is day 14 done. The 60-day clock loves people like you 📅",
  ],
  cat: [
    "68% and bending right? The quant grind shows in 3 weeks, not 3 days. Keep the reps going 📊",
    "English strength + quant penance is a very real CAT profile. The penance part ends with timed sets 🧮",
    "Expensive feedback is still the cheapest way to learn. DI speed note accepted 📝",
  ],
  backlogs: [
    "2/3 down and the third one's already scared 💪",
    "Backlogs aren't verdicts, they're chapters you get to rewrite. And you're rewriting well 🌱",
    "Attendance maths is strategy maths. 62 → 74 in 9 days is a flex, honestly 📋",
  ],
  phone: [
    "22 min of screen time is a flex for this platform. The drawer is the way 📵",
    "The 'one more scroll' trap is real. Tomorrow-you is already thanking tonight-you 😄",
    "Move reels to 9pm and watch your evenings come back. It always works 📱",
  ],
  hostel: [
    "The 11pm study corner is the best free study room in the country and I will die on this hill 🏢",
    "8 people, 0 noise — that's a community in the truest sense. Make it count tonight ✨",
    "Shared wifi notwithstanding, hostel quiet hours are elite 🫡",
  ],
  morning: [
    "Day 19 of the 4am club is a flex. The grey sky gets better around day 45, trust me 🌄",
    "The early hours really do compound. That 11am energy is the dividend ☀️",
    "Sunrise readers get the hardest chapters done before the world makes noise. Keep going 🔥",
  ],
  pomodoro: [
    "2.5 real hours beats 6 'focused' hours with your phone in hand. Small number, real number 🍅",
    "Mandatory breaks is the insight most people miss. Rest is part of the system, not a reward 💤",
    "Phone in the other room — the single most effective trick on this platform. Copy it everywhere 🔁",
  ],
  flow: [
    "A 3-hour flow that just… moved? That's the state. Protect the 9:30 slot at all costs 🌊",
    "Focus score 94 — the desk, the time, the silence. The system is real, keep feeding it 📈",
    "Flowstate as a place you return to. That framing alone is worth 10 points 💯",
  ],
  monsoon: [
    "Rain on the tin roof + Organic Chemistry = peak Indian study aesthetic 🌧️",
    "The monsoon study playlist is a shared cultural artifact at this point. Respect 👏",
    "Rainy reading days produce the best notes. The humidity is free motivation ☔",
  ],
  results: [
    "91.2 and *top of you* — that's exactly the right scoreboard 🙏",
    "14 points up from last month. The graph was waiting for you all along 📈",
    "Reading results as data, not as verdicts — that's topper energy, honestly 🧠",
  ],
  mocks: [
    "Test → analysis → error log. That loop is the whole game. Mocks are just mirrors 📝",
    "34 attempted, 80% accuracy — trading speed now is the right call. Accuracy first, always 🎯",
    "The mock's job is to show you where to spend next week. You're already doing that 📅",
  ],
  motivation: [
    "Showing up on the off days is the whole discipline. That's not a small thing 🔥",
    "25 focused minutes on a zero day is the streak keeping itself alive. Do it again tomorrow 🌱",
    "You're on your own timeline and it's early. The board is long, the year is longer ⏳",
  ],
  general: [
    "Notes for recall, not comfort — that rule saves an entire revision cycle 🧠",
    "A quiet, good day with zero notifications is a win. Stack them ✅",
    "Three ways over one chapter > one pass over three chapters. Deep beats wide in revision 📖",
    "Hard chapter first is the meta. The brain's excuses expire by the third problem 💪",
    "Revision in the last 30 days — marked the calendar, same. See you in the ranks 📅",
  ],
};

// ── Hinglish bot-to-bot banter (study rooms, short exchanges) ────────────────

export const BANTER = [
  "library seat kal save karlena, 9 baje aa raha hu 📚",
  "mock mein 142 aaya bhai 😭 phir se 140 ke aas paas",
  "chem physical start kar rahi hu, join? 7 baje library",
  "aaj ka target: 600 marks wali test series, full accuracy. bol do agar koi ho 😤",
  "chai break 10 min, phir wapas war mein ☕",
  "ye chapter kal tak nahi chura toh main khud se ladunga",
  "group study ya silent study? aaj ka dilemma 💭",
  "wifI hostel wala ab 2 ghante se gayab hai, meri life bhi saath mein",
  "error log update: 5 silly mistakes. sabka ek hi wajah — jaldi 😅",
  "kal ki mock ka paper chahiye koi? scan karke bhej do pls",
  "4am club members, check in — kitne up ho? 🌄",
  "NCERT ki 3rd round revision, aaj abhi. toppers hi karte hain ye kaam",
  "phone drawer mein 2 ghante se hai. main badal raha hu logon 📵",
  "monsoon + study playlist = perfect. koi aur track suggest kare?",
  "aaj ka session done: 3 chapters + 1 mock analysis. chalo kal wahi",
  "streak 42 days. koi toh break karne aao, bore ho gaya 😂 (joking, nahi karna)",
  "UPSC wale bhai current affairs digest share kar do please 🙏",
  "boards 60 days left. meri plan wali wall photo bhej rahi hu — cross karke dikha rahi hai",
  "focus score 96 aaya aaj. screen shoot karke save kar liya, flex ke liye",
  "break mein kya karte ho? main sirf 2 min baithta hu, phir wapas wahan 🪑",
];

// ── Arx (official AI companion) tone lines — G2 fallback floor ───────────────
// Witty, warm, a little cheeky, relentlessly encouraging. Hinglish-aware.

export const ARX_CHEERS = [
  "That's the kind of post that reminds me why this community exists. Stack it up 🔥",
  "Noted, archived, and quietly impressed. This is how streaks are made 🤖",
  "Somebody's actually doing the work at this hour. The leaderboard felt that ✨",
  "This. Right here. This is the energy the board runs on 📈",
  "Saving this to the official 'look at this person' file. Well done 🗂️",
];

export const ARX_RALLIES = [
  "Hey — bad days are data, not verdicts. One 25-minute session tomorrow flips the flag. I'm rooting 🤖💛",
  "The dip is the part where the curve gets interesting. You're not behind, you're mid-chapter 🌱",
  "Everyone here has a version of this post. What makes you different is that you'll post the next one too 💪",
  "Take the breath, keep the plan. The minimum viable session still counts — tomorrow you start small 🌤️",
];

/** Pick a cheer or rally deterministically from post engagement signals. */
export function arxFallbackReply(content: string, rng: () => number): string {
  const negative = /struggl|bad day|tired|lazy|burnout|give up|spiral|demotivat|failed|missed/.test(content.toLowerCase());
  const pool = negative ? ARX_RALLIES : ARX_CHEERS;
  return pool[Math.floor(rng() * pool.length)]!;
}

// Count of templates available (used by admin "template health" view).
export function templateInventory(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(POST_TEMPLATES)) out[`post:${k}`] = v.length;
  for (const [k, v] of Object.entries(COMMENT_REPLIES)) out[`comment:${k}`] = v.length;
  out.thread_scripts = THREAD_SCRIPTS.length;
  out.banter = BANTER.length;
  out.arx_lines = ARX_CHEERS.length + ARX_RALLIES.length;
  return out;
}
