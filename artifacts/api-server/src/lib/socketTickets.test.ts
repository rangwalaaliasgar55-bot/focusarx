import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { issueSocketTicket, verifySocketTicket, SOCKET_TICKET_TTL_SEC } from "./socketTickets";

const SECRET = "unit-test-secret-0123456789abcdef0123456789abcdef";

describe("socket tickets", () => {
  it("issues a ticket that verifies to the same subject", () => {
    const { ticket, expiresInSeconds } = issueSocketTicket("user-1", SECRET);
    expect(expiresInSeconds).toBe(SOCKET_TICKET_TTL_SEC);
    const payload = verifySocketTicket(ticket, SECRET);
    expect(payload).toEqual({ sub: "user-1" });
  });

  it("rejects tickets signed with a different secret", () => {
    const { ticket } = issueSocketTicket("user-1", SECRET);
    expect(verifySocketTicket(ticket, "another-secret-0123456789abcdef012345678")).toBeNull();
  });

  it("rejects access tokens presented as socket tickets (audience pinning)", () => {
    // An HS256 access token shaped like the auth.ts ones.
    const accessToken = jwt.sign(
      { sub: "user-1", type: "access" },
      SECRET,
      { algorithm: "HS256", issuer: "focusarx-api", audience: "focusarx-web", expiresIn: "15m" },
    );
    expect(verifySocketTicket(accessToken, SECRET)).toBeNull();
  });

  it("rejects expired tickets", () => {
    const expired = jwt.sign(
      { sub: "user-1", type: "socket_ticket" },
      SECRET,
      { algorithm: "HS256", issuer: "focusarx-api", audience: "focusarx-socket", expiresIn: "-10s" },
    );
    expect(verifySocketTicket(expired, SECRET)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifySocketTicket("not-a-jwt", SECRET)).toBeNull();
    expect(verifySocketTicket("", SECRET)).toBeNull();
  });
});
