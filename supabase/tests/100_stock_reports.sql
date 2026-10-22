-- =============================================================================
-- 100 — Stock, today's numbers and the reports built on them
-- =============================================================================
-- One shop, two products and a service, a sale today, a credit sale yesterday,
-- a collection today, then enough sales to push one product out and one below
-- its alert level. Everything the stock screen and the report screen show is
-- derived, so the assertions are all about arithmetic that must not drift.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'stock-owner@test.local', '{"full_name":"Owner"}'),
  ('dddddddd-0000-0000-0000-000000000002', 'stock-cashier@test.local', '{"full_name":"Cashier"}'),
  ('dddddddd-0000-0000-0000-000000000003', 'stock-outsider@test.local', '{"full_name":"Outsider"}');

select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('স্টকের দোকান', 'grocery', 'Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'স্টকের দোকান';

insert into public.tenant_members (tenant_id, user_id, role, display_name)
select t.id, 'dddddddd-0000-0000-0000-000000000002', 'cashier'::public.member_role, 'ক্যাশিয়ার'
from public.tenants t where t.name = 'স্টকের দোকান';

insert into public.products (tenant_id, name, unit_code, buy_price_paisa, sell_price_paisa, stock_alert_qty)
select id, 'মিনিকেট চাল', 'kg', 6800, 7500, 5 from public.tenants where name = 'স্টকের দোকান';

insert into public.products (tenant_id, name, unit_code, buy_price_paisa, sell_price_paisa, stock_alert_qty)
select id, 'সয়াবিন তেল', 'litre', 12000, 14000, 3 from public.tenants where name = 'স্টকের দোকান';

insert into public.products (tenant_id, name, unit_code, buy_price_paisa, sell_price_paisa, is_service)
select id, 'হোম ডেলিভারি', 'piece', 0, 5000, true from public.tenants where name = 'স্টকের দোকান';

insert into public.customers (tenant_id, name, phone)
select id, 'রহিম ভাই', '+8801712345678' from public.tenants where name = 'স্টকের দোকান';

insert into fixtures select 'rice', id from public.products where name = 'মিনিকেট চাল';
insert into fixtures select 'oil', id from public.products where name = 'সয়াবিন তেল';
insert into fixtures select 'rahim', id from public.customers where name = 'রহিম ভাই';

-- ---------------------------------------------------------------- opening stock
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L, jsonb_build_object(
      'client_id', 'dddddddd-1111-0000-0000-000000000001',
      'product_id', %L, 'qty_delta', 20, 'movement_type', 'opening',
      'unit_cost_paisa', 6800, 'reason', 'দোকান শুরু'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L, jsonb_build_object(
      'client_id', 'dddddddd-1111-0000-0000-000000000002',
      'product_id', %L, 'qty_delta', 4, 'movement_type', 'opening',
      'unit_cost_paisa', 12000, 'reason', 'দোকান শুরু'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'oil')));

-- --------------------------------------------------------------- the overview
select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select stock_value_paisa from public.stock_overview(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '184000',
  'stock value is quantity at cost: 20 × ৳68 + 4 × ৳120'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select product_count from public.stock_overview(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '2',
  'a service product holds no stock and is not counted'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select low_stock_count from public.stock_overview(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '0',
  'nothing is low yet'
);

-- --------------------------------------------------------------------- sales
-- Today: 2 kg rice for cash.
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'dddddddd-2222-0000-0000-000000000001',
      'paid_paisa', 15000,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', 2, 'unit_price_paisa', 7500))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

-- Yesterday: 1 kg rice on credit.
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'dddddddd-2222-0000-0000-000000000002',
      'customer_id', %L,
      'paid_paisa', 0,
      'business_date', to_char((now() at time zone 'Asia/Dhaka')::date - 1, 'YYYY-MM-DD'),
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', 1, 'unit_price_paisa', 7500))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim'),
    (select id from fixtures where key = 'rice')));

