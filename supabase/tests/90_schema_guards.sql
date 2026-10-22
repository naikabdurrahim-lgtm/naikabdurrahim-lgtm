-- =============================================================================
-- 90 — Schema guards: rules that must hold for every future migration too.
-- =============================================================================
-- These tests fail as soon as someone adds a table without RLS, forgets
-- tenant_id, or writes a SECURITY DEFINER function without a pinned search_path.
-- =============================================================================

-- Every table in `public` must have Row Level Security enabled.
select tests.eq(
  (select count(*)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity),
  0::bigint,
  'RLS is enabled on every table in the public schema'
);

-- Every table in `public` must expose at least one policy, otherwise it is dead
-- weight nobody can read — usually a forgotten policy. The only exceptions are
-- tables that are intentionally service-only and reachable only through
-- SECURITY DEFINER functions. Any new exception must be added here on purpose.
select tests.eq(
  (select count(*)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname not in ('auth_attempts')
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)),
  0::bigint,
  'every table has at least one policy, except the documented service-only ones'
);

-- Every business table carries tenant_id. The only exceptions are:
--   units    — shared reference vocabulary
--   tenants  — the root itself (its key IS the tenant id)
--   profiles        — one row per auth user, shared across all of their shops
--   auth_attempts   — keyed by a phone hash, exists before any tenant is known
--   recovery_codes  — belongs to a user, not to a shop
select tests.eq(
  (select count(*)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname not in ('units', 'tenants', 'profiles', 'auth_attempts', 'recovery_codes')
     and not exists (
       select 1 from pg_attribute a
       where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
     )),
  0::bigint,
  'every business table has a tenant_id column'
);

-- SECURITY DEFINER functions must pin search_path, otherwise a caller could
-- hijack name resolution and run their own code with elevated rights.
select tests.eq(
  (select count(*)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
       where cfg like 'search_path=%'
     )),
  0::bigint,
  'every SECURITY DEFINER function pins its search_path'
);

-- Append-only tables must actually have the guard trigger.
select tests.eq(
  (select count(*)
   from unnest(array[
     'ledger_entries', 'sale_items', 'payments', 'stock_movements',
     'audit_logs', 'sync_events'
   ]) as t(name)
   where not exists (
     select 1
     from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t.name
       and tg.tgname like '%no_update_delete'
       and not tg.tgisinternal
   )),
  0::bigint,
  'every append-only table has its mutation guard trigger'
);

-- Money columns must be integer types. A float column here is a shipping bug.
select tests.eq(
  (select count(*)
   from information_schema.columns
   where table_schema = 'public'
     and column_name like '%paisa'
     and data_type not in ('bigint', 'integer')),
  0::bigint,
  'every *_paisa column is an integer type (no floats for money)'
);

-- Quantities keep 3 decimal places for kg / gram / litre sales.
select tests.ok(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'sale_items'
     and column_name = 'qty' and numeric_scale = 3) = 1,
  'sale quantity keeps three decimal places'
);

-- Cashiers must have no SELECT policy on sale_items (cost price lives there).
select tests.eq(
  (select count(*)
   from pg_policies
   where schemaname = 'public'
     and tablename = 'sale_items'
     and cmd in ('SELECT', 'ALL')
     and roles::text like '%authenticated%'
     and coalesce(qual, '') not like '%has_tenant_role%'),
  0::bigint,
  'sale_items is only readable through the owner/manager policy'
);

-- Every RPC that writes money is granted to signed-in users only.
select tests.eq(
  (select count(*)
   from information_schema.routine_privileges
   where routine_schema = 'public'
     and grantee = 'anon'
     and routine_name in ('create_sale', 'collect_due', 'void_sale', 'record_stock_movement', 'create_tenant')),
  0::bigint,
  'anonymous visitors cannot call any write RPC'
);
