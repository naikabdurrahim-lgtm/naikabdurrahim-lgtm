-- =============================================================================
-- 0007 — Audit log and sync telemetry (both append-only)
-- =============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_len check (char_length(action) between 1 and 80),
  constraint audit_logs_table_len check (char_length(entity_table) between 1 and 80)
);

create index audit_logs_tenant_date_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (tenant_id, entity_table, entity_id);

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function app.forbid_mutation();

-- Generic audit trigger. SECURITY DEFINER so a normal member's write can record
-- an audit row without needing INSERT rights on audit_logs.
create or replace function app.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
  v_tenant uuid;
begin
  -- `new` is not assigned in a DELETE trigger, so each branch is explicit.
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old) - 'search_vector';
    v_after := null;
    v_entity_id := old.id;
    v_tenant := old.tenant_id;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old) - 'search_vector';
    v_after := to_jsonb(new) - 'search_vector';
    v_entity_id := new.id;
    v_tenant := new.tenant_id;
  else
    v_before := null;
    v_after := to_jsonb(new) - 'search_vector';
    v_entity_id := new.id;
    v_tenant := new.tenant_id;
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_table, entity_id, before_data, after_data)
  values (
    v_tenant,
    auth.uid(),
    lower(tg_op) || ':' || tg_table_name,
    tg_table_name,
    v_entity_id,
    v_before,
    v_after
  );

  return null;
end;
$$;

-- Price and deletion changes are the ones an owner must be able to review.
create trigger products_audit_update
  after update on public.products
  for each row
  when (
    old.sell_price_paisa is distinct from new.sell_price_paisa
    or old.buy_price_paisa is distinct from new.buy_price_paisa
    or old.deleted_at is distinct from new.deleted_at
    or old.name is distinct from new.name
  )
  execute function app.log_audit();

create trigger customers_audit_update
  after update on public.customers
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function app.log_audit();

create trigger tenant_members_audit_write
  after insert or update or delete on public.tenant_members
  for each row execute function app.log_audit();

create trigger app_settings_audit_update
  after update on public.app_settings
  for each row execute function app.log_audit();

-- ----------------------------------------------------------------- sync_events
create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  device_id text not null,
  direction text not null check (direction in ('push', 'pull')),
  table_name text not null,
  row_count integer not null default 0 check (row_count >= 0),
  client_at timestamptz,
  meta jsonb,
  created_at timestamptz not null default now(),
  constraint sync_events_device_len check (char_length(device_id) between 1 and 120)
);

create index sync_events_tenant_date_idx on public.sync_events (tenant_id, created_at desc);

create trigger sync_events_no_update_delete
  before update or delete on public.sync_events
  for each row execute function app.forbid_mutation();
