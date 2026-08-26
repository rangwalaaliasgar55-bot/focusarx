# FocusArx — full batch (bots + tokens + landing + LLM + bios + 3D)

## 1. LLM-backed bot replies
- `botEngine.ts` → `materializeDueBotReplies` now calls `generateAi` (Gemini→Groq via existing `aiProvider`) to rewrite template replies into natural student speech.
- System prompt forbids admitting AI / bot identity.
- Falls back to template if keys/budget fail or output fails safety checks.
- Budgeted under purpose `bot_reply`.

## 2. DB migration — rewrite existing bot bios
- `scripts/rewrite-bot-bios.sql` — idempotent UPDATE for `role='bot'` rows still carrying "AI rival" / robot emoji.
- Maps vibe → human bio lines matching seed logic.
- Run: `psql "$DATABASE_URL" -f scripts/rewrite-bot-bios.sql`

## 3. Landing redesign (conversion + mobile)
- Feature blurbs tightened; final CTA sharpened.
- Mobile: sticky CTA, safe-area, tighter type/padding, no inflated user counts.

## 4. UI token cleanup foundation
- `index.css` — semantic TOKEN ALIASES block.
- `scripts/token-codemod.md` — map for remaining hex/rgba.

## 5. Performance / 3D
- Hero3D + FocusCity3D: dpr capped, frameloop demand.

## 6. Community honesty
- Public AI-rival labels removed; templates humanized; pulse API neutral.
