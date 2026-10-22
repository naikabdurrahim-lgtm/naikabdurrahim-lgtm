-- =============================================================================
-- 0009 — Server-side write path for money and stock
-- =============================================================================
-- The client never inserts into sales / sale_items / payments / ledger_entries /
-- stock_movements directly. These functions are the only writers, so totals are
-- always recomputed on the server and history can never be forged or deleted.
--
-- Every function is SECURITY DEFINER with a pinned search_path and re-checks the
-- caller's membership and role — the API layer is not trusted either.
-- =============================================================================

-- --------------------------------------------------------------- create_tenant
create or replace function public.create_tenant(
  p_name text,
  p_pack public.business_pack default 'general',
  p_owner_display_name text default null
)
returns public.tenants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tenant public.tenants;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'invalid_tenant_name: a shop name is required' using errcode = 'check_violation';
  end if;

  insert into public.tenants (name, pack, owner_id)
  values (btrim(p_name), p_pack, v_user)
  returning * into v_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, display_name, invited_by)
  values (
    v_tenant.id,
    v_user,
    'owner',
    coalesce(nullif(btrim(p_owner_display_name), ''), (select full_name from public.profiles where id = v_user)),
    null
  );

  insert into public.app_settings (tenant_id)
  values (v_tenant.id)
  on conflict (tenant_id) do nothing;

  -- Categories that suit the chosen business pack.
  insert into public.categories (tenant_id, name, name_en, icon, sort_order)
  select v_tenant.id, d.name_bn, d.name_en, d.icon, d.sort_order
  from app.pack_categories d
  where d.pack = p_pack
  on conflict do nothing;

  return v_tenant;
end;
$$;

comment on function public.create_tenant(text, public.business_pack, text) is
  'Bootstraps a shop: tenant + owner membership + settings + pack default categories.';

