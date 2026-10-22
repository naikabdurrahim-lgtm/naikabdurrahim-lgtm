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

## Authentication (Phase 3)
- [ ] Phone + 6-digit PIN via synthetic email; PIN never stored client-side.
- [ ] Server-side rate limit and lockout (5 failures → 15-minute lock, exponential).
- [ ] Reject weak PINs (sequential, repeated, 123456, 000000, birth-year patterns).
- [ ] Optional upgrade to a real password; recovery flow documented and approved.
- [ ] Tokens stored in memory + secure storage on Android; no tokens in `localStorage` where avoidable.

## Input validation (Phase 2+)
- [ ] Zod on the client for UX, CHECK constraints + RPC validation in Postgres for truth.
- [ ] Numeric bounds: prices ≥ 0, discount ≤ subtotal, quantity > 0, `text` length caps.
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
