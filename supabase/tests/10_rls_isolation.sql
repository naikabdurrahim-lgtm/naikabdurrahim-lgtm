-- =============================================================================
-- 10 — Tenant isolation: shop A must never see or touch shop B's data.
-- =============================================================================
-- Fixtures: owner_a (shop A), cashier_a (shop A), owner_b (shop B).
--
-- Note on UPDATE/DELETE: RLS hides other tenants' rows, so an UPDATE simply
-- matches nothing and raises no error. Those tests therefore assert the EFFECT
-- (the row is unchanged) rather than expecting an exception.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.local', '{"full_name":"Owner A"}'),
  ('22222222-2222-2222-2222-222222222222', 'cashier_a@test.local', '{"full_name":"Cashier A"}'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@test.local', '{"full_name":"Owner B"}');

select tests.eq(
  (select count(*) from public.profiles
    where id in ('11111111-1111-1111-1111-111111111111',
                 '22222222-2222-2222-2222-222222222222',
                 '33333333-3333-3333-3333-333333333333')),
  3::bigint,
  'a profile is created automatically for every new auth user'
);

-- Shops are created through the RPC, exactly as the app does it.
select tests.as_user('11111111-1111-1111-1111-111111111111',
  $sql$select public.create_tenant('দোকান এ', 'grocery', 'Owner A')$sql$);

select tests.as_user('33333333-3333-3333-3333-333333333333',
  $sql$select public.create_tenant('Shop B', 'pharmacy', 'Owner B')$sql$);

insert into fixtures select 'tenant_a', id from public.tenants where name = 'দোকান এ';
insert into fixtures select 'tenant_b', id from public.tenants where name = 'Shop B';

select tests.eq((select count(*) from fixtures), 2::bigint, 'both shops exist');

-- cashier_a joins shop A (an owner adds staff).
insert into public.tenant_members (tenant_id, user_id, role, display_name)
select id, '22222222-2222-2222-2222-222222222222', 'cashier', 'Cashier A'
from public.tenants where name = 'দোকান এ';

insert into public.products (tenant_id, name, sell_price_paisa, buy_price_paisa, unit_code)
select id, 'চাল ১ কেজি', 7500, 6800, 'kg' from public.tenants where name = 'দোকান এ';

insert into public.products (tenant_id, name, sell_price_paisa, buy_price_paisa, unit_code)
select id, 'Napa 500mg', 200, 150, 'strip' from public.tenants where name = 'Shop B';

insert into fixtures select 'product_b', id from public.products where name = 'Napa 500mg';

insert into public.customers (tenant_id, name, phone)
select id, 'করিম', '+8801700000000' from public.tenants where name = 'Shop B';

-- ------------------------------------------------------- isolation: read side
select tests.eq(
  tests.count_rows('11111111-1111-1111-1111-111111111111', 'public.products'),
  1::bigint,
  'owner A sees only their own products'
);

select tests.eq(
  tests.count_rows('11111111-1111-1111-1111-111111111111', 'public.tenants'),
  1::bigint,
  'owner A sees only their own shop'
);

select tests.eq(
  tests.count_rows('11111111-1111-1111-1111-111111111111', 'public.customers'),
  0::bigint,
  'owner A cannot see shop B customers'
);

select tests.eq(
  tests.count_as('11111111-1111-1111-1111-111111111111',
    format($sql$select id from public.products where tenant_id = %L$sql$,
           (select id from fixtures where key = 'tenant_b'))),
  0::bigint,
  'a cross-tenant id lookup returns no rows instead of failing'
);

select tests.eq(
  tests.count_as('11111111-1111-1111-1111-111111111111', $sql$select 1 from public.sales$sql$),
  0::bigint,
  'owner A sees no sales from shop B'
);

-- ------------------------------------------------------ isolation: write side
-- INSERT into another tenant is refused by the WITH CHECK clause.
select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$insert into public.products (tenant_id, name, sell_price_paisa)
               values (%L, 'Hacked', 100)$sql$,
         (select id from fixtures where key = 'tenant_b')),
  'owner A cannot insert a product into shop B');

-- UPDATE and DELETE match nothing, so the row must be untouched afterwards.
select tests.as_user('11111111-1111-1111-1111-111111111111',
  format($sql$update public.products set sell_price_paisa = 1 where tenant_id = %L$sql$,
         (select id from fixtures where key = 'tenant_b')));

select tests.eq(
  (select sell_price_paisa from public.products where name = 'Napa 500mg'),
  200::bigint,
  'owner A cannot change a price in shop B'
);

