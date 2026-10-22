-- =============================================================================
-- 0011 — Auth hardening: lockout, phone availability, recovery codes
-- =============================================================================
-- Supabase Auth stores the password (PIN) hash; this file adds the defence that
-- Supabase Auth cannot provide on its own for a 6-digit PIN:
--
--   * login attempt log + lockout, keyed by a SHA-256 hash of the phone number,
--     so the attempt log stores no personal data;
--   * a pre-signup phone availability check, so a duplicate signup does not
--     leave an orphan auth user that nobody can ever claim;
--   * single-use recovery codes (hashed on the device), verified server-side.
--     Actually resetting the password needs the service role, so that step lives
--     in an Edge Function (Phase 12) — see docs/SECURITY.md.
-- =============================================================================

-- ------------------------------------------------------------- auth attempts
create table public.auth_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null,
  success boolean not null,
  ip_hash text,
  user_agent text,
  -- clock_timestamp() (not now()) so attempts recorded inside one transaction
  -- are still strictly ordered; the strike counter depends on that ordering.
  created_at timestamptz not null default clock_timestamp(),
  constraint auth_attempts_hash_len check (char_length(phone_hash) between 32 and 128),
  constraint auth_attempts_ua_len check (user_agent is null or char_length(user_agent) <= 300)
);

create index auth_attempts_phone_time_idx on public.auth_attempts (phone_hash, created_at desc);
create index auth_attempts_created_idx on public.auth_attempts (created_at);

alter table public.auth_attempts enable row level security;
-- Deliberately no policy: the table is invisible to every client. Reading and
-- writing happen only inside the SECURITY DEFINER functions below.

comment on table public.auth_attempts is
  'Login attempts for lockout. Keyed by a hash of the phone number: no PII stored.';

-- No forbid_mutation trigger here on purpose: unlike business history, this log
-- is disposable telemetry. It has no grants for any client role, so the only
-- thing that can ever delete it is the service-role purge job below.

