import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable, activeSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const JWT_SECRET = process.env.AUTH_SECRET ?? "focusarx-dev-secret-changeme-in-production";

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "400d" });
}

function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}

export function extractUserId(req: { headers: { authorization?: string } }): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  return payload?.sub ?? null;
}

router.get("/auth/session", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isGuest: usersTable.isGuest }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json({ user });
  } catch (err) {
    logger.error({ err }, "session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user?.hashedPassword) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json({ token: makeToken(user.id), user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } });
  } catch (err) {
    logger.error({ err }, "login error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/register", async (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  try {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) { res.status(400).json({ error: "Email already registered" }); return; }
    const hashedPassword = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ email, name: name || null, hashedPassword, isGuest: false }).returning();
    if (!user) { res.status(500).json({ error: "Failed to create user" }); return; }
    res.status(201).json({ message: "Account created", user: { id: user.id, email: user.email } });
  } catch (err) {
    logger.error({ err }, "register error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/guest", async (req, res) => {
  const { guestKey } = req.body as { guestKey?: string };
  if (!guestKey || guestKey.length < 8) { res.status(400).json({ error: "Invalid guest key" }); return; }
  const safeKey = guestKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
  const guestEmail = `guest_${safeKey}@guest.focusarx.internal`;
  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.guestKey, safeKey));
    if (!user) {
      const [created] = await db.insert(usersTable).values({ email: guestEmail, guestKey: safeKey, isGuest: true, name: "Guest" }).returning();
      user = created;
    }
    if (!user) { res.status(500).json({ error: "Failed to create guest" }); return; }
    res.json({ token: makeToken(user.id), user: { id: user.id, email: user.email, name: user.name, isGuest: true } });
  } catch (err) {
    logger.error({ err }, "guest error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as authRouter };
