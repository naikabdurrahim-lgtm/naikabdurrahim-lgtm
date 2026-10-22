-- =============================================================================
-- 0006 — Stock movements (append-only) with a verified cache column
-- =============================================================================
-- Stock on hand is DERIVED from stock_movements. products.stock_qty and
-- product_variants.stock_qty are caches kept in sync by trigger; the SQL test
-- suite asserts cache == v_stock_on_hand for every product.
-- There is no "set stock" path: an adjustment is a movement with a reason.
-- =============================================================================

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_id uuid not null,
  product_id uuid not null,
  variant_id uuid,
  batch_id uuid,
  movement_type public.stock_movement_type not null,
  -- Positive = stock in, negative = stock out. Never zero.
  qty_delta numeric(14, 3) not null check (qty_delta <> 0),
  unit_cost_paisa bigint not null default 0 check (unit_cost_paisa >= 0),
  reason text,
  reference_type text,
  reference_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint stock_movements_reason_len check (reason is null or char_length(reason) <= 300),
  constraint stock_movements_client_key unique (tenant_id, client_id),
  constraint stock_movements_tenant_id_key unique (tenant_id, id),
  constraint stock_movements_product_fkey foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete restrict,
  constraint stock_movements_variant_fkey foreign key (tenant_id, variant_id)
    references public.product_variants (tenant_id, id) on delete restrict,
  constraint stock_movements_batch_fkey foreign key (tenant_id, batch_id)
    references public.product_batches (tenant_id, id) on delete restrict,
  -- A purchase or sale must name what caused it.
  constraint stock_movements_reference_required check (
    movement_type in ('opening', 'adjustment', 'damage') or reference_id is not null
  )
);

create index stock_movements_product_idx
  on public.stock_movements (tenant_id, product_id, occurred_at desc);
create index stock_movements_tenant_date_idx on public.stock_movements (tenant_id, occurred_at desc);
create index stock_movements_sync_idx on public.stock_movements (tenant_id, created_at);

create trigger stock_movements_no_update_delete
  before update or delete on public.stock_movements
  for each row execute function app.forbid_mutation();

-- ------------------------------------------------------- cache maintenance
create or replace function app.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_qty numeric(14, 3);
  v_allow_negative boolean;
  v_is_service boolean;
begin
  select p.is_service into v_is_service
  from public.products p
  where p.tenant_id = new.tenant_id and p.id = new.product_id;

  if v_is_service then
    raise exception 'stock_movement_on_service_product: product % is a service and does not hold stock',
      new.product_id using errcode = 'check_violation';
  end if;

  if new.variant_id is null then
    update public.products
       set stock_qty = stock_qty + new.qty_delta
     where tenant_id = new.tenant_id and id = new.product_id
    returning stock_qty into v_new_qty;
  else
    update public.product_variants
       set stock_qty = stock_qty + new.qty_delta
     where tenant_id = new.tenant_id and id = new.variant_id
    returning stock_qty into v_new_qty;

    -- Keep the parent product total in step with its variants.
    update public.products
       set stock_qty = stock_qty + new.qty_delta
     where tenant_id = new.tenant_id and id = new.product_id
    returning stock_qty into v_new_qty;
  end if;

  if new.batch_id is not null then
    update public.product_batches
       set qty_remaining = qty_remaining + new.qty_delta
     where tenant_id = new.tenant_id and id = new.batch_id;
  end if;

  select allow_negative_stock into v_allow_negative
  from public.app_settings
  where tenant_id = new.tenant_id;

  if coalesce(v_allow_negative, false) = false and v_new_qty < 0 then
    raise exception 'insufficient_stock: product % would drop to % after this movement',
      new.product_id, v_new_qty
      using errcode = 'check_violation',
            hint = 'Enable "allow negative stock" in shop settings, or record the purchase first.';
  end if;

  return null;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function app.apply_stock_movement();
