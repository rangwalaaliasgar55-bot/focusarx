// ══════════════════════════════════════════════════════════════════
// Pillar–cluster map
// ══════════════════════════════════════════════════════════════════
// Three pillars hold the site's topical authority together:
//
//   /pomodoro-guide   the Pomodoro cluster  — timers, intervals, sprint tools
//   /deep-work-guide  the deep work cluster — attention, environment, stamina
//   /exam             the study exams cluster — 23 exam guides + their timers
//
// A pillar links out to every page in its cluster, and every page in a cluster
// links back to its pillar. That two-way wiring is what makes a cluster read as
// one subject to a crawler instead of 100 loosely related documents, and it is
// what distributes the authority the pillars earn to the pages that need it.
//
// The map lives here — not in the pages — because four renderers need it and
// they must agree: scripts/prerender.mjs (static documents), the shared page
// templates (components/ClusterLinks.tsx), the pillar pages themselves, and
// the gate in scripts/seo-validate.mjs that fails the build when a spoke
// forgets its way back. Exam and timer spokes are derived from the content
// modules rather than typed out, so a new exam guide joins its cluster by
// existing.

import { COMPARISON_PATHS, MINUTE_TIMERS } from "./seo-pages.mjs";
import { FUNNEL_ANGLES } from "./exam-funnel.mjs";
import { EXAM_SLUG_ORDER, examPlanLabel, funnelHeading } from "./exam/derive.mjs";

/** "…/5-minute-timer|5 minute timer" → { path, label } */
function pair(entry) {
  const [path, label] = String(entry).split("|");
  return { path, label };
}

const MINUTE_TIMER_SPOKES = MINUTE_TIMERS.map(pair);

/** Comparisons, assigned to the cluster whose subject they actually argue about. */
const COMPARISON_CLUSTER = {
  // Focus apps and site blockers: the same job a Pomodoro timer does.
  "focusarx-vs-forest": "pomodoro",
  "focusarx-vs-focus-todo": "pomodoro",
  "focusarx-vs-pomofocus": "pomodoro",
  "focusarx-vs-focusmate": "pomodoro",
  "focusarx-vs-freedom": "pomodoro",
  "focusarx-vs-stayfocusd": "pomodoro",
  // Recall and exam prep.
  "focusarx-vs-anki": "exams",
  // Whole-workflow systems: the deep work cluster's subject.
  "focusarx-vs-notion": "deep-work",
  "focusarx-vs-todoist": "deep-work",
  "focusarx-vs-toggl-track": "deep-work",
};

function comparisonSpokes(clusterId) {
  return COMPARISON_PATHS.filter((path) => COMPARISON_CLUSTER[path.split("/").pop()] === clusterId).map(
    (path) => ({
      path,
      label: path.split("/").pop().replace(/^focusarx-vs-/, "FocusArx vs ").replace(/-/g, " "),
    }),
  );
}

/** Essays, assigned by subject. */
const BLOG_CLUSTER = {
  "/blog/why-25-minutes-works": { cluster: "pomodoro", label: "Why 25 minutes works" },
  "/blog/attention-residue-task-switching": { cluster: "deep-work", label: "Attention residue" },
  "/blog/body-doubling-study-accountability": { cluster: "deep-work", label: "Body doubling for study" },
};

function blogSpokes(clusterId) {
  return Object.entries(BLOG_CLUSTER)
    .filter(([, meta]) => meta.cluster === clusterId)
    .map(([path, meta]) => ({ path, label: meta.label }));
}

