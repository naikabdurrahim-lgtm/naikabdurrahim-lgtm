-- =============================================================================
-- 0002 — Tenancy: profiles, tenants, members, settings, RLS helper predicates
-- =============================================================================
-- Multi-tenancy model:
--   tenants 1..n tenant_members n..1 auth.users
-- Every business table carries tenant_id, and child rows reference parents with
-- COMPOSITE foreign keys (tenant_id, parent_id) so a row can never be attached
-- to a parent in another tenant — enforced by the database, not by app code.
-- =============================================================================

-- ------------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_path text,
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  numeral_style text not null default 'bn' check (numeral_style in ('bn', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_full_name_len check (char_length(full_name) <= 120),
  -- Normalised Bangladeshi mobile number: +8801XXXXXXXXX
  constraint profiles_phone_format check (phone is null or phone ~ '^\+8801[3-9][0-9]{8}$')
);

create unique index profiles_phone_key on public.profiles (phone)
  where phone is not null and deleted_at is null;

create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

comment on table public.profiles is 'One row per auth user. Created by trigger, never by the client.';

-- -------------------------------------------------------------------- tenants
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pack public.business_pack not null default 'general',
  owner_id uuid not null references auth.users (id) on delete restrict,
  currency char(3) not null default 'BDT',
  timezone text not null default 'Asia/Dhaka',
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tenants_name_len check (char_length(btrim(name)) between 1 and 120)
);

create trigger tenants_touch before update on public.tenants
  for each row execute function app.touch_updated_at();

-- ------------------------------------------------------------- tenant_members
create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'cashier',
  display_name text,
  is_active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tenant_members_display_name_len check (display_name is null or char_length(display_name) <= 80),
  constraint tenant_members_tenant_id_key unique (tenant_id, id)
);

create unique index tenant_members_unique_active
  on public.tenant_members (tenant_id, user_id)
  where deleted_at is null;

create index tenant_members_user_idx on public.tenant_members (user_id) where deleted_at is null;
create index tenant_members_tenant_role_idx on public.tenant_members (tenant_id, role) where deleted_at is null;

create trigger tenant_members_touch before update on public.tenant_members
  for each row execute function app.touch_updated_at();

comment on table public.tenant_members is 'Role per user per shop. Source of truth for every permission check.';

-- ---------------------------------------------------------------- app_settings
create table public.app_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  allow_negative_stock boolean not null default false,
  low_stock_alert_qty numeric(14, 3) not null default 5 check (low_stock_alert_qty >= 0),
  default_unit text not null default 'piece',
  receipt_header text,
  receipt_footer text not null default 'ধন্যবাদ! আবার আসবেন।',
  show_profit_to_manager boolean not null default true,
  allow_cashier_discount boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_receipt_footer_len check (char_length(receipt_footer) <= 300)
);

create trigger app_settings_touch before update on public.app_settings
  for each row execute function app.touch_updated_at();

-- ============================================================================
-- RLS helper predicates — SECURITY DEFINER so policies on tenant_members itself
-- do not recurse. search_path is pinned to prevent search_path hijacking.
-- ============================================================================

create or replace function public.is_tenant_member(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = p_tenant
      and m.user_id = auth.uid()
      and m.is_active
      and m.deleted_at is null
  );
$$;

create or replace function public.has_tenant_role(p_tenant uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = p_tenant
      and m.user_id = auth.uid()
      and m.is_active
      and m.deleted_at is null
      and m.role::text = any (p_roles)
  );
$$;

create or replace function public.is_tenant_owner(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_tenant_role(p_tenant, array['owner']);
$$;

-- True when the target user shares at least one shop with the caller.
create or replace function public.shares_tenant_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_members mine
    join public.tenant_members theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid()
      and mine.is_active
      and mine.deleted_at is null
      and theirs.user_id = p_user
      and theirs.is_active
      and theirs.deleted_at is null
  );
$$;

revoke execute on function public.is_tenant_member(uuid) from public;
revoke execute on function public.has_tenant_role(uuid, text[]) from public;
revoke execute on function public.is_tenant_owner(uuid) from public;
revoke execute on function public.shares_tenant_with(uuid) from public;

grant execute on function public.is_tenant_member(uuid) to authenticated, service_role;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.is_tenant_owner(uuid) to authenticated, service_role;
grant execute on function public.shares_tenant_with(uuid) to authenticated, service_role;

-- ------------------------------------------------- auth.users -> profile sync
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
