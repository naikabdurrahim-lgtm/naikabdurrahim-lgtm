-- =============================================================================
-- 110 — POS payload: fractional quantity, percent discount, part payment
-- =============================================================================
-- 30_integrity and 70_pos already cover the arithmetic of create_sale. This
-- suite pins the *bytes the client sends*: a quantity as "1.500", a discount as
-- a percentage, a bill that is only partly paid, the two refusals a cashier must
-- hit, and that a void puts stock and khata back exactly.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'pos-owner@test.local', '{"full_name":"Owner"}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'pos-cashier@test.local', '{"full_name":"Cashier"}');

select tests.as_user('eeeeeeee-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('পিওএস দোকান', 'grocery', 'Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'পিওএস দোকান';

insert into public.tenant_members (tenant_id, user_id, role, display_name)
select t.id, 'eeeeeeee-0000-0000-0000-000000000002', 'cashier'::public.member_role, 'ক্যাশিয়ার'
from public.tenants t where t.name = 'পিওএস দোকান';

insert into public.products (tenant_id, name, unit_code, buy_price_paisa, sell_price_paisa)
select id, 'মিনিকেট চাল', 'kg', 6800, 7500 from public.tenants where name = 'পিওএস দোকান';

insert into public.customers (tenant_id, name, phone)
select id, 'রহিম ভাই', '+8801712345678' from public.tenants where name = 'পিওএস দোকান';

insert into fixtures select 'rice', id from public.products where name = 'মিনিকেট চাল';
insert into fixtures select 'rahim', id from public.customers where name = 'রহিম ভাই';

select tests.as_user('eeeeeeee-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L, jsonb_build_object(
      'client_id', 'eeeeeeee-1111-0000-0000-000000000001',
      'product_id', %L, 'qty_delta', 20, 'movement_type', 'opening',
      'reason', 'শুরুর মজুদ'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

-- ------------------------------------------------- fractional quantity + totals
-- 1.5 kg at ৳75 = ৳112.50, with a 10% discount: ৳101.25 total, ৳50 paid on the
-- spot and the rest on the khata.
select tests.as_user('eeeeeeee-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'eeeeeeee-2222-0000-0000-000000000001',
      'customer_id', %L,
      'paid_paisa', 5000,
      'discount_paisa', 1125,
      'discount_kind', 'percent',
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', '1.500', 'unit_price_paisa', 7500))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim'),
    (select id from fixtures where key = 'rice')));

select tests.eq(
  (select subtotal_paisa from public.sales
    where client_id = 'eeeeeeee-2222-0000-0000-000000000001'),
  11250::bigint,
  'a fractional quantity totals exactly: 1.5 × ৳75'
);

select tests.eq(
  (select total_paisa from public.sales
    where client_id = 'eeeeeeee-2222-0000-0000-000000000001'),
  10125::bigint,
  'the discount is taken off the total'
);

select tests.eq(
  (select due_paisa from public.sales
    where client_id = 'eeeeeeee-2222-0000-0000-000000000001'),
  5125::bigint,
  'what was not paid becomes the due'
);

select tests.eq(
  (select stock_qty from public.products where id = (select id from fixtures where key = 'rice')),
  18.500::numeric,
  'stock follows the quantity, not the line count'
);

select tests.eq(
  tests.value_as('eeeeeeee-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))),
  '5125',
  'the unpaid part lands on the customer''s khata'
);

select tests.eq(
  (select count(*) from public.payments
    where tenant_id = (select id from fixtures where key = 'tenant')
      and sale_id is not null),
  1::bigint,
  'the money handed over is recorded as one payment'
);

-- ------------------------------------------------------------------- refusals
select tests.denied('eeeeeeee-0000-0000-0000-000000000002',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'eeeeeeee-2222-0000-0000-000000000002',
      'paid_paisa', 5000,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', 1, 'unit_price_paisa', 5000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')),
  'a cashier cannot sell below cost');

select tests.as_user('eeeeeeee-0000-0000-0000-000000000001',
  format($sql$update public.app_settings set allow_cashier_discount = false
     where tenant_id = %L$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.denied('eeeeeeee-0000-0000-0000-000000000002',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'eeeeeeee-2222-0000-0000-000000000003',
      'paid_paisa', 7500,
      'discount_paisa', 500,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', 1, 'unit_price_paisa', 7500))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')),
  'a cashier cannot discount when the shop switched it off');

select tests.eq(
  (select count(*) from public.sales
    where tenant_id = (select id from fixtures where key = 'tenant')),
  1::bigint,
  'a refused sale writes nothing'
);

-- --------------------------------------------------------------- what is seen
select tests.eq(
  tests.count_rows('eeeeeeee-0000-0000-0000-000000000002', 'public.sale_items'),
  0::bigint,
  'a cashier sees no rows of sale_items (that is where cost lives)'
);

select tests.eq(
  tests.count_as('eeeeeeee-0000-0000-0000-000000000002',
    format($sql$select 1 from public.v_sale_items_receipt where sale_id = %L$sql$,
      (select id from public.sales where client_id = 'eeeeeeee-2222-0000-0000-000000000001'))),
  1::bigint,
  'but the receipt view shows the line, without cost'
);

-- ------------------------------------------------------------------- the undo
select tests.as_user('eeeeeeee-0000-0000-0000-000000000001',
  format($sql$select public.void_sale(%L, %L, 'ভুল করে বিল হয়েছে')$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from public.sales where client_id = 'eeeeeeee-2222-0000-0000-000000000001')));

select tests.eq(
  (select stock_qty from public.products where id = (select id from fixtures where key = 'rice')),
  20.000::numeric,
  'cancelling the sale puts the stock back'
);

select tests.eq(
  tests.value_as('eeeeeeee-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))),
  '0',
  'and takes the due off the khata'
);

select tests.eq(
  (select status::text from public.sales
    where client_id = 'eeeeeeee-2222-0000-0000-000000000001'),
  'voided',
  'the sale row stays, marked voided'
);

rollback;
