import { logger } from "./logger";

export type AuditAction =
  | "admin_login_success"
  | "admin_login_failed"
  | "admin_logout"
  | "admin_user_role_change"
  | "admin_bot_seed"
  | "admin_bot_delete"
  | "admin_economy_adjust"
  | "admin_content_moderation"
  | "admin_settings_change"
  | "admin_drop_trigger";

interface AuditEntry {
  action: AuditAction;
  userId?: string;
  ip?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export function auditLog(entry: Omit<AuditEntry, "timestamp">): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date(),
  };

  logger.info(
    {
      audit: true,
      action: fullEntry.action,
      userId: fullEntry.userId,
      ip: fullEntry.ip,
      details: fullEntry.details,
      timestamp: fullEntry.timestamp.toISOString(),
    },
    `[AUDIT] ${fullEntry.action}`,
  );

  // In future, persist to database table admin_audit_logs
  // For now, structured logging ensures audit trail in log aggregator
}

export function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}
