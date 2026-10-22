# দোকান বন্ধু · Dokan Bondhu

**বাংলা-প্রথম, অফলাইন-প্রথম, AI-সহায়ক মাল্টি-বিজনেস SaaS** — ছোট দোকানদারের বিক্রি, বাকি, স্টক আর দৈনিক লাভ, এক জায়গায়।

> Working name. The final product name is a pending founder decision (see `docs/DECISIONS.md`).

---

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Setup: Vite + React + TS + Tailwind, tokens, themes, i18n, app shell, health check, CI | ✅ done |
| 2 | Database: 19 tables, constraints, append-only guards, RLS on every table, write RPCs, 109 SQL assertions | ✅ done |
| 3 | Auth & onboarding: phone + PIN, lockout, recovery code, four-step onboarding, six business packs | ✅ done |
| 4 | Products & categories: paged search RPC, cost hidden from staff, add/edit/delete with undo, category sheet | ✅ done |
| 5–12 | POS → due ledger → stock/reports → packs → offline sync → staff/audit → AI → Android/launch | next: 5 |

The folder scaffold for every upcoming phase already exists, so later work adds files rather than restructuring.

---

## Quick start (Windows: PowerShell / CMD / Git Bash)

```bash
# 1) install
npm install

# 2) create your env file
#    PowerShell:  Copy-Item .env.example .env
#    CMD:         copy .env.example .env
#    Git Bash:    cp .env.example .env
#    then paste your Supabase URL + anon key into .env

# 3) run
npm run dev
# open http://localhost:5173
```

Supabase is optional in Phase 1: without `.env` values the app still runs and `/health` tells you exactly what to add.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (0.0.0.0:5173) |
| `npm run build` | Type-check + production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run format` | Prettier write |
| `npm run db:test` | Apply migrations to a scratch PostgreSQL and run the 7 SQL suites |
| `npm run db:types` | Regenerate `database.types.ts` from the live schema |

---

## What is inside

```
src/
  app/        routing, AppShell, providers, pages
  components/ ui/ primitives + common/ MoneyText, BigActionButton, StatCard, EmptyState, SyncStatusPill
  features/   auth, onboarding, products, pos, stock, customers, ledger, reports, staff, settings, ai
  packs/      grocery, pharmacy, clothing, restaurant, service, general
  lib/        money.ts, env.ts, i18n/, supabase/, useOnlineStatus.ts
  locales/    bn/ en/
  styles/     design tokens
supabase/     migrations (10), seed, SQL test suites (5)            (Phase 2)
ai-service/   FastAPI AI service                     (Phase 11)
docs/         rules, architecture, decisions, security, test plan
```

### Hard rules baked into the code

- **Money is integer paisa.** All conversion lives in `src/lib/money.ts` (21 unit tests).
- **No UI string outside `src/locales/`.**
- **Design tokens only** — no ad-hoc colours or radii in components.
- **Supabase anon key only** in the client; service-role key never ships.
- **Touch targets ≥ 48 px**, primary actions 56 px; Simple Mode = 4 big buttons.
- **Offline-friendly shell**: fonts self-hosted, no blocking third-party requests.
- **Money and stock are written only through server-side RPCs**; the tables have no
  INSERT policy at all, so a modified client cannot forge a total.
- **Every table has RLS**, and a test fails the build if a new one does not.

### Preferences (persisted per device)

Language (বাংলা/English) · mode (সহজ/প্রো) · appearance (dark/light/system) · accent (teal/blue/purple/pink/amber) · text size ×3 · numerals (০১২৩ / 0123).

They already persist and apply instantly — a great first thing to test.

---

## Documentation

- [`docs/PROJECT_RULES.md`](./PROJECT_RULES.md) — the master brief (single source of truth)
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — system shape, sync design, token system
- [`docs/DECISIONS.md`](./DECISIONS.md) — every non-trivial choice with its reason
- [`docs/SECURITY.md`](./SECURITY.md) — phase-by-phase security checklist
- [`docs/TEST_PLAN.md`](./TEST_PLAN.md) — automated and manual testing

## License

Proprietary — all rights reserved. Not open source.
