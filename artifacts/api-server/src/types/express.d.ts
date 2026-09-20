declare namespace Express {
  interface Request {
    /** Set by requireAuth / requireAdmin after token verification. */
    userId?: string;
    /** Set by the request-id middleware in app.ts. */
    id?: string;
    /** Set by the premium gate (lib/premiumCheck.ts). */
    isPremium?: boolean;
  }
}
