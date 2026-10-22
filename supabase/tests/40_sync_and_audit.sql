-- =============================================================================
-- 40 — Sync support: monotonic updated_at, soft deletes, audit of overwrites
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'sync@test.local', '{"full_name":"Sync Owner"}');

select tests.as_user('eeeeeeee-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('সিঙ্ক দোকান', 'general', 'Sync Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'সিঙ্ক দোকান';

insert into public.products (tenant_id, name, sell_price_paisa)
select id, 'মোবাইল রিচার্জ', 10000 from public.tenants where name = 'সিঙ্ক দোকান';

insert into fixtures select 'product', id from public.products where name = 'মোবাইল রিচার্জ';

-- Two writes inside one transaction must still produce increasing timestamps,
-- otherwise a pull-sync cursor keyed on updated_at could skip a row.
do $$
declare
  v_first timestamptz;
  v_second timestamptz;
  v_third timestamptz;
  v_id uuid := (select id from fixtures where key = 'product');
begin
  select updated_at into v_first from public.products where id = v_id;
  update public.products set sell_price_paisa = 11000 where id = v_id;
  select updated_at into v_second from public.products where id = v_id;
  update public.products set sell_price_paisa = 12000 where id = v_id;
  select updated_at into v_third from public.products where id = v_id;

  perform tests.ok(v_second > v_first, 'updated_at increases after the first update');
  perform tests.ok(v_third > v_second, 'updated_at increases again after the second update');
end;
$$;

-- Soft delete keeps the row: history and sync tombstones depend on it.
update public.products set deleted_at = now() where name = 'মোবাইল রিচার্জ';

select tests.eq(
  (select count(*) from public.products where deleted_at is not null),
  1::bigint,
  'a deleted product stays in the table as a soft-deleted row'
);

-- Both price changes and the deletion are audited, with before/after values.
select tests.eq(
  (select count(*) from public.audit_logs where entity_table = 'products'),
  3::bigint,
  'each price change and the deletion are audited'
);

select tests.ok(
  (select bool_and((before_data ->> 'sell_price_paisa') is not null)
   from public.audit_logs where action = 'update:products'),
  'audit rows keep the previous value, so an overwrite can be traced'
);

select tests.ok(
  (select bool_and(after_data is not null) from public.audit_logs where action = 'update:products'),
  'audit rows keep the new value too'
);

-- A cheaper-to-read view for the sync engine: only rows changed since a cursor.
select tests.ok(
  (select bool_and(updated_at is not null) from public.products),
  'every product row has an updated_at value usable as a sync cursor'
);

-- Sync telemetry is append-only.
insert into public.sync_events (tenant_id, device_id, direction, table_name, row_count)
select id, 'device-1', 'push', 'sales', 3 from public.tenants where name = 'সিঙ্ক দোকান';

select tests.eq(
  (select count(*) from public.sync_events), 1::bigint,
  'the client can record a sync event'
);

select tests.denied(null,
  $sql$update public.sync_events set row_count = 0$sql$,
  'sync events cannot be rewritten');

select tests.denied(null,
  $sql$delete from public.sync_events$sql$,
  'sync events cannot be deleted');

-- Tenant scoping on the telemetry table.
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000002', 'outsider@test.local', '{"full_name":"Outsider"}');

select tests.eq(
  tests.count_rows('eeeeeeee-0000-0000-0000-000000000002', 'public.sync_events'),
  0::bigint,
  'an outsider sees no sync telemetry'
);

select set_config('request.jwt.claim.sub', '', true);

rollback;
