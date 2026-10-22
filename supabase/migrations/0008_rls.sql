-- =============================================================================
-- 0008 — Row Level Security: enable on EVERY table, then explicit policies
-- =============================================================================
-- Principles
--   1. Default deny. RLS is enabled on every table; a table without a policy is
--      readable by nobody except service_role.
--   2. Tenant isolation comes from is_tenant_member(). It is a SECURITY DEFINER
--      function so policies never recurse through tenant_members.
--   3. Writes for money/stock tables do NOT exist as policies. Those tables are
--      written only by the SECURITY DEFINER functions in 0009, which validate
--      everything server-side. A client cannot forge totals or edit history.
--   4. Cashiers never see cost price or profit: sale_items has no cashier
--      SELECT policy; receipts use the v_sale_items_receipt view instead.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.tenants           enable row level security;
alter table public.tenant_members    enable row level security;
alter table public.app_settings      enable row level security;
alter table public.units             enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.product_batches   enable row level security;
alter table public.suppliers         enable row level security;
alter table public.customers         enable row level security;
alter table public.ledger_entries    enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_items        enable row level security;
alter table public.payments          enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.sync_events       enable row level security;

-- ------------------------------------------------------------------- profiles
create policy profiles_select_self_or_colleague on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_tenant_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -------------------------------------------------------------------- tenants
create policy tenants_select_member on public.tenants
  for select to authenticated
  using (public.is_tenant_member(id));

create policy tenants_update_owner on public.tenants
  for update to authenticated
  using (public.is_tenant_owner(id))
  with check (public.is_tenant_owner(id));

-- ------------------------------------------------------------- tenant_members
create policy tenant_members_select_member on public.tenant_members
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy tenant_members_insert_owner on public.tenant_members
  for insert to authenticated
  with check (public.is_tenant_owner(tenant_id));

create policy tenant_members_update_owner on public.tenant_members
  for update to authenticated
  using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

create policy tenant_members_delete_owner on public.tenant_members
  for delete to authenticated
  using (public.is_tenant_owner(tenant_id));

-- An owner may not demote or remove themselves while they are the last owner.
create or replace function app.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other_owners integer;
begin
  if tg_op = 'DELETE' then
    if old.role <> 'owner' then return old; end if;
  else
    if old.role <> 'owner' or new.role = 'owner' then return new; end if;
  end if;

  select count(*) into v_other_owners
  from public.tenant_members
  where tenant_id = coalesce(old.tenant_id, new.tenant_id)
    and role = 'owner'
    and deleted_at is null
    and id <> old.id;

  if v_other_owners = 0 then
    raise exception 'last_owner_protected: a shop must always keep at least one owner'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger tenant_members_protect_last_owner
  before update or delete on public.tenant_members
  for each row execute function app.protect_last_owner();

-- ---------------------------------------------------------------- app_settings
create policy app_settings_select_member on public.app_settings
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

create policy app_settings_update_manager on public.app_settings
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']));

-- ----------------------------------------------------------------------- units
-- Global reference data: readable by any signed-in user, writable only by service_role.
create policy units_select_authenticated on public.units
  for select to authenticated
  using (true);

-- ---------------------------------------------------- catalog (owner/manager)
create policy categories_select_member on public.categories
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy categories_write_manager on public.categories
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']));

create policy products_select_member on public.products
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy products_write_manager on public.products
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']));

create policy product_variants_select_member on public.product_variants
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy product_variants_write_manager on public.product_variants
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']));

create policy product_batches_select_member on public.product_batches
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy product_batches_write_manager on public.product_batches
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']));

create policy suppliers_select_member on public.suppliers
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy suppliers_write_manager on public.suppliers
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']));

-- ------------------------------------------------------------------- customers
-- Cashiers may add and correct customer details (they take the phone call), but
-- only owners/managers may archive them.
create policy customers_select_member on public.customers
  for select to authenticated using (public.is_tenant_member(tenant_id));

create policy customers_insert_member on public.customers
  for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

create policy customers_update_member on public.customers
  for update to authenticated
  using (public.is_tenant_member(tenant_id) and deleted_at is null)
  with check (public.is_tenant_member(tenant_id));

create policy customers_delete_manager on public.customers
  for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']));

-- --------------------------------------------------- money & stock: read-only
create policy sales_select_member on public.sales
  for select to authenticated using (public.is_tenant_member(tenant_id));

-- Cost price lives here, so cashiers are excluded. Receipts use the view below.
create policy sale_items_select_manager on public.sale_items
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']));

create policy payments_select_member on public.payments
  for select to authenticated using (public.is_tenant_member(tenant_id));

