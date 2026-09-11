import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

/**
 * Regression test for the production HTTP 500 on `GET /api/study-rooms`.
 * ══════════════════════════════════════════════════════════════════
 * Observed live:
 *
 *   {"error":{"code":"INTERNAL_ERROR","message":"Could not load study rooms",
 *             "requestId":"req_466253d6-…"}}
 *
 * The tables exist. What the endpoint did not survive was a *query* that the
 * deployed database could not answer: it read with a bare `db.select()`, which
 * drizzle expands to **every column in lib/db/src/schema**, and it chained five
 * such reads together with no per-query fallback. One column missing from the
 * live database (Postgres SQLSTATE 42703 — the shape of any migration that has
 * not been applied yet) or one missing relation (42P01) failed the whole chain,
 * so the room list — and /forge-room, which polls it every few seconds — was
 * permanently 500 while every other endpoint worked.
 *
 * These tests drive the real router against a fake `db` that can be told to
 * fail exactly like Postgres does, and assert the endpoint now:
 *
 *   • drops the missing column, retries, and answers 200;
 *   • degrades decoration (participant counts, wallet levels, message counts)
 *     instead of failing the payload;
 *   • still fails loudly — 500 with the standard envelope — when the *primary*
 *     read cannot be satisfied at all, so a real outage is not masked.
 */

// ─── fake db ────────────────────────────────────────────────────────────────

interface QueryLogEntry {
  table: string;
  fields: string[];
}

interface FakeDbState {
  /** table name → column names the deployed database is missing. */
  missingColumns: Map<string, Set<string>>;
  /** table names that do not exist at all. */
  missingTables: Set<string>;
  /** table name → rows to return. */
  rows: Map<string, unknown[]>;
  /** fail every read of this table regardless of columns (real outage). */
  hardFail: Set<string>;
  log: QueryLogEntry[];
}

const state: FakeDbState = {
  missingColumns: new Map(),
  missingTables: new Set(),
  rows: new Map(),
  hardFail: new Set(),
  log: [],
};

function pgError(sqlstate: string, message: string, extra: Record<string, string> = {}): Error {
  return Object.assign(new Error(message), { code: sqlstate, ...extra });
}

/** Column names a selection actually asks for, from a drizzle field object. */
function fieldColumnNames(fields: unknown): string[] {
  if (!fields || typeof fields !== "object") return [];
  return Object.values(fields as Record<string, { name?: string }>)
    .map((column) => (column && typeof column === "object" ? column.name : undefined))
    .filter((name): name is string => typeof name === "string");
}

function makeChain(tableName: string, fields: unknown) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    limit: () => chain,
    then: (
      onFulfilled?: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve()
      .then(() => resolveQuery(tableName, fields))
      .then(onFulfilled, onRejected),
  };
  return chain;
}

/**
 * Project rows onto the columns the query actually selected, the way Postgres
 * does. Without this a row would keep a field the SELECT dropped and the test
 * could not tell a working drift-retry from a lucky one.
 */
function project(rows: unknown[], fields: unknown): unknown[] {
  const keys = fields && typeof fields === "object" ? Object.keys(fields as Record<string, unknown>) : [];
  if (keys.length === 0) return rows;
  return rows.map((row) => {
    const source = row as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = source[key];
    return out;
  });
}

async function resolveQuery(tableName: string, fields: unknown): Promise<unknown[]> {
  const requested = fieldColumnNames(fields);
  state.log.push({ table: tableName, fields: requested });

  if (state.hardFail.has(tableName)) {
    throw pgError("08006", "terminating connection due to administrator command");
  }
  if (state.missingTables.has(tableName)) {
    throw pgError("42P01", `relation "${tableName}" does not exist`, { table: tableName });
  }
  const missing = state.missingColumns.get(tableName);
  if (missing && missing.size > 0) {
    // Postgres reports the first column it cannot find — exactly what a schema
    // that has drifted behind lib/db/src/schema produces.
    const offending = requested.find((name) => missing.has(name));
    if (offending) {
      throw pgError("42703", `column "${offending}" does not exist`, { column: offending });
    }
  }
  return project(state.rows.get(tableName) ?? [], fields);
}

/** drizzle keeps the SQL table name under its own (unexported-type) symbol. */
function sqlTableName(table: object): string {
  const symbol = Object.getOwnPropertySymbols(table).find((s) => s.description === "drizzle:Name");
  const name = symbol ? (table as Record<symbol, unknown>)[symbol] : undefined;
  return typeof name === "string" && name !== "" ? name : "unknown";
}

const fakeDb = {
  select: (fields?: unknown) => ({
    from: (table: object) => makeChain(sqlTableName(table), fields),
  }),
};

vi.mock("@workspace/db", async (importActual) => {
  const actual = await importActual<Record<string, unknown>>();
  return { ...actual, db: fakeDb };
});

// ─── fixtures ───────────────────────────────────────────────────────────────

const HOST = "user-host";

const ROOM = {
  id: "room-1",
  name: "Silent library",
  groupId: null,
  hostId: HOST,
  mode: "silent",
  status: "active",
  maxParticipants: 50,
  timerDuration: 1500,
  ambiance: "silence",
  isPublic: true,
  inviteCode: "ABC12345",
  scheduledFor: null,
  endedAt: null,
  description: "No talking, just work.",
  topic: "Physics",
  lastActivityAt: new Date("2026-09-11T10:00:00Z"),
  createdAt: new Date("2026-09-11T09:00:00Z"),
};

