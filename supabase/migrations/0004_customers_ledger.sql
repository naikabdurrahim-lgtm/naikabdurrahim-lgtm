-- =============================================================================
-- 0004 — Customers and the due ledger (বাকির খাতা)
-- =============================================================================
-- Due balance is DERIVED: sum(debit) - sum(credit) over ledger_entries.
-- ledger_entries is append-only. A due sale writes a debit; a collection writes
-- a credit; a voided sale writes a reversing credit. Nothing is ever edited.
-- =============================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  note text,
  credit_limit_paisa bigint check (credit_limit_paisa is null or credit_limit_paisa >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint customers_name_len check (char_length(btrim(name)) between 1 and 120),
  constraint customers_phone_format check (phone is null or phone ~ '^\+?[0-9]{6,15}$'),
  constraint customers_tenant_id_key unique (tenant_id, id)
);

create unique index customers_unique_active_phone
  on public.customers (tenant_id, phone)
  where phone is not null and deleted_at is null;

create index customers_tenant_name_idx on public.customers (tenant_id, name) where deleted_at is null;
create index customers_sync_idx on public.customers (tenant_id, updated_at);

create trigger customers_touch before update on public.customers
  for each row execute function app.touch_updated_at();

-- --------------------------------------------------------------- ledger_entries
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null,
  entry_type public.ledger_entry_type not null,
  amount_paisa bigint not null check (amount_paisa > 0),
  sale_id uuid,
  payment_id uuid,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  client_id uuid not null,
  constraint ledger_entries_note_len check (note is null or char_length(note) <= 300),
  constraint ledger_entries_sale_amount check (amount_paisa <= 100000000000),
  -- Idempotent sync: the same client-generated id can be pushed twice safely.
  constraint ledger_entries_client_key unique (tenant_id, client_id),
  constraint ledger_entries_customer_fkey foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id) on delete restrict
);

create index ledger_entries_customer_idx
  on public.ledger_entries (tenant_id, customer_id, occurred_at desc);
create index ledger_entries_tenant_date_idx on public.ledger_entries (tenant_id, occurred_at desc);
create index ledger_entries_sync_idx on public.ledger_entries (tenant_id, created_at);

-- Append-only: corrections are reversing entries, never edits.
create trigger ledger_entries_no_update_delete
  before update or delete on public.ledger_entries
  for each row execute function app.forbid_mutation();

comment on table public.ledger_entries is
  'Append-only customer due ledger. Balance = sum(debit) - sum(credit).';