create policy ledger_entries_select_member on public.ledger_entries
  for select to authenticated using (public.is_tenant_member(tenant_id));

create policy stock_movements_select_member on public.stock_movements
  for select to authenticated using (public.is_tenant_member(tenant_id));

-- ------------------------------------------------------------- audit and sync
create policy audit_logs_select_owner on public.audit_logs
  for select to authenticated using (public.is_tenant_owner(tenant_id));

create policy sync_events_select_member on public.sync_events
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy sync_events_insert_member on public.sync_events
  for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

-- ============================================================================
-- Views
-- ============================================================================

-- Receipt lines that a cashier is allowed to see (no cost, no profit).
-- SECURITY DEFINER view (owner = table owner, which bypasses RLS), therefore the
-- tenant check is written explicitly in the view body.
create or replace view public.v_sale_items_receipt
with (security_invoker = false) as
  select
    si.tenant_id,
    si.sale_id,
    si.id,
    si.name_snapshot,
    si.unit_code,
    si.qty,
    si.unit_price_paisa,
    si.discount_paisa,
    si.line_total_paisa,
    si.sort_order
  from public.sale_items si
  where public.is_tenant_member(si.tenant_id);

comment on view public.v_sale_items_receipt is
  'Sale lines without cost price or profit. Safe for the cashier role.';

-- Customer due balances, derived from the ledger. security_invoker so the
-- caller's RLS on customers/ledger_entries applies on top.
create or replace view public.v_customer_balances
with (security_invoker = true) as
  select
    c.tenant_id,
    c.id as customer_id,
    c.name,
    c.phone,
    c.credit_limit_paisa,
    coalesce(sum(case when le.entry_type = 'debit' then le.amount_paisa else -le.amount_paisa end), 0)::bigint as due_paisa,
    max(le.occurred_at) as last_activity_at
  from public.customers c
  left join public.ledger_entries le
    on le.tenant_id = c.tenant_id and le.customer_id = c.id
  where c.deleted_at is null
  group by c.tenant_id, c.id, c.name, c.phone, c.credit_limit_paisa;

comment on view public.v_customer_balances is
  'Due balance per customer = sum(debit) - sum(credit). Never stored, always derived.';

-- Independent recomputation of stock, used by tests and by the app's integrity check.
create or replace view public.v_stock_on_hand
with (security_invoker = true) as
  select
    p.tenant_id,
    p.id as product_id,
    p.name,
    p.stock_qty as cached_qty,
    coalesce(sum(sm.qty_delta), 0)::numeric(14, 3) as computed_qty
  from public.products p
  left join public.stock_movements sm
    on sm.tenant_id = p.tenant_id and sm.product_id = p.id
  where p.deleted_at is null
  group by p.tenant_id, p.id, p.name, p.stock_qty;

-- Daily takings and profit. Owner/manager only: profit is never exposed to cashiers.
create or replace view public.v_daily_summary
with (security_invoker = false) as
  select
    s.tenant_id,
    s.business_date,
    count(distinct s.id) as sale_count,
    coalesce(sum(s.total_paisa) filter (where s.status = 'completed'), 0)::bigint as sales_paisa,
    coalesce(sum(s.due_paisa) filter (where s.status = 'completed'), 0)::bigint as credit_given_paisa,
    coalesce(sum(si.line_total_paisa - si.cost_price_paisa * si.qty) filter (where s.status = 'completed'), 0)::bigint as profit_paisa
  from public.sales s
  left join public.sale_items si on si.tenant_id = s.tenant_id and si.sale_id = s.id
  where public.has_tenant_role(s.tenant_id, array['owner', 'manager'])
  group by s.tenant_id, s.business_date;

comment on view public.v_daily_summary is
  'Per-day sales, credit given and profit. Filtered to owner/manager inside the view.';

-- -------------------------------------------------------------- table grants
grant select on public.profiles, public.tenants, public.tenant_members, public.app_settings,
  public.units, public.categories, public.products, public.product_variants,
  public.product_batches, public.suppliers, public.customers, public.ledger_entries,
  public.sales, public.sale_items, public.payments, public.stock_movements,
  public.audit_logs, public.sync_events to authenticated;

grant insert, update, delete on public.categories, public.products, public.product_variants,
  public.product_batches, public.suppliers, public.customers to authenticated;

grant insert, update, delete on public.tenant_members to authenticated;
grant update on public.tenants, public.app_settings, public.profiles to authenticated;
grant insert on public.sync_events to authenticated;

grant select on public.v_sale_items_receipt, public.v_customer_balances,
  public.v_stock_on_hand, public.v_daily_summary to authenticated;
