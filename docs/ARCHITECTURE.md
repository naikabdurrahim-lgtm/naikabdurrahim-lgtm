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

20 tables, all in `supabase/migrations`. Ordered so each migration only depends on
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
| 0011 | `auth_attempts`, `recovery_codes` + lockout / availability / recovery RPCs |

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
runs eleven suites (isolation, roles, integrity, sync/audit, auth hardening,
catalogue, POS, customers, stock/reports, POS payload, schema guards). It runs in CI against a `postgres:16` service. See `scripts/setup-db.md`.

`scripts/generate-types.py` rebuilds `src/lib/supabase/database.types.ts` from that
same scratch database (`npm run db:types`): tables, views, enums, FK relationships
and function signatures. Function return types come from `pg_get_function_result`,
so an RPC that returns a table row is typed as that row, not as `Json`.

## 9. Environments

| Env | Frontend | Database |
|---|---|---|
| local | `npm run dev` (Vite, port 5173) | Supabase project (dev) |
| CI | `npm run build` with placeholder env | none |
| production | static host + PWA (Phase 12) | Supabase project (prod) |

`.env` is git-ignored; `.env.example` documents every key. Frontend keys must start with `VITE_`.

## 10. Authentication & onboarding (Phase 3)

```
SignInPage / SignUpPage
   └─ useAuth()  ──  AuthProvider  ──  authService  ──  supabase-js
                                          │
                                          ├─ signInWithPin / signUpWithPin
                                          ├─ getLockoutState / recordAttempt
                                          └─ saveRecoveryCode
```

- **Credentials**: phone number + 6-digit PIN. Supabase sees a synthetic email
  (`8801XXXXXXXXX@phone.dokanbondhu.local`) and the PIN as its password. The phone
  is the public half, the PIN is the secret; `authService` is the seam that lets a
  later version switch to real SMS OTP without touching a screen.
- **Guards**: `RequireAuth` (session) → `RequireShop` (tenant) → `RequireRole`
  (owner/manager screens). They render a skeleton while loading and a Bangla
  explanation instead of a dead end.
- **Role mirror**: `src/lib/permissions.ts` mirrors the RLS matrix so the UI hides
  what the database would refuse; `navigation.ts` filters the nav by role and mode.
- **Onboarding**: four screens, all state local. `create_tenant()` creates the shop,
  the owner membership, settings and pack categories in one transaction; starter
  products are inserted afterwards as an ordinary RLS-checked write, and their
  opening stock goes through `record_stock_movement()` (never a direct `stock_qty`).
  If only the products fail, the user continues to the dashboard with a warning.
- **Packs**: `src/packs/*` is data only — id, Bangla/English labels, terminology,
  default categories and units, feature modules, starter products. `getPack()`
  falls back to `general`, so an unknown pack can never break a screen.

## 11. Catalogue (Phase 4)

```
ProductsPage ── useProducts() ── search_products(p_tenant, query, category, limit, offset, include_inactive, id, low_stock)
     │                │
     │                └─ useInfiniteQuery, 40 rows/page, 30 s staleTime
     ├─ useCategories() ── list_categories(p_tenant)  → chips with counts
     └─ ProductCard → /products/:id

ProductFormPage ── zodResolver(buildProductFormSchema(t))
     │                 └─ strings in, `toProductInput()` → paisa + thousandths
     ├─ create: insert into products (RLS) + record_stock_movement(reason='opening')
     └─ edit:   update products (RLS) / soft delete + 10 s undo toast
```

