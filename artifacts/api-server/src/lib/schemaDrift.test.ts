import { beforeEach, describe, expect, it } from "vitest";
import { studyRoomMembersTable, studyRoomsTable } from "@workspace/db";
import {
  __resetDriftCache,
  describeDrift,
  isDependencyFailure,
  queryOrFallback,
  selectableColumns,
  selectResilient,
} from "./schemaDrift";

/**
 * Unit tests for the drift-tolerant read helpers behind the study-rooms fix.
 *
 * The point of these is the *classification*: a Postgres error has to be read
 * correctly before it can be recovered from, and getting it wrong fails in one
 * of two bad directions — retrying forever on an error that cannot be fixed by
 * retrying, or giving up on an error that one dropped column would fix.
 */

const pgError = (code: string, message: string, extra: object = {}) =>
  Object.assign(new Error(message), { code, ...extra });

beforeEach(() => {
  __resetDriftCache();
});

describe("describeDrift", () => {
  it("names the missing column from the SQLSTATE", () => {
    expect(describeDrift(pgError("42703", 'column "description" does not exist', { column: "description" })))
      .toEqual({ kind: "column", name: "description", sqlstate: "42703" });
  });

  it("names the missing column from the message alone", () => {
    // Some drivers/proxies surface the text without the structured fields.
    expect(describeDrift(new Error('column "focus_minutes" does not exist')))
      .toMatchObject({ kind: "column", name: "focus_minutes" });
  });

  it("identifies a missing relation", () => {
    expect(describeDrift(pgError("42P01", 'relation "study_room_messages" does not exist')))
      .toMatchObject({ kind: "table", name: "study_room_messages" });
  });

  it("does not mistake an ordinary failure for drift", () => {
    expect(describeDrift(new Error("duplicate key value violates unique constraint")))
      .toEqual({ kind: "unknown", name: null, sqlstate: null });
    expect(describeDrift(null)).toMatchObject({ kind: "unknown" });
    expect(describeDrift(undefined)).toMatchObject({ kind: "unknown" });
  });
});

describe("isDependencyFailure", () => {
  it("is true for drift and for connectivity problems", () => {
    expect(isDependencyFailure(pgError("42703", 'column "x" does not exist'))).toBe(true);
    expect(isDependencyFailure(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(true);
    expect(isDependencyFailure(new Error("terminating connection due to administrator command"))).toBe(true);
  });

  it("is false for application errors", () => {
    expect(isDependencyFailure(new Error("Room name is too short"))).toBe(false);
  });
});

describe("selectResilient", () => {
  it("selects every column when the database matches the schema", async () => {
    const seen: string[][] = [];
    const result = await selectResilient<Array<{ id: string }>>(studyRoomsTable, (fields) => {
      seen.push(Object.keys(fields));
      return Promise.resolve([{ id: "room-1" }]);
    });
    expect(result).toEqual([{ id: "room-1" }]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("description");
    expect(seen[0]).toContain("lastActivityAt");
  });

  it("drops a missing column, retries once and remembers it", async () => {
    const seen: string[][] = [];
    let attempt = 0;
    const result = await selectResilient<Array<{ id: string }>>(studyRoomsTable, (fields) => {
      seen.push(Object.keys(fields));
      attempt += 1;
      if (attempt === 1 && "description" in fields) {
        return Promise.reject(pgError("42703", 'column "description" does not exist', { column: "description" }));
      }
      return Promise.resolve([{ id: "room-1" }]);
    });

    expect(result).toEqual([{ id: "room-1" }]);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain("description");
    expect(seen[1]).not.toContain("description");
    // Everything else survives: the retry must not throw away the payload.
    expect(seen[1]).toContain("name");
    expect(seen[1]).toContain("hostId");

    // Second call: no re-probe, the drifted column is already known.
    seen.length = 0;
    await selectResilient(studyRoomsTable, (fields) => {
      seen.push(Object.keys(fields));
      return Promise.resolve([]);
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain("description");
  });

  it("rethrows when the failure is not a missing column", async () => {
    await expect(
      selectResilient(studyRoomsTable, () => Promise.reject(new Error("connection terminated"))),
    ).rejects.toThrow("connection terminated");
  });

  it("rethrows instead of dropping every column when the retry cannot help", async () => {
    // Dropping the column and still failing means the error is not really about
    // that column — keep failing loudly rather than selecting nothing.
    let attempts = 0;
    await expect(
      selectResilient(studyRoomsTable, () => {
        attempts += 1;
        return Promise.reject(pgError("42703", 'column "name" does not exist', { column: "name" }));
      }),
    ).rejects.toThrow(/does not exist/);
    expect(attempts).toBe(2);
  });

  it("keeps drift knowledge per table", async () => {
    await selectResilient(studyRoomsTable, (fields) => {
      if ("topic" in fields) {
        return Promise.reject(pgError("42703", 'column "topic" does not exist', { column: "topic" }));
      }
      return Promise.resolve([]);
    });
    // A different table is unaffected by study_rooms' drift.
    const memberFields = selectableColumns(studyRoomMembersTable);
    expect(Object.keys(memberFields)).toContain("focusMinutes");
    expect(Object.keys(selectableColumns(studyRoomsTable))).not.toContain("topic");
  });
});

describe("queryOrFallback", () => {
  it("returns the value when the query succeeds", async () => {
    await expect(queryOrFallback("counts", Promise.resolve([1, 2]), [])).resolves.toEqual([1, 2]);
  });

  it("returns the fallback when the query fails, whatever the reason", async () => {
    await expect(queryOrFallback("counts", Promise.reject(pgError("42P01", 'relation "x" does not exist')), [])).resolves.toEqual([]);
    await expect(queryOrFallback("counts", Promise.reject(new Error("timeout")), { count: 0 })).resolves.toEqual({ count: 0 });
  });
});
