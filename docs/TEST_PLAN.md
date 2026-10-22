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
| POS sales | SQL (scripted) | fractional quantities, percent discount, credit + ledger, cashier price/discount limits, receipt view vs cost table, void restores stock and due | ✅ `70_pos.sql` — 17 assertions |
| Sync support | SQL (scripted) | monotonic `updated_at`, soft deletes, audit of overwrites, append-only telemetry | ✅ `40_sync_and_audit.sql` — 11 assertions |
| End-to-end | Playwright | onboarding → sale → due → collect → dashboard; offline sale then reconnect | Phase 6–9 (Playwright cannot run in this environment) |

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

## Phase 5 specific (POS)

Automated:

- [x] `npm test` — 26 files, 306 tests, including `features/pos/cart.test.ts`
      (fractional quantities, rounding, discounts, change, credit, payload shape),
      `features/pos/api.test.ts` (RPC payload, error codes, receipt parsing) and
      `features/pos/pages/SellPage.test.tsx` (empty state, add, quantity step,
      payment sheet, credit needs a customer, price field for an owner).
- [x] `supabase/tests/70_pos.sql` — 1.5 kg totals 112.50 and leaves 18.5 in stock;
      10% discount; credit writes the due to the ledger; a cashier cannot sell
      below cost or discount when the shop forbids it; a cashier reads the receipt
      view but no rows of `sale_items`; void restores stock, clears the due and
      keeps the sale row.
- [x] `0013` regression: an owner can change shop settings, and the change lands in
      `audit_logs`.
- [x] `npm run typecheck`, `npm run lint`, `npm run build` (5 vendor chunks, no size
      warning).

Manual (needs the Supabase project from `.env`):

1. Sign in as owner → **বিক্রি**. The product grid shows name, price and stock.
2. Tap a product twice: one line, quantity 2, total updates.
3. Tap the quantity → the line sheet opens: presets (০.৫ / ১ / ২ …), type `1.5`,
   change the price, done. The line total follows.
4. Press **হিসাব** (mobile tab) → **বিক্রি নিশ্চিত করুন** → the sheet shows the total.
5. Type `500` in **হাতে নেওয়া টাকা** on a 470 bill → **ফেরত দিন** shows 30 and
   confirming records paid = 470, change = 30.
6. Switch **বাকিতে বিক্রি** on: the confirm button disables until a customer is
   chosen. Pick one, or add "রহিম ভাই / 01712345678" from the sheet.
7. Confirm → success screen with total, paid, change (or due), invoice number and
   **ফেরান** counting down from 10.
8. Tap **ফেরান** within 10 seconds → the receipt opens, marked cancelled, stock is
   back and the customer's due is gone.
9. Open **রসিদ** from the success screen: the receipt reads from the database, so a
   reload or a different device shows the same thing.
10. Sign in as cashier: the price field is replaced by an explanation, no undo
    button appears after a sale, and a below-cost price is refused with a Bangla
    message.
11. Turn off "cashier may discount" in the shop settings (SQL for now), then try a
    discount as a cashier → refused with **এই দোকানে ছাড় দেওয়ার অনুমতি আপনার নেই**.
12. Enter a barcode in the search box and press Enter: the product is added and the
    box clears, ready for the next scan.

## Phase 6 specific (due ledger & customers)

Automated:

- [x] `npm test` — 29 files, 341 tests, including `features/customers/api.test.ts`
      (bigint strings, omitted optional args, error-code mapping, soft delete,
      idempotent collection, reversal), `features/customers/schema.test.ts`
      (name-only customer, four ways to write a phone, taka → paisa) and
      `features/customers/components/CustomerListScreen.test.tsx` (total, debtor
      rows, collect button only when money is owed, pre-filled full due, undo
      calls `void_payment`, skeletons, retry on failure).
- [x] `supabase/tests/80_customers.sql` — a sale minus a collection is the due;
      voiding the sale removes the due; the debtor view hides settled customers;
      the biggest debtor sorts first; a phone typed without `+880` still matches;
      Bangla name search; `due_summary` totals, debtor count and customer count;
      the khata shows the collection newest-first with the running balance;
      page 2 of the ledger keeps the right `balance_after_paisa`; a cashier can
      read dues and a non-member cannot (both RPCs); undo of a collection restores
      the due and leaves the payment row marked voided; a second undo reports
      `already_voided`; a cashier cannot reverse someone else's payment; a payment
      amount can never be edited; a deleted customer leaves the list but the khata
      stays readable.
- [x] `supabase/tests/90_schema_guards.sql` — `payments` keeps a guard trigger
      (`payments_guard_update`) even though it is no longer the plain
      `no_update_delete` one.
- [x] `npm run typecheck`, `npm run lint`, `npm run build`.

Manual (needs the Supabase project from `.env`):

1. Sign in as owner → **বাকি**. The total owed and the debtor count match what the
   বিক্রি screen produced; the biggest debt is at the top.
2. Type the first four digits of a phone number: the customer appears even though
   the stored number starts with `+880`.
3. Tap **আদায়** on a row: the sheet opens with the whole due already filled in.
4. Take half instead: tap **অর্ধেক** → **টাকা পেয়েছি**. The row's due drops, the
   total at the top drops, and the undo bar appears.
5. Tap **ভুল হয়েছে? ফেরান** within ten seconds: the due comes back and the khata
   shows two lines — "বাকি আদায়" and its reversal.
6. Open the customer (tap the name): the khata lists every entry newest first with
   the balance after each one, and sale lines link to their receipt.
7. Set a credit limit of ৳৫০০ on a customer who owes ৳৬০০: the khata shows
   **বাকির সীমা ছাড়িয়ে গেছে**.
8. Delete that customer as the owner: they disappear from the list, the khata is
   still readable from a direct link, and it says the customer was deleted.
9. Sign in as a cashier: **কাস্টমার** is searchable, **আদায়** works, the edit and
   delete icons are gone, and a second undo attempt after the window shows a
   Bangla refusal rather than a Postgres message.
10. Add a customer with only a name — it saves. Add another with the same phone
    number — the form explains the duplicate instead of failing silently.
