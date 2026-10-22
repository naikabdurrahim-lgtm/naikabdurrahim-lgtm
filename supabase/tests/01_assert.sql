-- =============================================================================
-- Assertion helpers. Any failed assertion raises and the runner stops.
-- Every test file runs inside BEGIN ... ROLLBACK, so the database is untouched.
-- =============================================================================

create schema if not exists tests;

create or replace function tests.ok(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$$;

create or replace function tests.eq(p_actual anyelement, p_expected anyelement, p_message text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERTION FAILED: % (expected %, got %)', p_message, p_expected, p_actual;
  end if;
end;
$$;

-- Logs the given user in for the rest of the transaction, then runs p_sql as
-- the `authenticated` role — exactly what PostgREST does for a real request.
create or replace function tests.as_user(p_user uuid, p_sql text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute 'set local role authenticated';
  begin
    execute p_sql;
  exception when others then
    execute 'reset role';
    raise;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

-- Expects p_sql to be refused for the given user.
-- Syntax and missing-object errors are re-raised: a broken test must never pass
-- just because *something* failed.
create or replace function tests.denied(p_user uuid, p_sql text, p_message text)
returns void
language plpgsql
as $$
declare
  v_state text;
  v_message text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute 'set local role authenticated';
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    execute 'reset role';
    perform set_config('request.jwt.claim.sub', '', true);

    if v_state in ('42601', '42883', '42P01', '42703', '42804') then
      raise exception 'ASSERTION FAILED (test is broken, not the policy): % — % (%)',
        p_message, v_message, v_state;
    end if;
    return;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  raise exception 'ASSERTION FAILED (no error raised): %', p_message;
end;
$$;

-- Row count the given user would see for p_sql.
create or replace function tests.count_as(p_user uuid, p_sql text)
returns bigint
language plpgsql
as $$
declare
  v_count bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute 'set local role authenticated';
  execute format('select count(*) from (%s) t', p_sql) into v_count;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return v_count;
end;
$$;

-- Row count for a plain table read (shortcut for the common case).
-- `select 1`, not `select *`: a table may grant SELECT on some columns only
-- (products hides cost), and counting rows must not require every column.
create or replace function tests.count_rows(p_user uuid, p_table text)
returns bigint
language plpgsql
as $$
begin
  return tests.count_as(p_user, format('select 1 from %s', p_table));
end;
$$;

-- Scalar value a given user would see for p_sql, as text.
-- Needed for RPCs whose result depends on who is asking (e.g. profit visibility).
create or replace function tests.value_as(p_user uuid, p_sql text)
returns text
language plpgsql
as $$
declare
  v_value text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  execute 'set local role authenticated';
  execute format('select (%s)::text', p_sql) into v_value;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return v_value;
end;
$$;
