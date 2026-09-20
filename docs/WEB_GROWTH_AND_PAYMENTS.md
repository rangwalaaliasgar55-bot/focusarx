# Web growth and payment operations

## What is now in the product

The public acquisition path is `/focus?duration=<1-240>&task=<text>&src=<channel>`. `/go/ig` redirects to an armed 25-minute guest timer. Running and paused guest sessions persist by wall-clock deadline, so reload, back-swipe, tab suspension, and phone sleep do not restart the slice. Acquisition parameters are retained for 90 days and attached to page views, CTA events, signup/login events, session starts, and checkout events.

Canonical production host is `https://www.focusarx.site`; `vercel.json` permanently redirects the apex host. The web build targets Chrome 80 and Safari 13-era syntax, and the PWA supports both portrait and landscape.

Ads are opt-in with `VITE_ENABLE_ADS=true`, loaded only when a content-page ad placement mounts. Landing, authenticated study rooms, leaderboards, timers, and the application shell do not render ad units.

## Product terminology

The earned Premium currency is displayed as **Focus Credits**. Database/API identifiers remain `token*` for migration compatibility. Coins remain the cosmetic marketplace currency. Do not rename database columns solely for display terminology.

## Pricing

- Free: timer, planning, streaks, core analytics, study rooms, and guides.
- India Pro: ₹199 monthly or ₹1,499 yearly.
- International Pro: $4.99 monthly or $39 yearly.
- Earned Pro: 10,000 / 25,000 / 80,000 Focus Credits for 30 / 90 / 365 days.

Payment and earned routes create the same entitlement. Provider availability is environment-gated: no checkout control is shown if its provider is not fully configured.

## Stripe launch checklist

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, and `STRIPE_PRICE_PRO_YEARLY`. Configure the webhook URL as `/api/stripe/webhook`. Price IDs—not client copy—are authoritative for amounts charged. Complete tax, refund, support, and subscription-cancellation operations before enabling live keys.

## Razorpay launch checklist

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Optional amount overrides are `RAZORPAY_AMOUNT_PRO_MONTHLY_PAISE` and `RAZORPAY_AMOUNT_PRO_YEARLY_PAISE`; defaults are 19,900 and 149,900 paise.

The server creates an order and persists a user-bound checkout intent before opening checkout. Confirmation requires Razorpay HMAC verification, matching user/order/amount/currency, and a captured provider payment. Entitlement creation, subscription update, intent completion, and idempotency are transactional. FocusArx never receives or stores card/UPI credentials.

Before switching to live keys, verify monthly and annual success, cancellation, manual-capture mode, duplicate callbacks, a mismatched account, and provider downtime in Razorpay test mode.

## Search operations that cannot be automated in code

After deployment:

1. Confirm apex redirects to www and canonical, OG, JSON-LD, robots, and sitemap URLs all use www.
2. Resubmit the sitemap index and child sitemaps in Google Search Console.
3. Request indexing for the priority URLs listed in `docs/GSC_INDEXING.md`.
4. Confirm old profile sitemap shards remain absent and sampled `/u/*` pages remain noindex.
5. Monitor indexed/not-indexed counts and the cached homepage snippet weekly.

Search Console requests, payment-account approval, live keys, social account creation, directory submissions, and direct institute outreach require an account owner and cannot be completed by repository code.
