import { describe, it, expect } from "vitest";
import {
  createTotpFactor,
  verifyTotpCode,
  generateBackupCodes,
  matchBackupCode,
  hashBackupCode,
  encryptTotpSecret,
  decryptTotpSecret,
  TwoFactorNotConfiguredError,
} from "./twoFactor";
import { TOTP, Secret } from "otpauth";

/** Mint a code the way a real authenticator would, for the given base32 secret. */
function codeFrom(secretBase32: string, offsetPeriod = 0): string {
  const totp = new TOTP({
    issuer: "FocusArx",
    label: "user@example.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  // otpauth validates at `now`; shift by whole periods to simulate drift.
  const delta = offsetPeriod * 30 * 1000;
  const realNow = Date.now;
  Date.now = () => realNow() + delta;
  try {
    return totp.generate();
  } finally {
    Date.now = realNow;
  }
}

describe("TOTP factor creation", () => {
  it("creates a base32 secret and a provisioning URI naming issuer and account", () => {
    const { secret, otpauthUri } = createTotpFactor("user@example.com");
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(otpauthUri.startsWith("otpauth://totp/")).toBe(true);
    expect(otpauthUri).toContain("FocusArx");
    expect(otpauthUri).toContain("user%40example.com");
  });

  it("creates a different secret every time", () => {
    const a = createTotpFactor("user@example.com");
    const b = createTotpFactor("user@example.com");
    expect(a.secret).not.toBe(b.secret);
  });
});

describe("TOTP verification", () => {
  it("accepts the code the authenticator shows", () => {
    const { secret } = createTotpFactor("user@example.com");
    expect(verifyTotpCode(secret, "user@example.com", codeFrom(secret))).toBe(true);
  });

  it("accepts one period of clock drift in either direction", () => {
    const { secret } = createTotpFactor("user@example.com");
    expect(verifyTotpCode(secret, "user@example.com", codeFrom(secret, -1))).toBe(true);
    expect(verifyTotpCode(secret, "user@example.com", codeFrom(secret, 1))).toBe(true);
  });

  it("rejects a code from two periods away", () => {
    const { secret } = createTotpFactor("user@example.com");
    expect(verifyTotpCode(secret, "user@example.com", codeFrom(secret, 2))).toBe(false);
  });

  it("rejects garbage without throwing", () => {
    const { secret } = createTotpFactor("user@example.com");
    for (const bad of ["", "12345", "1234567", "abcdef", "1 2 3 4 5 6 x", "0000000000"]) {
      expect(verifyTotpCode(secret, "user@example.com", bad)).toBe(false);
    }
  });

  it("rejects a code generated from a different secret", () => {
    const a = createTotpFactor("user@example.com");
    const b = createTotpFactor("user@example.com");
    expect(verifyTotpCode(a.secret, "user@example.com", codeFrom(b.secret))).toBe(false);
  });
});

describe("backup codes", () => {
  it("generates eight codes that all verify against their digests", () => {
    const { plaintext, hashed } = generateBackupCodes();
    expect(plaintext).toHaveLength(8);
    expect(hashed).toHaveLength(8);
    for (const code of plaintext) {
      expect(matchBackupCode(code, hashed)).toBeGreaterThanOrEqual(0);
    }
  });

  it("is normalized: dash and case differences hash identically", () => {
    const code = "12345-67890";
    expect(hashBackupCode(code)).toBe(hashBackupCode("1234567890"));
    expect(hashBackupCode(" 12 345-67890 ")).toBe(hashBackupCode(code));
  });

  it("consumes exactly the matched entry", () => {
    const { hashed } = generateBackupCodes();
    const idx = matchBackupCode("99999-99999", hashed);
    // A random code is not in the list.
    expect(idx).toBe(-1);
    const real = generateBackupCodes();
    const i = matchBackupCode(real.plaintext[3], real.hashed);
    expect(i).toBe(3);
    const remaining = real.hashed.slice();
    remaining.splice(i, 1);
    expect(remaining).toHaveLength(7);
    // The consumed code no longer matches the remaining list.
    expect(matchBackupCode(real.plaintext[3], remaining)).toBe(-1);
  });

  it("does not carry the plaintext through the digest", () => {
    const { plaintext, hashed } = generateBackupCodes();
    for (const code of plaintext) {
      for (const digest of hashed) {
        expect(digest).not.toContain(code.replace("-", ""));
      }
    }
  });
});

describe("secret encryption at rest", () => {
  it("round-trips through the AES-256-GCM layer without the key present at write time", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "test-key-for-two-factor-0123456789";
    try {
      const { secret } = createTotpFactor("user@example.com");
      const stored = encryptTotpSecret(secret);
      expect(stored).not.toContain(secret);
      expect(decryptTotpSecret(stored)).toBe(secret);
    } finally {
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
    }
  });

  it("refuses to store a secret when no key is configured", () => {
    const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    try {
      expect(() => encryptTotpSecret("SOMESECRET")).toThrow(TwoFactorNotConfiguredError);
    } finally {
      if (previous !== undefined) process.env.INTEGRATION_ENCRYPTION_KEY = previous;
    }
  });
});
