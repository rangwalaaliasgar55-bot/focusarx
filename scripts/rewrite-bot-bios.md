# Rewrite bot bios (remove AI watermark)

Run against production Neon after deploy of humanized botEngine:

```bash
psql "$DATABASE_URL" -f scripts/rewrite-bot-bios.sql
```

Or from admin SQL console (if enabled in non-prod): paste the SQL body.

Idempotent. Only updates `role='bot'` rows whose bio still matches AI watermark patterns.
