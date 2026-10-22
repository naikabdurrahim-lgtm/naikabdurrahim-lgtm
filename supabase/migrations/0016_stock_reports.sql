-- =============================================================================
-- 0016 — Stock, today's takings and the reports behind them
-- =============================================================================
-- Phase 7 answers four questions, all of them in the database:
--
--   1. কী শেষ হয়ে যাচ্ছে?      list_stock(), stock_overview()
--   2. এই পণ্যটার কী হল?        product_stock_movements()
--   3. আজ কত হলো?               tenant_day_summary() (fixed here), recent_sales()
--   4. এই সপ্তাহে/মাসে কী হলো?  sales_report(), top_products()
--
-- Two rules hold everywhere in this file:
--   * membership is checked inside the function (they are security definer);
--   * cost and profit are returned as NULL — never as a fake zero — for a
--     cashier, because the column grant in 0012 already hides cost from them.
-- A NULL reads as "you are not allowed to see this"; 0 would read as "you made
-- no profit today", which is a different and dangerous sentence.
-- =============================================================================

-- ------------------------------------------------------- movement ordering key
-- `occurred_at` defaults to `now()`, which is the *transaction* start: every
-- movement written inside one transaction (a sale's stock line, a test suite)
-- shares it, so ordering by a timestamp is arbitrary. The movement history must
-- have a stable order, so it gets the same monotonic identity the ledger got in
-- 0014. Existing rows keep their order because the table is append-only.
alter table public.stock_movements
  add column seq bigint generated always as identity;

create unique index stock_movements_seq_key on public.stock_movements (seq);

comment on column public.stock_movements.seq is
  'Monotonic insertion order. The movement history sorts by this, never by a timestamp that can tie.';

-- --------------------------------------------------------------- stock overview
create or replace function public.stock_overview(p_tenant uuid)
returns table (
  product_count bigint,
  low_stock_count bigint,
  out_of_stock_count bigint,
  stock_value_paisa bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_can_see_cost boolean;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  v_can_see_cost := public.has_tenant_role(p_tenant, array['owner', 'manager']);

  return query
  select
    count(*)::bigint,
    count(*) filter (
      where p.stock_qty > 0 and p.stock_alert_qty > 0 and p.stock_qty <= p.stock_alert_qty
    )::bigint,
    count(*) filter (where p.stock_qty <= 0)::bigint,
    case
      when v_can_see_cost then
        coalesce(sum(round(p.stock_qty * p.buy_price_paisa)::bigint), 0)::bigint
    end
  from public.products p
  where p.tenant_id = p_tenant
    and p.deleted_at is null
    and not p.is_service;
end;
$$;

comment on function public.stock_overview(uuid) is
  'Product count, low/out-of-stock counts and stock value at cost. Value is NULL for a cashier.';

-- ------------------------------------------------------------------ stock list
-- Sorted by severity, not by name: the whole point is that whatever is about to
-- run out is the first thing the shopkeeper sees.
create or replace function public.list_stock(
  p_tenant uuid,
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  unit_code text,
  stock_qty numeric(14, 3),
  stock_alert_qty numeric(14, 3),
  sell_price_paisa bigint,
  buy_price_paisa bigint,
  stock_value_paisa bigint,
  is_service boolean,
  last_movement_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_can_see_cost boolean;
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_filter text := coalesce(nullif(btrim(p_filter), ''), 'all');
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;
  if v_filter not in ('all', 'low', 'out') then
    raise exception 'invalid_filter: % (expected all, low or out)', v_filter
      using errcode = 'check_violation';
  end if;

  v_can_see_cost := public.has_tenant_role(p_tenant, array['owner', 'manager']);

  return query
  select
    p.id,
    p.name,
    p.unit_code,
    p.stock_qty,
    p.stock_alert_qty,
    p.sell_price_paisa,
    case when v_can_see_cost then p.buy_price_paisa end,
    case when v_can_see_cost then round(p.stock_qty * p.buy_price_paisa)::bigint end,
    p.is_service,
    (select max(sm.occurred_at) from public.stock_movements sm
      where sm.tenant_id = p.tenant_id and sm.product_id = p.id)
  from public.products p
  where p.tenant_id = p_tenant
    and p.deleted_at is null
    and not p.is_service
    and (
      v_query is null
      or p.name ilike '%' || v_query || '%'
      or coalesce(p.name_en, '') ilike '%' || v_query || '%'
      or p.barcode ilike v_query || '%'
      or coalesce(p.sku, '') ilike '%' || v_query || '%'
    )
    and (
      v_filter = 'all'
      or (v_filter = 'out' and p.stock_qty <= 0)
      or (v_filter = 'low' and p.stock_qty > 0 and p.stock_alert_qty > 0
          and p.stock_qty <= p.stock_alert_qty)
    )
  order by
    case
      when p.stock_qty <= 0 then 0
      when p.stock_alert_qty > 0 and p.stock_qty <= p.stock_alert_qty then 1
      else 2
    end,
    p.name asc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.list_stock(uuid, text, text, integer, integer) is
  'Stock list sorted out-of-stock first, then low. `p_filter` is all | low | out.';

-- ------------------------------------------------------------ movement history
create or replace function public.product_stock_movements(
  p_tenant uuid,
  p_product uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  movement_type text,
  qty_delta numeric(14, 3),
  unit_cost_paisa bigint,
  reason text,
  occurred_at timestamptz,
  reference_type text,
  created_by_name text,
  running_qty numeric(14, 3)
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

  -- The running quantity is computed over the whole history before paging, the
  -- same way the customer khata does it (0014), so page 2 never restarts at 0.
  return query
  with ordered as (
    select
      sm.id,
      sm.movement_type::text as movement_type,
      sm.qty_delta,
      sm.unit_cost_paisa,
      sm.reason,
      sm.occurred_at,
      sm.created_at,
      sm.reference_type,
      coalesce(tm.display_name, '') as created_by_name,
      sum(sm.qty_delta) over (
        order by sm.seq
        rows between unbounded preceding and current row
      )::numeric(14, 3) as running_qty,
      sm.seq
    from public.stock_movements sm
    left join public.tenant_members tm
      on tm.tenant_id = sm.tenant_id and tm.user_id = sm.created_by
    where sm.tenant_id = p_tenant and sm.product_id = p_product
  )
  select
    o.id, o.movement_type, o.qty_delta, o.unit_cost_paisa, o.reason,
    o.occurred_at, o.reference_type, o.created_by_name, o.running_qty
  from ordered o
  order by o.seq desc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.product_stock_movements(uuid, uuid, integer, integer) is
  'Every movement for one product, newest first, with the running quantity.';

-- --------------------------------------------------------------- today's numbers
-- `tenant_day_summary()` already existed (0009) but counted collections wrong:
-- it compared `received_at` against a bare `date::timestamptz`, i.e. midnight in
-- the server's timezone (UTC), and it predates the void marker from 0015. Both
-- matter — a collection taken at 11 pm Dhaka was landing on the next day and a
-- reversed collection was still being counted as money in the drawer.
create or replace function public.tenant_day_summary(p_tenant uuid, p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date := coalesce(p_date, (now() at time zone 'Asia/Dhaka')::date);
  v_sales bigint;
  v_count bigint;
  v_due_given bigint;
  v_collected bigint;
  v_profit bigint;
  v_can_see_profit boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  v_can_see_profit := public.has_tenant_role(p_tenant, array['owner', 'manager']);

  select coalesce(sum(total_paisa), 0), count(*), coalesce(sum(due_paisa), 0)
    into v_sales, v_count, v_due_given
  from public.sales
  where tenant_id = p_tenant and business_date = v_date and status = 'completed';

  -- Dues collected today. Payments written by create_sale() carry a sale_id and
  -- are already inside sales_paisa; only the stand-alone ones are new money here.
  select coalesce(sum(amount_paisa), 0) into v_collected
  from public.payments
  where tenant_id = p_tenant
    and sale_id is null
    and voided_at is null
    and (received_at at time zone 'Asia/Dhaka')::date = v_date;

  if v_can_see_profit then
    select coalesce(sum(si.line_total_paisa - round(si.cost_price_paisa * si.qty)::bigint), 0)
      into v_profit
    from public.sale_items si
    join public.sales s on s.tenant_id = si.tenant_id and s.id = si.sale_id
    where si.tenant_id = p_tenant and s.business_date = v_date and s.status = 'completed';
  end if;

  return jsonb_build_object(
    'business_date', v_date,
    'sale_count', v_count,
    'sales_paisa', v_sales,
    'credit_given_paisa', v_due_given,
    'collected_paisa', v_collected,
    'profit_paisa', case when v_can_see_profit then v_profit else null end
  );
end;
$$;

comment on function public.tenant_day_summary(uuid, date) is
  'One business day: sales, credit given, dues collected and profit (NULL for a cashier). Dhaka-local.';

-- --------------------------------------------------------------- recent sales
create or replace function public.recent_sales(
  p_tenant uuid,
  p_limit integer default 20,
  p_offset integer default 0,
  p_date date default null
)
returns table (
  id uuid,
  invoice_no text,
  total_paisa bigint,
  due_paisa bigint,
  status text,
  business_date date,
  created_at timestamptz,
  customer_name text,
  item_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
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
    s.id,
    s.invoice_no,
    s.total_paisa,
    s.due_paisa,
    s.status::text,
    s.business_date,
    s.created_at,
    c.name,
    (select count(*) from public.sale_items si
      where si.tenant_id = s.tenant_id and si.sale_id = s.id)::bigint
  from public.sales s
  left join public.customers c on c.tenant_id = s.tenant_id and c.id = s.customer_id
  where s.tenant_id = p_tenant
    and (p_date is null or s.business_date = p_date)
  order by s.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.recent_sales(uuid, integer, integer, date) is
  'Newest sales first, with customer name and line count. Cost-free, so any member may read it.';

-- --------------------------------------------------------------- daily report
create or replace function public.sales_report(p_tenant uuid, p_from date, p_to date)
returns table (
  business_date date,
  sale_count bigint,
  sales_paisa bigint,
  credit_paisa bigint,
  collected_paisa bigint,
  profit_paisa bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Dhaka')::date - 6);
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Dhaka')::date);
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;
  -- Profit and takings across a range are management information.
  if not public.has_tenant_role(p_tenant, array['owner', 'manager']) then
    raise exception 'forbidden: reports are for the owner and manager'
      using errcode = 'insufficient_privilege';
  end if;
  if v_to < v_from then
    raise exception 'invalid_range: the end date is before the start date'
      using errcode = 'check_violation';
  end if;

  return query
  with days as (
    select s.business_date as d
    from public.sales s
    where s.tenant_id = p_tenant and s.business_date between v_from and v_to
    union
    select (pm.received_at at time zone 'Asia/Dhaka')::date as d
    from public.payments pm
    where pm.tenant_id = p_tenant
      and pm.voided_at is null
      and (pm.received_at at time zone 'Asia/Dhaka')::date between v_from and v_to
  )
  select
    d.d,
    coalesce(s.sale_count, 0)::bigint,
    coalesce(s.sales_paisa, 0)::bigint,
    coalesce(s.credit_paisa, 0)::bigint,
    coalesce(p.collected_paisa, 0)::bigint,
    coalesce(pr.profit_paisa, 0)::bigint
  from days d
  left join (
    -- One row per sale, so the totals are not inflated by the line count.
    select
      sa.business_date as d,
      count(*)::bigint as sale_count,
      sum(sa.total_paisa)::bigint as sales_paisa,
      sum(sa.due_paisa)::bigint as credit_paisa
    from public.sales sa
    where sa.tenant_id = p_tenant
      and sa.status = 'completed'
      and sa.business_date between v_from and v_to
    group by sa.business_date
  ) s on s.d = d.d
  left join (
    select
      sa.business_date as d,
      sum(si.line_total_paisa - round(si.cost_price_paisa * si.qty)::bigint)::bigint as profit_paisa
    from public.sale_items si
    join public.sales sa on sa.tenant_id = si.tenant_id and sa.id = si.sale_id
    where si.tenant_id = p_tenant
      and sa.status = 'completed'
      and sa.business_date between v_from and v_to
    group by sa.business_date
  ) pr on pr.d = d.d
  left join (
    select
      (pm.received_at at time zone 'Asia/Dhaka')::date as d,
      sum(pm.amount_paisa)::bigint as collected_paisa
    from public.payments pm
    where pm.tenant_id = p_tenant
      and pm.voided_at is null
      and (pm.received_at at time zone 'Asia/Dhaka')::date between v_from and v_to
    group by 1
  ) p on p.d = d.d
  order by d.d asc;
end;
$$;

comment on function public.sales_report(uuid, date, date) is
  'Per-day sales, credit, collections and profit for a date range. Owner/manager only.';

-- --------------------------------------------------------------- top products
create or replace function public.top_products(
  p_tenant uuid,
  p_from date default null,
  p_to date default null,
  p_limit integer default 10
)
returns table (
  product_id uuid,
  name text,
  qty numeric(14, 3),
  revenue_paisa bigint,
  profit_paisa bigint,
  sale_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Dhaka')::date - 29);
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Dhaka')::date);
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;
  if not public.has_tenant_role(p_tenant, array['owner', 'manager']) then
    raise exception 'forbidden: reports are for the owner and manager'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    si.product_id,
    coalesce(p.name, si.name_snapshot) as name,
    sum(si.qty)::numeric(14, 3),
    sum(si.line_total_paisa)::bigint,
    sum(si.line_total_paisa - round(si.cost_price_paisa * si.qty)::bigint)::bigint,
    count(distinct si.sale_id)::bigint
  from public.sale_items si
  join public.sales s
    on s.tenant_id = si.tenant_id and s.id = si.sale_id
  left join public.products p
    on p.tenant_id = si.tenant_id and p.id = si.product_id
  where si.tenant_id = p_tenant
    and s.status = 'completed'
    and s.business_date between v_from and v_to
  group by si.product_id, coalesce(p.name, si.name_snapshot)
  order by sum(si.line_total_paisa) desc, sum(si.qty) desc
  limit v_limit;
end;
$$;

comment on function public.top_products(uuid, date, date, integer) is
  'Best-selling products by revenue for a date range. Owner/manager only.';

-- ---------------------------------------------------------------- permissions
revoke execute on function public.stock_overview(uuid) from public;
revoke execute on function public.list_stock(uuid, text, text, integer, integer) from public;
revoke execute on function public.product_stock_movements(uuid, uuid, integer, integer) from public;
revoke execute on function public.recent_sales(uuid, integer, integer, date) from public;
revoke execute on function public.sales_report(uuid, date, date) from public;
revoke execute on function public.top_products(uuid, date, date, integer) from public;

grant execute on function public.stock_overview(uuid) to authenticated, service_role;
grant execute on function public.list_stock(uuid, text, text, integer, integer) to authenticated, service_role;
grant execute on function public.product_stock_movements(uuid, uuid, integer, integer) to authenticated, service_role;
grant execute on function public.tenant_day_summary(uuid, date) to authenticated, service_role;
grant execute on function public.recent_sales(uuid, integer, integer, date) to authenticated, service_role;
grant execute on function public.sales_report(uuid, date, date) to authenticated, service_role;
grant execute on function public.top_products(uuid, date, date, integer) to authenticated, service_role;