-- Lockout policy: 5 failures in 15 minutes → 15 minutes locked.
--                  10 failures in 1 hour   → 1 hour locked.
create or replace function public.auth_lockout_state(p_phone_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
  v_hourly integer;
  v_last timestamptz;
  v_last_success timestamptz;
  v_lock_until timestamptz;

begin
  if p_phone_hash is null or char_length(p_phone_hash) < 32 then
    return jsonb_build_object('locked', false, 'attempts_remaining', 5);
  end if;

  -- Only failures AFTER the most recent successful login count. Otherwise a
  -- shopkeeper who mistyped twice last week would start each day one attempt
  -- away from a lockout.
  select max(created_at) into v_last_success
  from public.auth_attempts
  where phone_hash = p_phone_hash and success = true;

  select count(*), max(created_at) into v_recent, v_last
  from public.auth_attempts
  where phone_hash = p_phone_hash
    and success = false
    and created_at > now() - interval '15 minutes'
    and (v_last_success is null or created_at > v_last_success);

  select count(*) into v_hourly
  from public.auth_attempts
  where phone_hash = p_phone_hash
    and success = false
    and created_at > now() - interval '1 hour'
    and (v_last_success is null or created_at > v_last_success);

  if v_hourly >= 10 and v_last is not null then
    v_lock_until := v_last + interval '1 hour';
  elsif v_recent >= 5 and v_last is not null then
    v_lock_until := v_last + interval '15 minutes';
  end if;

  return jsonb_build_object(
    'locked', coalesce(v_lock_until > now(), false),
    'locked_until', case when v_lock_until > now() then v_lock_until else null end,
    -- round(), not ceil(): the remaining time is a whole number of seconds set
    -- by the policy above, and ceil() could report 901 for a 15-minute lock.
    'retry_after_seconds', case when v_lock_until > now()
      then greatest(0, round(extract(epoch from (v_lock_until - now())))::integer) else 0 end,
    'attempts_remaining', greatest(0, 5 - v_recent)
  );
end;
$$;

create or replace function public.record_auth_attempt(
  p_phone_hash text,
  p_success boolean,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_phone_hash is null or char_length(p_phone_hash) < 32 then
    raise exception 'invalid_phone_hash' using errcode = 'check_violation';
  end if;

  insert into public.auth_attempts (phone_hash, success, ip_hash, user_agent)
  values (p_phone_hash, coalesce(p_success, false), p_ip_hash, left(p_user_agent, 300));

  -- A successful login clears the strike count for that number.
  if p_success then
    return jsonb_build_object('locked', false, 'attempts_remaining', 5);
  end if;

  return public.auth_lockout_state(p_phone_hash);
end;
$$;

comment on function public.record_auth_attempt(text, boolean, text, text) is
  'Records a login attempt and returns the resulting lockout state.';

-- ------------------------------------------------------- phone availability
-- Lets the signup screen refuse a duplicate number before creating an auth user,
-- which would otherwise leave an orphan account that can never be claimed.
create or replace function public.is_phone_available(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.profiles
    where phone = p_phone and deleted_at is null
  );
$$;

-- ------------------------------------------------------------ recovery codes
create table public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint recovery_codes_hash_len check (char_length(code_hash) between 32 and 128),
  constraint recovery_codes_user_key unique (user_id)
);

alter table public.recovery_codes enable row level security;

-- A user may see that they have a recovery code, never the hash itself.
create policy recovery_codes_select_self on public.recovery_codes
  for select to authenticated
  using (user_id = auth.uid());

comment on table public.recovery_codes is
  'Single-use account recovery code, stored only as a device-side SHA-256 hash.';

-- Stores (or replaces) the caller's recovery code hash. The plaintext code is
-- shown to the user once, on the device, and never sent to the server.
create or replace function public.set_recovery_code(p_code_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if p_code_hash is null or char_length(p_code_hash) < 32 then
    raise exception 'invalid_code_hash' using errcode = 'check_violation';
  end if;

  insert into public.recovery_codes (user_id, code_hash)
  values (v_user, p_code_hash)
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        used_at = null,
        created_at = now();
end;
$$;

-- Verifies a recovery code and burns it. Called only by a trusted server
-- component (the Phase 12 reset Edge Function), so it is granted to service_role
-- and NOT to authenticated/anon.
create or replace function public.consume_recovery_code(p_user uuid, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.recovery_codes
  where user_id = p_user and code_hash = p_code_hash and used_at is null
  for update;

  if v_id is null then
    return false;
  end if;

  update public.recovery_codes set used_at = now() where id = v_id;
  return true;
end;
$$;

-- --------------------------------------------------------------- maintenance
-- Keeps the attempt table small. Service-role only (cron / manual).
create or replace function public.purge_old_auth_attempts(p_older_than interval default interval '30 days')
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  delete from public.auth_attempts where created_at < clock_timestamp() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -------------------------------------------------------------------- grants
-- recovery_codes: the user may read their own row through RLS, so it needs a
-- SELECT grant. auth_attempts gets no grant at all: it is service-only.
grant select on public.recovery_codes to authenticated;
revoke execute on function public.auth_lockout_state(text) from public;
revoke execute on function public.record_auth_attempt(text, boolean, text, text) from public;
revoke execute on function public.is_phone_available(text) from public;
revoke execute on function public.set_recovery_code(text) from public;
revoke execute on function public.consume_recovery_code(uuid, text) from public;
revoke execute on function public.purge_old_auth_attempts(interval) from public;

grant execute on function public.auth_lockout_state(text) to anon, authenticated, service_role;
grant execute on function public.record_auth_attempt(text, boolean, text, text) to anon, authenticated, service_role;
grant execute on function public.is_phone_available(text) to anon, authenticated, service_role;
grant execute on function public.set_recovery_code(text) to authenticated, service_role;
grant execute on function public.consume_recovery_code(uuid, text) to service_role;
grant execute on function public.purge_old_auth_attempts(interval) to service_role;
