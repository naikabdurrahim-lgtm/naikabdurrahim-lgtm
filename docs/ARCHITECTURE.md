# Architecture

Living document. Updated at the end of every phase.

## 1. Shape of the system

```
Browser / Android (Capacitor)
  React 18 + Vite + TS + Tailwind
  ├─ UI reads/writes Dexie (IndexedDB) first      ← Phase 9
  ├─ Outbox queue for every mutation              ← Phase 9
  └─ Push/pull to Supabase over HTTPS
        │
        ▼
Supabase (PostgreSQL + Auth + RLS + Storage)      ← Phase 2/3
        ▲
        │  (server-to-server only, never from the browser)
  AI service (FastAPI)                            ← Phase 11
```

Rules that never change:

- The browser holds **only the anon key**. The service-role key never leaves the server.
- Every business row carries `tenant_id`; isolation is enforced by **RLS in Postgres**, not by UI code.
- Money is integer **paisa**; quantity is `numeric(14,3)` (client: integer thousandths).
- All IDs are client-generated UUIDs so offline writes are idempotent.
- Sales, payments, ledger entries and stock movements are **append-only**.

## 2. Frontend layout

```
src/
  app/            routing, layouts, providers, pages
  components/     ui/ (primitives) + common/ (MoneyText, BigActionButton, StatCard…)
  features/       one folder per domain; owns its logic and components
  packs/          Business Pack configs (grocery, pharmacy, clothing, restaurant, service, general)
  lib/            money.ts, env.ts, i18n/, supabase/, permissions.ts, useOnlineStatus.ts
  locales/        bn/ en/ JSON namespaces
  styles/         design tokens (CSS variables) + Tailwind layers
```

Dependency direction: `app → features → components/common → components/ui → lib`.
A feature never imports another feature's internals.

## 3. Design tokens

- HSL CSS variables in `src/styles/index.css`; Tailwind maps them in `tailwind.config.ts`.
- `[data-theme]` switches accent (teal/blue/purple/pink/amber).
- `[data-font-size]` switches the three accessibility text scales.
- `.light` / `.dark` on `<html>` switches appearance; `system` follows the OS.
- Semantic tokens: `--money-in`, `--money-out`, `--warning`. Colour is never the only signal.

## 4. Localisation

- Default `bn`, fallback `bn`, secondary `en`.
- No hard-coded UI strings: every label comes from `src/locales/**`.
- Number rendering: `formatPaisa()` for money, `toBanglaDigits()` for counts.
- Dates render in `Asia/Dhaka` from UTC timestamps (helper added in Phase 5).

## 5. Offline sync (design fixed now, built in Phase 9)

- Local-first: every read comes from Dexie; the network is a background detail.
- Outbox: `{ id, tenantId, table, op, payload, attempts, nextAttemptAt }`, exponential backoff with jitter.
- Idempotency: `sales.client_id` unique per tenant; server upserts by `(tenant_id, client_id)`.
- Pull: `updated_at` cursor per table, soft deletes included as tombstones.
- Conflict policy:
  - append-only tables (sales, sale_items, payments, ledger_entries, stock_movements) → never conflict;
  - editable tables (products, customers, settings) → last-write-wins by `updated_at`, and the loser's values are written to `audit_logs`.
- Sync UI states: `offline` → `pending` → `syncing` → `synced` → `error` (calm wording, retry by tapping).

## 6. Money and stock correctness

- `src/lib/money.ts` is the only place that converts between taka and paisa; it is unit-tested (21 tests).
- Stock on hand = sum of `stock_movements`; a trigger-maintained cache column is verified against it in Phase 2 SQL tests.
- Customer due = sum of `ledger_entries`; a due sale writes a debit, a collection writes a credit.
- Finalised sales are never edited; corrections are reversal records.

## 7. Environments

| Env | Frontend | Database |
|---|---|---|
| local | `npm run dev` (Vite, port 5173) | Supabase project (dev) |
| CI | `npm run build` with placeholder env | none |
| production | static host + PWA (Phase 12) | Supabase project (prod) |

`.env` is git-ignored; `.env.example` documents every key. Frontend keys must start with `VITE_`.
