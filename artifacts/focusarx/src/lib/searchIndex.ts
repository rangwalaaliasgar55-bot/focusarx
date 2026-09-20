import { PAGE_SEO } from "@/components/PageSEO";

/**
 * The search index, derived rather than hand-maintained.
 *
 * It used to be a hand-written array literal inside `pages/search.tsx`. Against
 * 97 routes it had drifted to **28** — so searching "wallet", "tasks", "habits",
 * "goals" or "pomodoro timer" found nothing, on a page whose entire purpose is
 * finding things. The failure mode is quiet by construction: nobody notices a
 * page *missing* from search, they just conclude the app does not have it.
 *
 * Two sources, and the split is the point:
 *
 * 1. **Derived from `PAGE_SEO`.** That map already carries a curated title,
 *    description and keyword list for every marketing and guide page, because
 *    the SEO gate requires them. Reading it means search cannot disagree with
 *    the page it describes, and adding a page to `PAGE_SEO` makes it findable
 *    for free.
 * 2. **Curated app entries below.** The logged-in application — `/dashboard`,
 *    `/tasks`, `/wallet` — is `noindex` and therefore absent from `PAGE_SEO`.
 *    Those need a written description, because the one on file is the *user's*
 *    understanding of the page, not a crawler's.
 *
 * `NOT_SEARCHABLE` is the third list, and it exists to be *short and reasoned*:
 * auth plumbing, redirects and admin surfaces are not destinations. Anything not
 * in it and not in the index fails `searchIndex.test.ts`, so a new page cannot
 * silently become unfindable — which is the actual defect this module fixes.
 */

export interface SearchEntry {
  title: string;
  description: string;
  path: string;
  section: "Guides" | "Tools" | "Features" | "Company";
  keywords: string;
}

/**
 * Routes that exist but are not destinations.
 *
 * Every one of these is either a step in a flow the user is already in, a
 * redirect, or a surface that is not part of the product's browsable content.
 * The reason is attached because the test reads this list, and a name without a
 * reason is how an exclusion becomes permanent by accident.
 */
export const NOT_SEARCHABLE: Record<string, string> = {
  "/login": "reached by its own header control, not by browsing",
  "/signup": "reached by its own call to action, not by browsing",
  "/welcome": "a post-signup landing step the new user is already in",
  "/auth/callback": "an OAuth redirect target with nothing to read",
  "/forgot-password": "a recovery step, not a destination",
  "/reset-password": "a recovery step reached from an emailed link",
  "/onboarding": "the flow a new account is already inside",
  "/go/ig": "a redirect to the community feed's external link",
  "/admin": "an operator surface, not user-facing",
  "/developer": "an operator surface, not user-facing",
  "/search": "the page you are on; listing it as its own result is noise",
  "/dna": "a legacy alias that redirects to /focus-dna",
  "/camera-data": "a distribution landing page for the Microsoft Store listing",
  "/data-deletion": "reached from the privacy page and the account settings",
  "/acceptable-use": "legal text reached from the footer",
  "/accessibility": "a statement reached from the footer",
  "/safety": "a statement reached from the footer",
  "/press": "a media page reached from the footer",
};

/** Which section a path belongs to. Content pages are named, not guessed. */
function sectionFor(path: string): SearchEntry["section"] {
  if (path.startsWith("/exam") || path.startsWith("/blog") || path.startsWith("/guides")) return "Guides";
  if (path === "/pricing") return "Company";
  if (path.startsWith("/privacy") || path.startsWith("/terms") || path.startsWith("/contact")) return "Company";
  if (path.startsWith("/support") || path.startsWith("/roadmap")) return "Company";
  if (path.startsWith("/changelog") || path.startsWith("/evidence")) return "Company";
  if (path.startsWith("/study-calculator") || path.startsWith("/study-method-quiz")) return "Tools";
  if (path.startsWith("/breathe") || path.startsWith("/break-free")) return "Tools";
  if (path.includes("timer") || path.startsWith("/focus-timer")) return "Tools";
  return "Guides";
}

/**
 * Entries built from `PAGE_SEO`, so a page's search result and its own
 * metadata cannot disagree.
 *
 * The `keywords` field is what makes the difference for a phrase like
 * "concentration": the page's description never uses the word, but the curated
 * keyword list does, and the scorer weights keywords above a body match.
 */
