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

## 6. Data model (implemented in Phase 2)

19 tables, all in `supabase/migrations`. Ordered so each migration only depends on
the ones before it.

| Migration | Tables |
|---|---|
| 0001 | enums, internal `app` schema, shared triggers |
| 0002 | `profiles`, `tenants`, `tenant_members`, `app_settings` + RLS predicates |
| 0003 | `units`, `categories`, `products`, `product_variants`, `product_batches`, `suppliers` |
| 0004 | `customers`, `ledger_entries` |
| 0005 | `sales`, `sale_items`, `payments` |
| 0006 | `stock_movements` + stock cache trigger |
| 0007 | `audit_logs`, `sync_events` + audit triggers |
| 0008 | RLS policies, grants, views |
| 0009 | RPCs: `create_tenant`, `create_sale`, `collect_due`, `void_sale`, `record_stock_movement`, `customer_balance`, `tenant_day_summary` |
| 0010 | reference data: units, per-pack default categories |

**Invariants enforced by the database**

- A child row can only belong to a parent in the same tenant (composite FKs).
- `sale.subtotal` must equal the sum of its lines (deferred constraint trigger).
- Line totals, sale totals, due and profit are computed by the database or by
  `create_sale()`; a client-supplied total is ignored.
- Stock can never go negative unless the shop allows it, and every change is a
  movement with a type, and a reason when it is an adjustment.
- Money/stock/ledger tables reject UPDATE and DELETE at the trigger level.
- `updated_at` is strictly increasing per row, so a pull cursor cannot skip rows.

**Views**

| View | Purpose | Who can read |
|---|---|---|
| `v_customer_balances` | due per customer (derived from the ledger) | any member |
| `v_stock_on_hand` | cache vs. recomputed stock (integrity check) | any member |
| `v_sale_items_receipt` | receipt lines without cost price | any member, incl. cashiers |
| `v_daily_summary` | sales / credit / profit per day | owner, manager |

## 7. Money and stock correctness

- `src/lib/money.ts` is the only place that converts between taka and paisa; it is unit-tested (21 tests).
- Stock on hand = sum of `stock_movements`; a trigger-maintained cache column is verified against it in Phase 2 SQL tests.
- Customer due = sum of `ledger_entries`; a due sale writes a debit, a collection writes a credit.
- Finalised sales are never edited; corrections are reversal records.

## 8. Local database testing

`npm run db:test` creates a scratch database, applies every migration in order, then
runs five suites (isolation, roles, integrity, sync/audit, schema guards). It runs in
CI against a `postgres:16` service. See `scripts/setup-db.md`.

## 9. Environments

| Env | Frontend | Database |
|---|---|---|
| local | `npm run dev` (Vite, port 5173) | Supabase project (dev) |
| CI | `npm run build` with placeholder env | none |
| production | static host + PWA (Phase 12) | Supabase project (prod) |

`.env` is git-ignored; `.env.example` documents every key. Frontend keys must start with `VITE_`.
