import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateSecret,
  safeEqual,
  secretHint,
  secretsConfigured,
  SecretDecryptionError,
  SecretsNotConfiguredError,
} from "./secrets";

const KEY = "test-key-for-aes-gcm-round-trips";

describe("secret encryption", () => {
  it("round-trips a token", () => {
    const ciphertext = encryptSecret("ya29.a0AfH6-refresh-token", Buffer.from("k".repeat(32)));
    expect(decryptSecret(ciphertext, Buffer.from("k".repeat(32)))).toBe("ya29.a0AfH6-refresh-token");
  });

  it("does not store the plaintext anywhere in the ciphertext", () => {
    // The point of the module. A test that only checks the round-trip would
    // pass on a function that returned its input unchanged.
    const ciphertext = encryptSecret("super-secret-webhook-key", Buffer.from("k".repeat(32)));
    expect(ciphertext).not.toContain("super-secret-webhook-key");
    expect(Buffer.from(ciphertext, "utf8").toString("latin1")).not.toContain("super-secret");
  });

  it("produces a different ciphertext every time for the same input", () => {
    // A fresh IV per call. Identical ciphertexts would mean a reused IV, which
    // in GCM leaks the XOR of the two plaintexts and permits tag forgery.
    const key = Buffer.from("k".repeat(32));
    const a = encryptSecret("same-value", key);
    const b = encryptSecret("same-value", key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe(decryptSecret(b, key));
  });

  it("refuses a ciphertext that has been tampered with", () => {
    // GCM's authentication tag is what makes this detectable. Without it a
    // modified token would decrypt to garbage we would then send to Google.
    const key = Buffer.from("k".repeat(32));
    const ciphertext = encryptSecret("original", key);
    const parts = ciphertext.split(".");
    const body = Buffer.from(parts[3]!, "base64url");
    body[0] = body[0]! ^ 0xff;
    const tampered = [parts[0], parts[1], parts[2], body.toString("base64url")].join(".");
    expect(() => decryptSecret(tampered, key)).toThrow(SecretDecryptionError);
  });

  it("refuses a ciphertext encrypted under a different key", () => {
    const ciphertext = encryptSecret("value", Buffer.from("a".repeat(32)));
    expect(() => decryptSecret(ciphertext, Buffer.from("b".repeat(32)))).toThrow(SecretDecryptionError);
  });

  it("rejects malformed input instead of returning something", () => {
    const key = Buffer.from("k".repeat(32));
    // Every one of these would be a silent empty-string return in a laxer
    // implementation, and an empty signing key is worse than an outage.
    for (const bad of ["", "not-a-ciphertext", "v1.only.three", "v2.aaa.bbb.ccc", "v1.!!.!!.!!"]) {
      expect(() => decryptSecret(bad, key), bad).toThrow(SecretDecryptionError);
    }
  });

  it("throws a specific error when no key is configured", () => {
    const original = process.env.INTEGRATION_ENCRYPTION_KEY;
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    try {
      expect(secretsConfigured()).toBe(false);
      expect(() => encryptSecret("value")).toThrow(SecretsNotConfiguredError);
      expect(() => decryptSecret("v1.a.b.c")).toThrow(SecretsNotConfiguredError);
    } finally {
      if (original !== undefined) process.env.INTEGRATION_ENCRYPTION_KEY = original;
    }
  });

  it("derives a usable key from a passphrase of any length", () => {
    // Operators paste whatever they have: a uuid, a long hex string, a phrase.
    const original = process.env.INTEGRATION_ENCRYPTION_KEY;
    try {
      process.env.INTEGRATION_ENCRYPTION_KEY = "short";
      const a = encryptSecret("v");
      process.env.INTEGRATION_ENCRYPTION_KEY = "a-much-longer-passphrase-than-32-bytes-would-be";
      const b = encryptSecret("v");
      expect(a).not.toBe(b);
      process.env.INTEGRATION_ENCRYPTION_KEY = "short";
      expect(decryptSecret(a)).toBe("v");
    } finally {
      if (original === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
      else process.env.INTEGRATION_ENCRYPTION_KEY = original;
    }
  });

  it("generates a URL-safe secret with 256 bits of entropy", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(secret, "base64url")).toHaveLength(32);
    expect(generateSecret()).not.toBe(secret);
  });

  it("hints only the non-secret prefix", () => {
    const secret = "whsec_abcdefghijklmnop";
    expect(secretHint(secret)).toBe("whsec_ab");
    expect(secret.length).toBeGreaterThan(secretHint(secret).length);
  });

  describe("safeEqual", () => {
    it("compares equal and unequal values", () => {
      expect(safeEqual("abc", "abc")).toBe(true);
      expect(safeEqual("abc", "abd")).toBe(false);
    });

    it("returns false on a length mismatch rather than throwing", () => {
      // `timingSafeEqual` throws on differing lengths. A naive wrapper that
      // let it throw would turn a bad signature into a 500.
      expect(safeEqual("abc", "abcdef")).toBe(false);
      expect(safeEqual("", "a")).toBe(false);
    });
  });
});

describe("key configuration is read per call", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts through the environment key", () => {
    expect(secretsConfigured()).toBe(true);
    const ciphertext = encryptSecret("from-env");
    expect(decryptSecret(ciphertext)).toBe("from-env");
  });
});
