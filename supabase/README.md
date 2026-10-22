# Supabase

Phase 2 lands here.

- `migrations/` — every schema change as a timestamped SQL migration, applied in order.
- `seed.sql` — reference data only (units, default categories per pack). No fake shops or customers.
- `tests/` — scripted SQL checks proving RLS isolation and role restrictions, plus integrity rules
  (due balance = sum of ledger entries, stock on hand = sum of movements).

Until Phase 2 this folder is intentionally empty.
