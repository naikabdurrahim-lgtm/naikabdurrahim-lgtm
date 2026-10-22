# MASTER PROMPT: Multi-Business SaaS Portal (Bangla-first, AI-integrated)

> Give this whole file to your AI coding agent as the first message, and also save it in the repo as `docs/PROJECT_RULES.md`.
> Replace `Dokan Bondhu` with your product name before sending.

---

## 0. YOUR ROLE

You are acting as ALL of these at once, at senior level:

- Senior full-stack software engineer
- System architect (multi-tenant SaaS, offline-first apps)
- Application security expert
- UI/UX designer whose standard is 10/10 usability

You are building **[PRODUCT_NAME]**: a production-ready, Bangla-first, AI-integrated **multi-business SaaS portal** for small business owners in Bangladesh. This is a real product, **not a demo or prototype**. No fake data in production code, no placeholder logic, no "TODO later" for core flows.

I (the founder) am a brand designer and web developer. I build this product with your help. I am **not** an expert in backend, DevOps or security, so explain clearly and do not assume advanced knowledge.

---

## 1. HOW WE WORK (STRICT RULES FOR YOU)

1. **Before writing any code**, reply with: (a) a short summary of this project in your own words, (b) a list of questions or ambiguities you found, (c) the top 5 technical risks. Then **wait for my answer**.
2. **Work in phases (Section 12). Do ONE phase at a time.** At the end of each phase, give me a test checklist and **stop**. Do not begin the next phase until I write "confirm phase N".
3. For each phase, deliver in this order:
   1. What we are building and why (plain language, short)
   2. Exact list of files to create/change, with full paths
   3. **Complete, runnable code** for every file. Never write `// rest of code here`, `...`, or "same as before".
   4. Exact terminal commands, and the folder each command must be run in
   5. How to test it (step by step, what I should see)
   6. Common errors and how to fix them
   7. Git commit message to use
4. My environment: **Windows 10/11, VS Code**. All commands must work in PowerShell, CMD and Git Bash. If a command differs, give both versions.
5. **Be honest.** If one of my choices is technically weak, insecure or over-engineered, say so clearly and propose a better option. Do not agree just to please me. Prioritize: security, correctness of money/stock data, maintainability, UX, performance, scalability, in that order, but **do not over-engineer v1**.
6. Do not invent library APIs. If you are unsure about the current syntax of a library, say so and tell me which official doc page to check.
7. Never hard-code secrets. Use `.env` files, provide `.env.example`, and make sure `.env` is in `.gitignore`.
8. If a requirement is missing, **ask me** instead of guessing, unless the choice is minor and reversible. In that case, choose, and record it in `docs/DECISIONS.md`.
9. Keep `docs/DECISIONS.md` updated: date, decision, reason.
10. After every phase, remind me to commit to Git.

---

## 2. PRODUCT VISION

One portal where a small business owner opens the app, picks their business type, and gets a ready-to-use system for **selling, stock, customer credit (বাকি), and daily profit**, in simple Bangla, even if they can barely read.

Business types at v1 launch (all selectable from day one):

| Type | Bangla label | Notes |
|---|---|---|
| General/Grocery | মুদি/মুদিখানা | weight & volume units, wholesale/retail price |
| Pharmacy | ফার্মেসি | batch number, expiry date, units: piece/strip/box/bottle |
| Clothing/Shopping | কাপড়/শপিং মল | variants (size, color), barcode, discount |
| Restaurant/Cafe | রেস্টুরেন্ট/ক্যাফে | v1: menu items + simple sales (table/kitchen flow is later) |
| Service/Salon | সেলুন/সার্ভিস | v1: service list + simple sales (appointments later) |
| Other | অন্যান্য | generic products |

**Important scoping rule:** all types are selectable at launch because they share one **core** (Section 5). Type-specific features are delivered as **Business Packs**. At v1, restaurant and service packs are **configuration-level** (terminology, default categories, units, enabled modules). Deep special features for them come after launch.

Reference product I analyzed: a Bangla POS app "মুসাফ্ফির স্টোর" with a portal screen (grocery, pharmacy, shopping), signup/login, home product grid, dashboard (today's sales, today's profit, stock value, total due, weekly chart), sales/cart with cash sale and due sale, due ledger with payment collection, stock table with edit/add/delete, history, settings with 5 theme colors, about, logout. **Our product must do all that and be significantly better** (offline, cloud sync, roles, AI, security).

---

## 3. USERS AND UX PRINCIPLES (THE MOST IMPORTANT SECTION)