export const CLUSTERS = [
  {
    id: "pomodoro",
    label: "Pomodoro",
    pillar: "/pomodoro-guide",
    pillarLabel: "The Pomodoro technique",
    blurb:
      "Every timer, interval and sprint tool on FocusArx, plus the guides that explain when each one is the right length.",
    spokes: [
      { path: "/pomodoro-timer", label: "Pomodoro timer" },
      { path: "/focus-timer", label: "Free focus timer" },
      { path: "/study-timer", label: "Study timer" },
      ...MINUTE_TIMER_SPOKES,
      { path: "/breathe", label: "2-minute breathing reset" },
      { path: "/break-free", label: "60-second scroll reset" },
      { path: "/two-hour-study-method", label: "The 2-hour study method" },
      { path: "/how-to-focus-while-studying", label: "How to focus while studying" },
      { path: "/study-techniques", label: "Best study techniques" },
      { path: "/study-method-quiz", label: "Study method quiz" },
      { path: "/adhd-focus-tools", label: "ADHD-friendly focus tools" },
      { path: "/study-timer-for-medical-students", label: "Study timer for medical students" },
      { path: "/focus-timer-for-programmers", label: "Focus timer for programmers" },
      // One dedicated timer page per exam that has a guide.
      ...EXAM_SLUG_ORDER.filter((slug) => FUNNEL_ANGLES[slug]).map((slug) => ({
        path: `/pomodoro-timer-for/${slug}`,
        label: funnelHeading(slug),
      })),
      ...comparisonSpokes("pomodoro"),
      ...blogSpokes("pomodoro"),
      { path: "/guides", label: "Every guide" },
    ],
  },
  {
    id: "deep-work",
    label: "Deep work",
    pillar: "/deep-work-guide",
    pillarLabel: "The deep work guide",
    blurb:
      "How attention actually works, and the tools and environments that protect a long block of it.",
    spokes: [
      { path: "/science-of-deep-work", label: "Neuroscience of deep work" },
      { path: "/deep-study-guide", label: "Deep study guide" },
      { path: "/focus-guide", label: "How to focus" },
      { path: "/two-hour-study-method", label: "The 2-hour study method" },
      { path: "/focus-music", label: "Focus music" },
      { path: "/body-doubling", label: "Body doubling" },
      { path: "/stop-scrolling", label: "How to stop scrolling" },
      { path: "/stop-procrastinating", label: "How to stop procrastinating" },
      { path: "/adhd-focus-tips", label: "How to focus with ADHD" },
      { path: "/30-minute-timer", label: "30 minute timer" },
      { path: "/45-minute-timer", label: "45 minute timer" },
      { path: "/pomodoro-timer", label: "Pomodoro timer" },
      { path: "/study-with-me", label: "Study with me sessions" },
      { path: "/virtual-study-room", label: "Virtual study room" },
      { path: "/study-rooms", label: "Live study rooms" },
      { path: "/focus-timer-for-programmers", label: "Focus timer for programmers" },
      ...comparisonSpokes("deep-work"),
      ...blogSpokes("deep-work"),
      { path: "/guides", label: "Every guide" },
    ],
  },
  {
    id: "exams",
    label: "Study exams",
    pillar: "/exam",
    pillarLabel: "Exam prep guides",
    blurb:
      "A study plan and a dedicated timer for every exam FocusArx covers, from JEE and NEET to CUET, CLAT, GRE and GMAT.",
    spokes: [
      ...EXAM_SLUG_ORDER.map((slug) => ({
        path: `/exam/${slug}`,
        label: examPlanLabel(slug),
      })),
      ...EXAM_SLUG_ORDER.filter((slug) => FUNNEL_ANGLES[slug]).map((slug) => ({
        path: `/pomodoro-timer-for/${slug}`,
        label: funnelHeading(slug),
      })),
      { path: "/study-techniques", label: "Best study techniques" },
      { path: "/feynman-technique", label: "The Feynman technique" },
      { path: "/study-method-quiz", label: "Study method quiz" },
      { path: "/study-calculator", label: "Study time calculator" },
      { path: "/study-timer-for-medical-students", label: "Study timer for medical students" },
      { path: "/study-timer", label: "Study timer" },
      ...comparisonSpokes("exams"),
      { path: "/guides", label: "Every guide" },
    ],
  },
];

export const CLUSTER_BY_ID = new Map(CLUSTERS.map((c) => [c.id, c]));

/** Clusters a path belongs to, as a spoke (a pillar is not its own spoke). */
export function clustersFor(path) {
  return CLUSTERS.filter(
    (cluster) => cluster.pillar !== path && cluster.spokes.some((s) => s.path === path),
  );
}

/** The cluster a path is the pillar of, if any. */
export function pillarCluster(path) {
  return CLUSTERS.find((cluster) => cluster.pillar === path) ?? null;
}

/**
 * Back-links a spoke owes: one per cluster it belongs to.
 *
 * @returns {{href: string, label: string, cluster: string}[]}
 */
export function pillarLinksFor(path) {
  return clustersFor(path).map((cluster) => ({
    href: cluster.pillar,
    label: cluster.pillarLabel,
    cluster: cluster.label,
  }));
}

/**
 * Siblings worth showing next to a page: spokes from the same clusters, in
 * cluster order, excluding the page itself and anything already linked.
 *
 * @param {string} path
 * @param {number} [limit]
 * @param {Iterable<string>} [exclude] paths the page already links to
 */
export function siblingSpokes(path, limit = 5, exclude = []) {
  const skip = new Set([path, ...exclude]);
  const seen = new Set();
  const out = [];
  for (const cluster of clustersFor(path)) {
    for (const spoke of cluster.spokes) {
      if (skip.has(spoke.path) || seen.has(spoke.path)) continue;
      seen.add(spoke.path);
      out.push({ ...spoke, cluster: cluster.label });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
