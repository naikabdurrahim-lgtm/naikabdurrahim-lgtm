-- =============================================================================
-- 70 — POS: the exact payload the sell screen sends
-- =============================================================================
-- The Phase 5 screen is a thin shell over create_sale(). This suite proves the
-- contract it relies on: fractional quantities, a percent discount, credit with
-- a customer, the cashier's limits, the receipt a cashier may read, and that a
-- void puts everything back where it was.
--
-- Every RPC call runs as the `authenticated` role with a real JWT subject, the
-- same way PostgREST calls it.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'pos-owner@test.local', '{"full_name":"Owner"}'),
  ('dddddddd-0000-0000-0000-000000000002', 'pos-cashier@test.local', '{"full_name":"Cashier"}');

select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('পস দোকান', 'grocery', 'Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'পস দোকান';

insert into public.tenant_members (tenant_id, user_id, role, display_name)
select t.id, 'dddddddd-0000-0000-0000-000000000002', 'cashier'::public.member_role, 'Cashier'
from public.tenants t where t.name = 'পস দোকান';

-- 20 kg of rice at 68.00 cost / 75.00 selling, plus a service.
insert into public.products (tenant_id, name, unit_code, buy_price_paisa, sell_price_paisa, stock_qty)
select id, 'মিনিকেট চাল', 'kg', 6800, 7500, 20 from public.tenants where name = 'পস দোকান';

insert into public.products (tenant_id, name, buy_price_paisa, sell_price_paisa, is_service)
select id, 'হোম ডেলিভারি', 0, 3000, true from public.tenants where name = 'পস দোকান';

insert into public.customers (tenant_id, name, phone)
select id, 'রহিম ভাই', '+8801712345678' from public.tenants where name = 'পস দোকান';

insert into fixtures select 'rice', id from public.products where name = 'মিনিকেট চাল';
insert into fixtures select 'delivery', id from public.products where name = 'হোম ডেলিভারি';
insert into fixtures select 'customer', id from public.customers where name = 'রহিম ভাই';

-- --------------------------------------------------- fractional quantity sale
-- The POS sends qty as a fixed 3-decimal string ("1.500"), exactly as typed.
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'eeeeeeee-0000-0000-0000-000000000001',
        'paid_paisa', 11250,
        'payment_method', 'cash',
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', '1.500', 'unit_price_paisa', 7500))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

select tests.eq(
  (select subtotal_paisa from public.sales
    where client_id = 'eeeeeeee-0000-0000-0000-000000000001'),
  11250::bigint,
  '1.5 kg at 75.00 totals 112.50, not 112 or 113'
);

select tests.eq(
  (select qty from public.sale_items
    where sale_id = (select id from public.sales
                      where client_id = 'eeeeeeee-0000-0000-0000-000000000001')),
  1.500::numeric,
  'the line keeps the thousandth precision the client sent'
);

select tests.eq(
  (select stock_qty from public.products where name = 'মিনিকেট চাল'),
  18.500::numeric,
  'half a kilo leaves the shelf, not a whole one'
);

-- ------------------------------------------------------- percent discount sale
-- The screen computes 10% of 112.50 and sends the paisa amount with its kind.
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'eeeeeeee-0000-0000-0000-000000000002',
        'discount_paisa', 1125,
        'discount_kind', 'percent',
        'paid_paisa', 10125,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', '1.500', 'unit_price_paisa', 7500))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')));

select tests.eq(
  (select total_paisa from public.sales
    where client_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  10125::bigint,
  'a 10% discount comes off the total, not the subtotal'
);

select tests.eq(
  (select discount_kind from public.sales
    where client_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'percent'::text,
  'the receipt can still say \"10% off\" rather than a bare amount'
);

-- ------------------------------------------------------------ credit sale
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'eeeeeeee-0000-0000-0000-000000000003',
        'customer_id', %L,
        'paid_paisa', 4000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 2, 'unit_price_paisa', 7500))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'customer'),
    (select id from fixtures where key = 'rice')));

select tests.eq(
  (select due_paisa from public.sales
    where client_id = 'eeeeeeee-0000-0000-0000-000000000003'),
  11000::bigint,
  'the unpaid remainder becomes the due on the bill'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'customer'))),
  '11000',
  'the ledger carries the same due the receipt shows'
);

select tests.eq(
  (select count(*) from public.payments p
    join public.sales s on s.id = p.sale_id
   where s.client_id = 'eeeeeeee-0000-0000-0000-000000000003'),
  1::bigint,
  'only the money actually received is written to the cash book'
);

-- ------------------------------------------------------------- cashier limits
select tests.denied('dddddddd-0000-0000-0000-000000000002',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(), 'paid_paisa', 5000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 5000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')),
  'a cashier cannot sell below the cost price');

-- An owner must be able to change their own shop settings. This is also the
-- regression test for 0013 (the audit trigger used to assume an `id` column).
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$update public.app_settings set allow_cashier_discount = false
          where tenant_id = %L$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.ok(
  (select count(*) from public.audit_logs
    where entity_table = 'app_settings' and action = 'update:app_settings') >= 1,
  'a settings change is written to the audit log'
);

select tests.denied('dddddddd-0000-0000-0000-000000000002',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(), 'paid_paisa', 7000,
        'discount_paisa', 500,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 7500))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rice')),
  'the shop setting can take discounting away from a cashier');

-- The receipt view is the cashier's way to reprint; the cost-bearing table is not.
select tests.ok(
  tests.count_as('dddddddd-0000-0000-0000-000000000002',
    format($sql$select 1 from public.v_sale_items_receipt where sale_id = %L$sql$,
      (select id from public.sales where client_id = 'eeeeeeee-0000-0000-0000-000000000001'))) > 0,
  'a cashier can read the receipt lines'
);

-- RLS filters rows instead of raising, so the assertion is "sees nothing".
select tests.eq(
  tests.count_as('dddddddd-0000-0000-0000-000000000002',
    format($sql$select cost_price_paisa from public.sale_items where sale_id = %L$sql$,
      (select id from public.sales where client_id = 'eeeeeeee-0000-0000-0000-000000000001'))),
  0::bigint,
  'a cashier sees no rows at all in the cost-bearing table');

-- ------------------------------------------------------------------- undo
select tests.as_user('dddddddd-0000-0000-0000-000000000001',
  format($sql$select public.void_sale(%L,
      (select id from public.sales where client_id = 'eeeeeeee-0000-0000-0000-000000000003'),
      'ভুল হয়ে গেছে (আনডু)')$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.eq(
  (select status::text from public.sales
    where client_id = 'eeeeeeee-0000-0000-0000-000000000003'),
  'voided',
  'undo marks the sale cancelled instead of deleting it'
);

select tests.eq(
  tests.value_as('dddddddd-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'customer'))),
  '0',
  'undo takes the due off the customer'
);

select tests.eq(
  (select stock_qty from public.products where name = 'মিনিকেট চাল'),
  -- 20 − 1.5 − 1.5 − 2 + 2 = 17
  17.000::numeric,
  'undo puts the stock back exactly'
);

select tests.eq(
  (select count(*) from public.sales
    where client_id = 'eeeeeeee-0000-0000-0000-000000000003'),
  1::bigint,
  'the cancelled sale is still there for the history'
);

rollback;
