# Decisions log

Format: **date — decision — reason**. Newest first.
Rule (PROJECT_RULES 1.9): every non-trivial choice goes here so future phases do not re-litigate it.

---

## 2026-10-22 — Phase 6 dues & customers

| # | Decision | Reason |
|---|---|---|
| 85 | **The customer list and the khata are read through four `security definer` functions** (`list_customers`, `due_summary`, `get_customer`, `customer_ledger`), not through `v_customer_balances`. | The view is `security_invoker` and groups by customer, so it can neither page, nor search, nor filter to debtors without the client downloading every row. The functions also let a soft-deleted customer stay readable. |
| 86 | **`ledger_entries` gained a `seq bigint generated always as identity`, and the khata sorts by it.** | `occurred_at` defaults to `now()`, which is the transaction start: a sale and its payment in one transaction tie, and a running balance over a tie is arbitrary. Insertion order is the only honest order an append-only ledger has. |
| 87 | **`payments` stays append-only, with one narrow exception**: `app.guard_payment_update()` permits setting `voided_at / voided_by / void_reason` once, and refuses every other change or any delete. | The ledger can be reversed but the money row must not silently change. A guard that enumerates the allowed change is stricter than dropping the trigger. |
| 88 | **Undoing a collection writes a *debit* ledger entry through `void_payment()`; the payment row is never deleted.** | Matches the sale rule (reversals, never edits), keeps the khata explainable ("আদায়" and "আদায় বাতিল" side by side) and makes the reversal idempotent. |
| 89 | **A cashier may reverse their own collection for ten minutes; an owner or manager may reverse any payment at any time.** | The counter needs a mis-tap fixed before the customer leaves; yesterday's takings must not be quietly reversible by whoever is on shift. "Ten minutes" is server time, not device time. |
| 90 | **Debtors come first, biggest debt on top, then everyone else by name.** | The বাকি screen exists to answer "who owes me the most"; `/customers` re-sorts by name only inside the POS picker, where the user is looking for a person. |
| 91 | **`/due` and `/customers` are one component (`CustomerListScreen`) with a `mode` flag.** | The two screens differ by one filter and one button. Two copies would drift, and the screen that must never be wrong is the one the shopkeeper checks at closing time. |
| 92 | **Search on a phone number compares after stripping `+` and spaces, server-side.** | A shopkeeper reads `01712345678` from a receipt while the column stores `+8801712345678`; a client-side `ilike` would never match. |
| 93 | **The collect sheet offers নগদ / বিকাশ / নগদ (Nagad) / রকেট**, although `payment_method` also has `card`, `bank`, `other`. | The other three are rare enough in a small shop that a longer grid costs more taps than it saves; the column keeps them for the API and later phases. |
| 94 | **A customer needs only a name**; phone, address, note and credit limit are optional. | Half the regulars are known by name. Requiring a number would push the shopkeeper to invent one, which poisons duplicate detection. |
| 95 | **`ErrorPanel`, `EmptyState` and `Field` moved to `src/components/common/`.** | Three features now render the same failure state; a per-feature copy is how "no raw errors" quietly stops being true. |

## 2026-10-22 — Phase 5 POS

| # | Decision | Reason |
|---|---|---|
| 70 | **The POS reads products through the same `search_products()` query as the catalogue**, with `p_include_inactive = false`. | One code path, one cache, server-side search; a discontinued product must never be sold by accident. |
| 71 | **The bill lives in memory only — no `localStorage`, no Dexie.** | A shared shop phone must not keep yesterday's prices or a half-finished bill. Durable drafts belong to the offline store in Phase 9, keyed per user. |
| 72 | **The client never writes `sales`, `sale_items`, `payments` or `stock_movements`.** `create_sale()` is the only door. | The server recomputes subtotal, discount, total, due, the invoice number, the stock movement and the ledger entry. A tampered client can change the price it offers, never what is recorded. |
| 73 | **One `client_id` per submit attempt, reused on retry, discarded after success.** | `create_sale` is idempotent per `client_id`; generating a new one per tap would turn a flaky network into a double sale. |
| 74 | **An untouched amount field on a cash sale means "paid exactly".** | Otherwise every sale would need the shopkeeper to retype the total, and a forgotten field would silently become credit. Credit is an explicit switch. |
| 75 | **Quantities go out as fixed 3-decimal strings** (`"1.500"`). | The database column is `numeric(14,3)`; sending a JS float invites `1.4999999`. The cart keeps thousandths and formats once. |
| 76 | **A percent discount is converted to paisa on the client and stored with `discount_kind = 'percent'`.** | `sales.total_paisa` is generated from paisa only, so the server needs the amount; the kind is kept so the receipt can say "10% off". |
| 77 | **Only owner/manager can edit a line's price in the UI**; the database additionally refuses below-cost sales by a cashier. | A cashier typing 1 taka instead of 100 is a real risk in a busy shop. The UI prevents it; the server is the second line of defence. |
| 78 | **Receipts are read from `sales` + `v_sale_items_receipt`, never from `sale_items`.** | The view already drops cost price, so a cashier can reprint a receipt without seeing what the shop paid. |
| 79 | **The customer picker lives inside the sale, and can create a customer inline.** | "রহিম ভাই, ০১৭…" is the normal case at the counter; sending the cashier to another screen would abandon the bill. Phase 6 grows this into the full customer screen. |
| 80 | **Undo is a `void_sale()` with a required reason, shown for 10 seconds, owner/manager only.** | PROJECT_RULES 3.1 #10 requires a 10-second undo and the ledger must stay append-only, so undo is a reversal, not a delete. A cashier sees no undo button because the database would refuse it. |
| 81 | **Sheets are Radix Dialog, not a hand-rolled modal.** | Focus trap, Escape, `aria-modal` and scroll lock are security and accessibility details worth a 12 kB dependency. |
| 82 | **Vendor chunks are split in `vite.config.ts`** (`react`, `supabase`, `forms`, `i18n`). | The single bundle crossed 900 kB and warned; splitting keeps our code cacheable separately and removes the warning without hiding it. |
| 83 | **`0013_audit_entity_id.sql` fixes `app.log_audit()` for tables without an `id` column.** | Found by this phase: `app_settings` is keyed by `tenant_id`, so an owner changing shop settings hit `record "new" has no field "id"`. The Phase 2 tests missed it because the only settings update there was a cashier's, refused by RLS before the trigger ran. |
| 84 | **Phase 5 needs a connection.** Offline selling arrives in Phase 9 with the outbox; until then the screen says so instead of pretending. | Selling offline without the queue would either lose the sale or duplicate it on reconnect. Saying it out loud beats silent data loss. |

