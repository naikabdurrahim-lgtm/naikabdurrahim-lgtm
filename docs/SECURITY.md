# Security checklist

Checked at the end of every phase. Items marked **[P1]** are done in Phase 1; the rest list the phase that closes them.

## Data isolation
- [x] **[P2]** RLS enabled on every table in `public` — plus `90_schema_guards.sql` fails if a future table forgets it.
- [x] **[P2]** Helper functions `is_tenant_member(uuid)` / `has_tenant_role(uuid, text[])`, `security definer` with `search_path` pinned (also asserted by a test).
- [x] **[P2]** Automated tests: tenant A cannot read or write tenant B rows (23 assertions in `10_rls_isolation.sql`).
- [x] **[P2]** Role tests: `cashier` cannot change prices, delete products, read cost prices or profit, move stock, or manage staff (29 assertions in `20_role_permissions.sql`).
- [x] **[P2]** Money, stock and ledger tables have **no INSERT/UPDATE/DELETE policy**: writes go through validated `security definer` RPCs only.
- [x] **[P2]** Append-only triggers on `ledger_entries`, `sale_items`, `payments`, `stock_movements`, `audit_logs`, `sync_events`.
- [x] **[P1]** No service-role key anywhere in `src/`, `public/` or Android assets (gitleaks runs in CI).

## Secrets
- [x] **[P1]** `.env` git-ignored; `.env.example` committed with placeholders only.
- [x] **[P1]** Only `VITE_*` variables reach the browser; the anon key is the only Supabase credential in the client.
- [x] **[P1]** CI secret scan with `gitleaks`.

## Authentication
- [x] **[P3]** Phone + 6-digit PIN via synthetic email (`8801XXXXXXXXX@phone.dokanbondhu.local`); PIN lives only in React state during submit, never in storage or logs.
- [x] **[P3]** Server-side rate limit and lockout in `0011_auth_hardening.sql`: 5 failures / 15 min → 15-minute lock, 10 failures / 1 hour → 1-hour lock. Asserted by `50_auth_hardening.sql`.
- [x] **[P3]** Weak PINs rejected client-side before submit: all-same, ascending/descending runs, 30 leaked PINs, repeated blocks, birth years 1960–2039, and digits from the user's own phone number.
- [x] **[P3]** Recovery flow: 12-symbol code (60 bits) shown once at signup, stored only as a SHA-256 hash, single-use, alphabet excludes I/O/0/1. `set_recovery_code` / `consume_recovery_code` in `0011`, called from `authService.saveRecoveryCode`.
- [x] **[P3]** Attempt log stores only `sha256("phone:v1:" + e164)` — no phone number in `auth_attempts`.
- [x] **[P3]** `is_phone_available()` lets signup refuse a taken number without leaking an account's existence beyond that single boolean.
- [ ] **[P12]** Tokens stored in memory + secure storage on Android; see `@capacitor/preferences` note in Phase 12. On the web, `supabase-js` keeps the session in `localStorage`, which is the accepted trade-off for a PWA (XSS is mitigated by CSP in Phase 12 and by never rendering untrusted HTML).
- [ ] **[P10] Self-service PIN reset.** Today the recovery code is proof-of-ownership that support verifies by hand (the sign-in screen says so). A real reset needs an admin/service-role action, which must never run in a browser; Phase 10 adds a request queue processed by an operator, or a Supabase Edge Function. **This is a known limitation, stated in the UI rather than hidden.**
- [ ] **[P12]** Optional upgrade to a real password for owners who want one (the `authService` interface already isolates this).

