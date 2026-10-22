-- =============================================================================
-- 0003 — Catalog: units (global reference), categories, products, variants,
--        batches, suppliers
-- =============================================================================
-- Money: integer paisa (bigint). Quantity: numeric(14,3) for kg / gram / litre.
-- `units` is controlled vocabulary shared by all tenants — read-only for clients.
-- =============================================================================

-- ----------------------------------------------------------------------- units
create table public.units (
  code text primary key,
  label_bn text not null,
  label_en text not null,
  kind text not null check (kind in ('count', 'weight', 'volume')),
  allows_decimal boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.units is 'Global measurement vocabulary. Clients may read, never write.';

alter table public.app_settings
  add constraint app_settings_default_unit_fkey
  foreign key (default_unit) references public.units (code);

-- ------------------------------------------------------------------ categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  name_en text,
  icon text not null default 'package',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint categories_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint categories_tenant_id_key unique (tenant_id, id)
);

create unique index categories_unique_active_name
  on public.categories (tenant_id, lower(name))
  where deleted_at is null;

create trigger categories_touch before update on public.categories
  for each row execute function app.touch_updated_at();

-- -------------------------------------------------------------------- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid,
  name text not null,
  name_en text,
  barcode text,
  sku text,
  unit_code text not null default 'piece' references public.units (code),
  buy_price_paisa bigint not null default 0 check (buy_price_paisa >= 0),
  sell_price_paisa bigint not null check (sell_price_paisa >= 0),
  wholesale_price_paisa bigint check (wholesale_price_paisa is null or wholesale_price_paisa >= 0),
  stock_qty numeric(14, 3) not null default 0,
  stock_alert_qty numeric(14, 3) not null default 0 check (stock_alert_qty >= 0),
  -- Services (salon, repairs) are sold without stock tracking.
  is_service boolean not null default false,
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(name_en, '') || ' ' ||
      coalesce(barcode, '') || ' ' || coalesce(sku, '')
    )
  ) stored,
  constraint products_name_len check (char_length(btrim(name)) between 1 and 160),
  constraint products_sell_price_positive check (sell_price_paisa <= 100000000000),
  constraint products_tenant_id_key unique (tenant_id, id),
  -- Only the category column is nulled; tenant_id must stay NOT NULL.
  constraint products_category_fkey foreign key (tenant_id, category_id)
    references public.categories (tenant_id, id) on delete set null (category_id)
);

create unique index products_unique_barcode
  on public.products (tenant_id, barcode)
  where barcode is not null and deleted_at is null;

create unique index products_unique_sku
  on public.products (tenant_id, sku)
  where sku is not null and deleted_at is null;

create index products_tenant_name_idx on public.products (tenant_id, name) where deleted_at is null;
create index products_tenant_active_idx on public.products (tenant_id, is_active) where deleted_at is null;
create index products_search_idx on public.products using gin (search_vector);
create index products_sync_idx on public.products (tenant_id, updated_at);

create trigger products_touch before update on public.products
  for each row execute function app.touch_updated_at();

comment on column public.products.stock_qty is
  'Cached stock level maintained by stock_movements triggers. Verified against v_stock_on_hand by SQL tests.';

-- ------------------------------------------------------------ product_variants
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  name text not null,
  sku text,
  barcode text,
  buy_price_paisa bigint check (buy_price_paisa is null or buy_price_paisa >= 0),
  sell_price_paisa bigint check (sell_price_paisa is null or sell_price_paisa >= 0),
  stock_qty numeric(14, 3) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint product_variants_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint product_variants_tenant_id_key unique (tenant_id, id),
  constraint product_variants_product_fkey foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create unique index product_variants_unique_barcode
  on public.product_variants (tenant_id, barcode)
  where barcode is not null and deleted_at is null;

create unique index product_variants_unique_name
  on public.product_variants (tenant_id, product_id, lower(name))
  where deleted_at is null;

create index product_variants_product_idx on public.product_variants (tenant_id, product_id);
create index product_variants_sync_idx on public.product_variants (tenant_id, updated_at);

create trigger product_variants_touch before update on public.product_variants
  for each row execute function app.touch_updated_at();

-- ------------------------------------------------------------- product_batches
-- Pharmacy pack: batch number + expiry. Also usable for any perishable goods.
create table public.product_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  variant_id uuid,
  batch_no text not null,
  expiry_date date,
  buy_price_paisa bigint not null default 0 check (buy_price_paisa >= 0),
  qty_received numeric(14, 3) not null default 0 check (qty_received >= 0),
  qty_remaining numeric(14, 3) not null default 0,
  supplier_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint product_batches_batch_no_len check (char_length(btrim(batch_no)) between 1 and 60),
  constraint product_batches_tenant_id_key unique (tenant_id, id),
  constraint product_batches_product_fkey foreign key (tenant_id, product_id)
    references public.products (tenant_id, id) on delete cascade
);

create unique index product_batches_unique_no
  on public.product_batches (tenant_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(batch_no))
  where deleted_at is null;

create index product_batches_expiry_idx on public.product_batches (tenant_id, expiry_date)
  where deleted_at is null;
create index product_batches_product_idx on public.product_batches (tenant_id, product_id);
create index product_batches_sync_idx on public.product_batches (tenant_id, updated_at);

create trigger product_batches_touch before update on public.product_batches
  for each row execute function app.touch_updated_at();

-- ------------------------------------------------------------------- suppliers
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint suppliers_name_len check (char_length(btrim(name)) between 1 and 120),
  constraint suppliers_phone_format check (phone is null or phone ~ '^\+?[0-9]{6,15}$'),
  constraint suppliers_tenant_id_key unique (tenant_id, id)
);

create unique index suppliers_unique_active_name
  on public.suppliers (tenant_id, lower(name))
  where deleted_at is null;

create index suppliers_sync_idx on public.suppliers (tenant_id, updated_at);

create trigger suppliers_touch before update on public.suppliers
  for each row execute function app.touch_updated_at();

-- Deferred FKs that need both tables to exist.
alter table public.product_batches
  add constraint product_batches_supplier_fkey foreign key (tenant_id, supplier_id)
  references public.suppliers (tenant_id, id) on delete set null (supplier_id);

alter table public.product_batches
  add constraint product_batches_variant_fkey foreign key (tenant_id, variant_id)
  references public.product_variants (tenant_id, id) on delete set null (variant_id);
