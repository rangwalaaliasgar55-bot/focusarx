// ══════════════════════════════════════════════════════════════════
// Minute-length timer pages — /5-minute-timer … /45-minute-timer
// ══════════════════════════════════════════════════════════════════
// One page per duration people actually search for. Each is a *working* timer
// (src/pages/minute-timer.tsx pre-arms the focus timer to that length) plus
// genuinely different copy: a five-minute block and a forty-five-minute block
// are not the same tool, and a template with the number swapped would be thin
// content competing with itself.
//
// Extend by adding a MINUTE_TIMER_PAGES entry — the routes, sitemap segment,
// prerender manifest, llms.txt and internal links all derive from this file.
//
// Copy rules followed here (they are build gates, not style preferences):
//   • the answer-first paragraph is 40–60 words and stands alone as a snippet;
//   • section headings are questions, each answered in one short paragraph;
//   • titles and descriptions share almost no words with each other, so the
//     cannibalisation gate in scripts/seo-validate.mjs stays quiet;
//   • sources are real and specific — see /evidence for the claim policy.

/** The durations published as their own page. */
export const MINUTE_TIMER_DURATIONS = [5, 10, 15, 30, 45];

/** "path|Label" sibling links, so every timer page links the other four. */
const siblingLinks = (minutes) =>
  MINUTE_TIMER_DURATIONS.filter((m) => m !== minutes).map(
    (m) => `/${m}-minute-timer|${m} minute timer`,
  );

/** Shared discovery links: the hub pages a timer searcher should see next. */
const HUB_LINKS = [
  "/pomodoro-timer|Free Pomodoro timer (25/5)",
  "/focus-timer|Focus timer for deep work",
  "/study-timer|Study timer by subject",
  "/focus|Open the timer app",
];