## 2026-10-22 — Phase 4 products & categories

| # | Decision | Reason |
|---|---|---|
| 55 | **Cost price (`buy_price_paisa`) is hidden from the `authenticated` role at the column level**, not by a view or client filtering. | RLS is row-level and cannot hide a column; a cashier could otherwise read cost with a plain `select`. The table grant is now an explicit column list without cost. Consequence: **nobody** can read the raw column, not even an owner — and that is deliberate. |
| 56 | **Cost is served only by `search_products()`**, a `security definer` function that returns `buy_price_paisa` as null unless `has_tenant_role(tenant, {owner, manager})`. | One auditable place decides cost visibility, and the same function already has to check membership. It also keeps the cost out of any accidentally-cached client query. |
| 57 | **Reading the catalogue goes through the RPC, not `select * from products`.** | A pharmacy with 4,000 SKUs must not be downloaded to filter it in the browser; search, category filter, paging and the low-stock filter are all server-side. |
| 58 | **Paging is keyset-free offset paging, 40 rows per page, with a 1–200 clamp server-side.** | The catalogue is small enough that offsets never get deep; clamp prevents a client asking for a whole pharmacy in one response. Revisit only if a shop exceeds ~20k products. |
| 59 | **Search matches Bangla name, English name, barcode prefix, SKU and the `simple` tsvector.** | A shopkeeper types “চাল”, an English name, or scans/keys the first digits of a barcode — all three must find the product. Barcode is a prefix match so a scanner that appends a check digit still works. |
| 60 | **The low-stock filter is a server argument (`p_low_stock`), and services are always excluded.** | Filtering client-side would only filter the current page, which is worse than useless; a service has no stock to run out of. A product with `stock_alert_qty = 0` is never shown as low — "no alert set" is not "zero". |
| 61 | **`list_categories()` returns counts computed in SQL.** | The chips show “চাল-ডাল 12”; counting in the client would need every product again. |
| 62 | **Writes use the tables directly (RLS: owner/manager), reads use RPCs.** | Insert/update stay ordinary PostgREST calls with no cost leak; keeping them out of the definer functions means less SQL surface to audit. |
| 63 | **Opening stock is never a product column write.** It is a second step through `record_stock_movement(reason='opening')`. | PROJECT_RULES 5.4: stock only moves through movements. If the movement fails, the product still exists and the UI says so — losing the product would be worse. |
| 64 | **Deleting a product or category is a soft delete with a 10-second undo toast.** | Sales history must keep referencing the row, and the undo requirement (PROJECT_RULES 3.1 #10) is cheap to honour when nothing is really gone. |
| 65 | **A removed category never removes its products**; they become uncategorised and the delete confirmation says how many. | Silently deleting a whole category's stock would be a data-loss bug that looks like a feature. |
| 66 | **The products screen has no role guard; the form is reachable only by owner/manager through RLS.** | A cashier must be able to look up a price mid-sale. A refused write surfaces as “অনুমতি নেই”, not a dead screen. |
| 67 | **Form state is strings; paisa and thousandths exist only after validation** (`toProductInput`). | One conversion point means a price can never be stored as a float, and the user's Bangla numerals and commas survive until the last moment. |
| 68 | **"Save and add another" keeps the unit and service flag** but clears everything else. | Adding twenty SKUs from one delivery note is the common case; retyping "kg" twenty times is the fastest way to lose a user. |
| 69 | **`UnitCode` is a runtime tuple (`UNIT_CODES`) with an `isUnitCode()` guard.** | The RPC returns `text`; a DB value the client does not know must fall back to `piece` instead of crashing a screen. |

## 2026-10-22 — Phase 3 auth, onboarding, packs

| # | Decision | Reason |
|---|---|---|
| 35 | **Login is phone + 6-digit PIN over Supabase email/password with a synthetic address** `8801XXXXXXXXX@phone.dokanbondhu.local`. | The fixed rule (PROJECT_RULES 5.1): Supabase phone OTP needs a paid SMS provider, which is not in the v1 budget. The address is never shown and never receives mail; the PIN is the secret. Documented as a deliberate trade-off, not an accident. |
| 36 | **The synthetic address keeps all 13 E.164 digits and drops only the `+`.** | Reversible, so any screen can show the phone again; two phones can never collide on one mailbox. |
| 37 | **The PIN never leaves the device in plain text except to Supabase Auth**, which stores it as a bcrypt hash. No PIN is ever written to localStorage, Dexie or logs. | A PIN is a password. The client keeps it in React state for the duration of the submit call only. |
| 38 | **PIN policy is enforced client-side (`checkPin`) and rate-limited server-side** (5 failures/15 min → 15 min lock, 10/hour → 1 hour lock). | A 6-digit PIN is only 1M combinations, so lockout is the real security control. The client rule exists to stop a shopkeeper choosing `123456` and blaming the app later. |
| 39 | **PIN rules return codes, not sentences** (`sequential`, `common`, `birth_year`, …), translated in `auth.pinProblems.*`. | Keeps the domain module free of Bangla text and lets a future language reuse the same checks. |
| 40 | **Attempt keys are SHA-256 of `phone:v1:<e164>` — the attempt table never stores a phone number.** | A leaked `auth_attempts` table cannot be used to enumerate customers, and the salted prefix prevents matching against a generic phone-hash table. |
| 41 | **A 12-symbol recovery code (60 bits) is shown once at signup and stored only as a SHA-256 hash.** | Without SMS there is no self-service reset. Showing it once and gating the Continue button on an explicit "I wrote it down" checkbox is the honest alternative; the code is single-use. |
| 42 | **The alphabet is A–Z minus I/O plus 2–9 (32 symbols)** and the code is displayed in three groups of four. | 32 symbols divide a random byte evenly (5 bits, no modulo bias) and the excluded glyphs are the ones people misread when copying by hand. |
| 43 | **Database sessions, not custom JWTs.** The client uses `supabase-js` session handling; no auth logic is re-implemented. | Anything custom here is a security liability; the library is audited and already handles refresh, storage and PKCE. |
| 44 | **Auth is behind `authService`, so the transport can change** (e.g. real SMS OTP in v2) without touching a screen. | The synthetic-email trick is a v1 compromise. The interface is the exit strategy. |
| 45 | **Onboarding writes nothing until the last button.** `create_tenant` runs as one transaction; starter products are a separate, non-fatal step. | Half-created shops confuse a new user more than an error message. A missing starter list is fixable in one tap. |
| 46 | **If the shop is created but the starter products fail, the app continues to the dashboard with a warning.** | Retrying "create" would make a second shop. The tenant exists, which is the expensive part; products are editable later. |
| 47 | **Restaurant and service starter products are inserted with `is_service = true` and no opening stock.** | A salon appointment and a plate of rice have no shelf count in v1 (PROJECT_RULES 8). Marking them as services now avoids fake stock numbers later. |
| 48 | **Business packs are data, never code paths.** Six objects, a registry, and `getPack()` that falls back to `general`. | Adding a seventh business type must not touch `features/`. A test asserts every pack's invariants (categories exist, integer paisa, sell ≥ buy). |
| 49 | **The nav is filtered by role as well as by mode** (`visibleNavItems(mode, role)`). | The database refuses a cashier's report query; showing the tab anyway produces a dead end the user cannot explain. |
| 50 | **Simple Mode is capped at five bottom-bar slots** (home, বিক্রি, বাকি, স্টক, আজকের হিসাব). | PROJECT_RULES 3.1 #4 and one-handed reach; settings is reachable from the header. |
| 51 | **All UI strings come from `src/locales/**`, and a test scans the source for `t('…')` keys** in both languages. | A typo'd key renders as `auth.welcome` on the shopkeeper's screen. The scan catches it before review. |
| 52 | **i18next placeholders are `{{double}}` by default — locale files were converted.** | A single-brace `{count}` renders literally; the test suite now proves interpolation reaches the screen ("আর 2 বার…"). |
| 53 | **`scripts/generate-types.py` reads `pg_get_function_result`** for RPC return types and emits composite returns as the table Row. | `information_schema` reports `create_tenant` as `USER-DEFINED` with no name, which typed every RPC argument as `never`. Regenerating is now a one-liner (`npm run db:types`). |
| 54 | **Component tests use `@testing-library/react`; no Playwright UI runs in this environment** (the browser binary cannot be downloaded here). | The behaviour that matters in Phase 3 (PIN entry, lockout banner, recovery gate, onboarding order) is asserted in jsdom; the visual pass stays a human step. |

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