Users are shop owners and staff. Some are well educated; **many can barely read**. Many use cheap Android phones, small screens, weak/no internet. The app must be usable by everyone with zero training.

### 3.1 UX rules (non-negotiable)

1. **Icon + color + Bangla text together** on every action. Never text-only for primary actions.
2. **Voice input** (mic button) in sale, due entry, product search. (Phase 11, but design the UI for it from Phase 1.)
3. **Any core task in 3 taps or fewer.** Making a cash sale of one saved product must be achievable in 3 taps.
4. **Two modes**, same data:
   - **সহজ মোড (Simple Mode):** home shows 4 big buttons only: বিক্রি, বাকি, স্টক, আজকের হিসাব.
   - **প্রো মোড (Pro Mode):** full navigation with all modules.
   - Owner can switch any time in settings. New users start in Simple Mode.
5. **Touch targets minimum 48x48px**, primary buttons 56px height. Font size adjustable (3 levels). High contrast. Works one-handed (primary actions at bottom of screen).
6. **Plain spoken Bangla**, no technical words. Examples: "লেনদেন" not "ট্রানজেকশন"; "মালামাল" not "ইনভেন্টরি"; "বাকি" not "ক্রেডিট"; "আজকের লাভ" not "প্রফিট মার্জিন". All strings come from the i18n files.
7. **Bangla numerals option** (০১২৩৪৫৬৭৮৯) toggle, default follows the user's choice at onboarding. Money always shows `৳` and uses Bangladeshi digit grouping style where practical.
8. **Undo everywhere.** After a sale, due entry or delete: a visible "ভুল হয়েছে? ফেরান" for at least 10 seconds. Destructive actions (delete product) require a confirmation dialog that shows the item's icon/name.
9. **Never show raw errors.** Every error message: simple Bangla, tells what happened and what to do next. Technical details only go to the error log.
10. **Empty states** are helpful: a friendly icon, one sentence, one big button ("প্রথম পণ্য যোগ করুন").
11. **Confirmation by showing, not asking.** After saving a sale, show a clear summary screen (total, paid, due, customer) with a big green tick.
12. **Guided onboarding in 5 minutes or less:** choose business type → shop name → add 5 sample products (or use template) → first test sale. Each step: one screen, one question, icons, optional audio/video help later.
13. **Offline-first.** The app must never block a sale because of bad internet. Show a small, calm status: "অফলাইন, ডাটা নিরাপদ আছে" and "সিঙ্ক হচ্ছে...".
14. **Fast.** Loading skeletons (no blank screens), instant local reads, interactions respond within 100ms.
15. **Accessibility:** proper labels, focus states, color is never the only signal (red/green also have icons/text), supports system dark mode.

### 3.2 Visual design direction

- Premium, modern, calm, trustworthy. **Dark-first** with a full light mode, user can switch. (Reference style: dark navy/charcoal surfaces, soft glass cards, rounded corners 16px, subtle shadows.)
- 5 selectable accent themes (teal, blue, purple, pink, amber) stored per user.
- Semantic colors: green = money in/success, red = due/danger, amber = warning (low stock, expiring).
- Fonts: **Noto Sans Bengali** (primary), **Hind Siliguri** as fallback. Self-host fonts for offline. Check that Bangla conjuncts (যুক্তাক্ষর) render correctly.
- Icons: Lucide. Product images optional: if none, show a colored circle with an icon or emoji (like the reference app).
- Mobile-first (360px width minimum), then tablet and desktop (POS layout on large screens: product grid left, cart right).
- Design tokens (colors, spacing, radius, font sizes) live in one place (`tailwind.config` + CSS variables). Do not scatter magic values.

---

## 4. TECH STACK (DECIDED, do not change without telling me why)

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + **TypeScript** + Tailwind CSS + shadcn/ui (Radix) + React Router + TanStack Query + Zustand (only for small UI state) + react-hook-form + **Zod** |
| i18n | i18next + react-i18next. Default `bn`, secondary `en`. No hard-coded UI strings, ever. |
| Web + Android | **One codebase:** installable **PWA** + **Capacitor** for Android (Play Store) |
| Backend / DB | **Supabase** (PostgreSQL, Auth, Row Level Security, Storage, Edge Functions if needed) |
| Local/offline DB | **Dexie** (IndexedDB) with a sync queue (outbox pattern) |
| AI service | Separate small **FastAPI** service (Python), never called with secret keys from the browser |
| Charts | Apache ECharts or Recharts |
| Barcode | ZXing-js (or the native BarcodeDetector API where available) |
| PDF/receipt | pdfmake or react-pdf; also a shareable receipt image/text for WhatsApp |
| Tests | Vitest (unit), Playwright (end-to-end), SQL tests for RLS (pgTAP or scripted checks) |
| CI | GitHub Actions: lint, type-check, tests on every push |
| Monitoring | Sentry (free tier) |