function derivedEntries(): SearchEntry[] {
  const out: SearchEntry[] = [];
  const seen = new Set<string>();
  for (const meta of Object.values(PAGE_SEO)) {
    const path = meta.canonical;
    if (!path || seen.has(path)) continue;
    if (NOT_SEARCHABLE[path]) continue;
    seen.add(path);
    out.push({
      path,
      title: meta.title,
      description: meta.description,
      keywords: meta.keywords ?? "",
      section: sectionFor(path),
    });
  }
  return out;
}

/**
 * Curated entries for the logged-in app.
 *
 * Written from the user's point of view — what the page lets you *do* — because
 * that is the question someone types into a search box. "Track habits and see
 * your streaks" finds the page; "Habits" alone finds nothing if the user's word
 * was "streak".
 */
const APP_ENTRIES: SearchEntry[] = [
  { path: "/dashboard", section: "Features", title: "Dashboard", description: "Your focus minutes, streak and today's next action, with how each number compares to yesterday.", keywords: "dashboard home overview stats summary today progress" },
  { path: "/focus", section: "Features", title: "Focus Timer", description: "Start a focus session with the timer, pick a duration, and see your session history.", keywords: "focus timer session start pomodoro deep work sprint" },
  { path: "/tasks", section: "Features", title: "Tasks", description: "Plan your day, reorder what matters, and check things off as you finish them.", keywords: "tasks todo to-do list plan today checklist done" },
  { path: "/habits", section: "Features", title: "Habits", description: "Build daily habits, see your streaks, and catch the days you miss.", keywords: "habits streak routine daily repeat track consistency" },
  { path: "/goals", section: "Features", title: "Goals", description: "Set longer-term goals and watch your progress toward them.", keywords: "goals objectives targets milestones progress" },
  { path: "/analytics", section: "Features", title: "Analytics", description: "When you focus best: hours of the day, days of the week, and how this week compares to last.", keywords: "analytics insights charts heatmap hours when best time" },
  { path: "/ai-insights", section: "Features", title: "AI Insights", description: "What your focus data says about your patterns, and what to change next.", keywords: "ai insights analysis patterns advice coach" },
  { path: "/focus-dna", section: "Features", title: "Focus DNA", description: "Your focus profile — the conditions, times and session lengths your best work happens in.", keywords: "focus dna profile archetype personality best conditions" },
  { path: "/achievements", section: "Features", title: "Achievements", description: "Badges you have unlocked, and which ones are still within reach.", keywords: "achievements badges rewards unlocked trophies milestones" },
  { path: "/missions", section: "Features", title: "Missions", description: "Short challenges that earn XP and coins for focusing.", keywords: "missions quests challenges daily objectives xp" },
  { path: "/wallet", section: "Features", title: "Wallet", description: "Your coins, XP and token balance, and the history of what you earned and spent.", keywords: "wallet coins tokens balance xp currency earn spend" },
  { path: "/shop", section: "Features", title: "Shop", description: "Spend coins on cosmetics, boosts and upgrades.", keywords: "shop store buy purchase items coins spend" },
  { path: "/marketplace", section: "Features", title: "Marketplace", description: "Buy and gift items with coins, and manage your inventory.", keywords: "marketplace market items gift inventory trade buy" },
  { path: "/lootboxes", section: "Features", title: "Loot Boxes", description: "Open boxes earned from focus sessions for coins and items.", keywords: "lootbox loot box crate reward open surprise" },
  { path: "/quests", section: "Features", title: "Quests", description: "Daily and weekly quests, with the rewards for completing them.", keywords: "quests challenges daily weekly rewards claim" },
  { path: "/battle-pass", section: "Features", title: "Season Pass", description: "Seasonal progress and the rewards unlocked at each tier.", keywords: "battle pass season tiers rewards level unlock" },
  { path: "/leaderboard", section: "Features", title: "Leaderboard", description: "Your rank against everyone and your friends, and how far you are from the next place.", keywords: "leaderboard ranking rank compete weekly xp top scores" },
  { path: "/flashcards", section: "Features", title: "Flashcards", description: "Spaced-repetition cards that schedule each review for when you are about to forget it.", keywords: "flashcards spaced repetition fsrs recall memorize decks cards" },
  { path: "/study-rooms", section: "Features", title: "Live Study Rooms", description: "Focus alongside other people in a room with a shared timer.", keywords: "study rooms live together body doubling accountability group" },
  { path: "/groups", section: "Features", title: "Groups", description: "Focus groups and their shared streaks and standings.", keywords: "groups teams friends accountability community circle" },
  { path: "/social", section: "Features", title: "Community Feed", description: "What other people are working on, and your own focus posts.", keywords: "community feed social posts friends share timeline" },
  { path: "/messages", section: "Features", title: "Messages", description: "Direct conversations with the people you follow.", keywords: "messages chat dm inbox direct conversation" },
  { path: "/notifications", section: "Features", title: "Notifications", description: "Streak reminders, achievements and replies, and which ones you want to receive.", keywords: "notifications alerts reminders settings push" },
  { path: "/profile", section: "Features", title: "Profile & Settings", description: "Your progress, appearance, sound, notifications, connected apps and account security.", keywords: "profile settings account appearance theme sound security integrations webhooks" },
  { path: "/referral", section: "Features", title: "Invite Friends", description: "Your invite code and what you both get when a friend joins.", keywords: "referral invite friends code share bonus" },
  { path: "/premium", section: "Features", title: "Premium", description: "What premium unlocks, and the token cost of each plan.", keywords: "premium pro upgrade unlock tokens membership plan" },
  { path: "/city", section: "Features", title: "Focus City", description: "The city you build with the coins your focus sessions earn.", keywords: "city build buildings skins coins upgrade" },
  { path: "/pets", section: "Features", title: "Pets", description: "Companions that grow as you keep focusing.", keywords: "pets companion collect feed grow unlock" },
  { path: "/dreams", section: "Features", title: "Dream Journal", description: "Record and reflect on your dreams.", keywords: "dreams journal sleep record reflect" },
  { path: "/consequences", section: "Features", title: "Consequences", description: "The stakes you have set for missing a session, and the freezes you can spend.", keywords: "consequences stakes penalties freeze shield miss" },
  { path: "/constellations", section: "Features", title: "Constellations", description: "Sessions arranged as stars, so a stretch of focus becomes something you can see.", keywords: "constellations stars night sky visual progress" },
  { path: "/forge", section: "Features", title: "Forge", description: "Turn earned materials into items.", keywords: "forge craft materials items combine upgrade" },
  { path: "/break-free", section: "Tools", title: "Break-Free Reset", description: "A short guided reset for when you have fallen into a distraction spiral.", keywords: "distraction break free scroll phone reset spiral" },
  { path: "/breathe", section: "Tools", title: "Breathing Reset", description: "A two-minute guided breathing exercise to settle before or after a block.", keywords: "breathe breathing calm reset box breathing anxiety" },
  { path: "/5-minute-timer", section: "Tools", title: "5-Minute Timer", description: "A five-minute countdown for a quick task or a single pomodoro sprint.", keywords: "5 minute timer countdown five quick short" },
  { path: "/10-minute-timer", section: "Tools", title: "10-Minute Timer", description: "A ten-minute countdown for a short focused block.", keywords: "10 minute timer countdown ten short" },
  { path: "/15-minute-timer", section: "Tools", title: "15-Minute Timer", description: "A fifteen-minute countdown for a quarter pomodoro or a reading block.", keywords: "15 minute timer countdown fifteen" },
  { path: "/30-minute-timer", section: "Tools", title: "30-Minute Timer", description: "A thirty-minute countdown for a half-hour deep-work block.", keywords: "30 minute timer countdown thirty half hour" },
  { path: "/45-minute-timer", section: "Tools", title: "45-Minute Timer", description: "A forty-five-minute countdown for a long focus block.", keywords: "45 minute timer countdown forty five long" },
  { path: "/pomodoro-timer", section: "Tools", title: "Pomodoro Timer", description: "The classic 25/5 pomodoro cycle, with your history tracked.", keywords: "pomodoro timer 25 5 technique tomato cycle" },
  { path: "/study-timer", section: "Tools", title: "Study Timer", description: "A study timer with session lengths for revision blocks.", keywords: "study timer revision exam sessions school" },
  { path: "/focus-timer-for-programmers", section: "Tools", title: "Focus Timer for Programmers", description: "Longer deep-work blocks for coding, with break cues that do not break flow.", keywords: "programmer developer coding timer deep work flow" },
  { path: "/study-timer-for-medical-students", section: "Tools", title: "Study Timer for Medical Students", description: "Long-session study timers for the volume medical study demands.", keywords: "medical students neet mbbs study timer long sessions" },
  { path: "/how-to-focus-while-studying", section: "Guides", title: "How to Focus While Studying", description: "A practical routine for studying with attention instead of rereading.", keywords: "how to focus studying concentrate attention" },
  { path: "/body-doubling", section: "Guides", title: "Body Doubling", description: "Why working alongside someone makes focusing easier, and how to use it.", keywords: "body doubling focus alongside adhd accountability" },
  { path: "/stop-scrolling", section: "Guides", title: "How to Stop Scrolling", description: "Why short-form feeds hold attention and what actually breaks the loop.", keywords: "scroll scrolling phone doom scrolling break quit" },
  { path: "/adhd-focus-tools", section: "Tools", title: "ADHD Focus Tools", description: "The tools that help most with ADHD time blindness and task initiation.", keywords: "adhd add focus tools time blindness initiation" },
  { path: "/deep-work-guide", section: "Guides", title: "Deep Work Guide", description: "How to build a deep-work habit that survives a normal week.", keywords: "deep work guide habit distraction free concentration" },
  { path: "/blog", section: "Guides", title: "Blog", description: "Articles on focus, studying and building the habit.", keywords: "blog articles posts writing focus study" },
  { path: "/changelog", section: "Company", title: "Changelog", description: "What shipped, and when.", keywords: "changelog releases updates what's new shipped" },
  { path: "/evidence", section: "Company", title: "Evidence", description: "Every product claim and the source behind it.", keywords: "evidence claims sources research citations proof" },
  { path: "/exam", section: "Guides", title: "Exam Preparation Guides", description: "Exam-specific study plans for JEE, NEET, UPSC, boards and more.", keywords: "exam preparation guides jee neet upsc boards" },
];