-- ---------------------------------------------------------------- create_sale
-- Payload shape (all money in paisa):
-- {
--   "client_id": uuid, "customer_id": uuid|null, "device_id": text,
--   "business_date": "YYYY-MM-DD", "discount_paisa": 0, "discount_kind": "amount",
--   "paid_paisa": 0, "payment_method": "cash", "note": "...",
--   "items": [ { "product_id": uuid, "variant_id": uuid|null, "batch_id": uuid|null,
--                "qty": 1.000, "unit_price_paisa": 1200, "discount_paisa": 0 } ]
-- }
create or replace function public.create_sale(p_tenant uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_client_id uuid := (p_payload ->> 'client_id')::uuid;
  v_existing public.sales;
  v_sale public.sales;
  v_item record;
  v_product public.products;
  v_subtotal bigint := 0;
  v_discount bigint := coalesce((p_payload ->> 'discount_paisa')::bigint, 0);
  v_paid bigint := coalesce((p_payload ->> 'paid_paisa')::bigint, 0);
  v_total bigint;
  v_due bigint;
  v_customer uuid := nullif(p_payload ->> 'customer_id', '')::uuid;
  v_invoice_seq bigint;
  v_idx integer := 0;
  v_items jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_allow_cashier_discount boolean := true;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member: you do not belong to this shop' using errcode = 'insufficient_privilege';
  end if;

  if v_client_id is null then
    raise exception 'missing_client_id: every sale needs a client-generated id' using errcode = 'check_violation';
  end if;

  -- Idempotency: pushing the same offline sale twice returns the original.
  select * into v_existing from public.sales
  where tenant_id = p_tenant and client_id = v_client_id;
  if found then
    return jsonb_build_object(
      'sale_id', v_existing.id,
      'invoice_no', v_existing.invoice_no,
      'total_paisa', v_existing.total_paisa,
      'paid_paisa', v_existing.paid_paisa,
      'due_paisa', v_existing.due_paisa,
      'duplicate', true
    );
  end if;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'empty_sale: a sale needs at least one item' using errcode = 'check_violation';
  end if;

  select coalesce(
    (select allow_cashier_discount from public.app_settings where tenant_id = p_tenant),
    true
  ) into v_allow_cashier_discount;

  if v_discount < 0 then
    raise exception 'invalid_discount' using errcode = 'check_violation';
  end if;

  if v_discount > 0
     and not v_allow_cashier_discount
     and not public.has_tenant_role(p_tenant, array['owner', 'manager']) then
    raise exception 'discount_not_allowed: only an owner or manager may give a discount'
      using errcode = 'insufficient_privilege';
  end if;

  if v_customer is not null and not exists (
    select 1 from public.customers
    where tenant_id = p_tenant and id = v_customer and deleted_at is null
  ) then
    raise exception 'unknown_customer: customer % does not belong to this shop', v_customer
      using errcode = 'check_violation';
  end if;

  -- Per-tenant invoice numbering. The advisory lock serialises concurrent sales
  -- in the same shop so two devices can never take the same number.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text, 42));
  select coalesce(max(invoice_seq), 0) + 1 into v_invoice_seq
  from public.sales where tenant_id = p_tenant;

  -- The row is created with neutral values and filled in once the lines are known,
  -- so the CHECK constraints never see a half-built sale.
  insert into public.sales (
    tenant_id, client_id, invoice_seq, customer_id, business_date,
    subtotal_paisa, discount_paisa, discount_kind, paid_paisa, note, device_id, created_by
  )
  values (
    p_tenant, v_client_id, v_invoice_seq, v_customer,
    coalesce((p_payload ->> 'business_date')::date, (now() at time zone 'Asia/Dhaka')::date),
    1, 0, coalesce(p_payload ->> 'discount_kind', 'amount'), 0,
    nullif(p_payload ->> 'note', ''),
    nullif(p_payload ->> 'device_id', ''),
    v_user
  )
  returning * into v_sale;

  for v_item in
    select * from jsonb_to_recordset(v_items) as x(
      product_id uuid, variant_id uuid, batch_id uuid, qty numeric,
      unit_price_paisa bigint, discount_paisa bigint
    )
  loop
    if v_item.product_id is null or v_item.qty is null or v_item.qty <= 0 then
      raise exception 'invalid_sale_item: each line needs a product and a positive quantity'
        using errcode = 'check_violation';
    end if;

    select * into v_product from public.products
    where tenant_id = p_tenant and id = v_item.product_id and deleted_at is null;
    if not found then
      raise exception 'unknown_product: product % is not in this shop', v_item.product_id
        using errcode = 'check_violation';
    end if;

    if v_item.unit_price_paisa is null or v_item.unit_price_paisa < 0 then
      raise exception 'invalid_price: unit price cannot be negative' using errcode = 'check_violation';
    end if;

    -- Price is taken from the payload so an offline device's local price wins,
    -- but a cashier may never sell below cost without a manager-level discount.
    if v_item.unit_price_paisa < v_product.buy_price_paisa
       and not public.has_tenant_role(p_tenant, array['owner', 'manager']) then
      raise exception 'below_cost_not_allowed: % is sold below its cost price', v_product.name
        using errcode = 'insufficient_privilege';
    end if;

    insert into public.sale_items (
      tenant_id, sale_id, product_id, variant_id, batch_id, name_snapshot, unit_code,
      qty, unit_price_paisa, cost_price_paisa, discount_paisa, sort_order, created_by
    )
    values (
      p_tenant, v_sale.id, v_item.product_id, v_item.variant_id, v_item.batch_id,
      v_product.name, v_product.unit_code,
      v_item.qty, v_item.unit_price_paisa, v_product.buy_price_paisa,
      coalesce(v_item.discount_paisa, 0), v_idx, v_user
    );

    -- Stock leaves the shelf through an append-only movement (not a direct write).
    if not v_product.is_service then
      insert into public.stock_movements (
        tenant_id, client_id, product_id, variant_id, batch_id, movement_type,
        qty_delta, unit_cost_paisa, reference_type, reference_id, created_by
      )
      values (
        p_tenant, gen_random_uuid(), v_item.product_id, v_item.variant_id, v_item.batch_id,
        'sale', -v_item.qty, v_product.buy_price_paisa, 'sale', v_sale.id, v_user
      );
    end if;

    v_subtotal := v_subtotal + round(v_item.qty * v_item.unit_price_paisa)::bigint
                            - coalesce(v_item.discount_paisa, 0);
    v_idx := v_idx + 1;
  end loop;

  if v_subtotal <= 0 then
    raise exception 'invalid_sale_total: the sale total must be greater than zero'
      using errcode = 'check_violation';
  end if;

  if v_discount > v_subtotal then
    raise exception 'discount_exceeds_total: discount % > subtotal %', v_discount, v_subtotal
      using errcode = 'check_violation';
  end if;

  v_total := v_subtotal - v_discount;

  if v_paid < 0 or v_paid > v_total then
    raise exception 'invalid_paid_amount: paid % is outside 0..%', v_paid, v_total
      using errcode = 'check_violation';
  end if;

  v_due := v_total - v_paid;

  if v_due > 0 and v_customer is null then
    raise exception 'due_requires_customer: choose a customer before selling on credit'
      using errcode = 'check_violation';
  end if;

  update public.sales
     set subtotal_paisa = v_subtotal,
         discount_paisa = v_discount,
         paid_paisa = v_paid
   where id = v_sale.id
  returning * into v_sale;

  if v_paid > 0 then
    insert into public.payments (
      tenant_id, client_id, sale_id, customer_id, amount_paisa, method, created_by
    )
    values (
      p_tenant, gen_random_uuid(), v_sale.id, v_customer, v_paid,
      coalesce((p_payload ->> 'payment_method')::public.payment_method, 'cash'), v_user
    );
  end if;

  if v_due > 0 then
    insert into public.ledger_entries (
      tenant_id, customer_id, entry_type, amount_paisa, sale_id, note, created_by, client_id
    )
    values (
      p_tenant, v_customer, 'debit', v_due, v_sale.id, 'বাকি বিক্রি', v_user, gen_random_uuid()
    );
  end if;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'invoice_no', v_sale.invoice_no,
    'subtotal_paisa', v_subtotal,
    'discount_paisa', v_discount,
    'total_paisa', v_total,
    'paid_paisa', v_paid,
    'due_paisa', v_due,
    'duplicate', false
  );
