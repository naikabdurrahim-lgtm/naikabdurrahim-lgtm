# Decisions log

Format: **date — decision — reason**. Newest first.
Rule (PROJECT_RULES 1.9): every non-trivial choice goes here so future phases do not re-litigate it.

---

## 2026-10-22 — Phase 2 database

| # | Decision | Reason |
|---|---|---|
| 19 | **Composite foreign keys everywhere**: every child row references its parent by `(tenant_id, parent_id)`, not just `parent_id`. | A row physically cannot be attached to a parent in another shop, even if a future code path forgets a check. Cheaper and more reliable than a trigger per table. |
| 20 | **RLS on every table + a test that fails if a new table lacks it** (`90_schema_guards.sql`). | The rules only hold if they are enforced for tables that do not exist yet. |
| 21 | **`sales`, `sale_items`, `payments`, `ledger_entries`, `stock_movements` have no INSERT policy.** Writes go through SECURITY DEFINER RPCs (`create_sale`, `collect_due`, `void_sale`, `record_stock_movement`). | A tampered client cannot forge a total, back-date a payment, or write history. Totals are recomputed from the lines on the server. |
| 22 | **Stock on hand = sum of `stock_movements`.** `products.stock_qty` is a cache maintained by trigger, verified against `v_stock_on_hand` in tests. | Same number two ways; the test catches any drift immediately. There is no "set stock" path — adjustments need a reason. |
| 23 | **Due balance is always derived** (`sum(debit) − sum(credit)`) via `customer_balance()` and `v_customer_balances`. No cached balance column. | A cached balance is the classic source of wrong money. At shop scale (thousands of rows) the sum is fast; correctness first. |
| 24 | **Append-only tables have a `forbid_mutation` trigger.** Corrections are reversing records (`void_sale`). | Matches accounting practice and the offline-sync conflict model: append-only rows can never conflict. |
| 25 | **Invoice numbers are assigned on the server** with a per-tenant advisory lock; the client shows a local draft until sync. | Two offline devices must never produce the same invoice number, and gaps/duplicates are worse than waiting for a sync. |
| 26 | **`business_date` is supplied by the device** (defaulting to Asia/Dhaka today). | A sale made offline at 11 pm must count for that day, not for the day the phone reconnects. |
| 27 | **Idempotency keys on every synced write** (`client_id` unique per tenant on sales/payments/ledger/stock). Re-sending returns the original result. | The outbox retries; without this, retries duplicate sales and stock movements. |
| 28 | **Cashier cannot read `sale_items`** (cost price lives there). Receipts use the `v_sale_items_receipt` view; profit comes only from owner/manager views and RPCs. | Profit visibility is a business rule, and the database is where it must hold. |
| 29 | **Cashiers may create customers and collect dues, but not change stock, prices, settings or staff.** | Matches how a real counter works: the cashier serves customers and takes money. |
| 30 | **A shop must always keep one owner** (`protect_last_owner` trigger). | Prevents a shop from becoming unmanageable after an accidental role change. |
| 31 | **Voiding a part-paid credit sale leaves the customer with an advance** (negative balance). The UI must show this as "অগ্রিম", not as an error. | The money really was paid. Silently zeroing it would lose a real liability. Documented in a test. |
| 32 | **`units` is global reference data** (no `tenant_id`), read-only for clients; per-shop measurement choices live in `app_settings.default_unit`. | Measurement vocabulary is identical for every shop; duplicating it per tenant would drift. |
| 33 | **Business pack defaults live in `app.pack_categories`** and are copied into a shop by `create_tenant()`. | Adding a business type means adding rows, never changing core code (PROJECT_RULES 5.2). |
| 34 | **The SQL suites run against a throw-away local Postgres**, not Supabase (`npm run db:test`). | Fast, free, no production risk, and it runs in CI on every push. |

---

## 2026-10-22 — Phase 1 foundation

