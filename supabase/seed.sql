-- =============================================================================
-- seed.sql — OPTIONAL development data only
-- =============================================================================
-- Reference data (units, pack categories) ships in migrations, so a production
-- database needs NO seed. This file exists so a developer can log in and see a
-- realistic shop immediately in local development.
--
-- It refuses to run against a database that already has shops, so it can never
-- pollute a real one.
-- =============================================================================

do $$
begin
  if exists (select 1 from public.tenants) then
    raise notice 'seed skipped: this database already has tenants';
    return;
  end if;

  raise notice 'seed: reference data only — no demo shops are created';
  raise notice 'seed: create your shop from the onboarding screen (Phase 3)';
end;
$$;
