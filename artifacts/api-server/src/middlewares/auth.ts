import { Request, Response, NextFunction } from "express";
import { extractUserId } from "../routes/auth";

export interface AuthRequest extends Request {
  userId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthRequest).userId = userId;
  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = extractUserId(req);
  if (userId) {
    (req as AuthRequest).userId = userId;
  }
  next();
}