-- Today: the customer pays ৩০০০ against that due.
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L, jsonb_build_object(
      'client_id', 'dddddddd-3333-0000-0000-000000000001',
      'customer_id', %L, 'amount_paisa', 3000, 'method', 'cash'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim')));

-- ------------------------------------------------------------- today's numbers
select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (public.tenant_day_summary(%L) ->> 'sales_paisa')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '15000',
  'today counts only today''s sale, not yesterday''s'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (public.tenant_day_summary(%L) ->> 'profit_paisa')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '1400',
  'profit is revenue minus cost: 2 × (৳75 − ৳68)'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (public.tenant_day_summary(%L) ->> 'collected_paisa')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '3000',
  'a collection against an old due counts as money in today'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (public.tenant_day_summary(%L,
        (now() at time zone 'Asia/Dhaka')::date - 1) ->> 'credit_given_paisa')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '7500',
  'yesterday''s credit sale is still reported on yesterday'
);

-- --------------------------------------------------- push one out, one to low
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'dddddddd-2222-0000-0000-000000000003',
      'paid_paisa', 56000,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', 4, 'unit_price_paisa', 14000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'oil')));

select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L, jsonb_build_object(
      'client_id', 'dddddddd-2222-0000-0000-000000000004',
      'paid_paisa', 97500,
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', %L, 'qty', 13, 'unit_price_paisa', 7500))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select out_of_stock_count from public.stock_overview(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '1',
  'selling the last of the oil marks it out of stock'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select low_stock_count from public.stock_overview(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '1',
  '4 kg left against an alert of 5 is low'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (select name from public.list_stock(%L) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'))),
  'সয়াবিন তেল',
  'the stock list puts whatever is finished at the top'
);

select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_stock(%L, null, 'low')$sql$,
      (select id from fixtures where key = 'tenant'))),
  1::bigint,
  'the low filter hides the product that is completely out'
);

select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_stock(%L, 'তেল')$sql$,
      (select id from fixtures where key = 'tenant'))),
  1::bigint,
  'searching the stock list by name works'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (select stock_value_paisa from public.list_stock(%L) where name = 'মিনিকেট চাল')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '27200',
  'the value of one line is quantity at cost'
);

-- ------------------------------------------------------------- a damage note
select tests.denied('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L, jsonb_build_object(
      'client_id', 'dddddddd-1111-0000-0000-000000000003',
      'product_id', %L, 'qty_delta', -1, 'movement_type', 'damage'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')),
  'a stock change without a reason is refused');

select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L, jsonb_build_object(
      'client_id', 'dddddddd-1111-0000-0000-000000000004',
      'product_id', %L, 'qty_delta', -1, 'movement_type', 'damage',
      'reason', 'ভেজা চাল'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select 1 from public.product_stock_movements(%L, %L)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rice'))),
  5::bigint,
  'rice has five movements: opening, three sales and the damage'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (select running_qty from public.product_stock_movements(%L, %L) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rice'))),
  '3.000',
  'the newest movement carries the current quantity'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (select running_qty from public.product_stock_movements(%L, %L, 1, 2))$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rice'))),
  '17.000',
  'page 2 of the history keeps the running quantity of the whole history'
);

-- ------------------------------------------------------------------ the books
select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (select item_count from public.recent_sales(p_tenant => %L,
        p_date => (now() at time zone 'Asia/Dhaka')::date) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '1',
  'the newest sale on the today list carries its line count'
);

select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select 1 from public.recent_sales(p_tenant => %L,
        p_date => (now() at time zone 'Asia/Dhaka')::date)$sql$,
      (select id from fixtures where key = 'tenant'))),
  3::bigint,
  'today has three sales'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select sales_paisa from public.sales_report(%L,
        (now() at time zone 'Asia/Dhaka')::date, (now() at time zone 'Asia/Dhaka')::date)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '168500',
  'the report adds up the day: 150 + 560 + 975'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select profit_paisa from public.sales_report(%L,
        (now() at time zone 'Asia/Dhaka')::date, (now() at time zone 'Asia/Dhaka')::date)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '18500',
  'the day''s profit is the sum of each line''s margin'
);