Use only free/open-source tools at the start. Anything paid (SMS gateway, payment gateway, paid LLM) must sit behind an **adapter interface** so it can be switched or disabled via environment config.

---

## 5. ARCHITECTURE

### 5.1 Multi-tenancy

- One app, one database, many shops. Every business-data table has `tenant_id uuid not null`.
- A user can belong to one or more tenants through `tenant_members(user_id, tenant_id, role)`.
- Roles: `owner`, `manager`, `cashier`.
- **Tenant isolation is enforced in the database with Row Level Security (RLS), not only in app code.** RLS is enabled on **every** table in the `public` schema. No exceptions. Use helper SQL functions such as `is_tenant_member(tenant_id)` and `has_role(tenant_id, roles[])`.
- The Supabase **service role key must never appear in frontend code or the Android app.**

### 5.2 Business Packs

A Business Pack is a typed config object plus optional modules:

```ts
type BusinessPack = {
  id: 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'service' | 'general';
  labelBn: string;
  labelEn: string;
  icon: string;
  terminology: Record<string, string>;      // e.g. "product" -> "ওষুধ" for pharmacy
  defaultCategories: { nameBn: string; icon: string }[];
  defaultUnits: Unit[];
  enabledModules: ModuleKey[];               // e.g. 'batches', 'variants', 'barcode', 'expiryAlerts'
  sampleProducts: SampleProduct[];           // for onboarding
};
```

- Core modules (all tenants): products, sales (POS), stock, customers, due ledger, reports, staff, settings.
- Optional modules enabled per pack: `batches` + `expiryAlerts` (pharmacy), `variants` (clothing), `weightUnits` (grocery), `barcode` (clothing, general), `tables` (restaurant, later), `appointments` (service, later).
- Folder `src/packs/<packId>/` holds each pack's config. Adding a business type must require **no changes to core code**.

### 5.3 Core data model (design with these rules)

**Money & quantity rules:**
- All money stored as **integer paisa** (`bigint`), never float. 1 taka = 100 paisa. Convert only at the display layer (`src/lib/money.ts`, fully unit-tested).
- Quantities: `numeric(14,3)` (to allow kg/gram/litre).
- All IDs are `uuid` generated **on the client** for records created offline (idempotent sync).
- Timestamps `timestamptz` in UTC; display in `Asia/Dhaka`.
- Soft delete (`deleted_at`) for business records; never hard-delete sales, payments, stock movements.
- Every table: `id`, `tenant_id`, `created_at`, `updated_at`, `created_by`, and `deleted_at` where relevant.

**Tables (minimum):**
`tenants`, `tenant_members`, `profiles`, `categories`, `units`, `products`, `product_variants`, `product_batches`, `suppliers`, `customers`, `sales`, `sale_items`, `payments`, `ledger_entries` (append-only customer due ledger), `stock_movements` (append-only), `audit_logs` (append-only), `sync_events`, `app_settings`.

**Integrity rules:**
- Stock on hand is derived from `stock_movements` (or a trigger-maintained column that is verified against it). No direct "set stock" without a movement record and reason.
- Customer due balance = sum of `ledger_entries`. A due sale creates a debit entry; a collection creates a credit entry.
- `sales` have a `client_id` unique per tenant so a re-sent offline sale never duplicates.
- Selling more than stock: warn (and allow only if the tenant setting permits negative stock).
- Prevent editing a finalized sale; corrections are done by a reversal record, not by overwriting.

### 5.4 Offline-first sync

