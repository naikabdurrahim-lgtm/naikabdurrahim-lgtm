-- =============================================================================
-- 20 — Role permissions: cashiers sell, managers manage, owners own.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@test.local', '{"full_name":"Owner"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'manager@test.local', '{"full_name":"Manager"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'cashier@test.local', '{"full_name":"Cashier"}');

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('রোল টেস্ট দোকান', 'general', 'Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'রোল টেস্ট দোকান';

insert into public.tenant_members (tenant_id, user_id, role, display_name)
select t.id, m.uid, m.role, m.label
from public.tenants t
cross join (values
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'manager'::public.member_role, 'Manager'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'cashier'::public.member_role, 'Cashier')
) as m(uid, role, label)
where t.name = 'রোল টেস্ট দোকান';

insert into public.products (tenant_id, name, buy_price_paisa, sell_price_paisa, unit_code)
select id, 'লবণ ১ কেজি', 3000, 4000, 'kg' from public.tenants where name = 'রোল টেস্ট দোকান';

-- Stock so a cashier can actually sell something.
select tests.as_user('aaaaaaaa-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'product_id', (select id from public.products where name = 'লবণ ১ কেজি'),
                         'qty_delta', 50,
                         'movement_type', 'opening',
                         'reason', 'শুরুর মজুদ'))$sql$,
    (select id from fixtures where key = 'tenant')));

-- --------------------------------------------------------------- cashier rules
select tests.eq(
  tests.count_rows('aaaaaaaa-0000-0000-0000-000000000003', 'public.products'),
  1::bigint,
  'cashier can read the catalogue'
);

-- RLS hides the rows from a cashier, so the UPDATE silently affects nothing.
-- The meaningful assertion is that the price did not change.
select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  $sql$update public.products set sell_price_paisa = 1$sql$);

select tests.eq(
  (select sell_price_paisa from public.products where name = 'লবণ ১ কেজি'),
  4000::bigint,
  'the price is unchanged after a cashier update attempt'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  $sql$delete from public.products$sql$);

select tests.eq(
  (select count(*) from public.products where name = 'লবণ ১ কেজি'),
  1::bigint,
  'cashier cannot delete a product'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  $sql$update public.tenants set name = 'Hacked'$sql$);

select tests.eq(
  (select name from public.tenants), 'রোল টেস্ট দোকান',
  'cashier cannot rename the shop'
);

select tests.denied('aaaaaaaa-0000-0000-0000-000000000003',
  format($sql$insert into public.tenant_members (tenant_id, user_id, role)
               values (%L, 'aaaaaaaa-0000-0000-0000-000000000003', 'owner')$sql$,
         (select id from fixtures where key = 'tenant')),
  'cashier cannot add staff');

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  $sql$update public.tenant_members set role = 'owner'
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$sql$);

select tests.eq(
  (select role::text from public.tenant_members
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'cashier',
  'cashier cannot promote themselves'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  $sql$update public.app_settings set allow_negative_stock = true$sql$);

select tests.eq(
  (select allow_negative_stock from public.app_settings), false,
  'cashier cannot change shop settings'
);

-- Profit is invisible to a cashier: no cost prices, no profit figure.
select tests.eq(
  tests.count_rows('aaaaaaaa-0000-0000-0000-000000000003', 'public.sale_items'),
  0::bigint,
  'cashier cannot read sale_items (cost price lives there)'
);

select tests.eq(
  tests.value_as('aaaaaaaa-0000-0000-0000-000000000003',
    format($sql$select coalesce(public.tenant_day_summary(%L, current_date) ->> 'profit_paisa', 'null')$sql$,
           (select id from fixtures where key = 'tenant'))),
  'null',
  'cashier gets no profit figure from the day summary'
);

-- Stock changes are manager-only.
select tests.denied('aaaaaaaa-0000-0000-0000-000000000003',
  format($sql$select public.record_stock_movement(%L,
        jsonb_build_object('client_id', gen_random_uuid(),
                           'product_id', (select id from public.products limit 1),
                           'qty_delta', 10,
                           'movement_type', 'adjustment',
                           'reason', 'cashier trying'))$sql$,
         (select id from fixtures where key = 'tenant')),
  'cashier cannot adjust stock');

select tests.denied('aaaaaaaa-0000-0000-0000-000000000003',
  format($sql$select public.void_sale(%L, gen_random_uuid(), 'cashier trying')$sql$,
         (select id from fixtures where key = 'tenant')),
  'cashier cannot cancel a sale');

-- But a cashier CAN sell. A full cash sale must succeed.
select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', '99999999-0000-0000-0000-000000000001',
        'paid_paisa', 8000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', (select id from public.products where name = 'লবণ ১ কেজি'),
          'qty', 2,
          'unit_price_paisa', 4000))
      ))$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.eq(
  (select count(*) from public.sales), 1::bigint,
  'a cashier can complete a sale'
);

