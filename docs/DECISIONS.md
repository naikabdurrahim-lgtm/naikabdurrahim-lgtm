# Decisions log

Format: **date — decision — reason**. Newest first.
Rule (PROJECT_RULES 1.9): every non-trivial choice goes here so future phases do not re-litigate it.

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
