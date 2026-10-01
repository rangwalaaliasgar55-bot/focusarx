import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, rehashPassword, isCurrentHash } from "./passwordHashing";

// bcryptjs is already a workspace dependency; used here to mint realistic
// legacy rows so the compatibility path is exercised against the real thing.
import bcrypt from "bcryptjs";

describe("argon2id password hashing", () => {
  it("round-trips a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const result = await verifyPassword("correct horse battery staple", hash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
    expect(result.algorithm).toBe("argon2id");
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    const result = await verifyPassword("incorrect horse", hash);
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it("produces the OWASP-baseline encoded parameters", async () => {
    // The parameters are a public commitment, not a private choice: the test
    // fails loudly if someone "tunes" them without noticing.
    const hash = await hashPassword("anything");
    expect(hash).toContain("$argon2id$");
    expect(hash).toContain("m=19456");
    expect(hash).toContain("t=2");
    expect(hash).toContain("p=1");
  });

  it("salts: two hashes of the same password differ", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password", a)).toEqual(expect.objectContaining({ valid: true }));
    expect(await verifyPassword("same password", b)).toEqual(expect.objectContaining({ valid: true }));
  });

  it("never throws on a malformed stored hash", async () => {
    for (const stored of ["", "not a hash", "$argon2id$garbage", "$2a$12$short", "x".repeat(5000)]) {
      const result = await verifyPassword("pw", stored);
      expect(result.valid).toBe(false);
      expect(result.needsRehash).toBe(false);
    }
  });
});

describe("bcrypt compatibility (legacy rows)", () => {
  it("verifies a legacy bcrypt hash and flags it for rehash", async () => {
    const legacy = await bcrypt.hash("legacy-password", 10);
    const result = await verifyPassword("legacy-password", legacy);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(true);
    expect(result.algorithm).toBe("bcrypt");
  });

  it("rejects a wrong password against a legacy hash without flagging rehash", async () => {
    const legacy = await bcrypt.hash("legacy-password", 10);
    const result = await verifyPassword("not-the-password", legacy);
    expect(result.valid).toBe(false);
    // No verification, no upgrade — rehashing would silently change the
    // password of an account whose owner is not present.
    expect(result.needsRehash).toBe(false);
  });
});

describe("rehash", () => {
  it("upgrades a verified legacy password to argon2id", async () => {
    const legacy = await bcrypt.hash("upgrade-me", 10);
    const upgraded = await rehashPassword("upgrade-me");
    expect(isCurrentHash(upgraded)).toBe(true);
    expect(isCurrentHash(legacy)).toBe(false);
    expect((await verifyPassword("upgrade-me", upgraded)).valid).toBe(true);
  });
});