end;
$$;

comment on function public.create_sale(uuid, jsonb) is
  'The only way to create a sale. Recomputes every total server-side and is idempotent per client_id.';

-- ---------------------------------------------------------------- collect_due
create or replace function public.collect_due(p_tenant uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_customer uuid := (p_payload ->> 'customer_id')::uuid;
  v_amount bigint := coalesce((p_payload ->> 'amount_paisa')::bigint, 0);
  v_client uuid := (p_payload ->> 'client_id')::uuid;
  v_balance bigint;
  v_payment public.payments;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member: you do not belong to this shop' using errcode = 'insufficient_privilege';
  end if;
  if v_client is null then
    raise exception 'missing_client_id' using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.payments where tenant_id = p_tenant and client_id = v_client) then
    return jsonb_build_object('duplicate', true);
  end if;

  if v_amount <= 0 then
    raise exception 'invalid_amount: the payment must be greater than zero' using errcode = 'check_violation';
  end if;
  if v_customer is null then
    raise exception 'missing_customer' using errcode = 'check_violation';
  end if;

  v_balance := public.customer_balance(p_tenant, v_customer);

  if v_balance <= 0 then
    raise exception 'nothing_due: this customer has no outstanding balance' using errcode = 'check_violation';
  end if;
  if v_amount > v_balance then
    raise exception 'overpayment: % exceeds the outstanding balance of %', v_amount, v_balance
      using errcode = 'check_violation';
  end if;

  insert into public.payments (
    tenant_id, client_id, customer_id, amount_paisa, method, reference, note, created_by
  )
  values (
    p_tenant, v_client, v_customer, v_amount,
    coalesce((p_payload ->> 'method')::public.payment_method, 'cash'),
    nullif(p_payload ->> 'reference', ''),
    nullif(p_payload ->> 'note', ''),
    v_user
  )
  returning * into v_payment;

  insert into public.ledger_entries (
    tenant_id, customer_id, entry_type, amount_paisa, payment_id, note, created_by, client_id
  )
  values (
    p_tenant, v_customer, 'credit', v_amount, v_payment.id, 'বাকি আদায়', v_user, gen_random_uuid()
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'amount_paisa', v_amount,
    'balance_paisa', v_balance - v_amount,
    'duplicate', false
  );
