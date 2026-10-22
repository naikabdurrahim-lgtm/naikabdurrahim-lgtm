# Test plan

## Automated (run in CI on every push)

| Layer | Tool | Scope | Status |
|---|---|---|---|
| Money & quantity math | Vitest | parse/format/sum/discount/line totals/profit | ✅ 21 tests (Phase 1) |
| UI components | Vitest + Testing Library | MoneyText numerals, BigActionButton targets | Phase 4 |
| Permissions | Vitest | `can(user, action)` matrix | Phase 3 |
| Sync outbox | Vitest | retry/backoff, idempotent ids, conflict policy | Phase 9 |
| Database rules | SQL (scripted) | CHECK constraints, append-only guards, stock/due derivation, idempotency, void/reversal | ✅ `30_integrity.sql` — 37 assertions |
| RLS | SQL (scripted) | cross-tenant read/write must fail; role restrictions | ✅ `10_rls_isolation.sql` (23) + `20_role_permissions.sql` (29) |
| Schema guards | SQL (scripted) | RLS on every table, tenant_id present, pinned search_path, integer money, no anon RPC access | ✅ `90_schema_guards.sql` — 9 assertions |
| Sync support | SQL (scripted) | monotonic `updated_at`, soft deletes, audit of overwrites, append-only telemetry | ✅ `40_sync_and_audit.sql` — 11 assertions |
| End-to-end | Playwright | onboarding → sale → due → collect → dashboard; offline sale then reconnect | Phase 5–9 |

## Manual (each phase)

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — all clean.
2. Load the app at 360 px, 768 px and 1280 px width; check no horizontal scrolling.
3. Keyboard: Tab through the page, focus ring visible on every interactive element.
4. Toggle every setting (theme, accent, text size, numerals, language, mode); reload and confirm persistence.
5. Screen reader smoke test (NVDA or TalkBack): header, nav and primary action must be announced with meaningful labels.
6. Low-end Android device: cold start < 3 s on 3G, no blank screen (skeleton or content always visible).
7. Real shopkeeper usability test with 3+ people before launch (Phase 12).

## Phase 1 specific

- [ ] `http://localhost:5173/` renders the shell with no console errors.
- [ ] `/health` reports database status and the setup steps when `.env` is missing.
- [ ] Language switch changes all visible text and persists after reload; `<html lang>` updates.
- [ ] Accent switch recolours primary buttons immediately; all five accents are distinguishable.
- [ ] Text size ×3 changes the whole type scale, not just headings.
- [ ] Bangla numerals toggle changes `৳12.50` to `৳১২.৫০` in the settings preview.
- [ ] Dark/light switch keeps contrast readable in both modes.
- [ ] Simple mode shows 4 big buttons; Pro mode shows dashboard tiles and quick links.
- [ ] Bottom navigation is reachable with the thumb on a 360 px screen.
- [ ] `/unknown-path` shows the friendly not-found page.

## Phase 2 specific (database)

Run: `npm run db:test` (needs a local PostgreSQL 15+; see `scripts/setup-db.md`).

Expected output:

```
==> migrations          0001 … 0010   ok (each)
==> test suites
    10_rls_isolation.sql              PASS
    20_role_permissions.sql           PASS
    30_integrity.sql                  PASS
    40_sync_and_audit.sql             PASS
    90_schema_guards.sql              PASS
==> RESULT: all suites passed
```

What each suite proves, in plain language:

1. **10_rls_isolation** — a shop owner cannot see, change or delete another shop's
   products, customers, sales, staff or audit log, even by guessing the id. Views
   do not leak either.
2. **20_role_permissions** — a cashier can sell and collect dues but cannot change
   prices, delete products, move stock, read cost prices or profit, rename the shop
   or add staff. An owner cannot demote the last owner.
3. **30_integrity** — money and stock add up: opening stock, cash sale, credit sale,
   collection, void, day summary. Duplicate offline pushes do not duplicate sales.
   Overselling, overpaying, discounting beyond the total and credit-without-customer
   are all refused. History cannot be edited or deleted.
4. **40_sync_and_audit** — `updated_at` always moves forward (a sync cursor cannot
   skip a row), deletes are soft, price changes are audited with before/after values.
5. **90_schema_guards** — every table has RLS, every business table has `tenant_id`,
   every `security definer` function pins `search_path`, money columns are integers,
   and anonymous users cannot call any write RPC.
