import { Request, Response, NextFunction } from "express";
import { extractUserId } from "../routes/auth";
import { sendUnauthorized } from "../lib/httpErrors";

export interface AuthRequest extends Request {
  userId: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = extractUserId(req);
  if (!userId) {
    sendUnauthorized(res);
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