/**
 * The localized editions — /in, /us, /hi, /es, /pt-br and their pricing pages.
 *
 * These arrived with the international-editions work on `main`, and the route
 * gate failed the moment they existed: every static route must be either
 * findable or deliberately excluded, and there is no honest reason to exclude a
 * page a user might be looking for ("hindi", "espanol", "india pricing").
 *
 * Titles and descriptions are copied **verbatim** from
 * `src/content/locale-pages.mjs`, the module that authors them, and
 * `searchIndex.test.ts` fails if they ever stop matching it. They are copied
 * rather than imported because that module also carries every localized page
 * body (~45 kb) and this index ships in the entry chunk that the bundle-budget
 * gate watches. The test keeps the two in step at zero runtime cost.
 */
const LOCALE_ENTRIES: SearchEntry[] = [
  { path: "/in", section: "Guides", title: "Focus Timer for JEE, NEET & UPSC Aspirants", description: "Free focus timer for Indian exam prep — JEE, NEET, UPSC, CA, GATE, boards. Pomodoro sessions, IST streaks, an AI coach. No card, no payment.", keywords: "india indian in hindi jee neet upsc ca gate boards ist edition" },
  { path: "/in/pricing", section: "Company", title: "FocusArx India Pricing — Free, UPI or Credits", description: "Core FocusArx tools are free. Pro is ₹199 monthly or ₹1,499 yearly through UPI/card, or 10,000 earned Focus Credits for 30 days.", keywords: "india pricing price rupee inr upi razorpay cost free edition" },
  { path: "/us", section: "Guides", title: "Free Focus Timer for US Students & Grad Test Prep", description: "A free Pomodoro and deep work timer that runs with no account and no card. GRE and GMAT guides, distraction blocking, streaks that reset at your own midnight.", keywords: "usa us united states gre gmat edition grade test prep" },
  { path: "/us/pricing", section: "Company", title: "FocusArx Pricing — Free or Pro", description: "Core FocusArx tools are free. Pro launches at $4.99 monthly or $39 yearly, or unlocks with Focus Credits earned from finished sessions.", keywords: "usa us pricing price cost credit card free pro edition" },
  { path: "/hi", section: "Guides", title: "फ्री पोमोडोरो टाइमर — पढ़ाई के लिए", description: "बिना अकाउंट और बिना कार्ड के मुफ़्त फोकस टाइमर। पोमोडोरो सेशन, स्ट्रीक, स्टडी रूम और AI कोच। JEE, NEET, UPSC और बोर्ड की तैयारी के लिए बनी गाइड।", keywords: "hindi hi हिंदी भाषा भारत पोमोडोरो टाइमर पढ़ाई edition" },
  { path: "/hi/pricing", section: "Company", title: "FocusArx की कीमत — मुफ़्त, UPI या Focus Credits", description: "मुख्य टूल मुफ़्त हैं। Pro ₹199 प्रति माह या ₹1,499 प्रति वर्ष है, या 30 दिनों के लिए 10,000 कमाए हुए Focus Credits।", keywords: "hindi hi हिंदी कीमत मूल्य upi भुगतान edition" },
  { path: "/es", section: "Guides", title: "Temporizador Pomodoro gratis para estudiar", description: "Temporizador de concentración gratis, sin cuenta ni tarjeta. Sesiones Pomodoro, rachas, salas de estudio y un coach de IA. Empieza en diez segundos.", keywords: "espanol spanish es temporizador pomodoro estudiar gratis edition" },
  { path: "/es/pricing", section: "Company", title: "Precios de FocusArx — gratis o Pro", description: "Las herramientas principales son gratis. Pro cuesta $4,99 al mes o $39 al año, o 10.000 Focus Credits ganados por 30 días.", keywords: "espanol spanish es precios coste gratis tarjeta edition" },
  { path: "/pt-br", section: "Guides", title: "Timer Pomodoro grátis para estudar", description: "Timer de foco gratuito, sem conta e sem cartão. Sessões Pomodoro, sequências, salas de estudo e um coach de IA. Comece em dez segundos.", keywords: "portugues portuguese brasil brazil pt timer pomodoro estudar gratis edition" },
  { path: "/pt-br/pricing", section: "Company", title: "Preços do FocusArx — grátis ou Pro", description: "As ferramentas principais são grátis. O Pro custa US$4,99 por mês ou US$39 por ano, ou 10.000 Focus Credits ganhos por 30 dias.", keywords: "portugues portuguese brasil brazil pt precos gratis edition" },
];