## Catalogue & cost visibility (Phase 4)
- [x] **[P4]** `products.buy_price_paisa` is **not in the `authenticated` column grant**. No client role — cashier, manager or owner — can read it with a plain `SELECT`, including `select *`. Asserted by `60_catalog.sql`.
- [x] **[P4]** Cost is returned only by `search_products()`, which nulls it unless `has_tenant_role(tenant, {owner, manager})`. The function is `security definer` with `search_path = public, pg_temp` and re-checks membership on every call.
- [x] **[P4]** The RPC is `revoke execute … from public` and granted only to `authenticated` and `service_role`; `anon` execution is asserted to fail.
- [x] **[P4]** Paging is clamped server-side (1–200 rows). A client cannot ask for a whole pharmacy in one request, deliberately or by mistake.
- [x] **[P4]** Writes stay on ordinary RLS-checked table access (owner/manager only from `0008_rls.sql`); there is no definer function that writes products, so there is nothing that could bypass the policy.
- [x] **[P4]** Opening stock is written through `record_stock_movement()`, never by updating `stock_qty` — the stock cache can only be changed by an audited movement.
- [x] **[P4]** All RPC output is parsed with Zod before it reaches a screen: a malformed row becomes one friendly error, not a crash and not a leaked stack trace.
- [ ] **[P9]** Offline catalogue cache in Dexie must store the **masked** product rows only, so a cashier's device never holds cost data.

## Sales & POS (Phase 5)
- [x] **[P5]** The client cannot insert a sale. Totals, invoice number, stock movement and ledger entry are computed inside `create_sale()` (security definer, membership-checked).
- [x] **[P5]** Idempotency: `sales.client_id` is unique per shop, so a retried submit returns the original sale instead of a duplicate. The POS reuses one id per attempt.
- [x] **[P5]** A cashier cannot sell below cost; the check is server-side (`below_cost_not_allowed`), with the UI limiting price edits to owner/manager.
- [x] **[P5]** Discounts for cashiers can be switched off per shop (`app_settings.allow_cashier_discount`), enforced inside the RPC, not in the browser.
- [x] **[P5]** `void_sale()` requires owner/manager **and** a non-empty reason; it reverses stock and the ledger rather than deleting anything.
- [x] **[P5]** Receipts are read from `sales` + `v_sale_items_receipt` (no cost column). `sale_items` stays invisible to a cashier.
- [x] **[P5]** The POS never receives or stores `buy_price_paisa`; the sell screen's payload contains only what the shop charges.
- [ ] **[P9]** Offline sales must keep the same idempotency key from the outbox; a queued sale may only be replayed, never re-created.

## Input validation (Phase 2+)
- [x] **[P3]** Phone numbers normalised to E.164 before any use (`normaliseBdPhone`); invalid numbers never reach the server.
- [x] **[P4]** Zod on the client for the product and category forms (Bangla messages from the locale files, never raw Postgres text).
- [x] **[P4]** Numeric bounds: price ≤ 2 decimals and ≥ 0, quantity ≥ 0, barcode `[A-Za-z0-9_-]` only, name ≤ 160 chars, category ≤ 60. CHECK constraints remain the source of truth.
- [ ] Numeric bounds for sales: discount ≤ subtotal, quantity > 0 (Phase 5).
- [ ] Parameterised queries only (Supabase client / RPC); no string-built SQL.

## Web hardening (Phase 12)
- [ ] Strict CSP (`default-src 'self'`, no `unsafe-inline` for scripts), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] HTTPS only; no mixed content.
- [ ] No `dangerouslySetInnerHTML`; if unavoidable, sanitise with DOMPurify and document why.
- [ ] Dependency scanning (Dependabot + `npm audit`) reviewed weekly.

## Audit trail (Phase 10)
- [ ] Append-only `audit_logs` for price changes, stock adjustments, deletions, role changes, logins, exports.
- [ ] Logs readable by owner only; never editable or deletable from the app.

## AI safety (Phase 11)
- [ ] All user text/transcripts treated as untrusted (prompt-injection resistant prompt design).
- [ ] AI can only *propose* structured actions; the user confirms before anything is saved.
- [ ] The model receives the minimum tenant data needed; no cross-tenant context, ever.
- [ ] Per-tenant usage quotas and rate limits; provider keys live server-side in the FastAPI service only.
- [ ] Pharmacy: no dosage or drug-interaction advice in v1.

## Privacy & legal (Phase 12)
- [ ] Privacy policy + terms pages; minimum personal data collected.
- [ ] Owner-triggered data export (CSV/Excel) and a tested restore.
- [ ] Customer phone numbers handled as sensitive; documented retention and deletion policy.
- [ ] Legal review of Bangladeshi data-protection obligations (founder action item, flagged).

## Backups
- [ ] Supabase automated backups understood and documented; one restore rehearsed before launch.
- [ ] Owner export includes products, customers, sales, payments, ledger and stock movements.
