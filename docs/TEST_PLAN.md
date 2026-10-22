# Test plan

## Automated (run in CI on every push)

| Layer | Tool | Scope | Status |
|---|---|---|---|
| Money & quantity math | Vitest | parse/format/sum/discount/line totals/profit | ✅ 21 tests (Phase 1) |
| UI components | Vitest + Testing Library | MoneyText numerals, BigActionButton targets, PIN entry, products list states, onboarding order | ✅ Phase 3–4 |
| Permissions | Vitest | `can(user, action)` matrix | ✅ Phase 3 |
| Sync outbox | Vitest | retry/backoff, idempotent ids, conflict policy | Phase 9 |
| Database rules | SQL (scripted) | CHECK constraints, append-only guards, stock/due derivation, idempotency, void/reversal | ✅ `30_integrity.sql` — 37 assertions |
| RLS | SQL (scripted) | cross-tenant read/write must fail; role restrictions | ✅ `10_rls_isolation.sql` (23) + `20_role_permissions.sql` (29) |
| Schema guards | SQL (scripted) | RLS on every table, tenant_id present, pinned search_path, integer money, no anon RPC access | ✅ `90_schema_guards.sql` — 9 assertions |
| Catalogue access | SQL (scripted) | cost column unreadable by any client role, cost masked in the RPC, Bangla/English/barcode search, paging, low-stock filter, category counts | ✅ `60_catalog.sql` — 35 assertions |
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

## Phase 3 specific (auth, onboarding, packs)

### Automated

```bash
npm test          # 20 files, 230 tests
npm run lint
npm run typecheck
npm run build
npm run db:test   # 6 SQL suites, including 50_auth_hardening.sql
```

Unit tests added in Phase 3:

- `phone.test.ts` — every way a Bangladeshi number is typed (017…, 8801…, +8801…,
  Bangla digits, spaces/dashes), rejection of 012 and short numbers, synthetic email
  round-trip, salted hash stable per phone and different across phones.
- `pin.test.ts` — accepted PINs, every rejection reason (empty, letters, length,
  all-same, ascending/descending, leaked list, repeated block, birth year, digits
  from the owner's own phone), strength bands, confirmation.
- `recoveryCode.test.ts` — shape `ABCD-EFGH-JKLM`, 32-symbol alphabet (no I/O/0/1),
  500 draws are unique, tolerant formatting, canonical form for hashing.
- `authErrors.test.ts` — every failure code has a Bangla and an English sentence,
  Supabase messages map correctly, technical detail never reaches the screen.
- `permissions.test.ts` — the role matrix matches the RLS policies, cashier never
  gets cost/profit/void/staff, unknown role gets nothing.
- `packs.test.ts` — six packs, unique ids, Bangla labels, starter products have a
  real category, integer paisa, sell ≥ buy, services have no stock, no duplicates.
- `navigation.test.ts` — role-filtered nav; a cashier never sees reports.
- `guards.test.tsx` — RequireAuth (loader / redirect / pass / setup notice),
  RequireShop (onboarding redirect), RequireRole (cashier sent home).
- `SignInPage.test.tsx` — button gating, E.164 submit, Bangla error + PIN cleared,
  lockout banner + disabled PIN, attempts warning, links.
- `SignUpPage.test.tsx` — weak-PIN reason shown, mismatch blocked, recovery code
  shown once and stored, continue disabled until acknowledged, duplicate phone.
- `OnboardingPage.test.tsx` — four steps, nothing written until the last button,
  select-all/clear, back preserves input, error message, no duplicate shop when
  only the starter products fail.
- `api.test.ts` — `create_tenant` args, category mapping, opening stock as a
  movement, restaurant gets no stock, movement failure is non-fatal.
- `PinInput.test.tsx` — six 56px boxes, one-digit-at-a-time entry, paste, letters
  ignored, Backspace behaviour, invalid state exposed via `aria-invalid`.
- `uiKeys.test.ts` — every `t('…')` key in the source exists in bn and en.

### Manual (the parts jsdom cannot see)

1. `npm run dev`, open the printed URL.
2. Without `.env`: the setup notice explains what is missing, with a link to
   Settings. No white screen.
3. With a Supabase project and `0011` pushed: `/sign-up` → name, phone, PIN
   `482915`, confirm → the recovery code appears once, **Continue is disabled
   until the checkbox is ticked** → onboarding.
4. Onboarding: choose মুদি দোকান → shop name → starter products (all preselected,
   clear-all works) → simple/pro mode, Bangla/English numerals, language →
   "দোকান তৈরি করুন". You land on the dashboard with the shop name in the header.
5. Sign out, sign in with the same phone and PIN. A wrong PIN shows a Bangla
   sentence, clears the six boxes and keeps the phone number.
6. Five wrong PINs in a row → the lockout banner with a live countdown; the PIN
   boxes are disabled. (Wait out 15 minutes, or clear `auth_attempts` in the
   Supabase SQL editor on a test project.)
7. `/reports` as a cashier: the tab is hidden, and the URL redirects home.
8. Rotate the phone to 360 px: all primary buttons stay ≥ 48 px, the bottom bar
   shows five slots in Simple Mode.

## Phase 4 specific (products & categories)

Automated:

- [x] `npm test` — 22 files, 259 tests, including `features/products/schema.test.ts`
      (validation, paisa/thousandths conversion, stock warnings) and
      `features/products/pages/ProductsPage.test.tsx` (skeleton, error, empty,
      low-stock chip, debounced search).
- [x] `supabase/tests/60_catalog.sql` — the cost column is unreadable by cashier,
      manager **and** owner; the RPC masks cost for a cashier; search finds Bangla,
      English and a barcode prefix; paging does not overlap; a soft-deleted category
      leaves the product; the low-stock filter excludes services.
- [x] `npm run typecheck`, `npm run lint --max-warnings=0`, `npm run build`.

Manual (needs the Supabase project from `.env`):

1. Sign in as the owner, open **পণ্য**.
2. The list shows skeletons for a moment, then rows with price and stock state —
   never a blank screen. Pull-to-refresh is not needed; a reload refetches.
3. Type `চাল` in the search box: the list narrows after ~250 ms and the empty-state
   copy changes to "no match" if nothing is found.
4. Tap **কম স্টক**: only products at or below their alert level appear; a service
   product never does.
5. Tap **পণ্য যোগ করুন**, fill name + price only, tap **সংরক্ষণ** → back on the list,
   the new product is at the top with a Bangla toast.
6. Add a second product with **আরেকটি যোগ করুন**: the unit and "service" flag are
   kept, the name and price are empty, and the cursor is in the name field.
7. Open a product, change the price, save → the list shows the new price immediately
   (the query cache is invalidated).
8. Delete a product, then tap **ফিরিয়ে আনুন** within 10 seconds → it comes back.
   Wait 10 seconds and delete again → it stays gone (but is only soft-deleted).
9. Open **ক্যাটাগরি**, add "মাছ", rename it, then delete it → products in it stay,
   uncategorised.
10. Sign in as a cashier: **পণ্য** still opens and prices are visible, but the form is
    refused by the database and the screen says **অনুমতি নেই** — no raw Postgres text.
11. Barcode: type `8901234` into search → the product with that barcode prefix appears
    (Phase 5 adds the camera scanner).
12. Check both languages and Simple/Pro mode: no string is missing, all amounts switch
    to Bangla numerals when the toggle is on.