select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select 1 from public.sales_report(%L,
        (now() at time zone 'Asia/Dhaka')::date - 6, (now() at time zone 'Asia/Dhaka')::date)$sql$,
      (select id from fixtures where key = 'tenant'))),
  2::bigint,
  'a week range covers yesterday and today, with no invented empty days'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (select name from public.top_products(%L,
        (now() at time zone 'Asia/Dhaka')::date, (now() at time zone 'Asia/Dhaka')::date) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'))),
  'মিনিকেট চাল',
  'the best seller by revenue comes first'
);

-- ------------------------------------------------------------- who may look
select tests.ok(
  tests.value_as('dddddddd-0000-0000-0000-000000000002',
    format($sql$select (public.tenant_day_summary(%L) ->> 'profit_paisa') is null$sql$,
      (select id from fixtures where key = 'tenant'))) = 'true',
  'a cashier sees takings but no profit'
);

select tests.ok(
  tests.value_as('dddddddd-0000-0000-0000-000000000002',
    format($sql$select (select stock_value_paisa from public.stock_overview(%L)) is null$sql$,
      (select id from fixtures where key = 'tenant'))) = 'true',
  'a cashier sees the stock list but not what it cost'
);

select tests.ok(
  tests.value_as('dddddddd-0000-0000-0000-000000000002',
    format($sql$select (select buy_price_paisa from public.list_stock(%L) limit 1) is null$sql$,
      (select id from fixtures where key = 'tenant'))) = 'true',
  'no cost price reaches a cashier, even through the stock list'
);

select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000002',
    format($sql$select 1 from public.recent_sales(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  4::bigint,
  'a cashier can see the sales they made, without cost'
);

select tests.denied('dddddddd-0000-0000-0000-000000000002',
  format($sql$select public.record_stock_movement(%L, jsonb_build_object(
      'client_id', 'dddddddd-1111-0000-0000-000000000005',
      'product_id', %L, 'qty_delta', 5, 'movement_type', 'adjustment',
      'reason', 'নিজে ঠিক করছি'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')),
  'a cashier cannot change stock');

select tests.denied('dddddddd-0000-0000-0000-000000000002',
  format($sql$select * from public.sales_report(%L,
      (now() at time zone 'Asia/Dhaka')::date, (now() at time zone 'Asia/Dhaka')::date)$sql$,
    (select id from fixtures where key = 'tenant')),
  'a cashier cannot read the reports');

select tests.denied('dddddddd-0000-0000-0000-000000000002',
  format($sql$select * from public.top_products(%L)$sql$,
    (select id from fixtures where key = 'tenant')),
  'a cashier cannot read the top products');

select tests.denied('dddddddd-0000-0000-0000-000000000003',
  format($sql$select * from public.stock_overview(%L)$sql$,
    (select id from fixtures where key = 'tenant')),
  'someone outside the shop cannot read the stock at all');

select tests.denied('dddddddd-0000-0000-0000-000000000003',
  format($sql$select * from public.recent_sales(%L)$sql$,
    (select id from fixtures where key = 'tenant')),
  'someone outside the shop cannot read the sales');

-- --------------------------------------------- a voided sale leaves the books
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.void_sale(%L, %L, 'ভুল করে বিল হয়েছে')$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from public.sales where client_id = 'dddddddd-2222-0000-0000-000000000004')));

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select (public.tenant_day_summary(%L) ->> 'sales_paisa')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '71000',
  'a cancelled sale is not takings'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select sales_paisa from public.sales_report(%L,
        (now() at time zone 'Asia/Dhaka')::date, (now() at time zone 'Asia/Dhaka')::date)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '71000',
  'and it is not in the report either'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select low_stock_count from public.stock_overview(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '0',
  'cancelling the sale puts the stock back, so nothing is low again'
);

rollback;
