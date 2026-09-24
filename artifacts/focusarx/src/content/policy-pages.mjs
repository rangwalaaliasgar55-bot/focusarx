/**
 * Policy page bodies — one source for the document and the crawler.
 *
 * These six pages were the last place in the build where the prerendered
 * document and the rendered page disagreed. `src/pages/terms.tsx` held a full
 * terms document while `scripts/prerender-data.mjs` declared `sections: []`,
 * so a reader got the policy and a crawler got a heading, one lead sentence and
 * a "keep reading" list — 15 to 25 words per page.
 *
 * That is not merely thin, it is *indistinguishable*: six near-identical stubs
 * clustering in the same topic space is exactly the shape Google resolves by
 * choosing its own canonical. It is why Search Console reported
 * "Duplicate, Google chose different canonical than user" against
 * `/acceptable-use` while the page's own canonical was correct and
 * self-referencing. Nothing was malformed; there was simply nothing on the page
 * to canonicalise.
 *
 * So the copy lives here, once. `scripts/prerender-data.mjs` renders it into
 * the static HTML and `src/components/PolicyBody.tsx` renders the same array
 * into the app — the two cannot drift, and the depth gate in
 * `scripts/seo-validate.mjs` measures real prose rather than padding.
 *
 * Shape matches the prerenderer's section contract:
 *   { h: heading, p?: paragraph | paragraphs, bullets?: string[] }
 */

/**
 * The legal link set — the footer every policy page ends with, and the same set
 * the prerenderer uses for "keep reading" links.
 *
 * These were two hand-maintained lists in two files, which is how
 * `/cookie-policy` and `/accessibility` ended up reachable only from the
 * sitemap for a while. One array, two renderers.
 */
export const LEGAL_FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookie-policy", label: "Cookies" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/ai-policy", label: "AI Policy" },
  { href: "/data-deletion", label: "Data Deletion" },
  { href: "/accessibility", label: "Accessibility" },
];