select tests.eq(
  (select stock_qty from public.products where name = 'লবণ ১ কেজি'),
  48.000::numeric,
  'the sale deducted stock'
);

-- A cashier may take a due collection (that is counter work).
select tests.as_user('aaaaaaaa-0000-0000-0000-000000000001',
  $sql$insert into public.customers (tenant_id, name, phone)
      select id, 'রহিম', '+8801711111111' from public.tenants limit 1$sql$);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', '99999999-0000-0000-0000-000000000002',
        'customer_id', (select id from public.customers where name = 'রহিম'),
        'paid_paisa', 0,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', (select id from public.products where name = 'লবণ ১ কেজি'),
          'qty', 1,
          'unit_price_paisa', 4000))
      ))$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.eq(
  tests.value_as('aaaaaaaa-0000-0000-0000-000000000003',
    format($sql$select public.customer_balance(%L,
              (select id from public.customers where name = 'রহিম'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  '4000',
  'a cashier can record a credit sale'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000003',
  format($sql$select public.collect_due(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'customer_id', (select id from public.customers where name = 'রহিম'),
                         'amount_paisa', 1500))$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.eq(
  tests.value_as('aaaaaaaa-0000-0000-0000-000000000003',
    format($sql$select public.customer_balance(%L,
              (select id from public.customers where name = 'রহিম'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  '2500',
  'a cashier can collect a due payment'
);

-- A cashier can still print a receipt: the view exposes the lines without cost.
select tests.eq(
  tests.count_rows('aaaaaaaa-0000-0000-0000-000000000003', 'public.v_sale_items_receipt'),
  2::bigint,
  'a cashier can read receipt lines through the view'
);

select tests.eq(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'v_sale_items_receipt'
      and column_name in ('cost_price_paisa', 'line_total_paisa', 'profit_paisa')),
  1::bigint,
  'the receipt view exposes no cost or profit column'
);

-- --------------------------------------------------------------- manager rules
select tests.eq(
  tests.count_rows('aaaaaaaa-0000-0000-0000-000000000002', 'public.sale_items'),
  2::bigint,
  'a manager can read sale items'
);

select tests.eq(
  tests.value_as('aaaaaaaa-0000-0000-0000-000000000002',
    format($sql$select public.tenant_day_summary(%L, current_date) ->> 'profit_paisa'$sql$,
           (select id from fixtures where key = 'tenant'))),
  -- Sale 1: (4000-3000) x 2 = 2000 · Sale 2: (4000-3000) x 1 = 1000
  '3000',
  'a manager sees the profit figure'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000002',
  $sql$update public.products set sell_price_paisa = 4500$sql$);

select tests.eq(
  (select sell_price_paisa from public.products where name = 'লবণ ১ কেজি'),
  4500::bigint,
  'a manager can change a price'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000002',
  $sql$delete from public.tenant_members
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$sql$);

select tests.eq(
  (select count(*) from public.tenant_members
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000003' and deleted_at is null),
  1::bigint,
  'a manager cannot remove staff (owner only)'
);

select tests.as_user('aaaaaaaa-0000-0000-0000-000000000002',
  $sql$update public.tenants set name = 'Manager Rename'$sql$);

select tests.eq(
  (select name from public.tenants), 'রোল টেস্ট দোকান',
  'a manager cannot rename the shop (owner only)'
);

-- ---------------------------------------------------------------- owner rules
select tests.as_user('aaaaaaaa-0000-0000-0000-000000000001',
  $sql$update public.tenants set name = 'নতুন নাম'$sql$);

select tests.eq(
  (select name from public.tenants), 'নতুন নাম',
  'an owner can rename the shop'
);

select tests.denied('aaaaaaaa-0000-0000-0000-000000000001',
  $sql$update public.tenant_members set role = 'cashier'
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$sql$,
  'the last owner cannot demote themselves');

select tests.denied('aaaaaaaa-0000-0000-0000-000000000001',
  $sql$delete from public.tenant_members
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$sql$,
  'the last owner cannot be removed');

-- ------------------------------------------------------- audit trail visibility
select tests.ok(
  (select count(*) from public.audit_logs
    where entity_table = 'products' and action = 'update:products') >= 1,
  'a price change is written to the audit log'
);

select tests.eq(
  tests.count_rows('aaaaaaaa-0000-0000-0000-000000000003', 'public.audit_logs'),
  0::bigint,
  'cashiers cannot read the audit log'
);

select tests.eq(
  tests.count_rows('aaaaaaaa-0000-0000-0000-000000000001', 'public.audit_logs') > 0,
  true,
  'the owner can read the audit log'
);

-- Append-only protection on the audit log itself. Checked as the table owner so
-- the trigger is what refuses, not RLS.
select tests.denied(null,
  $sql$delete from public.audit_logs$sql$,
  'audit log rows cannot be deleted, not even by the owner');

select set_config('request.jwt.claim.sub', '', true);

rollback;