end;
$$;

-- ------------------------------------------------------------ customer_balance
create or replace function public.customer_balance(p_tenant uuid, p_customer uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    sum(case when le.entry_type = 'debit' then le.amount_paisa else -le.amount_paisa end),
    0
  )::bigint
  from public.ledger_entries le
  where le.tenant_id = p_tenant
    and le.customer_id = p_customer
    and public.is_tenant_member(p_tenant);
$$;

-- --------------------------------------------------------- record_stock_movement
create or replace function public.record_stock_movement(p_tenant uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_client uuid := (p_payload ->> 'client_id')::uuid;
  v_qty numeric(14, 3) := (p_payload ->> 'qty_delta')::numeric(14, 3);
  v_type public.stock_movement_type := coalesce((p_payload ->> 'movement_type')::public.stock_movement_type, 'adjustment');
  v_movement public.stock_movements;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Cashiers sell; stock changes are an owner/manager responsibility.
  if not public.has_tenant_role(p_tenant, array['owner', 'manager']) then
    raise exception 'forbidden: only an owner or manager may change stock'
      using errcode = 'insufficient_privilege';
  end if;

  if v_client is null then
    raise exception 'missing_client_id' using errcode = 'check_violation';
  end if;

  if v_qty is null or v_qty = 0 then
    raise exception 'invalid_quantity: a stock movement needs a non-zero quantity'
      using errcode = 'check_violation';
  end if;

  if v_type in ('adjustment', 'damage', 'opening') and nullif(p_payload ->> 'reason', '') is null then
    raise exception 'reason_required: explain why stock is being adjusted'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.stock_movements where tenant_id = p_tenant and client_id = v_client) then
    return jsonb_build_object('duplicate', true);
  end if;

  insert into public.stock_movements (
    tenant_id, client_id, product_id, variant_id, batch_id, movement_type,
    qty_delta, unit_cost_paisa, reason, reference_type, reference_id, created_by
  )
  values (
    p_tenant, v_client,
    (p_payload ->> 'product_id')::uuid,
    nullif(p_payload ->> 'variant_id', '')::uuid,
    nullif(p_payload ->> 'batch_id', '')::uuid,
    v_type,
    v_qty,
    coalesce((p_payload ->> 'unit_cost_paisa')::bigint, 0),
    nullif(p_payload ->> 'reason', ''),
    nullif(p_payload ->> 'reference_type', ''),
    nullif(p_payload ->> 'reference_id', '')::uuid,
    v_user
  )
  returning * into v_movement;

  return jsonb_build_object(
    'movement_id', v_movement.id,
    'product_id', v_movement.product_id,
    'stock_qty', (select stock_qty from public.products where tenant_id = p_tenant and id = v_movement.product_id),
    'duplicate', false
  );
end;
$$;

