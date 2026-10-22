# Test plan

## Automated (run in CI on every push)

| Layer | Tool | Scope | Status |
|---|---|---|---|
| Money & quantity math | Vitest | parse/format/sum/discount/line totals/profit | ✅ 21 tests (Phase 1) |
| UI components | Vitest + Testing Library | MoneyText numerals, BigActionButton targets | Phase 4 |
| Permissions | Vitest | `can(user, action)` matrix | Phase 3 |
| Sync outbox | Vitest | retry/backoff, idempotent ids, conflict policy | Phase 9 |
| Database rules | SQL (pgTAP or scripted) | CHECK constraints, append-only guards, stock/due derivation | Phase 2 |
| RLS | SQL scripted | cross-tenant read/write must fail; role restrictions | Phase 2 |
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