select tests.as_user('11111111-1111-1111-1111-111111111111',
  format($sql$delete from public.products where tenant_id = %L$sql$,
         (select id from fixtures where key = 'tenant_b')));

select tests.eq(
  (select count(*) from public.products where name = 'Napa 500mg'),
  1::bigint,
  'owner A cannot delete a product in shop B'
);

-- Money tables are read-only for everyone: writes only happen via the RPCs.
select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$insert into public.sales (tenant_id, client_id, subtotal_paisa, paid_paisa, created_by)
               values (%L, gen_random_uuid(), 1000, 1000,
                       '11111111-1111-1111-1111-111111111111')$sql$,
         (select id from fixtures where key = 'tenant_a')),
  'nobody can insert a sale directly: create_sale() is the only path');

select tests.denied('11111111-1111-1111-1111-111111111111',
  $sql$insert into public.ledger_entries (tenant_id, customer_id, entry_type, amount_paisa, client_id)
      values ('33333333-3333-3333-3333-333333333333', gen_random_uuid(), 'debit', 100, gen_random_uuid())$sql$,
  'ledger entries cannot be inserted directly');

select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$insert into public.stock_movements (tenant_id, client_id, product_id, movement_type, qty_delta)
               values (%L, gen_random_uuid(), %L, 'adjustment', 5)$sql$,
         (select id from fixtures where key = 'tenant_a'),
         (select id from public.products where name = 'চাল ১ কেজি')),
  'stock movements cannot be inserted directly');

-- Members of shop A cannot add themselves to shop B.
select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$insert into public.tenant_members (tenant_id, user_id, role)
               values (%L, '11111111-1111-1111-1111-111111111111', 'owner')$sql$,
         (select id from fixtures where key = 'tenant_b')),
  'owner A cannot join shop B by inserting a membership row');

-- RPCs re-check membership server-side, independent of RLS.
select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$select public.create_sale(%L,
        '{"client_id":"44444444-4444-4444-4444-444444444444","paid_paisa":0,"items":[]}'::jsonb)$sql$,
         (select id from fixtures where key = 'tenant_b')),
  'create_sale refuses a tenant the caller does not belong to');

select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$select public.record_stock_movement(%L,
        jsonb_build_object('client_id', gen_random_uuid(),
                           'product_id', %L,
                           'qty_delta', 5,
                           'movement_type', 'adjustment',
                           'reason', 'x'))$sql$,
         (select id from fixtures where key = 'tenant_b'),
         (select id from fixtures where key = 'product_b')),
  'record_stock_movement refuses a foreign tenant');

select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$select public.collect_due(%L,
        jsonb_build_object('client_id', gen_random_uuid(),
                           'customer_id', %L,
                           'amount_paisa', 100))$sql$,
         (select id from fixtures where key = 'tenant_b'),
         (select id from public.customers where name = 'করিম')),
  'collect_due refuses a foreign tenant');

select tests.denied('11111111-1111-1111-1111-111111111111',
  format($sql$select public.void_sale(%L, gen_random_uuid(), 'x')$sql$,
         (select id from fixtures where key = 'tenant_b')),
  'void_sale refuses a foreign tenant');

-- Audit logs are owner-only and never cross shops.
select tests.eq(
  tests.count_rows('22222222-2222-2222-2222-222222222222', 'public.audit_logs'),
  0::bigint,
  'a cashier cannot read the audit log'
);

select tests.eq(
  tests.count_as('11111111-1111-1111-1111-111111111111',
    format($sql$select * from public.audit_logs where tenant_id = %L$sql$,
           (select id from fixtures where key = 'tenant_b'))),
  0::bigint,
  'owner A cannot read shop B audit logs'
);

-- Profiles are visible to colleagues only, never across shops.
select tests.eq(
  tests.count_as('11111111-1111-1111-1111-111111111111',
    $sql$select * from public.profiles where id = '33333333-3333-3333-3333-333333333333'$sql$),
  0::bigint,
  'owner A cannot read owner B profile'
);

select tests.eq(
  tests.count_as('11111111-1111-1111-1111-111111111111',
    $sql$select * from public.profiles where id = '22222222-2222-2222-2222-222222222222'$sql$),
  1::bigint,
  'owner A can read a colleague profile in the same shop'
);

-- Views must not leak across tenants either.
select tests.eq(
  tests.count_as('11111111-1111-1111-1111-111111111111', $sql$select * from public.v_customer_balances$sql$),
  0::bigint,
  'the balance view shows nothing from shop B'
);

select set_config('request.jwt.claim.sub', '', true);

rollback;
