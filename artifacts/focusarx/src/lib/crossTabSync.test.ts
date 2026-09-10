import { describe, expect, it } from "vitest";
import {
  broadcastLeaderComplete,
  broadcastLeaderState,
  deriveMirrorSeconds,
  isMirrorStale,
  MIRROR_STALE_MS,
  subscribeToLeader,
  type LeaderMirror,
} from "./crossTabSync";

const flush = () => new Promise((resolve) => setTimeout(resolve, 25));
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

function mirrorFixture(overrides: Partial<LeaderMirror> = {}): LeaderMirror {
  return {
    tabId: uid("tab"),
    mode: "focus",
    status: "running",
    secondsLeft: 900,
    deadlineMs: Date.now() + 900_000,
    totalSeconds: 1500,
    receivedAt: Date.now(),
    ...overrides,
  };
}

describe("crossTabSync mirror protocol (P0.3)", () => {
  it("delivers a foreign leader heartbeat to the subscriber", async () => {
    const leaderId = uid("leader");
    const received: LeaderMirror[] = [];
    const unsubscribe = subscribeToLeader({
      ownTabId: uid("follower"),
      onMirror: (m) => { if (m.tabId === leaderId) received.push(m); },
      onResign: () => {},
      onComplete: () => {},
    });
    try {
      broadcastLeaderState(leaderId, {
        mode: "focus",
        status: "running",
        secondsLeft: 899,
        deadlineMs: Date.now() + 899_000,
        totalSeconds: 1500,
      });
      await flush();
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ mode: "focus", status: "running", totalSeconds: 1500 });
    } finally {
      unsubscribe();
    }
  });

  it("ignores its own broadcasts", async () => {
    const ownId = uid("self");
    let calls = 0;
    const unsubscribe = subscribeToLeader({
      ownTabId: ownId,
      onMirror: () => { calls += 1; },
      onResign: () => { calls += 1; },
      onComplete: () => { calls += 1; },
    });
    try {
      broadcastLeaderState(ownId, {
        mode: "focus",
        status: "running",
        secondsLeft: 10,
        deadlineMs: Date.now() + 10_000,
        totalSeconds: 1500,
      });
      broadcastLeaderComplete(ownId, "focus");
      await flush();
      expect(calls).toBe(0);
    } finally {
      unsubscribe();
    }
  });

  it("ignores malformed payloads without throwing (never NaN into the UI)", async () => {
    const mirrors: LeaderMirror[] = [];
    const followerId = uid("follower");
    const unsubscribe = subscribeToLeader({
      ownTabId: followerId,
      onMirror: (m) => { mirrors.push(m); },
      onResign: () => {},
      onComplete: () => {},
    });
    try {
      const ch = new BroadcastChannel("focusarx-timer");
      try {
        ch.postMessage(null);
        ch.postMessage({ nonsense: true });
        ch.postMessage({ type: "state", tabId: uid("bad"), payload: null });
        ch.postMessage({ type: "state", tabId: uid("bad"), payload: { mode: "nonsense", status: "running" } });
        ch.postMessage({ type: "state", tabId: uid("bad"), payload: { mode: "focus", status: "idle" } });
        ch.postMessage({ type: "state", tabId: uid("bad"), payload: { mode: "focus", status: "running", secondsLeft: NaN, totalSeconds: 1500 } });
        ch.postMessage({ type: "state", tabId: followerId, payload: { mode: "focus", status: "running", secondsLeft: 5, deadlineMs: Date.now() + 5000, totalSeconds: 1500 } });
      } finally {
        ch.close();
      }
      await flush();
      expect(mirrors).toHaveLength(0);
    } finally {
      unsubscribe();
    }
  });

  it("routes resign and complete to their handlers", async () => {
    const leaderId = uid("leader");
    const resigned: string[] = [];
    const completed: string[] = [];
    const unsubscribe = subscribeToLeader({
      ownTabId: uid("follower"),
      onMirror: () => {},
      onResign: (id) => { resigned.push(id); },
      onComplete: (id) => { completed.push(id); },
    });
    try {
      broadcastLeaderComplete(leaderId, "focus");
      const ch = new BroadcastChannel("focusarx-timer");
      try {
        ch.postMessage({ type: "resign", payload: { tabId: leaderId }, timestamp: Date.now(), tabId: leaderId });
      } finally {
        ch.close();
      }
      await flush();
      expect(completed).toContain(leaderId);
      expect(resigned).toContain(leaderId);
    } finally {
      unsubscribe();
    }
  });
});

describe("mirror freshness + countdown", () => {
  it("flags mirrors older than three missed heartbeats as stale", () => {
    const now = Date.now();
    expect(isMirrorStale(mirrorFixture({ receivedAt: now }), now)).toBe(false);
    expect(isMirrorStale(mirrorFixture({ receivedAt: now - MIRROR_STALE_MS }), now)).toBe(false);
    expect(isMirrorStale(mirrorFixture({ receivedAt: now - MIRROR_STALE_MS - 1 }), now)).toBe(true);
  });

  it("derives remaining time from the leader deadline (wall-clock, sleep-safe)", () => {
    const now = Date.now();
    const m = mirrorFixture({ deadlineMs: now + 90_500 });
    expect(deriveMirrorSeconds(m, now)).toBe(91);
    expect(deriveMirrorSeconds(m, now + 95_000)).toBe(0);
  });

  it("falls back to the slice for paused mirrors (no deadline)", () => {
    const m = mirrorFixture({ status: "paused", deadlineMs: null, secondsLeft: 300 });
    expect(deriveMirrorSeconds(m, Date.now() + 3_600_000)).toBe(300);
  });
});
