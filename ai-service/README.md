# AI service (FastAPI)

Phase 11 lands here. It will expose:

- `POST /parse-command` — Bangla voice/text command → structured proposed action (never auto-saved)
- `POST /scan-memo` — supplier memo photo → editable draft stock lines
- `POST /daily-brief` — max 5 plain-Bangla lines
- `POST /due-reminder` — friendly reminder text

Rules: provider keys live only in this service, every request is tenant-scoped and rate limited,
and all user text is treated as untrusted input. The browser only ever knows `VITE_AI_SERVICE_URL`.