-- ------------------------------------------------------------------- void_sale
-- Sales are never edited or deleted. A void writes reversing records.
create or replace function public.void_sale(p_tenant uuid, p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales;
  v_item record;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not public.has_tenant_role(p_tenant, array['owner', 'manager']) then
    raise exception 'forbidden: only an owner or manager may cancel a sale'
      using errcode = 'insufficient_privilege';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'reason_required: tell the customer why the sale is cancelled'
      using errcode = 'check_violation';
  end if;

  select * into v_sale from public.sales
  where tenant_id = p_tenant and id = p_sale_id
  for update;

  if not found then
    raise exception 'unknown_sale' using errcode = 'check_violation';
  end if;

  if v_sale.status = 'voided' then
    return jsonb_build_object('sale_id', v_sale.id, 'already_voided', true);
  end if;

  -- Put the stock back.
  for v_item in
    select si.*, p.is_service
    from public.sale_items si
    join public.products p on p.tenant_id = si.tenant_id and p.id = si.product_id
    where si.tenant_id = p_tenant and si.sale_id = p_sale_id
  loop
    if not v_item.is_service then
      insert into public.stock_movements (
        tenant_id, client_id, product_id, variant_id, batch_id, movement_type,
        qty_delta, unit_cost_paisa, reason, reference_type, reference_id, created_by
      )
      values (
        p_tenant, gen_random_uuid(), v_item.product_id, v_item.variant_id, v_item.batch_id,
        'sale_return', v_item.qty, v_item.cost_price_paisa, p_reason, 'sale', p_sale_id, v_user
      );
    end if;
  end loop;

  -- Reverse any credit this sale created.
  if v_sale.due_paisa > 0 and v_sale.customer_id is not null then
    insert into public.ledger_entries (
      tenant_id, customer_id, entry_type, amount_paisa, sale_id, note, created_by, client_id
    )
    values (
      p_tenant, v_sale.customer_id, 'credit', v_sale.due_paisa, p_sale_id,
      'বিক্রি বাতিল: ' || p_reason, v_user, gen_random_uuid()
    );
  end if;

  update public.sales
  set status = 'voided', voided_at = now(), voided_by = v_user, void_reason = btrim(p_reason)
  where id = p_sale_id
  returning * into v_sale;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'status', v_sale.status,
    'reversed_due_paisa', v_sale.due_paisa,
    'already_voided', false
  );
end;
$$;

-- ------------------------------------------------------------ today_summary
-- Dashboard numbers for one business day. Profit is shown to owner/manager only.
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
  v_count integer;
  v_due_given bigint;
  v_collected bigint;
  v_profit bigint;
  v_can_see_profit boolean;
begin
  if not public.is_tenant_member(p_tenant) then
    raise exception 'not_a_member' using errcode = 'insufficient_privilege';
  end if;

  v_can_see_profit := public.has_tenant_role(p_tenant, array['owner', 'manager']);

  select coalesce(sum(total_paisa), 0), count(*), coalesce(sum(due_paisa), 0)
    into v_sales, v_count, v_due_given
  from public.sales
  where tenant_id = p_tenant and business_date = v_date and status = 'completed';

  select coalesce(sum(amount_paisa), 0) into v_collected
  from public.payments
  where tenant_id = p_tenant
    and sale_id is null
    and received_at >= v_date::timestamptz
    and received_at < (v_date + 1)::timestamptz;

  if v_can_see_profit then
    select coalesce(sum(si.line_total_paisa - si.cost_price_paisa * si.qty), 0) into v_profit
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

-- --------------------------------------------------------------------- grants
revoke execute on function public.create_tenant(text, public.business_pack, text) from public;
revoke execute on function public.create_sale(uuid, jsonb) from public;
revoke execute on function public.collect_due(uuid, jsonb) from public;
revoke execute on function public.record_stock_movement(uuid, jsonb) from public;
revoke execute on function public.void_sale(uuid, uuid, text) from public;
revoke execute on function public.customer_balance(uuid, uuid) from public;
revoke execute on function public.tenant_day_summary(uuid, date) from public;

grant execute on function public.create_tenant(text, public.business_pack, text) to authenticated, service_role;
grant execute on function public.create_sale(uuid, jsonb) to authenticated, service_role;
grant execute on function public.collect_due(uuid, jsonb) to authenticated, service_role;
grant execute on function public.record_stock_movement(uuid, jsonb) to authenticated, service_role;
grant execute on function public.void_sale(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.customer_balance(uuid, uuid) to authenticated, service_role;
grant execute on function public.tenant_day_summary(uuid, date) to authenticated, service_role;