const MEMBER = {
  id: "member-1",
  roomId: "room-1",
  userId: HOST,
  joinedAt: new Date(),
  leftAt: null,
  focusMinutes: 12,
  status: "active",
};

const USER = { id: HOST, name: "Aliasgar", email: "host@focusarx.site", role: "user" };
const WALLET = { userId: HOST, level: 7 };
const MESSAGE_COUNT = { roomId: "room-1", count: 3 };

function seedHappyPath() {
  state.rows.set("study_rooms", [ROOM]);
  state.rows.set("study_room_members", [MEMBER]);
  state.rows.set("users", [USER]);
  state.rows.set("user_wallets", [WALLET]);
  state.rows.set("study_room_messages", [MESSAGE_COUNT]);
  state.rows.set("study_groups", []);
}

async function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const { studyRoomsRouter } = await import("./studyRooms");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { id: string }).id = "req_test";
    next();
  });
  app.use("/api", studyRoomsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function getRooms(url: string) {
  const response = await fetch(`${url}/api/study-rooms`, {
    headers: { accept: "application/json" },
  });
  const body = await response.json();
  return { status: response.status, body };
}

beforeEach(async () => {
  state.missingColumns.clear();
  state.missingTables.clear();
  state.rows.clear();
  state.hardFail.clear();
  state.log.length = 0;
  const { __resetDriftCache } = await import("../lib/schemaDrift");
  __resetDriftCache();
});

describe("GET /api/study-rooms", () => {
  it("returns the enriched room list on the happy path", async () => {
    seedHappyPath();
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      const room = body[0];
      expect(room.id).toBe("room-1");
      expect(room.hostName).toBe("Aliasgar");
      expect(room.participantCount).toBe(1);
      expect(room.messageCount).toBe(3);
      expect(room.isPrivate).toBe(false);
      expect(room.participants[0]).toMatchObject({ userId: HOST, name: "Aliasgar", level: 7, isHost: true });
      // A public room's invite code is shareable by design.
      expect(room.inviteCode).toBe("ABC12345");
    } finally {
      await server.close();
    }
  });

  it("answers 200 when a column is missing from the deployed study_rooms table", async () => {
    // The production failure: the schema declares columns the live database
    // does not have yet, and `db.select()` asked for all of them.
    seedHappyPath();
    state.missingColumns.set("study_rooms", new Set(["description", "topic"]));
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status, `expected 200 after dropping the drifted columns, got ${status}: ${JSON.stringify(body)}`).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("room-1");
      expect(body[0].description).toBeUndefined();

      // The retry must actually have dropped the column, and must not re-probe
      // on every request: at most one failed attempt per missing column.
      const roomQueries = state.log.filter((entry) => entry.table === "study_rooms");
      const last = roomQueries[roomQueries.length - 1]!;
      expect(last.fields).not.toContain("description");
      expect(last.fields).not.toContain("topic");
      expect(last.fields).toContain("name");
    } finally {
      await server.close();
    }
  });

  it("answers 200 when study_room_members has drifted", async () => {
    seedHappyPath();
    state.missingColumns.set("study_room_members", new Set(["focus_minutes"]));
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status).toBe(200);
      expect(body[0].participants).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it("degrades to an empty participant list when the members relation is missing", async () => {
    seedHappyPath();
    state.missingTables.add("study_room_members");
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status, "a missing decoration table must not 500 the room list").toBe(200);
      expect(body[0].participants).toEqual([]);
      expect(body[0].participantCount).toBe(0);
      // The host name still resolves: users are read from the room rows.
      expect(body[0].hostName).toBe("Aliasgar");
    } finally {
      await server.close();
    }
  });

  it("degrades message counts and wallet levels instead of failing", async () => {
    seedHappyPath();
    state.missingTables.add("study_room_messages");
    state.missingTables.add("user_wallets");
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status).toBe(200);
      expect(body[0].messageCount).toBe(0);
      expect(body[0].participants[0].level).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("still answers 500 with the standard envelope when the room read itself fails", async () => {
    seedHappyPath();
    // A connection-level failure is not drift: masking it would hide an outage.
    state.hardFail.add("study_rooms");
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status).toBe(500);
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(body.error.message).toBe("Could not load study rooms");
      expect(body.error.requestId).toBeDefined();
    } finally {
      await server.close();
    }
  });

  it("returns an empty list, not an error, when there are no public rooms", async () => {
    state.rows.set("study_rooms", []);
    const server = await startServer();
    try {
      const { status, body } = await getRooms(server.url);
      expect(status).toBe(200);
      expect(body).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("learns the drift once instead of re-probing on every poll", async () => {
    // /forge-room polls this endpoint every few seconds. Re-discovering the
    // same missing column on each poll would mean one failed query forever.
    seedHappyPath();
    state.missingColumns.set("study_rooms", new Set(["topic"]));
    const server = await startServer();
    try {
      const first = await getRooms(server.url);
      expect(first.status).toBe(200);
      const probesAfterFirst = state.log.filter((entry) => entry.table === "study_rooms").length;

      state.log.length = 0;
      const second = await getRooms(server.url);
      expect(second.status).toBe(200);
      const queriesAfterSecond = state.log.filter((entry) => entry.table === "study_rooms");
      // One query, no failed retry: the drifted column is already known.
      expect(queriesAfterSecond).toHaveLength(1);
      expect(queriesAfterSecond[0]!.fields).not.toContain("topic");
      expect(probesAfterFirst).toBeGreaterThan(1);
    } finally {
      await server.close();
    }
  });
});
