-- =============================================================================
-- 0013 — Audit log: tables without an `id` column
-- =============================================================================
-- Found while building the POS: `app.log_audit()` recorded `new.id`, but
-- `app_settings` is keyed by `tenant_id` and has no `id` column at all. Any
-- update an owner made to their own shop settings therefore failed with
--   record "new" has no field "id"
-- and the settings screen would have been unusable in Phase 10.
--
-- The SQL tests never caught it because the only settings update in the suite
-- was made by a cashier, whose write is refused by RLS before the trigger runs.
--
-- The fix keeps `id` as the natural key when it exists and falls back to
-- `tenant_id` for one-row-per-shop tables.
-- =============================================================================

create or replace function app.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_entity_id uuid;
  v_tenant uuid;
begin
  -- `new` is not assigned in a DELETE trigger, so each branch is explicit.
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old) - 'search_vector';
    v_after := null;
    v_row := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old) - 'search_vector';
    v_after := to_jsonb(new) - 'search_vector';
    v_row := to_jsonb(new);
  else
    v_before := null;
    v_after := to_jsonb(new) - 'search_vector';
    v_row := to_jsonb(new);
  end if;

  -- Not every audited table has a surrogate key (app_settings is keyed by the
  -- shop itself), so fall back to the tenant id.
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'tenant_id')::uuid;
  v_tenant := (v_row ->> 'tenant_id')::uuid;

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

comment on function app.log_audit() is
  'Append-only audit of price, deletion, membership and settings changes. Uses id, or tenant_id for one-row-per-shop tables.';
