-- =============================================================================
-- Local harness: the minimum of Supabase that our migrations depend on.
-- Runs BEFORE the migrations, on a throw-away database only.
-- =============================================================================

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Mirrors Supabase: the JWT subject, read from the session settings.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

grant usage on schema public to anon, authenticated, service_role;
