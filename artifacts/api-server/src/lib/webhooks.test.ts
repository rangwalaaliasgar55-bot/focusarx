import { describe, it, expect } from "vitest";
import {
  bodyFor,
  endpointWants,
  isPrivateIpv4,
  isPrivateIpv6,
  isRetryableStatus,
  isWebhookEvent,
  parseIpv4,
  parseSignatureHeader,
  retryDelayMs,
  RETRY_SCHEDULE_MS,
  signPayload,
  validateWebhookUrl,
  verifySignature,
  WEBHOOK_EVENTS,
} from "./webhooks";

describe("signature", () => {
  const secret = "whsec_test_1234567890";
  const body = JSON.stringify({ event: "session.completed", data: { minutes: 25 } });

  it("signs and verifies the exact body it was given", () => {
    const header = signPayload(secret, 1_700_000_000, body);
    expect(verifySignature(body, header, secret, 1_700_000_000)).toBe(true);
  });

  it("covers the timestamp, so a captured request cannot be replayed", () => {
    // Signing the body alone means this exact request works forever. The
    // timestamp is inside the MAC, so re-stamping it invalidates it.
    const header = signPayload(secret, 1_700_000_000, body);
    const restamped = header.replace("t=1700000000", "t=1900000000");
    expect(verifySignature(body, restamped, secret, 1_900_000_000)).toBe(false);
  });

  it("rejects a delivery older than the tolerance window", () => {
    const header = signPayload(secret, 1_700_000_000, body);
    // Five minutes later is fine; an hour is not.
    expect(verifySignature(body, header, secret, 1_700_000_290)).toBe(true);
    expect(verifySignature(body, header, secret, 1_700_003_600)).toBe(false);
  });

  it("rejects a body modified after signing", () => {
    const header = signPayload(secret, 1_700_000_000, body);
    const tampered = body.replace("25", "9999");
    expect(verifySignature(tampered, header, secret, 1_700_000_000)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const header = signPayload("some-other-secret", 1_700_000_000, body);
    expect(verifySignature(body, header, secret, 1_700_000_000)).toBe(false);
  });

  it("accepts any one of several v1 signatures", () => {
    // Rotation: the receiver may still hold the previous secret, so both are
    // sent during the overlap.
    const good = signPayload(secret, 1_700_000_000, body).split("v1=")[1]!;
    const header = `t=1700000000,v1=${"0".repeat(64)},v1=${good}`;
    expect(verifySignature(body, header, secret, 1_700_000_000)).toBe(true);
  });

  it("returns false rather than throwing on hostile headers", () => {
    for (const bad of [null, undefined, 42, "", "v1=", "t=abc,v1=xy", "t=1"]) {
      expect(verifySignature(body, bad, secret, 1_700_000_000), String(bad)).toBe(false);
    }
  });

  it("returns false when no secret is configured", () => {
    // An empty secret would otherwise sign with an empty key, which every
    // attacker also knows.
    expect(verifySignature(body, signPayload("", 1_700_000_000, body), "", 1_700_000_000)).toBe(false);
  });

  it("parses a header it built itself", () => {
    const parsed = parseSignatureHeader(signPayload(secret, 1_700_000_000, body));
    expect(parsed).not.toBeNull();
    expect(parsed!.timestamp).toBe(1_700_000_000);
    expect(parsed!.signatures).toHaveLength(1);
    expect(parsed!.signatures[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("event subscriptions", () => {
  it("treats an empty subscription as everything", () => {
    expect(endpointWants([], "session.completed")).toBe(true);
    expect(endpointWants(null, "session.completed")).toBe(true);
    expect(endpointWants(undefined, "level.up")).toBe(true);
  });

  it("treats a non-empty subscription as an allowlist", () => {
    expect(endpointWants(["session.completed"], "session.completed")).toBe(true);
    expect(endpointWants(["session.completed"], "level.up")).toBe(false);
  });

  it("ignores an event name it does not recognise", () => {
    expect(isWebhookEvent("session.completed")).toBe(true);
    expect(isWebhookEvent("session.compleeted")).toBe(false);
    expect(isWebhookEvent("")).toBe(false);
    expect(isWebhookEvent(null)).toBe(false);
  });

  it("keeps the catalog free of duplicates", () => {
    expect(new Set(WEBHOOK_EVENTS).size).toBe(WEBHOOK_EVENTS.length);
  });
});

describe("URL validation", () => {
  it("accepts a normal https receiver", () => {
    expect(validateWebhookUrl("https://example.com/hooks/focusarx").ok).toBe(true);
  });

  it("rejects the cloud metadata endpoint", () => {
    // The single most valuable SSRF target: it returns instance credentials to
    // whoever asks. A webhook URL is a "fetch this for me" feature.
    for (const url of [
      "https://169.254.169.254/latest/meta-data/",
      "http://169.254.169.254/",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://metadata/",
    ]) {
      expect(validateWebhookUrl(url).ok, url).toBe(false);
    }
  });

  it("rejects private and loopback ranges in every spelling", () => {
    // `new URL` normalises some of these and not others, which is why the
    // parser handles octal, hex, and short forms itself.
    for (const url of [
      "https://127.0.0.1/hook",
      "https://127.1/hook",
      "https://2130706433/hook",
      "https://0x7f.0.0.1/hook",
      "https://10.0.0.5/hook",
      "https://192.168.1.1/hook",
      "https://172.16.0.1/hook",
      "https://100.64.0.1/hook",
      "https://[::1]/hook",
      "https://[fd00::1]/hook",
      "https://[fe80::1]/hook",
      "https://[::ffff:127.0.0.1]/hook",
    ]) {
      // Explicitly the production posture. Loopback is the one host whose
      // treatment depends on the environment, so a test that relied on the
      // ambient NODE_ENV would pass in CI and fail in a deployed build.
      expect(validateWebhookUrl(url, { allowLoopback: false }).ok, url).toBe(false);
    }
  });

  it("allows a public IP and the ranges just outside the private blocks", () => {
    for (const url of ["https://8.8.8.8/hook", "https://172.32.0.1/hook", "https://172.15.0.1/hook"]) {
      expect(validateWebhookUrl(url).ok, url).toBe(true);
    }
  });

  it("requires https in general, but permits loopback in development", () => {
    expect(validateWebhookUrl("http://example.com/hook").ok).toBe(false);
    const dev = { allowLoopback: true };
    expect(validateWebhookUrl("http://localhost:3000/hook", dev).ok).toBe(true);
    expect(validateWebhookUrl("http://127.0.0.1:3000/hook", dev).ok).toBe(true);
  });

  it("withdraws the loopback exception in production", () => {
    // A fetch to our own loopback reaches whatever admin or health port shares
    // the network namespace. Same bug class as the metadata endpoint, smaller
    // radius, and there is no legitimate production receiver there.
    const prod = { allowLoopback: false };
    expect(validateWebhookUrl("http://localhost:3000/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://127.0.0.1/hook", prod).ok).toBe(false);
    expect(validateWebhookUrl("https://[::1]/hook", prod).ok).toBe(false);
  });

  it("rejects embedded credentials and non-http schemes", () => {
    // `https://user:pass@evil.com` puts a secret in our logs, and `file://`
    // and `gopher://` are classic SSRF escalations.
    expect(validateWebhookUrl("https://user:pass@example.com/hook").ok).toBe(false);
    for (const url of ["file:///etc/passwd", "gopher://example.com/", "ftp://example.com/", "javascript:alert(1)"]) {
      expect(validateWebhookUrl(url).ok, url).toBe(false);
    }
  });

  it("rejects empty, non-string, and unparseable input", () => {
    for (const bad of ["", "   ", null, undefined, 42, {}, "not a url", "https://"]) {
      expect(validateWebhookUrl(bad).ok, String(bad)).toBe(false);
    }
  });
});

describe("IPv4 parsing", () => {
  it("parses the forms a URL parser leaves alone", () => {
    expect(parseIpv4("127.1")).toEqual([127, 0, 0, 1]);
    expect(parseIpv4("127.0.0.1")).toEqual([127, 0, 0, 1]);
    expect(parseIpv4("0x7f.0.0.1")).toEqual([127, 0, 0, 1]);
    expect(parseIpv4("0177.0.0.1")).toEqual([127, 0, 0, 1]);
  });

  it("returns null for a hostname, so DNS decides", () => {
    expect(parseIpv4("example.com")).toBeNull();
    expect(parseIpv4("")).toBeNull();
    expect(parseIpv4("1.2.3.4.5")).toBeNull();
    expect(parseIpv4("256.1.1.1")).toBeNull();
  });

  it("classifies the reserved ranges", () => {
    expect(isPrivateIpv4([169, 254, 169, 254])).toBe(true);
    expect(isPrivateIpv4([224, 0, 0, 1])).toBe(true);
    expect(isPrivateIpv4([8, 8, 8, 8])).toBe(false);
    expect(isPrivateIpv4([1, 1, 1, 1])).toBe(false);
  });

  it("classifies IPv6 loopback, unique-local, and link-local", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("fd12::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("2606:4700::1111")).toBe(false);
    expect(isPrivateIpv6("example.com")).toBe(false);
  });
});

describe("retry policy", () => {
  it("backs off on schedule, then holds at the last interval", () => {
    const noJitter = () => 0.5; // jitter multiplier becomes exactly 1
    expect(retryDelayMs(0, noJitter)).toBe(RETRY_SCHEDULE_MS[0]);
    expect(retryDelayMs(1, noJitter)).toBe(RETRY_SCHEDULE_MS[1]);
    const last = retryDelayMs(RETRY_SCHEDULE_MS.length - 1, noJitter);
    expect(retryDelayMs(99, noJitter)).toBe(last);
  });

  it("jitters so a shared outage does not synchronise every retry", () => {
    const low = retryDelayMs(0, () => 0);
    const high = retryDelayMs(0, () => 1);
    expect(low).toBeLessThan(high);
    // Bounded: a broken random must not produce a day-long delay or a negative.
    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThan(RETRY_SCHEDULE_MS[0] * 1.3);
  });

  it("never returns a negative or NaN delay for a corrupted attempt count", () => {
    for (const attempts of [-5, NaN, Infinity, 1e9]) {
      const delay = retryDelayMs(attempts);
      expect(Number.isFinite(delay), String(attempts)).toBe(true);
      expect(delay).toBeGreaterThan(0);
    }
  });

  it("retries what might recover and not what cannot", () => {
    // A 400 retried six times over a day is noise at the receiver; the same
    // treatment for a 503 is correct.
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(status), String(status)).toBe(true);
    }
    for (const status of [400, 401, 403, 404, 410, 422]) {
      expect(isRetryableStatus(status), String(status)).toBe(false);
    }
  });
});

describe("bodyFor", () => {
  it("returns the stored body byte-for-byte", () => {
    // The bytes signed must be the bytes sent, or a receiver's stored
    // signature check fails on a redelivery that should have succeeded.
    const body = '{"event":"session.completed","data":{"minutes":25}}';
    expect(bodyFor({ payload: { _body: body, _delivery: "abc" }, deliveryId: "abc" })).toBe(body);
  });

  it("rebuilds a valid body from a row written before this shape existed", () => {
    const body = bodyFor({ payload: { minutes: 25 }, deliveryId: "abc" });
    expect(() => JSON.parse(body)).not.toThrow();
    expect(JSON.parse(body).id).toBe("abc");
  });
});