/**
 * The index, de-duplicated by path.
 *
 * `APP_ENTRIES` wins where both sources cover a path: the curated app copy is
 * written from the user's side, and two entries for one page would show it twice
 * in an unfiltered list.
 */
export function buildSearchIndex(): SearchEntry[] {
  const byPath = new Map<string, SearchEntry>();
  for (const entry of derivedEntries()) byPath.set(entry.path, entry);
  for (const entry of APP_ENTRIES) byPath.set(entry.path, entry);
  for (const entry of LOCALE_ENTRIES) byPath.set(entry.path, entry);
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export const SEARCH_INDEX: SearchEntry[] = buildSearchIndex();

/**
 * Score an entry against a query.
 *
 * Exported so the ranking is testable without rendering. A title match beats a
 * keyword match beats a body match, and every term must match *something* —
 * otherwise "focus timer" would return every page containing "focus".
 */
export function scoreEntry(entry: SearchEntry, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = `${entry.title} ${entry.description} ${entry.keywords} ${entry.path}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (entry.title.toLowerCase().includes(term)) termScore += 3;
    if (entry.keywords.toLowerCase().includes(term)) termScore += 2;
    if (entry.path.toLowerCase().includes(term)) termScore += 2;
    if (haystack.includes(term)) termScore += 1;
    // All terms must match: a page matching only "focus" is not a result for
    // "focus timer".
    if (termScore === 0) return 0;
    score += termScore;
  }
  return score;
}

export function searchEntries(query: string, index: SearchEntry[] = SEARCH_INDEX): SearchEntry[] {
  if (!query.trim()) return index;
  return index
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .map((r) => r.entry);
}
