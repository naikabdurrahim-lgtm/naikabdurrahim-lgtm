-- =============================================================================
-- 0014 — Due ledger: who owes what, how the balance got there
-- =============================================================================
-- Phase 6 needs three questions answered by the database, not by the browser:
--
--   1. Which customers owe money, most owed first? (the "বাকি" screen)
--   2. What is the total outstanding, and since when? (the summary)
--   3. What happened to one customer's balance, entry by entry? (the khata)
--
-- The balance is never stored: it is `sum(debit) - sum(credit)` over the
-- append-only ledger (0004). These functions only read, and every one of them
-- checks membership itself because they are `security definer`.
-- =============================================================================

-- ------------------------------------------------------------- ledger ordering
-- `occurred_at` defaults to now(), which is the transaction start time: two
-- entries written by the same transaction would tie. The khata must have a
-- stable order, so the append-only ledger gets a monotonic identity column.
-- Existing rows keep their order because the table has only ever been appended.
alter table public.ledger_entries
  add column seq bigint generated always as identity;

create unique index ledger_entries_seq_key on public.ledger_entries (seq);

comment on column public.ledger_entries.seq is
  'Monotonic insertion order. The khata sorts by this, never by a timestamp that can tie.';

-- ------------------------------------------------- customers with a due balance
create or replace function public.list_customers(
  p_tenant uuid,
  p_query text default null,
  p_only_due boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  phone text,
  due_paisa bigint,
  credit_limit_paisa bigint,
  last_activity_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    c.id,
    c.name,
    c.phone,
    coalesce(sum(case when le.entry_type = 'debit' then le.amount_paisa
                      else -le.amount_paisa end), 0)::bigint as due_paisa,
    c.credit_limit_paisa,
    max(le.occurred_at) as last_activity_at,
    c.created_at
  from public.customers c
  left join public.ledger_entries le
    on le.tenant_id = c.tenant_id and le.customer_id = c.id
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and (
      v_query is null
      or c.name ilike '%' || v_query || '%'
      -- A shopkeeper reads the number from the receipt, with or without +880.
      or replace(replace(coalesce(c.phone, ''), '+', ''), ' ', '') like '%' || replace(v_query, '+', '') || '%'
    )
  group by c.id, c.name, c.phone, c.credit_limit_paisa, c.created_at
  having not p_only_due
      or sum(case when le.entry_type = 'debit' then le.amount_paisa
                  else -le.amount_paisa end) > 0
  order by
    -- Debtors first, biggest debt on top; then everyone else by name.
    sum(case when le.entry_type = 'debit' then le.amount_paisa
             else -le.amount_paisa end) desc nulls last,
    c.name asc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.list_customers(uuid, text, boolean, integer, integer) is
  'Customers with their derived due balance. p_only_due keeps just the debtors.';

-- ----------------------------------------------------------------- due summary
create or replace function public.due_summary(p_tenant uuid)
returns table (
  total_due_paisa bigint,
  debtor_count bigint,
  customer_count bigint,
  oldest_due_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  return query
  with balances as (
    select
      c.id,
      coalesce(sum(case when le.entry_type = 'debit' then le.amount_paisa
                        else -le.amount_paisa end), 0)::bigint as due_paisa,
      max(case when le.entry_type = 'debit' then le.occurred_at end) as last_debit_at
    from public.customers c
    left join public.ledger_entries le
      on le.tenant_id = c.tenant_id and le.customer_id = c.id
    where c.tenant_id = p_tenant and c.deleted_at is null
    group by c.id
  )
  select
    coalesce(sum(due_paisa) filter (where due_paisa > 0), 0)::bigint,
    count(*) filter (where due_paisa > 0)::bigint,
    count(*)::bigint,
    min(last_debit_at) filter (where due_paisa > 0)
  from balances;
end;
$$;

comment on function public.due_summary(uuid) is
  'Total outstanding across the shop, how many customers owe it, and since when.';

-- ---------------------------------------------------------------- one customer
-- Unlike list_customers this also returns a soft-deleted customer: a khata must
-- stay readable after the person is removed from the list.
create or replace function public.get_customer(p_tenant uuid, p_customer uuid)
returns table (
  id uuid,
  name text,
  phone text,
  address text,
  note text,
  due_paisa bigint,
  credit_limit_paisa bigint,
  is_active boolean,
  is_deleted boolean,
  last_activity_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    c.id, c.name, c.phone, c.address, c.note,
    coalesce(sum(case when le.entry_type = 'debit' then le.amount_paisa
                      else -le.amount_paisa end), 0)::bigint as due_paisa,
    c.credit_limit_paisa,
    c.is_active,
    c.deleted_at is not null,
    max(le.occurred_at),
    c.created_at
  from public.customers c
  left join public.ledger_entries le
    on le.tenant_id = c.tenant_id and le.customer_id = c.id
  where c.tenant_id = p_tenant and c.id = p_customer
  group by c.id, c.name, c.phone, c.address, c.note,
           c.credit_limit_paisa, c.is_active, c.deleted_at, c.created_at;
end;
$$;

comment on function public.get_customer(uuid, uuid) is
  'One customer with the derived due balance, including a soft-deleted one.';

-- ------------------------------------------------------------- customer ledger
-- `balance_after_paisa` is computed over the whole history before paging, so a
-- page never shows a wrong running total.
create or replace function public.customer_ledger(
  p_tenant uuid,
  p_customer uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  entry_type text,
  amount_paisa bigint,
  balance_after_paisa bigint,
  occurred_at timestamptz,
  note text,
  sale_id uuid,
  payment_id uuid,
  invoice_no text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  return query
  with ordered as (
    select
      le.id,
      le.entry_type::text as entry_type,
      le.amount_paisa,
      sum(case when le.entry_type = 'debit' then le.amount_paisa
               else -le.amount_paisa end)
        over (order by le.seq
              rows between unbounded preceding and current row)::bigint as balance_after_paisa,
      le.occurred_at,
      le.note,
      le.sale_id,
      le.payment_id,
      le.seq
    from public.ledger_entries le
    where le.tenant_id = p_tenant and le.customer_id = p_customer
  )
  select
    o.id, o.entry_type, o.amount_paisa, o.balance_after_paisa, o.occurred_at,
    o.note, o.sale_id, o.payment_id, s.invoice_no
  from ordered o
  left join public.sales s on s.tenant_id = p_tenant and s.id = o.sale_id
  order by o.seq desc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.customer_ledger(uuid, uuid, integer, integer) is
  'Append-only ledger for one customer, newest first, with the running balance.';

-- ---------------------------------------------------------------- permissions
revoke execute on function public.list_customers(uuid, text, boolean, integer, integer) from public;
revoke execute on function public.due_summary(uuid) from public;
revoke execute on function public.get_customer(uuid, uuid) from public;
revoke execute on function public.customer_ledger(uuid, uuid, integer, integer) from public;

grant execute on function public.list_customers(uuid, text, boolean, integer, integer) to authenticated, service_role;
grant execute on function public.due_summary(uuid) to authenticated, service_role;
grant execute on function public.get_customer(uuid, uuid) to authenticated, service_role;
grant execute on function public.customer_ledger(uuid, uuid, integer, integer) to authenticated, service_role;
