-- =============================================================================
-- 0012 — Catalog access: cost is not for everyone; one server-side search
-- =============================================================================
-- Two problems this migration fixes:
--
-- 1. `products.buy_price_paisa` was readable by any member, cashiers included.
--    RLS is row-level, so it cannot hide a column. Column privileges can: the
--    table-level SELECT grant is replaced with an explicit column list that
--    omits cost. An owner still needs cost, so `search_products()` (security
--    definer, role-checked) is the one place that returns it — nulled for staff.
--
-- 2. The product list needs server-side search, filtering and paging. Doing it
--    in the browser means downloading the whole catalogue, which is wrong for a
--    pharmacy with 4,000 SKUs.
-- =============================================================================

-- ---------------------------------------------------- cost is owner/manager only
revoke select on public.products from authenticated;

grant select (
  id, tenant_id, category_id, name, name_en, barcode, sku, unit_code,
  sell_price_paisa, wholesale_price_paisa, stock_qty, stock_alert_qty,
  is_service, image_path, sort_order, is_active,
  created_at, updated_at, deleted_at
) on public.products to authenticated;

comment on column public.products.buy_price_paisa is
  'Cost price. Never granted to the `authenticated` role: read it through search_products(), which nulls it for cashiers.';

-- --------------------------------------------------------- product search RPC
-- Returns the catalogue page for one shop, with cost only when the caller is an
-- owner or manager. `security definer` so the cost column can be read at all;
-- the tenant check below replaces RLS inside the function.
create or replace function public.search_products(
  p_tenant uuid,
  p_query text default null,
  p_category uuid default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_include_inactive boolean default true,
  p_id uuid default null,
  p_low_stock boolean default false
)
returns table (
  id uuid,
  name text,
  name_en text,
  category_id uuid,
  category_name text,
  unit_code text,
  barcode text,
  sku text,
  sell_price_paisa bigint,
  buy_price_paisa bigint,
  wholesale_price_paisa bigint,
  stock_qty numeric(14, 3),
  stock_alert_qty numeric(14, 3),
  is_service boolean,
  is_active boolean,
  updated_at timestamptz
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
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
    p.id,
    p.name,
    p.name_en,
    p.category_id,
    -- A soft-deleted category must not come back on a product card.
    case when c.deleted_at is null then c.name end,
    p.unit_code,
    p.barcode,
    p.sku,
    p.sell_price_paisa,
    case when v_can_see_cost then p.buy_price_paisa end,
    p.wholesale_price_paisa,
    p.stock_qty,
    p.stock_alert_qty,
    p.is_service,
    p.is_active,
    p.updated_at
  from public.products p
  left join public.categories c
    on c.id = p.category_id and c.tenant_id = p.tenant_id
  where p.tenant_id = p_tenant
    and p.deleted_at is null
    and (p_category is null or p.category_id = p_category)
    and (p_id is null or p.id = p_id)
    and (coalesce(p_include_inactive, true) or p.is_active)
    -- "Running out" filter: only products the shopkeeper asked to be warned
    -- about, and never services (they have no stock to run out of).
    and (
      not coalesce(p_low_stock, false)
      or (not p.is_service and p.stock_alert_qty > 0 and p.stock_qty <= p.stock_alert_qty)
    )
    and (
      v_query is null
      or p.name ilike '%' || v_query || '%'
      or coalesce(p.name_en, '') ilike '%' || v_query || '%'
      or p.barcode ilike v_query || '%'
      or coalesce(p.sku, '') ilike v_query || '%'
      or p.search_vector @@ plainto_tsquery('simple', v_query)
    )
  order by p.is_active desc, p.name asc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.search_products(uuid, text, uuid, integer, integer, boolean, uuid, boolean) is
  'Paged catalogue search for one shop. Cost is null unless the caller is owner/manager.';

-- ------------------------------------------------------- category list with counts
-- Counting products per category in the browser would mean loading every product.
create or replace function public.list_categories(p_tenant uuid)
returns table (
  id uuid,
  name text,
  name_en text,
  icon text,
  sort_order integer,
  is_active boolean,
  product_count bigint
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
    c.id, c.name, c.name_en, c.icon, c.sort_order, c.is_active,
    (select count(*)
       from public.products p
      where p.tenant_id = c.tenant_id
        and p.category_id = c.id
        and p.deleted_at is null) as product_count
  from public.categories c
  where c.tenant_id = p_tenant
    and c.deleted_at is null
  order by c.sort_order asc, c.name asc;
end;
$$;

-- ---------------------------------------------------------------- permissions
revoke execute on function public.search_products(uuid, text, uuid, integer, integer, boolean, uuid, boolean) from public;
revoke execute on function public.list_categories(uuid) from public;

grant execute on function public.search_products(uuid, text, uuid, integer, integer, boolean, uuid, boolean) to authenticated, service_role;
grant execute on function public.list_categories(uuid) to authenticated, service_role;
