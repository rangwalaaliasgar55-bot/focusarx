// ══════════════════════════════════════════════════════════════════
// FocusArx blog content — the file the prompt asked for: extend by adding
// an entry here. Everything downstream (blog index, /blog/:slug pages,
// prerender manifest, sitemap) derives from BLOG_POSTS, so one edit ships
// the post everywhere. Keep copy unique per post — no templated filler.
// ══════════════════════════════════════════════════════════════════

export const BLOG_POSTS = [
  {
    slug: "why-25-minutes-works",
    title: "Why 25 Minutes Works | The Science of the Pomodoro Interval",
    description:
      "The 25-minute Pomodoro interval is not magic — it matches how attention fatigues and recovers. What the research actually says, and when to break the rule.",
    date: "2026-09-05",
    readMin: 6,
    h1: "Why 25 minutes works",
    lead: "Twenty-five minutes is short enough to start without dread and long enough to do real work. The interval succeeds for unglamorous reasons: it bounds the commitment, forces a recovery break, and makes progress countable.",
    sections: [
      {
        h: "Starting is the hard part, not working",
        p: "Procrastination research consistently finds that the dread of beginning outweighs the pain of doing. A 25-minute commitment slips under the avoidance reflex: anyone can endure 25 minutes. Once started, most people continue past the bell — the interval's real job was getting them to open the file.",
      },
      {
        h: "Attention fatigues on a 20–45 minute curve",
        p: "Sustained-attention studies show vigilance declining within the first half hour of continuous effort, with brief breaks restoring performance close to baseline. The 5-minute rest is not wasted time; it is what buys the next 25 minutes at full quality. Skipping breaks borrows focus from later at punishing interest.",
      },
      {
        h: "Countable work compounds",
        p: "Four pomodoros is a day you can point to. The count turns vague effort into a score, and scores feed streaks — the mechanism that carries motivation on days discipline does not show up. Track completions, not hours.",
      },
      {
        h: "When to break the 25-minute rule",
        p: "Once starting is easy, extend: 50/10 for problem sets, 90/15 for deep writing. The rule to keep is the rhythm — bounded work, real rest, counted reps — not the number 25.",
      },
    ],
    faq: [
      ["Is 25 minutes backed by science?", "Indirectly. No study proves 25 is optimal, but sustained-attention research supports short bounded intervals with real breaks, and the low commitment reliably defeats start-up procrastination."],
      ["Should I skip breaks when I am in flow?", "Finish the thought, then take the break anyway. Flow returns faster after rest; grinding through it borrows tomorrow's focus."],
    ],
  },
  {
    slug: "attention-residue-task-switching",
    title: "Attention Residue: Why Task Switching Costs 23 Minutes",
    description:
      "Part of your mind stays on the last task after you switch. What attention residue is, what it costs students, and the three cheapest ways to kill it.",
    date: "2026-09-05",
    readMin: 5,
    h1: "Attention residue and the 23-minute refocus",
    lead: "When you switch tasks, part of your attention stays behind — still chewing on the unfinished thread. Researchers call it attention residue, and full recovery averages over twenty minutes. Every 'quick check' restarts that clock.",
    sections: [
      {
        h: "The residue mechanism",
        p: "The mind does not context-switch like a computer; it drags the previous goal set along. After answering one message mid-study, the message keeps occupying working memory while you read — comprehension drops while effort feels the same, so the damage is invisible to the person doing it.",
      },
      {
        h: "Why students pay double",
        p: "Study material is high-interference: similar concepts compete in memory. Switching between physics and chemistry mid-session is worse than switching between either and a walk, because the residues collide. One subject per block is not preference — it is interference management.",
      },
      {
        h: "Three cheap fixes",
        p: "First, single-tab sessions: one thing open, phone in another room. Second, shutdown rituals: write the next step down before any switch, which lets the brain release the thread. Third, batch the small stuff: messages, email and admin get their own block, never the gaps between study blocks.",
      },
    ],
    faq: [
      ["Does music count as task switching?", "Steady instrumental sound is fine for most people; lyrical or novel audio competes for the same verbal channel as reading. If comprehension drops, drop the lyrics first."],
      ["What about planned breaks?", "Breaks between bounded blocks are recovery, not switching — the block ended deliberately, so there is no open thread leaving residue."],
    ],
  },
  {
    slug: "body-doubling-study-accountability",
    title: "Body Doubling: Why Studying Near Others Works",
    description:
      "Working alongside another person measurably improves task initiation and persistence. The psychology of body doubling and how to use study rooms well.",
    date: "2026-09-05",
    readMin: 5,
    h1: "Body doubling: accountability without pressure",
    lead: "Body doubling is simple: work on your own task in the presence of another person who is also working. It is one of the most replicated focus effects in ADHD coaching — and it works on everyone, because starting is social even when the work is solo.",
    sections: [
      {
        h: "Why presence changes behavior",
        p: "Being observed — even silently, even by strangers — raises the cost of quitting and lowers the cost of starting. Cameras-on study rooms recreate the library effect: the room holds the norm, so willpower does not have to. You do not need conversation; co-presence is the active ingredient.",
      },
      {
        h: "How to run a good room session",
        p: "State your goal in one sentence at the start. Keep cameras on and mics off during blocks. Chat only on breaks — mid-block messages recreate the switching cost the room exists to prevent. Ninety minutes with two other people beats three solo hours.",
      },
      {
        h: "When to study alone instead",
        p: "Deep creative work with fragile early ideas can suffer under observation. Use rooms for initiation-heavy work — problem sets, revision, writing sprints — and solitude for work that needs internal quiet.",
      },
    ],
    faq: [
      ["Do cameras need to be on?", "They help a lot — the effect scales with perceived presence. If cameras are off for privacy, a shared timer and stated goals preserve most of it."],
      ["Is chatting during breaks okay?", "Yes, and it helps: social breaks are more restorative than scrolling ones. Keep it inside the break window."],
    ],
  },
];

export const BLOG_PATHS = BLOG_POSTS.map((p) => `/blog/${p.slug}`);

export function getBlogPost(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
