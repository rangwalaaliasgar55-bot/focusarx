// Type declarations for ./clusters.mjs — the pillar/cluster map. Shared with
// the build scripts, which run as plain Node ESM (same convention as
// ./seo-pages.d.mts and ./exam/derive.d.mts).

export interface ClusterSpoke {
  path: string;
  label: string;
}

export interface Cluster {
  id: string;
  /** Human name, e.g. "Pomodoro". */
  label: string;
  /** The pillar page every spoke links back to. */
  pillar: string;
  /** Anchor text for that back-link. */
  pillarLabel: string;
  blurb: string;
  spokes: ClusterSpoke[];
}

export const CLUSTERS: Cluster[];
export const CLUSTER_BY_ID: Map<string, Cluster>;

/** Clusters a path belongs to as a spoke (a pillar is not its own spoke). */
export function clustersFor(path: string): Cluster[];

/** The cluster this path is the pillar of, or null. */
export function pillarCluster(path: string): Cluster | null;

export function pillarLinksFor(path: string): {
  href: string;
  label: string;
  cluster: string;
}[];

export function siblingSpokes(
  path: string,
  limit?: number,
  exclude?: Iterable<string>,
): (ClusterSpoke & { cluster: string })[];
