-- =============================================================================
-- 0001 — Foundation: enums, internal schema, shared trigger functions
-- =============================================================================
-- Supabase-compatible: uses auth.uid() and gen_random_uuid() (core since PG13).
-- Every helper that must bypass RLS is SECURITY DEFINER with a pinned search_path.
-- =============================================================================

-- Internal helpers live outside `public` so PostgREST never exposes them.
create schema if not exists app;
revoke all on schema app from public;
comment on schema app is 'Internal helpers for Dokan Bondhu. Not exposed through the API.';

-- ---------------------------------------------------------------- enumerations
create type public.member_role as enum ('owner', 'manager', 'cashier');

create type public.business_pack as enum (
  'grocery', 'pharmacy', 'clothing', 'restaurant', 'service', 'general'
);

create type public.sale_status as enum ('completed', 'voided');

create type public.payment_method as enum (
  'cash', 'bkash', 'nagad', 'rocket', 'card', 'bank', 'other'
);

create type public.ledger_entry_type as enum ('debit', 'credit');

create type public.stock_movement_type as enum (
  'opening', 'purchase', 'sale', 'sale_return', 'adjustment', 'damage'
);

-- ------------------------------------------------------------------- functions
-- Monotonic updated_at. Two writes in the same millisecond must still produce a
-- strictly increasing value, otherwise a pull-sync cursor can skip a row.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

comment on function app.touch_updated_at() is
  'Keeps updated_at strictly increasing per row so sync cursors never miss rows.';

-- Guard for append-only tables (sales, payments, ledger, stock movements, logs).
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
as $$
declare
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id::text;
  else
    v_id := new.id::text;
  end if;

  raise exception 'append_only_violation: % % is not allowed (row %)', tg_table_name, lower(tg_op), v_id
    using errcode = 'restrict_violation',
          hint = 'Append-only records are never edited or deleted. Write a reversing record instead.';
end;
$$;

comment on function app.forbid_mutation() is
  'Blocks UPDATE/DELETE on append-only tables. Corrections are reversal records.';

-- Resolve the acting user without failing when called from a service context.
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

comment on function app.current_user_id() is
  'Thin wrapper around auth.uid() so policies read consistently in every context.';