- **Reads are RPCs, writes are tables.** The RPC is the only way to receive cost
  (`buy_price_paisa` is outside the role's column grant), and it is the only place
  that can filter and page 4,000 SKUs without shipping them to the browser.
- **The feature folder owns everything**: `types.ts` (view models), `schema.ts`
  (validation + conversion), `api.ts` (the only Postgres caller, Zod-parsed),
  `queries.ts` (TanStack hooks and cache keys), `useCatalogueTerms.ts` (pack words
  such as ঔষধ vs পণ্য), `components/`, `pages/`.
- **Cache keys** are `['products', tenantId, query, categoryId, lowStock]` and
  `['categories', tenantId]`; every mutation invalidates both, because category
  counts are derived from products.
- **Errors are codes, not messages.** `ProductApiError.code` maps to
  `products:errors.*`, so the same failure is Bangla or English without the SQL
  text ever reaching the user.
- **Money and quantity never touch a float**: the form holds strings, `schema.ts`
  converts once, and the API stores integer paisa and `numeric(14,3)`.

## 12. Selling (Phase 5)

```
SellPage
 ├─ ProductPicker ── usePosProducts ── search_products(…, p_include_inactive => false)
 ├─ useCart ── cart.ts (pure: add/step/setQty/price/discount/credit)
 │      └─ computeTotals → subtotal, discount, total, paid, due, change
 ├─ LineSheet (Radix dialog) — quantity presets + price (owner/manager only)
 └─ PaymentSheet — tendered, method, credit, customer, note
        └─ toSalePayload → create_sale(p_tenant, p_payload)
                 └─ invoice no, totals, stock movement, ledger entry  (server)
```

- **Two sources of truth, on purpose.** `cart.ts` decides what the shopkeeper sees;
  `create_sale()` decides what is stored. If they disagree the sale is refused, not
  mis-recorded.
- **Idempotency**: one `client_id` per attempt, reused when the same bill is
  retried, so a timeout is never a double sale.
- **Receipts**: `sales` + `v_sale_items_receipt` (no cost), readable by every role,
  so a reprint never becomes a privilege escalation.
- **Undo**: `void_sale()` with a reason — a reversal record, never a delete.
- **Phase 9 seam**: the payload builder takes a client id, which is exactly what the
  offline outbox will store, so a queued sale replays instead of being re-created.

## 13. Dues and customers (Phase 6)

```
/due            CustomerListScreen mode="due"   → list_customers(only_due => true)
/customers      CustomerListScreen mode="all"   → list_customers(p_query => …)
/customers/new  CustomerFormPage                → customers insert
/customers/:id  CustomerPage                    → get_customer + customer_ledger
   └─ CollectSheet → collect_due(p_payload)     → payments + ledger credit
        └─ UndoBar (10 s) → void_payment()      → ledger debit + void marker
```

- **The balance is never stored and never summed in the browser.** `due_summary()`
  returns the shop total, the debtor count and the oldest due; `customer_ledger()`
  computes `balance_after_paisa` over the whole history *before* paging, so page 2
  continues page 1 instead of restarting at zero.
- **One ordering rule**: `list_customers` sorts by derived due descending, then by
  name; the POS picker re-sorts by name because there the user is looking for a
  person, not a debtor.
- **A khata outlives its customer.** Deleting a customer sets `deleted_at`
  (soft delete); the list hides the row, `get_customer()` still returns it with
  `is_deleted = true`, and the ledger keeps every line.
- **Collect once.** `collect_due()` is idempotent on `client_id`, so a retry after
  a timeout returns the original payment instead of taking the money twice.
- **Reversal, not deletion.** `void_payment()` writes a debit entry and marks the
  payment; the pair stays visible. Cashiers may undo their own collection for ten
  minutes, owners and managers at any time.
- **Error codes, not SQL**: `CustomerApiError` / `LedgerApiError` map to
  `customers:*` keys, so a refusal reads as a sentence in Bangla or English.

## 14. Stock, today and reports (Phase 7)

```
/stock              StockPage
 ├─ stock_overview()        counts + value (value NULL for a cashier)
 ├─ list_stock(filter)      out → low → name
 └─ MovementSheet → record_stock_movement()   reason required, append-only
/stock/:productId   ProductStockPage
 └─ product_stock_movements()  running quantity over the whole history
/today              TodayPage
 ├─ tenant_day_summary()    sales, credit, collected, profit (NULL for a cashier)
 └─ recent_sales()          today's bills → /sell/receipt/:id
/reports            ReportsPage (owner/manager)
 ├─ sales_report(from, to)  per-day rows; the client sums the range
 ├─ top_products(from, to)  best sellers by revenue
 └─ DailyBars               buttons + CSS heights, no chart library
```

- **Derived, never cached**: stock on hand is the sum of `stock_movements`
  (verified against the cache column in the SQL suite), and every report is
  computed from `sales` / `sale_items` / `payments` at read time.
- **Profit is a permission, not a number**: the functions return `NULL` for a
  cashier, so the UI cannot accidentally print a zero instead of "not allowed".
- **Voided sales** are excluded from takings, credit and profit, but stay visible
  in `recent_sales` with a struck-through amount.
- **Two aggregates, never one join**: sale-level totals and line-level profit are
  separate subqueries; joining them would multiply totals by line count.

