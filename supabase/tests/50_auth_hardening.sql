-- =============================================================================
-- 50 — Auth hardening: lockout, phone availability, recovery codes
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000001', 'locked@test.local', '{"full_name":"Locked User"}');

-- The profile row is created by trigger on auth.users insert; add the phone.
update public.profiles set phone = '+8801711111111'
where id = 'ffffffff-0000-0000-0000-000000000001';

-- The attempt log is invisible to clients: no grant at all, so even a valid
-- session is refused by the database rather than merely filtered by RLS.
select tests.denied(null, $sql$select * from public.auth_attempts$sql$,
  'the attempt log cannot be read by any client role');

select tests.denied('ffffffff-0000-0000-0000-000000000001',
  $sql$select * from public.auth_attempts$sql$,
  'a signed-in user cannot read the attempt log either');

select tests.denied(null,
  $sql$insert into public.auth_attempts (phone_hash, success)
      values ('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', false)$sql$,
  'attempts cannot be written directly, only through the RPC');

-- ------------------------------------------------------------- phone check
select tests.eq(
  (select public.is_phone_available('+8801711111111')),
  false,
  'a phone already used by an account is reported as taken'
);

select tests.eq(
  (select public.is_phone_available('+8801799999999')),
  true,
  'an unused phone is available'
);

-- ------------------------------------------------------------ lockout policy
do $$
declare
  v_hash text := repeat('a', 64);
  v_state jsonb;
  v_i integer;
begin
  -- Four failures: still allowed, one attempt left.
  for v_i in 1..4 loop
    v_state := public.record_auth_attempt(v_hash, false, null, 'test-agent');
  end loop;

  perform tests.eq((v_state ->> 'locked')::boolean, false, 'four failures do not lock the account');
  perform tests.eq((v_state ->> 'attempts_remaining')::integer, 1, 'one attempt remains after four failures');

  -- Fifth failure locks for 15 minutes.
  v_state := public.record_auth_attempt(v_hash, false, null, 'test-agent');
  perform tests.eq((v_state ->> 'locked')::boolean, true, 'the fifth failure locks the account');
  perform tests.ok((v_state ->> 'retry_after_seconds')::integer > 0, 'the lock reports how long to wait');
  perform tests.ok((v_state ->> 'retry_after_seconds')::integer <= 900, 'the lock is at most 15 minutes');

  -- The lock is visible before the next attempt, so the UI can warn early.
  perform tests.eq((public.auth_lockout_state(v_hash) ->> 'locked')::boolean, true,
    'lockout state is readable before the next attempt');

  -- A different number is unaffected.
  perform tests.eq((public.auth_lockout_state(repeat('b', 64)) ->> 'locked')::boolean, false,
    'locking one number does not lock another');
end;
$$;

-- Five more failures inside the hour escalate to a one-hour lock.
do $$
declare
  v_hash text := repeat('c', 64);
  v_state jsonb;
  v_i integer;
begin
  for v_i in 1..10 loop
    v_state := public.record_auth_attempt(v_hash, false, null, null);
  end loop;
  perform tests.eq((v_state ->> 'locked')::boolean, true, 'ten failures in an hour lock the account');
  perform tests.ok((v_state ->> 'retry_after_seconds')::integer > 900,
    'ten failures escalate to a longer lock');
end;
$$;

-- A successful login resets the counter.
do $$
declare
  v_hash text := repeat('d', 64);
begin
  perform public.record_auth_attempt(v_hash, false, null, null);
  perform public.record_auth_attempt(v_hash, false, null, null);
  perform public.record_auth_attempt(v_hash, true, null, null);
  perform tests.eq((public.auth_lockout_state(v_hash) ->> 'attempts_remaining')::integer, 5,
    'a successful login clears the failures');
end;
$$;

-- The RPC rejects junk input rather than logging it.
select tests.denied(null, $sql$select public.record_auth_attempt('short', false, null, null)$sql$,
  'a malformed phone hash is refused');

-- ----------------------------------------------------------- recovery codes
select tests.denied('ffffffff-0000-0000-0000-000000000001',
  $sql$select public.set_recovery_code('tooshort')$sql$,
  'a malformed recovery hash is refused');

select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  $sql$select public.set_recovery_code(repeat('e', 64))$sql$);

select tests.eq(
  (select count(*) from public.recovery_codes where used_at is null),
  1::bigint,
  'the recovery code hash is stored once'
);

select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  $sql$select public.set_recovery_code(repeat('f', 64))$sql$);

select tests.eq(
  (select count(*) from public.recovery_codes),
  1::bigint,
  'setting a new recovery code replaces the old one'
);

-- A user may see their own recovery row, never someone else's.
select tests.eq(
  tests.count_rows('ffffffff-0000-0000-0000-000000000001', 'public.recovery_codes'),
  1::bigint,
  'a user can see that they have a recovery code'
);

select tests.eq(
  tests.count_rows('11111111-1111-1111-1111-111111111111', 'public.recovery_codes'),
  0::bigint,
  'another user sees nothing'
);

-- Only service_role may consume a code, and only once.
select tests.denied('ffffffff-0000-0000-0000-000000000001',
  $sql$select public.consume_recovery_code('ffffffff-0000-0000-0000-000000000001', repeat('f', 64))$sql$,
  'a client cannot consume a recovery code itself');

select tests.eq(
  (select public.consume_recovery_code('ffffffff-0000-0000-0000-000000000001', repeat('f', 64))),
  true,
  'the trusted server path can consume a matching code'
);

select tests.eq(
  (select public.consume_recovery_code('ffffffff-0000-0000-0000-000000000001', repeat('f', 64))),
  false,
  'a recovery code cannot be used twice'
);

-- ---------------------------------------------------------------- maintenance
do $$
declare
  v_hash text := repeat('9', 64);
begin
  perform public.record_auth_attempt(v_hash, false, null, null);
  perform tests.eq(public.purge_old_auth_attempts(interval '0 seconds') >= 1, true,
    'the maintenance job can purge old attempts');
end;
$$;

select set_config('request.jwt.claim.sub', '', true);

rollback;