| # | Decision | Reason |
|---|---|---|
| 1 | **Product name is a placeholder: `Dokan Bondhu` / দোকান বন্ধু.** Stored in `src/lib/env.ts` (`appConfig.name`), locale files and `package.json`. | The final name has not been confirmed yet. Changing it later touches four places and nothing else. |
| 2 | **The app lives in this repository for now**, with the profile README kept untouched at `/README.md` and the product README at `docs/PROJECT_README.md`. | This checkout is the founder's GitHub *profile* repository. Overwriting `README.md` would change the public profile page. Recommend moving the product to its own repo before Phase 2. |
| 3 | **Money = integer paisa everywhere.** `number` in TS, `bigint` in Postgres from Phase 2, formatted only through `src/lib/money.ts`. | Floats lose paisa on repeated arithmetic; integer paisa makes totals exact and testable. |
| 4 | **Bangladeshi digit grouping** (`1,23,456.78`) rather than Western grouping. | Matches how shopkeepers read amounts locally (lakh/crore grouping). |
| 5 | **Negative money renders as `-৳12.50`**, sign before the symbol. | Matches Bangla/South-Asian typography and avoids `৳-12.50` looking like a data error. |
| 6 | **`parseTakaToPaisa` strips commas anywhere** and accepts Bangla digits, `৳`, and spaces. | Shopkeepers paste amounts from WhatsApp/memos; rejecting formatting is a real usability failure. Invalid decimals (>2 places) still fail with `null`. |
| 7 | **Quantity is an integer in thousandths** (`quantityMilli`), mirroring `numeric(14,3)`. | Avoids float drift for kg/gram sales and keeps the client/server representation identical. |
| 8 | **Dark is the default appearance, teal the default accent.** | Per PROJECT_RULES 3.2 (dark-first). Teal reads as "money/safe" in the local context and stays legible at low brightness. |
| 9 | **Default language `bn`, default numerals `bn` for new users**, both overridable in Settings and persisted. | The target user reads Bangla first; numerals are a per-person preference, so it is a visible setting rather than a hidden default. |
| 10 | **Intentional use of `react-hook-form`, Dexie, Radix Dialog/Toast is deferred** until the phase that uses them. Removed from `package.json`; `sonner` covers toasts for now. | Keeps the dependency surface and audit noise small in Phase 1. |
| 11 | **Custom preference store (Zustand + `persist`) instead of `next-themes`.** | One store owns theme, accent, text size, numerals, language and mode; a second theme library would duplicate state. |
| 12 | **Locale files are per-namespace JSON** (`src/locales/<lang>/common.json`), feature namespaces added with their feature. | All UI text is translatable from day one without a flat 1000-key file. |
| 13 | **Scaffolded routes for later modules use `ModulePlaceholder`**, which states plainly that the feature is not built. | Navigation, route guards and deep links can be tested now, without fake data or dead buttons. |
| 14 | **Supabase config is optional at boot.** The app renders the shell and a health check explains what to fix. | A missing `.env` must not produce a white screen; the founder is not a backend specialist and needs a readable failure. |
| 15 | **`server.allowedHosts: true` and `host: 0.0.0.0` in Vite.** | Required for previewing the dev server from outside the machine. Production hosting (Phase 12) gets strict headers/CSP instead. |
| 16 | **CI runs Prettier check, ESLint, `tsc`, unit tests, production build, `gitleaks`; `npm audit` is non-blocking.** | Prevents broken pushes; audit stays visible without blocking work on transitive advisories we cannot fix immediately. |
| 17 | **Fonts are self-hosted** via `@fontsource` (Noto Sans Bengali 400–700, Hind Siliguri 400/600). | Offline-first requirement; also removes a third-party request, which matters for CSP and privacy. |
| 18 | **Bangla numeral conversion is display-only** (`MoneyText`, `NumberText`), never applied to inputs, IDs or stored values. | Keeps data machine-readable while the UI stays localised. |
