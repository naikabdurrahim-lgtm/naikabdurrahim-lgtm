-- =============================================================================
-- 0005 — Sales, sale items, payments
-- =============================================================================
-- All three tables are append-only. Writes happen exclusively through the
-- create_sale() / collect_due() / void_sale() functions in 0009, so a client can
-- never forge a total, back-date a payment, or delete history.
-- =============================================================================

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Client-generated id: re-sending an offline sale must not create a duplicate.
  client_id uuid not null,
  invoice_seq bigint,
  invoice_no text generated always as (
    case when invoice_seq is null then null
         else 'INV-' || lpad(invoice_seq::text, 5, '0') end
  ) stored,
  customer_id uuid,
  status public.sale_status not null default 'completed',
  -- Business date in the shop's timezone; supplied by the device so an offline
  -- sale still lands on the day it was actually made.
  business_date date not null default ((now() at time zone 'Asia/Dhaka')::date),
  subtotal_paisa bigint not null check (subtotal_paisa > 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  discount_kind text not null default 'amount' check (discount_kind in ('amount', 'percent')),
  total_paisa bigint generated always as (subtotal_paisa - discount_paisa) stored,
  paid_paisa bigint not null default 0 check (paid_paisa >= 0),
  due_paisa bigint generated always as (subtotal_paisa - discount_paisa - paid_paisa) stored,
  note text,
  device_id text,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint sales_discount_within_subtotal check (discount_paisa <= subtotal_paisa),
  constraint sales_paid_within_total check (paid_paisa <= subtotal_paisa - discount_paisa),
  constraint sales_note_len check (note is null or char_length(note) <= 500),
  constraint sales_void_reason_len check (void_reason is null or char_length(void_reason) <= 300),
  constraint sales_client_key unique (tenant_id, client_id),
  constraint sales_tenant_id_key unique (tenant_id, id),
  constraint sales_customer_fkey foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id) on delete restrict
);

create unique index sales_unique_invoice on public.sales (tenant_id, invoice_no)
  where invoice_no is not null;

create index sales_tenant_date_idx on public.sales (tenant_id, business_date desc);
create index sales_tenant_customer_idx on public.sales (tenant_id, customer_id)
  where customer_id is not null;
create index sales_sync_idx on public.sales (tenant_id, updated_at);
create index sales_open_due_idx on public.sales (tenant_id, business_date)
  where due_paisa > 0 and status = 'completed';

create trigger sales_touch before update on public.sales
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------- sale_items
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sale_id uuid not null,
  product_id uuid,
  variant_id uuid,
  batch_id uuid,
  -- Snapshot fields: the receipt must never change when a product is renamed.
  name_snapshot text not null,
  unit_code text not null default 'piece',
  qty numeric(14, 3) not null check (qty > 0),
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  -- Cost at the time of sale, used for profit. Hidden from cashiers by RLS.
  cost_price_paisa bigint not null default 0 check (cost_price_paisa >= 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  line_total_paisa bigint not null default 0 check (line_total_paisa >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint sale_items_name_len check (char_length(btrim(name_snapshot)) between 1 and 160),
  constraint sale_items_tenant_id_key unique (tenant_id, id),
  constraint sale_items_sale_fkey foreign key (tenant_id, sale_id)
    references public.sales (tenant_id, id) on delete restrict,
  constraint sale_items_variant_fkey foreign key (tenant_id, variant_id)
    references public.product_variants (tenant_id, id) on delete restrict,
  constraint sale_items_batch_fkey foreign key (tenant_id, batch_id)
    references public.product_batches (tenant_id, id) on delete restrict
);

create index sale_items_sale_idx on public.sale_items (tenant_id, sale_id);
create index sale_items_product_idx on public.sale_items (tenant_id, product_id);

-- The database computes the line total; never trust a client-supplied value.
create or replace function app.compute_sale_item_total()
returns trigger
language plpgsql
as $$
declare
  v_gross bigint;
begin
  v_gross := round(new.qty * new.unit_price_paisa)::bigint;
  if new.discount_paisa > v_gross then
    raise exception 'sale_item_discount_exceeds_line: discount % > gross %', new.discount_paisa, v_gross
      using errcode = 'check_violation';
  end if;
  new.line_total_paisa := v_gross - new.discount_paisa;
  return new;
end;
$$;

create trigger sale_items_compute_total
  before insert or update on public.sale_items
  for each row execute function app.compute_sale_item_total();

create trigger sale_items_no_update_delete
  before update or delete on public.sale_items
  for each row execute function app.forbid_mutation();

-- The sale's subtotal must equal the sum of its lines. Deferred so the sale and
-- its items can be inserted in either order inside one transaction.
create or replace function app.check_sale_subtotal()
returns trigger
language plpgsql
as $$
declare
  v_sale_id uuid := coalesce(new.sale_id, old.sale_id);
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_sum bigint;
  v_declared bigint;
begin
  select coalesce(sum(line_total_paisa), 0) into v_sum
  from public.sale_items
  where tenant_id = v_tenant and sale_id = v_sale_id;

  select subtotal_paisa into v_declared
  from public.sales
  where tenant_id = v_tenant and id = v_sale_id;

  if v_declared is null then
    return null; -- sale removed inside this transaction; nothing to verify
  end if;

  if v_sum <> v_declared then
    raise exception 'sale_subtotal_mismatch: sale % declares % paisa but its lines sum to %',
      v_sale_id, v_declared, v_sum
      using errcode = 'check_violation',
            hint = 'Send the exact line totals; the server recomputes them from quantity and unit price.';
  end if;
  return null;
end;
$$;

create constraint trigger sale_items_check_subtotal
  after insert or update or delete on public.sale_items
  deferrable initially deferred
  for each row execute function app.check_sale_subtotal();

-- ------------------------------------------------------------------- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_id uuid not null,
  sale_id uuid,
  customer_id uuid,
  amount_paisa bigint not null check (amount_paisa > 0),
  method public.payment_method not null default 'cash',
  reference text,
  note text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint payments_target_present check (sale_id is not null or customer_id is not null),
  constraint payments_note_len check (note is null or char_length(note) <= 300),
  constraint payments_client_key unique (tenant_id, client_id),
  constraint payments_tenant_id_key unique (tenant_id, id),
  constraint payments_sale_fkey foreign key (tenant_id, sale_id)
    references public.sales (tenant_id, id) on delete restrict,
  constraint payments_customer_fkey foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id) on delete restrict
);

create index payments_sale_idx on public.payments (tenant_id, sale_id) where sale_id is not null;
create index payments_customer_idx on public.payments (tenant_id, customer_id) where customer_id is not null;
create index payments_tenant_date_idx on public.payments (tenant_id, received_at desc);
create index payments_sync_idx on public.payments (tenant_id, created_at);

create trigger payments_no_update_delete
  before update or delete on public.payments
  for each row execute function app.forbid_mutation();