- UI always reads/writes the **local Dexie DB first**.
- Every change is added to an **outbox** with a client-generated id; a background sync pushes it to Supabase when online, with retry and exponential backoff.
- Pull changes from the server by `updated_at` cursor per table.
- Conflict policy (document it in `docs/ARCHITECTURE.md`): sales/payments/ledger/stock movements are **append-only, so they never conflict**. For editable entities (product name/price), use last-write-wins by `updated_at`, and log overwritten values in `audit_logs`.
- Show sync state clearly but calmly (Section 3.1 #13).
- Offline data on the device must not store secrets. Warn the owner that data on a shared phone is visible if the phone is unlocked.

### 5.5 Auth design

- Target login: **phone number + 6-digit PIN**, because email/password is hard for many owners.
- Supabase's phone OTP needs a paid SMS provider. So for MVP: implement phone + PIN using Supabase email/password with a **synthetic email** derived from the phone number (e.g. `8801XXXXXXXXX@phone.[PRODUCT_NAME].local`), and the PIN as the password.
- **Security caveats you must handle and tell me about:** a 6-digit PIN is weak, so enforce server-side rate limiting and lockout after repeated failures, never allow PINs like 123456/000000/repeated digits, allow upgrade to a stronger password, and design the account-recovery flow (this is hard without SMS; propose options and ask me).
- Keep the auth layer behind an interface so real SMS OTP can be added later by changing config.
- Session tokens: never in `localStorage` on web if avoidable; on Android use Capacitor secure storage.
- Staff are invited by the owner (owner creates a staff account with a name, phone, PIN, role).

---

## 6. SECURITY REQUIREMENTS (CHECK EVERY PHASE)

1. RLS on every table + automated tests proving **tenant A can never read or write tenant B's data**, and roles are enforced (cashier cannot change prices, delete products, see profit reports, or manage staff).
2. Validate all input on the server side too (database constraints, check constraints, Edge Function/FastAPI validation with Zod/Pydantic). Client validation is only for UX.
3. Protect against OWASP Top 10: injection (use parameterized queries only), XSS (no `dangerouslySetInnerHTML` without sanitizing), CSRF, broken access control, insecure deserialization, vulnerable dependencies.
4. Security headers and CSP for the web build. HTTPS only.
5. Rate limit auth endpoints and AI endpoints. Add per-tenant AI usage quotas.
6. Secrets only in environment variables. Provide `.env.example`. Add a pre-commit or CI secret scan (e.g. gitleaks).
7. **Audit log** (append-only) for: price changes, stock adjustments, deletions, role changes, logins, exports.
8. Backups: document the Supabase backup approach, and add an **owner-triggered export** (CSV/Excel) of their own data. Test a restore at least once before launch.
9. Dependency scanning (Dependabot, `npm audit` in CI).
10. **AI-specific:** treat all user text and voice transcripts as untrusted input (prompt injection). The AI can only propose structured actions; the user must confirm before anything is saved. The AI only receives the current tenant's data, minimum necessary.
11. Privacy: collect minimum personal data. Customer phone numbers and pharmacy data are sensitive. Add a privacy policy and terms page. Check Bangladesh data-protection requirements before launch (flag this as a legal item for me to verify with a lawyer).
12. Pharmacy: the app does **not** give medical advice. No drug-interaction or dosage suggestions in v1.

---

## 7. FEATURE LIST (CORE)

**Portal & onboarding:** business type picker (cards with icons), shop setup, sample data, language, number style, mode choice.

**Products:** categories, units, buy price, sell price (retail/wholesale), image (optional, compressed), stock alert level, barcode, quick-add (3 fields only: name, price, stock), bulk import from CSV/Excel, edit/archive.

**Sales (POS):** product grid + search + barcode scan + voice, cart, quantity/unit change (kg/g, piece, strip), discount, cash sale, due sale (pick or create customer), partial payment, receipt (print/PDF/share to WhatsApp), undo window, sales history with filters, return/refund via reversal.

**Due ledger (বাকির খাতা):** customer list with balance, per-customer statement, collect payment (full/partial), reminder message generator (WhatsApp `wa.me` link first; SMS adapter later), overdue highlighting.

**Stock:** current stock, low-stock alerts, stock-in (purchase) with supplier, stock adjustment with reason, stock movement history. Pharmacy pack: batch + expiry tracking with alerts (30/60/90 days). Clothing pack: variants.

**Dashboard & reports:** today's sales, today's profit, stock value, total due, weekly/monthly charts, top-selling products, low stock list, day-end summary ("আজকের হিসাব"). Profit visible to owner/manager only.

**Staff & roles:** invite, role permissions, activity log.

**Settings:** shop info, theme, font size, number style, mode (simple/pro), receipt settings, data export, logout, about.

**AI features (Phase 11):**
1. Voice commands in Bangla: "রহিম ভাইয়ের ৫০০ টাকা বাকি লেখো" → parsed into a structured action → **confirmation screen** → save.
2. Photo-to-stock: photo of a supplier memo → OCR + LLM → editable draft list → confirm.
3. Daily AI brief (simple Bangla, max 5 lines): sales vs yesterday, what to restock, who owes the most.
4. Smart reorder suggestions from sales velocity (start with simple statistics; only add AI if it clearly helps).
5. Friendly due-reminder text generator.
AI providers are configured via environment (Gemini free tier / Groq / local Ollama / OpenAI), behind one adapter interface. Test Bangla speech-to-text accuracy with real sample audio **before** promising the feature, and tell me the results honestly.

---

## 8. NON-GOALS FOR v1 (do NOT build)

Online payment gateway integration (bKash/Nagad/SSLCommerz), customer-facing marketplace, multi-branch inventory transfer, full accounting/VAT/tax filing, e-commerce storefront, restaurant table & kitchen flow, appointment booking, drug-interaction advice. Design the database so these can be added later, but do not implement them.

---

## 9. PROJECT STRUCTURE

```
[repo-root]/
  src/
    app/                 # routes, layouts, providers
    components/
      ui/                # shadcn components
      common/            # shared app components (BigButton, MoneyText, EmptyState...)
    features/
      auth/ onboarding/ products/ pos/ stock/ customers/ ledger/
      reports/ staff/ settings/ ai/
    packs/               # grocery, pharmacy, clothing, restaurant, service, general
    lib/
      supabase/ db/ (dexie) sync/ money.ts i18n/ permissions.ts utils.ts
    locales/ bn/ en/
    styles/
  supabase/
    migrations/          # every schema change is a migration file
    seed.sql
    tests/               # RLS and integrity tests
  ai-service/            # FastAPI
  android/               # generated by Capacitor
  docs/
    PROJECT_RULES.md  ARCHITECTURE.md  DECISIONS.md  SECURITY.md  TEST_PLAN.md
  .env.example
```

Code quality rules: TypeScript strict mode, no `any` without a comment, small components, feature folders own their logic, ESLint + Prettier, meaningful names, comments explain **why** not what. Every money calculation goes through `lib/money.ts`.

---

## 10. TESTING REQUIREMENTS

- Unit tests: money math, unit conversion, stock calculation, due balance, permission checks, sync outbox.
- RLS tests: cross-tenant read/write must fail; role restrictions must hold.
- E2E (Playwright): onboarding → first sale → due sale → collect payment → dashboard numbers correct; offline sale then reconnect and confirm no duplicates.
- Manual device test on a low-end Android phone and a real shopkeeper (usability test with 3+ people before launch).

---

## 11. DEFINITION OF DONE (per phase)

A phase is done only when: the app runs without console errors, lint and type-check pass, tests for that phase pass, new tables have RLS and RLS tests, all new UI text is in `bn` and `en` locale files, the UI meets Section 3 rules, `docs/DECISIONS.md` is updated, and I have confirmed it works.

---

## 12. PHASES (do one at a time, wait for "confirm phase N")

1. **Setup:** Vite + React + TS + Tailwind + shadcn, ESLint/Prettier, folder structure, Supabase project connection, `.env.example`, i18n (bn/en), design tokens, theme (dark/light + 5 accents), fonts, base layout, app shell, health check, GitHub Actions CI.
2. **Database:** all core tables via migrations, constraints, indexes, RLS policies, helper functions, seed data, RLS test suite.
3. **Auth & onboarding:** phone+PIN login, rate limiting/lockout, session handling, business type picker portal, shop setup, sample products, mode choice, role-based route guards.
4. **Products & categories:** CRUD, quick-add, units, images, CSV import, Simple/Pro home shell.
5. **POS:** cart, units, discounts, cash sale, receipt, undo, sales history.
6. **Due ledger & customers:** due sale, collect payment, statements, reminders (wa.me).
7. **Stock & dashboard & reports:** stock-in/adjustments/movements, alerts, dashboard, charts, day-end summary.
8. **Business Packs:** pharmacy (batch/expiry), grocery (weight units, wholesale price), clothing (variants, barcode), restaurant/service/general (config-level).
9. **Offline & sync:** Dexie local DB, outbox, pull sync, conflict handling, sync status UI, offline E2E tests.
10. **Staff, audit & extras:** staff invites, permission enforcement, audit log viewer, receipt printing, barcode scanning, data export.
11. **AI:** FastAPI service, adapters, voice command → confirm flow, photo-to-stock, daily brief, reorder suggestions, quotas, guardrails.
12. **Android & launch prep:** Capacitor build, app icon/splash, Play Store checklist, performance pass, full security review (use `docs/SECURITY.md` checklist), backup/restore test, privacy policy & terms, Sentry, usability test notes.

---

## 13. YOUR FIRST MESSAGE

Do **not** write code yet. Reply with:

1. Your understanding of the project in about 10 lines (Bangla or English, your choice).
2. Your questions to me (group them: product, UX, technical, legal).
3. Your top 5 risks and how you plan to reduce them.
4. A proposed list of exact tools/accounts I need to prepare before Phase 1 (with free-tier notes).

Then wait.