/** Shared, honest description of what a session is worth — used by /pricing. */
export const POLICY_PAGES = {
  "/privacy": {
    updated: "August 2026",
    sections: [
      {
        h: "Information we collect",
        p: [
          "We collect what you give us directly: your name, email address and password when you register, and the content you create inside the product — tasks, goals, session intentions, flashcards, notes and chat messages to the coach.",
          "We also collect the usage data the product is built around: focus session durations, break patterns, task completions, streaks and in-app interaction events. This is what produces your analytics, your XP and coins, and your leaderboard position. Guest sessions carry an anonymous identifier generated in your browser instead of an account.",
        ],
      },
      {
        h: "How we use your information",
        bullets: [
          "Provide the service: run timers, store sessions, sync them across your devices.",
          "Calculate XP, coins, streaks, quests and leaderboard rankings.",
          "Generate personalised coaching and study roadmaps when you ask for them.",
          "Send account email only (password resets, and deletion confirmations).",
          "Produce aggregate, anonymised usage statistics so we know which features are actually used.",
        ],
      },
      {
        h: "AI features and what they receive",
        p: [
          "FocusArx uses third-party AI providers — Groq running Llama 3 for the Coach, and Google Gemini for the roadmap generator — to produce coaching replies and study plans. When you use those features, your message and a small amount of session context are sent to the provider handling the request.",
          "We do not send your name, email address, password or payment information to AI providers, and the request carries no account identifier beyond what the provider needs to answer it.",
        ],
      },
      {
        h: "Webcam attention monitoring stays on your device",
        p: [
          "Optional attention monitoring runs MediaPipe entirely inside your browser. Frames are analysed locally and discarded; video is never uploaded, recorded or transmitted. If you never enable the feature, no camera permission is requested at all. The full technical account is on the camera data page.",
        ],
      },
      {
        h: "Data retention",
        p: [
          "Account data is kept for as long as the account exists. Deleting your account starts a 30-day grace window, during which signing back in cancels the deletion; after the window closes the account and its rows are purged, including any email delivery log entries that referenced your address. Guest sessions are eligible for purging after 30 days of inactivity.",
        ],
      },
      {
        h: "Cookies and local storage",
        p: [
          "The app keeps your session token and preferences in browser localStorage rather than in cookies, and we run no third-party advertising or tracking cookies. Analytics is our own, keyed to a random visitor identifier stored locally.",
        ],
      },
      {
        h: "Sharing and disclosure",
        p: [
          "We do not sell personal data. We may publish aggregate, non-identifying statistics (for example, total focus hours across the platform), and we will disclose information where the law requires it. Infrastructure providers process data on our behalf under their own terms — hosting, database and the AI providers named above.",
        ],
      },
      {
        h: "Your rights",
        p: [
          "Depending on where you live you may have the right to access, correct, export or delete your personal data. Export and deletion are self-service from your account settings, and the data deletion page explains what each one removes.",
        ],
      },
      {
        h: "Contact",
        p: [
          "Questions about this policy, or a request that the self-service tools do not cover, can go to focusarx@gmail.com. We aim to answer privacy requests within 30 days.",
        ],
      },
    ],
  },

  "/terms": {
    updated: "August 2026",
    sections: [
      {
        h: "1. Acceptance of terms",
        p: [
          "By accessing or using FocusArx you agree to be bound by these terms and by our privacy policy. If you do not agree with them, please do not use the service.",
        ],
      },
      {
        h: "2. What the service is",
        p: [
          "FocusArx is a productivity platform built around a focus timer: Pomodoro-style and custom-length sessions, task tracking, streaks, study analytics, gamified progression (XP, coins, quests, leaderboards) and optional AI coaching. The service is provided as-is and changes over time — the changelog records what has shipped.",
        ],
      },
      {
        h: "3. Eligibility",
        p: [
          "You must be at least 13 years old to use FocusArx. By creating an account you confirm that you meet this requirement, and that any information you give us about yourself is accurate.",
        ],
      },
      {
        h: "4. Your account",
        bullets: [
          "You are responsible for keeping your credentials confidential and for activity under your account.",
          "Tell us promptly if you believe your account has been accessed by someone else.",
          "Guest sessions are temporary; data may be purged after 30 days of inactivity.",
          "One person, one account — multiple accounts used to inflate leaderboard position are a violation of the acceptable use policy.",
        ],
      },
      {
        h: "5. Acceptable use",
        p: [
          "You agree to use FocusArx lawfully and in line with the acceptable use policy, which lists the specific prohibitions: cheating on leaderboards, abusing AI endpoints, attacking the service, scraping, and posting harmful content. Enforcement steps are described on that page.",
        ],
      },
      {
        h: "6. AI-generated content",
        p: [
          "Coaching replies and generated roadmaps come from third-party models and are provided for information and motivation only. They are not professional medical, psychological, legal or career advice, and they can be wrong. The AI policy describes what is sent to which provider, and what the product does when a provider is unavailable.",
        ],
      },
      {
        h: "7. Rewards, coins and Premium",
        p: [
          "XP, coins and every other reward in FocusArx have no monetary value, cannot be exchanged for cash, and are not transferable between accounts. Premium is unlocked with coins earned from completed sessions, quests and streaks — nothing in the product is sold for money, so there is no card, UPI or payment step anywhere.",
          "Because no money changes hands there is nothing to refund, but a mis-credited reward caused by a bug is still ours to correct: report it and the ledger gets fixed.",
        ],
      },
      {
        h: "8. Intellectual property",
        p: [
          "FocusArx, its interface, its content and its code are owned by FocusArx and protected by applicable intellectual property law. You keep ownership of everything you create inside the product — your tasks, notes, goals and messages.",
        ],
      },
      {
        h: "9. Disclaimers and limitation of liability",
        p: [
          "The service is provided without warranty of any kind. We are not liable for indirect, incidental or consequential damages arising from your use of it. FocusArx is free and Premium is unlocked with in-app tokens, so our aggregate liability is limited to the fullest extent the law allows.",
        ],
      },
      {
        h: "10. Termination",
        p: [
          "Accounts that violate these terms or the acceptable use policy may be suspended or terminated. You may delete your own account at any time from the data deletion page; the 30-day grace period described in the privacy policy applies.",
        ],
      },
      {
        h: "11. Changes to these terms",
        p: [
          "We may update these terms as the product changes. Continued use after an update constitutes acceptance of the revised terms, and material changes are announced to registered users where we have a way to reach them.",
        ],
      },
      {
        h: "12. Contact",
        p: [
          "Questions about these terms can go to focusarx@gmail.com.",
        ],
      },
    ],
  },

  "/cookie-policy": {
    updated: "August 2026",
    sections: [
      {
        h: "What we use instead of cookies",
        p: [
          "FocusArx is a single-page application that keeps your session in browser localStorage rather than in cookies. That means your authentication token and preferences stay in your browser and are not attached to requests to advertising networks — there are none to attach them to.",
        ],
      },
      {
        h: "What is stored locally, and why",
        bullets: [
          "focusarx-auth-token — your signed session token, so you stay signed in between visits.",
          "focusarx-guest-key — an anonymous identifier for guest sessions, so a session started before you sign up is not lost.",
          "focusarx-guest-timer and focusarx-timer-* — a running timer's state, so a refresh, a back-swipe or a closed tab does not destroy a session in progress.",
          "focusarx-theme, focusarx-session-preset, focusarx-timer-theme — your appearance and timer preferences.",
          "focusarx-onboarding-* — flags that stop the onboarding wizard reappearing once you have completed it.",
          "focusarx-visitor-id — a random identifier used to count unique visitors without identifying them.",
        ],
      },
      {
        h: "The one cookie we set",
        p: [
          "The staff admin console uses a short-lived, HttpOnly session cookie. It is set only when an administrator signs in to that console, it is not used for tracking, and ordinary accounts never receive it.",
        ],
      },
      {
        h: "Third parties",
        p: [
          "We run no third-party advertising or tracking cookies. Analytics is ours, not an external script. AI features call Groq and Google when you use the Coach or the roadmap generator, which is a request rather than a cookie; the AI policy lists exactly what those requests contain.",
        ],
      },
      {
        h: "How to clear what is stored",
        p: [
          "Clearing site data for www.focusarx.site in your browser removes every item above: you will be signed out and your local preferences reset. That does not touch your account on our servers — use the data deletion page for that, including the 30-day grace window.",
        ],
      },
    ],
  },

  "/acceptable-use": {
    updated: "August 2026",
    sections: [
      {
        h: "Overview",
        p: [
          "This acceptable use policy governs how FocusArx may be used. Using the service means accepting these rules, and breaking them can lead to content being removed, features being restricted, or an account being suspended. It applies to every part of the product — the timer, tasks and goals, study rooms, the leaderboard, the pledge wall, and anything you send to the AI coach.",
        ],
      },
      {
        h: "What you may use FocusArx for",
        bullets: [
          "Tracking and improving your own focus, study and work habits.",
          "Taking part in the community features: study rooms, leaderboards, streaks, quests and the pledge wall.",
          "Using the coach and roadmap generator for your own development, and exporting your own data.",
          "Storing the tasks, goals, flashcards and notes you want to come back to.",
        ],
      },
      {
        h: "Prohibited activity",
        bullets: [
          "Cheating on the leaderboard — scripting sessions, faking completion, or running several accounts to inflate XP, coins or streak position.",
          "Abusing AI features — bulk requests designed to sidestep rate limits, or reselling generated output as your own product.",
          "Attacking the service — probing for injection flaws, denial of service, credential stuffing, or any other attempt to break the infrastructure.",
          "Reverse-engineering or scraping in ways that breach the terms of service, including harvesting other people's profile data.",
          "Posting harmful content — anything illegal, abusive, harassing, hateful, or that exposes another person's private information.",
          "Impersonating another person, or misrepresenting an account as belonging to someone else.",
        ],
      },
      {
        h: "Study rooms and the pledge wall",
        p: [
          "Live study rooms and the Break Free pledge wall are shared spaces, so they carry an extra expectation: be the reason a room is calm rather than the reason it is not. Hosts are responsible for the rooms they open, pledges must be genuine and constructive, and content that contains abuse, hate speech or personal information is removed. Reporting a room or a pledge is a single tap, and reports are reviewed by a human.",
        ],
      },
      {
        h: "Enforcement and what happens after a report",
        p: [
          "A report creates a moderation review. Because the same pattern looks very different in a first-time slip and a deliberate campaign, enforcement is graded: a minor or first-time violation normally gets a warning and removal of the offending content; repeated violations restrict the features involved — leaderboard eligibility, study rooms, or messaging; serious or repeated violations end in suspension or a permanent ban. Severe cases — coordinated cheating, attacks on the service, or content that endangers another person — are actioned immediately without a prior warning.",
        ],
      },
      {
        h: "Automatic protection",
        p: [
          "Some of this policy is enforced by the product rather than by a moderator: rate limits on AI endpoints, server-side validation of every submitted session so a client cannot invent XP, and bot filtering on public leaderboards and profiles. Those controls exist to keep the community features meaningful for the people actually using them.",
        ],
      },
      {
        h: "Appeals and mistakes",
        p: [
          "Enforcement is done by people reading reports, and people make mistakes. If you believe an action was wrong, reply to the notice or email focusarx@gmail.com with the account and the decision you are questioning, and it will be reviewed again. Where an automated control caused the problem, we would rather fix the control than leave a correct account restricted.",
        ],
      },
      {
        h: "Reporting a violation",
        p: [
          "If you see something that breaks these rules — in a study room, on the pledge wall, in a public profile — report it in the product or email focusarx@gmail.com with a link and a sentence about what happened. Reports are confidential, and you do not need to be the person affected to make one.",
        ],
      },
    ],
  },

  "/ai-policy": {
    updated: "August 2026",
    sections: [
      {
        h: "Where AI appears in FocusArx",
        bullets: [
          "The coach — a conversational productivity assistant that answers questions, suggests session lengths and reacts to how your day is going.",
          "The roadmap generator — turns a subject and a deadline into a structured study plan you can save and edit.",
          "Session summaries and insights — short natural-language readings of a completed session's focus metrics.",
          "Attention monitoring — computer vision that never leaves your device and is not an AI provider request at all.",
        ],
      },
      {
        h: "What is sent to the provider",
        p: [
          "A coach request carries the message you typed, a short window of recent conversation so the reply has context, and an anonymised description of your current session — for example \"25-minute block with 12 minutes remaining\". If you have completed a readiness check-in, that score is included so the advice can respond to it.",
          "What is never sent: your name, your email address, your password, your payment details, or your full session history. Requests are not used to build a profile of you across other services.",
        ],
      },
      {
        h: "Who the providers are",
        p: [
          "Coaching runs on Groq (Llama 3), and roadmap generation runs on Google Gemini. Each provider processes the request under its own terms and privacy policy. If you would rather not send anything to either, the timer, tasks, streaks and analytics work fully without touching them.",
        ],
      },
      {
        h: "Limits of what the models can tell you",
        p: [
          "AI output here is motivational and informational, not professional advice. It is not medical, psychological, legal or financial guidance, and it can be confidently wrong — a generated study plan is a starting point you should sanity-check against your own syllabus, not an authority.",
        ],
      },
      {
        h: "When a provider is unavailable",
        p: [
          "If a provider is down or unconfigured, FocusArx falls back to a curated response set and shows a \"Basic\" indicator in the coach panel rather than failing silently. Core features never depend on AI: the countdown, tasks, streaks, analytics and study rooms are unaffected.",
        ],
      },
      {
        h: "Rate limits",
        p: [
          "AI endpoints are rate-limited per account to keep them available for everyone and to bound cost — the coach accepts a limited number of messages per minute, and roadmap saves are capped per hour. Hitting a limit returns a clear message and the ability to try again shortly.",
        ],
      },
      {
        h: "Your control over it",
        p: [
          "AI features are opt-in: nothing is generated unless you ask for it, and the coach panel can be ignored entirely. You can delete your account's data — including the conversations stored with it — from the data deletion page.",
        ],
      },
    ],
  },
};

/** Section list for a policy path, or an empty array when the page is not here. */
export function policySections(path) {
  return POLICY_PAGES[path]?.sections ?? [];
}

export default POLICY_PAGES;