export const MINUTE_TIMER_PAGES = {
  "/5-minute-timer": {
    kind: "tool",
    title: "5 Minute Timer — Free Micro-Break Countdown | FocusArx",
    description:
      "A free 5 minute timer for micro-breaks, task transitions and the two-minute rule. One click to start, no signup, keeps running offline and saves your streak.",
    h1: "5 minute timer for micro-breaks and quick starts",
    lead:
      "Five minutes is the shortest block worth naming. Use it to close a transition cleanly, to do the thing you have been avoiding, or to make a break end on purpose instead of whenever you notice the time.",
    answerFirst:
      "A 5 minute timer is best used for transitions, not work: stand up and reset between blocks, clear one small task you have been avoiding, or cap a break so it ends on purpose. Five minutes is short enough that starting costs nothing, which is exactly why it beats an open-ended pause.",
    software: {
      name: "FocusArx 5 Minute Timer",
      category: "ProductivityApplication",
      description:
        "Browser countdown for five-minute micro-breaks and quick tasks, with optional session logging, streaks and a focus score.",
    },
    howTo: {
      name: "How to use a 5 minute timer",
      steps: [
        { name: "Decide what the five minutes are for", text: "A reset, one small task, or a hard stop on a break. Naming it stops the block from becoming a scroll." },
        { name: "Start the timer and put the phone face down", text: "The countdown is visible on the page; the point is that the end is already decided." },
        { name: "Do the one thing", text: "Reply to the message, file the notes, stretch, walk to the window. One task, no switching." },
        { name: "Stop when it rings", text: "If you are mid-something useful, extend once to a 10 or 15 minute block rather than drifting without a timer." },
      ],
    },
    sections: [
      {
        h: "What is worth doing in five minutes?",
        p: [
          "Anything with a clear end: send the reply, tidy the desk, write the three lines you will work on next, review one flashcard set, stand up and look out of a window. Five minutes suits tasks that are easy to postpone precisely because they are small — the two-minute rule works by removing the negotiation.",
        ],
      },
      {
        h: "Why cap a break with a timer at all?",
        p: [
          "An uncapped break ends when you happen to notice, which is usually well after attention has drifted somewhere else. A ringing timer hands the decision back to you. The break still restores you; what changes is that returning is an event rather than a gradual loss of the afternoon.",
        ],
      },
      {
        h: "How does this differ from a Pomodoro?",
        p: [
          "A Pomodoro is a work interval — 25 minutes of one task, then a break. Five minutes is normally the break, or the warm-up before the work starts. Use the Pomodoro timer when you have a task to make progress on, and this page when you need a bounded pause or a tiny starting wedge.",
        ],
      },
      {
        h: "When is five minutes too short?",
        p: [
          "For anything that needs a warm-up: writing, coding, problem sets, reading dense material. Settling in takes a few minutes, so a five-minute cap ends just as the work becomes interesting. Move to a 30 or 45 minute block for that kind of task and keep five minutes for transitions.",
        ],
      },
    ],
    faq: [
      ["Is the 5 minute timer free?", "Yes, and there is no signup step. Start it in the browser; create a free account only if you want the session, your streak and the focus score saved across devices."],
      ["Does it work offline?", "FocusArx is installable as a PWA, so once the page has loaded the countdown keeps running without a connection. History syncs when you are back online."],
      ["Can I use it as a break timer between Pomodoros?", "That is the most common use. A five-minute break between 25-minute intervals is the standard rhythm; keep the break screen-free where you can, because scrolling does not restore attention the way movement does."],
      ["Will it make a sound when it ends?", "Yes — an end chime, with optional coach audio and ambient sound during the block. Everything runs in the browser; no download."],
      ["Can I change the length?", "The focus app supports custom intervals from 10 to 180 minutes, and this page pre-arms five. For anything longer, open the 10, 15, 30 or 45 minute timer."],
    ],
    cta: { href: "/focus?duration=5", label: "Start a 5 minute block" },
    related: [...siblingLinks(5), "/break-free|60-second scroll reset", "/breathe|Two-minute breathing reset", ...HUB_LINKS],
    lastReviewed: "2026-09-08",
    sources: [
      "David Allen, Getting Things Done (2001) — the two-minute rule for small, postponable tasks.",
      "Sophie Leroy, 'Why is it so hard to do my work?' (2009) — attention residue when switching between tasks.",
      "BJ Fogg, Tiny Habits (2019) — starting small as a behaviour-design lever.",
    ],
  },

  "/10-minute-timer": {
    kind: "tool",
    title: "10 Minute Timer to Start When You Can't | FocusArx",
    description:
      "A free 10 minute timer that makes starting cheap. Use it for the ten-minute rule, warm-ups and small admin sprints — browser-based, no signup, streak-saved.",
    h1: "10 minute timer for the hardest part: starting",
    lead:
      "Procrastination is rarely about the work; it is about opening the file. Ten minutes is long enough to get past the first resistance and short enough that agreeing to it costs nothing.",
    answerFirst:
      "A 10 minute timer is a starting tool: agree to ten minutes only, begin the task, and let momentum decide what happens next. Procrastination research treats avoidance as emotion regulation, not laziness, and a bounded ten minutes lowers the emotional cost of beginning enough that most people continue past the chime.",
    software: {
      name: "FocusArx 10 Minute Timer",
      category: "ProductivityApplication",
      description:
        "Browser countdown for ten-minute starting sprints and warm-ups, with task intent, session scoring and streak tracking.",
    },
    howTo: {
      name: "How to run a 10 minute starting sprint",
      steps: [
        { name: "Name the task out loud or in the task field", text: "'Draft the introduction' rather than 'essay'. Vague tasks are the ones we avoid." },
        { name: "Agree to ten minutes only", text: "The deal is that you may stop when the timer rings. That permission is what makes starting possible." },
        { name: "Work badly on purpose", text: "A rough first ten minutes beats a perfect plan. Do not edit, do not research — produce." },
        { name: "At the chime, choose once", text: "Stop cleanly and take a break, or extend into a 30 minute block. Both are fine; drifting is not." },
      ],
    },
    sections: [
      {
        h: "What is the ten-minute rule?",
        p: [
          "You commit to ten minutes of the task, not to finishing it. The rule works because avoidance is driven by the anticipated discomfort of a long, undefined effort. Shrink the effort and the avoidance shrinks with it — and once you are ten minutes in, the task is usually less awful than the idea of it was.",
        ],
      },
      {
        h: "Why ten minutes rather than twenty-five?",
        p: [
          "Twenty-five asks for a real commitment; ten asks for a taste. On days when starting is the whole problem, the smaller number wins more sessions than the more efficient one. Use 25/5 once starting is easy — the Pomodoro timer is the better tool then — and keep ten minutes for cold starts.",
        ],
      },
      {
        h: "What suits a ten-minute sprint?",
        p: [
          "Warm-ups and shallow work: the first paragraph, inbox triage, setting up an environment, reviewing yesterday's notes, one problem from a set. Ten minutes also works well as a deliberate transition between two subjects, giving the previous one a formal ending before the next begins.",
        ],
      },
      {
        h: "How do I keep going after it rings?",
        p: [
          "Extend deliberately rather than ignoring the chime: open a 30 minute block for the same task and keep the note you were working from in front of you. The reason a sprint converts into a session is that the hard part — contact with the task — is already behind you.",
        ],
      },
    ],
    faq: [
      ["Does the 10 minute timer need an account?", "No. It starts immediately. An account only adds saved sessions, streaks, analytics and cross-device sync."],
      ["Is ten minutes enough to do anything useful?", "Enough to start, which is the part that fails. Ten focused minutes on a real task usually produces a rough draft of something, and rough drafts are editable in a way blank pages are not."],
      ["Should I take a break afterwards?", "If you stop, yes — two to five minutes, screen-free. If you continue, run a longer block and take the break after that; the break should follow effort, not the chime."],
      ["Can I use it for exercise or cooking?", "It is a general countdown, so yes. Most people use it for study and work because FocusArx also logs the session against a task."],
      ["What if I get distracted mid-sprint?", "Note the distraction on paper and return to the task. Ten minutes is short enough that one interruption is recoverable; the note is what stops it becoming a tab you open later."],
    ],
    cta: { href: "/focus?duration=10", label: "Start a 10 minute sprint" },
    related: [...siblingLinks(10), "/stop-procrastinating|How to stop procrastinating", "/deep-study-guide|Deep study guide", ...HUB_LINKS],
    lastReviewed: "2026-09-08",
    sources: [
      "Timothy Pychyl, Solving Procrastination (2013) — avoidance as short-term mood repair; 'just get started'.",
      "Fuschia Sirois & Tim Pychyl, 'Procrastination, Health, and Well-Being' (2013) — emotion-regulation account of delay.",
      "David Allen, Getting Things Done (2001) — two-minute rule and next-action specificity.",
    ],
  },

  "/15-minute-timer": {
    kind: "tool",
    title: "15 Minute Timer for Revision Sprints (Free) | FocusArx",
    description:
      "A free 15 minute timer for active-recall sprints: flashcards, past-paper questions and formula drills. Browser-based, no signup, saves to your streak.",
    h1: "15 minute timer for active recall sprints",
    lead:
      "Fifteen minutes is the natural size of a retrieval burst — long enough for a real set of questions, short enough to repeat four times in an evening without the session collapsing into rereading.",
    answerFirst:
      "A 15 minute timer suits retrieval practice: pick one topic, answer questions from memory for fifteen minutes, then check and correct. Testing yourself beats rereading in almost every comparison, and short sprints keep the effort high enough to work while staying easy to schedule between other things.",
    software: {
      name: "FocusArx 15 Minute Timer",
      category: "EducationalApplication",
      description:
        "Browser countdown for fifteen-minute revision sprints, with subject tagging, session scoring and streak tracking.",
    },
    howTo: {
      name: "How to run a 15 minute revision sprint",
      steps: [
        { name: "Pick one topic and one mode", text: "Flashcards, past-paper questions, or blank-page recall. One topic per sprint — mixing slows retrieval too much to be useful." },
        { name: "Start the timer and answer from memory first", text: "No notes open. The struggle to retrieve is the mechanism, not a flaw in the session." },
        { name: "Mark what you missed", text: "Wrong, half-right or blank. That list is the next sprint's topic." },
        { name: "Correct for two minutes, then stop", text: "Fix the errors briefly and close the book. Spacing the next attempt beats extending this one." },
      ],
    },
    sections: [
      {
        h: "Why fifteen minutes for retrieval practice?",
        p: [
          "Retrieval is effortful, and effort is what makes it stick — but it degrades quickly. Fifteen minutes keeps you answering from memory rather than recognising, which is where the benefit lives. Longer blocks drift into rereading and highlighting, the two techniques evidence rates lowest for durable learning.",
        ],
      },
      {
        h: "What should the fifteen minutes contain?",
        p: [
          "Questions, not notes. Past-paper items, flashcards, or a blank sheet where you write everything you can recall about one topic and then compare it with the source. If your hand is not producing answers, you are reviewing rather than retrieving, and the sprint will feel easier but teach you less.",
        ],
      },
      {
        h: "How many sprints should I do a day?",
        p: [
          "Two to four, spread out. Distributed practice beats the same total time in one sitting, and spacing across days beats spacing across hours. A realistic pattern is one after class, one before dinner and one short set the next morning on whatever you missed.",
        ],
      },
      {
        h: "15 minutes or a full Pomodoro?",
        p: [
          "Use fifteen when the material is dense or new — definitions, formulas, vocabulary, case law — because retrieval fatigue arrives early. Use a 25-minute Pomodoro when the task has momentum: writing, problem sets you already understand, or code. Many students alternate: sprint to learn, Pomodoro to apply.",
        ],
      },
    ],
    faq: [
      ["Is the 15 minute timer free to use?", "Yes. No signup, no trial, no card. Logging sessions to a streak is free too; Focus Tokens unlock Premium extras."],
      ["Does active recall really work better than rereading?", "Testing effect studies find retrieval practice produces better later recall than an equal amount of rereading, including on inference questions. Dunlosky and colleagues rated practice testing high utility across ages and materials."],
      ["Can I tag the sprint to a subject?", "Yes — the study timer links blocks to subjects, so revision time per topic is measurable instead of a feeling."],
      ["What if I finish the set early?", "Add a second pass on the items you missed rather than stopping. The misses are the useful part; a clean sweep usually means the questions were too easy."],
      ["Is this useful for board and entrance exams?", "It is the standard unit for CBSE revision, NEET Biology recall and JEE formula drills — short, topic-scoped, repeated across days."],
    ],
    cta: { href: "/focus?duration=15", label: "Start a 15 minute sprint" },
    related: [...siblingLinks(15), "/study-techniques|Best study techniques, ranked by evidence", "/study-calculator|Study time calculator", "/exam|Exam prep hub", ...HUB_LINKS],
    lastReviewed: "2026-09-08",
    sources: [
      "Roediger & Karpicke, 'Test-Enhanced Learning' (2006) — retrieval practice versus rereading.",
      "Dunlosky et al., 'Improving Students' Learning With Effective Learning Techniques' (2013) — practice testing and distributed practice rated high utility.",
      "Cepeda et al., 'Distributed Practice in Verbal Recall Tasks' (2006) — spacing effects.",
    ],
  },

  "/30-minute-timer": {
    kind: "tool",
    title: "30 Minute Timer: Deep Work Without Burnout | FocusArx",
    description:
      "A free 30 minute timer for one-task deep work: long enough to get past settling in, short enough to repeat. Scores each block and tracks focus week over week.",
    h1: "30 minute timer for deep work you can repeat",
    lead:
      "Half an hour is the smallest block that counts as real work on a hard task. It clears the settling-in cost, leaves room for three or four in a day, and ends before the kind of fatigue that turns the next block into a scroll.",
    answerFirst:
      "A 30 minute timer gives one task your full attention for half an hour, then a deliberate break. It is the shortest block that pays for its own warm-up: settling in costs a few minutes, so thirty leaves enough real work to matter while staying short enough to repeat three or four times in a day.",
    software: {
      name: "FocusArx 30 Minute Timer",
      category: "ProductivityApplication",
      description:
        "Browser countdown for half-hour deep work blocks, with focus scoring, session history, streaks and optional live study rooms.",
    },
    howTo: {
      name: "How to run a 30 minute deep work block",
      steps: [
        { name: "Choose one outcome, not one topic", text: "'Write the method section draft' beats 'thesis'. A block needs a finish line you can see." },
        { name: "Remove the interruptions before you start", text: "Phone in another room, notifications off, tabs closed. Interruption cost is paid whether or not you take the call." },
        { name: "Start and stay on the one task", text: "Note anything that comes up on paper and keep going. The note is the interruption handler." },
        { name: "Stop at the chime and take a real break", text: "Five to ten minutes away from the screen. Repeat up to four blocks, then take a long break or stop for the day." },
      ],
    },
    sections: [
      {
        h: "Why is thirty minutes the smallest real deep-work block?",
        p: [
          "Because the first few minutes go on settling in: finding the file, reloading the problem into your head, resisting the urge to check something. A ten-minute block spends most of itself on that cost. Thirty minutes leaves roughly twenty-five of actual work, which is enough to move a hard task visibly forward.",
        ],
      },
      {
        h: "What should the break look like?",
        p: [
          "Movement and distance from the screen: stand up, walk, look out of a window, get water. Five to ten minutes is enough. A break spent scrolling keeps the same attention system loaded, which is why it often leaves you more scattered than sitting still would have.",
        ],
      },
      {
        h: "How many 30 minute blocks a day is realistic?",
        p: [
          "Three or four for most people, on top of whatever else the day contains. Deliberate-practice research puts the sustainable ceiling for focused cognitive work well below a full working day — treat four good blocks as a strong result rather than evidence you are falling behind.",
        ],
      },
      {
        h: "30 minutes, 50/10, or 90?",
        p: [
          "Thirty for repetition and for days with fragmented time. Fifty over ten when the task needs more run-up — writing, coding, proofs. Ninety for the one session a day where you want depth above everything and can protect the time. Escalate only while the work stays honest; a long block with your phone beside you is a short block with extra guilt.",
        ],
      },
    ],
    faq: [
      ["Is the 30 minute timer free?", "Yes — the timer, tasks, streaks and session history are free forever. Premium extras are unlocked with Focus Tokens earned by completing sessions."],
      ["Do I need an account?", "No. Start the block immediately; an account only keeps your history, focus score and streak across devices."],
      ["Is half an hour enough for deep work?", "For most tasks, yes — it clears the warm-up and produces something you can point to. Reserve 50 or 90 minutes for work that needs sustained state, and use thirty for everything else so you can do it several times a day."],
      ["Should I silence notifications?", "Yes, before the block starts. An interruption costs more than its own length because reloading the task afterwards takes minutes; removing the possibility is cheaper than resisting it."],
      ["Can other people work alongside me?", "Live study rooms run a shared countdown with other learners, camera optional and off by default. It is the body-doubling effect, and it makes starting a hard block easier."],
    ],
    cta: { href: "/focus?duration=30", label: "Start a 30 minute block" },
    related: [...siblingLinks(30), "/deep-work-guide|Deep work guide", "/science-of-deep-work|The science of deep work", "/virtual-study-room|Virtual study rooms", ...HUB_LINKS],
    lastReviewed: "2026-09-08",
    sources: [
      "Cal Newport, Deep Work (2016) — scheduling and protecting concentrated blocks.",
      "K. Anders Ericsson et al., 'Deliberate Practice' (1993) — focused practice sessions and daily limits.",
      "Sophie Leroy (2009) — attention residue after task switching.",
    ],
  },

  "/45-minute-timer": {
    kind: "tool",
    title: "45 Minute Timer for Study Blocks & Mocks | FocusArx",
    description:
      "A free 45 minute timer that matches a school period or a mock-paper section. Build exam stamina with timed blocks, focus scores and live study rooms.",
    h1: "45 minute timer for class-length study blocks",
    lead:
      "Forty-five minutes is the length of a school period and roughly the length of one exam section. Practising at that length trains the thing exams actually test: staying accurate for as long as the paper runs.",
    answerFirst:
      "A 45 minute timer matches a school period and a single exam section, which makes it the practice length for exam stamina. Run one section of a past paper or one subject's problem set at real timing, then take a ten-minute break — accuracy at minute forty is what the exam grades, not accuracy at minute five.",
    software: {
      name: "FocusArx 45 Minute Timer",
      category: "EducationalApplication",
      description:
        "Browser countdown for forty-five-minute study blocks and mock-paper sections, with focus scoring, subject tagging and study rooms.",
    },
    howTo: {
      name: "How to practise a 45 minute exam block",
      steps: [
        { name: "Pick one section, not one paper", text: "One subject or one section of a past paper at official timing. A whole paper needs a whole morning; a section fits after class." },
        { name: "Set up exam conditions", text: "No notes, no music with lyrics, no phone in reach, one sheet of rough work. Conditions are part of what you are practising." },
        { name: "Start the timer and work to the chime", text: "Skip and return rather than stalling — time management is a graded skill on every timed paper." },
        { name: "Mark it and log the misses", text: "Score it honestly, write down why each miss happened, and make those topics the next block." },
      ],
    },
    sections: [
      {
        h: "Why forty-five minutes?",
        p: [
          "Because it is the unit real exams and real timetables use. A school period runs about forty to fifty minutes, and most entrance papers divide into sections of similar length. Practising at that length builds the specific stamina the paper demands — holding accuracy in minute forty, when the easy gains are gone.",
        ],
      },
      {
        h: "How do I use it for mock-paper practice?",
        p: [
          "Take one section at official timing and mark it immediately. Two blocks a week, marked properly, beats one full mock a month left unmarked: the value is in the error log, not in the score. Rotate subjects so each one gets a timed block every few days.",
        ],
      },
      {
        h: "Is 45 minutes better than a Pomodoro for studying?",
        p: [
          "For exam preparation, usually yes — because the exam is longer than twenty-five minutes and you need to practise sustaining attention past the point where a Pomodoro would have given you a break. Keep 25/5 for revision of new material and use forty-five for application under timing.",
        ],
      },
      {
        h: "When should I move up to ninety minutes?",
        p: [
          "When forty-five feels manageable and your paper has long sections — JEE Advanced, UPSC answer writing, full-length NEET papers. Build there in steps rather than jumping: forty-five, then sixty, then ninety, with the same exam conditions at each length.",
        ],
      },
    ],
    faq: [
      ["Is the 45 minute timer free?", "Yes, with no signup required. Sessions, streaks and the focus score are free too; Focus Tokens unlock Premium extras."],
      ["Does it suit board exams as well as entrance exams?", "Yes. CBSE papers are three hours, so practising in forty-five-minute sections with short breaks maps closely onto the real paper's structure and pacing."],
      ["How long should the break be?", "About ten minutes, away from the screen. After two or three blocks take a longer break — the aim is repeated quality, not maximum hours."],
      ["Can I study with other people at the same time?", "Live study rooms run the same countdown for everyone in the room, camera optional and off by default. It is useful for mock timing because everybody starts together."],
      ["Should I use music?", "Not for exam-condition practice — the real paper is silent. If you need sound while studying, lyric-free ambient or brown noise is the least costly option."],
    ],
    cta: { href: "/focus?duration=45", label: "Start a 45 minute block" },
    related: [...siblingLinks(45), "/exam|Exam prep hub", "/study-timer|Study timer by subject", "/focus-music|Best music for studying", ...HUB_LINKS],
    lastReviewed: "2026-09-08",
    sources: [
      "K. Anders Ericsson et al., 'Deliberate Practice' (1993) — practice structured to match performance conditions.",
      "NTA and CBSE published exam patterns — paper length and section structure for JEE Main, NEET UG and board exams.",
      "Dunlosky et al. (2013) — interleaved and distributed practice ratings.",
    ],
  },
};

/** Lookup helper for the page component and tests. */
export function getMinuteTimerPage(minutes) {
  return MINUTE_TIMER_PAGES[`/${minutes}-minute-timer`] ?? null;
}
