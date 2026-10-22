-- =============================================================================
-- 30 — Data integrity: money, stock, dues, idempotency, append-only, reversal
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'shop@test.local', '{"full_name":"Shop Owner"}');

select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('ইন্টিগ্রিটি দোকান', 'grocery', 'Shop Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'ইন্টিগ্রিটি দোকান';

insert into public.products (tenant_id, name, buy_price_paisa, sell_price_paisa, unit_code)
select id, 'চিনি ১ কেজি', 9000, 11000, 'kg' from public.tenants where name = 'ইন্টিগ্রিটি দোকান';

insert into public.products (tenant_id, name, buy_price_paisa, sell_price_paisa, is_service)
select id, 'হেয়ারকাট', 0, 20000, true from public.tenants where name = 'ইন্টিগ্রিটি দোকান';

insert into public.customers (tenant_id, name, phone)
select id, 'রহিম ভাই', '+8801712345678' from public.tenants where name = 'ইন্টিগ্রিটি দোকান';

insert into fixtures select 'sugar', id from public.products where name = 'চিনি ১ কেজি';
insert into fixtures select 'service', id from public.products where name = 'হেয়ারকাট';
insert into fixtures select 'customer', id from public.customers where name = 'রহিম ভাই';

-- ------------------------------------------------------- opening stock
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'product_id', %L,
                         'qty_delta', 20,
                         'movement_type', 'opening',
                         'reason', 'শুরুর মজুদ'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')));

select tests.eq(
  (select stock_qty from public.products where name = 'চিনি ১ কেজি'),
  20.000::numeric,
  'opening stock is applied through a movement, not by writing stock_qty'
);

select tests.eq(
  (select count(*) from public.v_stock_on_hand where cached_qty <> computed_qty),
  0::bigint,
  'the stock cache matches the movement history for every product'
);

-- ------------------------------------------------------------- cash sale
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'cccccccc-0000-0000-0000-000000000001',
        'paid_paisa', 22000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 2, 'unit_price_paisa', 11000))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')));

select tests.eq(
  (select total_paisa from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000001'),
  22000::bigint,
  'the sale total is computed from the lines'
);

select tests.eq(
  (select due_paisa from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000001'),
  0::bigint,
  'a fully paid sale has no due'
);

select tests.ok(
  (select invoice_no is not null from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000001'),
  'the server assigns an invoice number'
);

select tests.eq(
  (select stock_qty from public.products where name = 'চিনি ১ কেজি'),
  18.000::numeric,
  'stock drops by the quantity sold'
);

select tests.eq(
  (select count(*) from public.payments p
    join public.sales s on s.id = p.sale_id
    where s.client_id = 'cccccccc-0000-0000-0000-000000000001'),
  1::bigint,
  'a cash payment row is recorded for the cash book'
);

-- ------------------------------------------------- idempotency (offline resend)
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'cccccccc-0000-0000-0000-000000000001',
        'paid_paisa', 22000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 2, 'unit_price_paisa', 11000))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')));

select tests.eq(
  (select count(*) from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000001'),
  1::bigint,
  're-sending the same offline sale does not create a duplicate'
);

select tests.eq(
  (select stock_qty from public.products where name = 'চিনি ১ কেজি'),
  18.000::numeric,
  'a duplicate push does not deduct stock twice'
);

select tests.eq(
  (select count(*) from public.payments), 1::bigint,
  'a duplicate push does not record a second payment'
);

-- ------------------------------------------------------- due sale + ledger
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'cccccccc-0000-0000-0000-000000000002',
        'customer_id', %L,
        'paid_paisa', 5000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 11000))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'customer'),
    (select id from fixtures where key = 'sugar')));

select tests.eq(
  tests.value_as('bbbbbbbb-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
           (select id from fixtures where key = 'tenant'),
           (select id from fixtures where key = 'customer'))),
  '6000',
  'a partial payment leaves the remainder as due'
);

select tests.eq(
  (select count(*) from public.ledger_entries
    where sale_id = (select id from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000002')),
  1::bigint,
  'a credit sale writes exactly one debit entry'
);

-- Collect part of the due.
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L,
      jsonb_build_object('client_id', 'dddddddd-0000-0000-0000-000000000001',
                         'customer_id', %L,
                         'amount_paisa', 2000))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'customer')));

select tests.eq(
  tests.value_as('bbbbbbbb-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
           (select id from fixtures where key = 'tenant'),
           (select id from fixtures where key = 'customer'))),
  '4000',
  'a collection reduces the due balance'
);

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'customer_id', %L,
                         'amount_paisa', 999999))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'customer')),
  'collecting more than the outstanding balance is refused');

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'customer_id', %L,
                         'amount_paisa', -100))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'customer')),
  'a negative payment is refused');

-- ------------------------------------------------------------------ guardrails
select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 11000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')),
  'a credit sale without a customer is refused');

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(), 'paid_paisa', 100,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1000, 'unit_price_paisa', 11000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')),
  'selling more than the stock on hand is refused');

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(), 'paid_paisa', 0, 'items', '[]'::jsonb))$sql$,
    (select id from fixtures where key = 'tenant')),
  'a sale with no items is refused');

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(), 'paid_paisa', 50000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 2, 'unit_price_paisa', 11000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')),
  'paying more than the total is refused');

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', gen_random_uuid(), 'paid_paisa', 20000,
        'discount_paisa', 5000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 11000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')),
  'a discount larger than the subtotal is refused');

-- Selling a service does not touch stock.
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object('client_id', 'cccccccc-0000-0000-0000-000000000003',
        'paid_paisa', 20000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 20000))))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'service')));

select tests.eq(
  (select count(*) from public.stock_movements
    where product_id = (select id from fixtures where key = 'service')),
  0::bigint,
  'a service item creates no stock movement'
);

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.record_stock_movement(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'product_id', %L,
                         'qty_delta', 5,
                         'movement_type', 'adjustment'))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'sugar')),
  'a stock adjustment without a reason is refused');

-- --------------------------------------------------------------- append-only
select tests.denied(null,
  $sql$update public.sales set paid_paisa = 0
      where client_id = 'cccccccc-0000-0000-0000-000000000001'$sql$,
  'a sale cannot be edited after the fact');

select tests.denied(null,
  $sql$delete from public.sale_items$sql$,
  'sale lines can never be deleted');

select tests.denied(null,
  $sql$update public.stock_movements set qty_delta = 0$sql$,
  'stock movements can never be edited');

select tests.denied(null,
  $sql$delete from public.ledger_entries$sql$,
  'ledger entries can never be deleted');

select tests.denied(null,
  $sql$update public.payments set amount_paisa = 1$sql$,
  'payments can never be edited');

-- --------------------------------------------------------------- void / reversal
select tests.as_user('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.void_sale(%L,
      (select id from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000002'),
      'ভুল হয়ে গেছে')$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.eq(
  (select status::text from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000002'),
  'voided',
  'a cancelled sale is marked voided, not deleted'
);

-- The credit sale created a 6000 debit and 2000 was collected, leaving 4000.
-- Voiding reverses the full 6000, so the balance becomes -2000: the shop now
-- owes the customer 2000 (an advance). This is correct accounting — the money
-- really was paid — and the app shows a negative balance as "অগ্রিম".
select tests.eq(
  tests.value_as('bbbbbbbb-0000-0000-0000-000000000001',
    format($sql$select public.customer_balance(%L, %L)$sql$,
           (select id from fixtures where key = 'tenant'),
           (select id from fixtures where key = 'customer'))),
  '-2000',
  'voiding a part-paid credit sale turns the collected amount into an advance'
);

-- A customer with an advance cannot be asked to pay again.
select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L,
      jsonb_build_object('client_id', gen_random_uuid(),
                         'customer_id', %L,
                         'amount_paisa', 100))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'customer')),
  'a customer with an advance has nothing to collect');

-- 20 opening − 2 (cash sale) − 1 (credit sale) + 1 (void returns it) = 18.
select tests.eq(
  (select stock_qty from public.products where name = 'চিনি ১ কেজি'),
  18.000::numeric,
  'voiding a sale returns the stock'
);

select tests.eq(
  (select count(*) from public.v_stock_on_hand where cached_qty <> computed_qty),
  0::bigint,
  'the stock cache still matches history after a void'
);

select tests.denied('bbbbbbbb-0000-0000-0000-000000000001',
  format($sql$select public.void_sale(%L,
      (select id from public.sales where client_id = 'cccccccc-0000-0000-0000-000000000001'), '')$sql$,
    (select id from fixtures where key = 'tenant')),
  'cancelling without a reason is refused');

-- ---------------------------------------------------------------- day summary
-- Only the two completed sales count; the voided one is excluded.
select tests.eq(
  tests.value_as('bbbbbbbb-0000-0000-0000-000000000001',
    format($sql$select public.tenant_day_summary(%L, (now() at time zone 'Asia/Dhaka')::date) ->> 'sale_count'$sql$,
           (select id from fixtures where key = 'tenant'))),
  '2',
  'a voided sale is not counted as today''s sales'
);

-- Cash sale profit: (11000 - 9000) × 2 = 4000. Service sale: 20000 - 0 = 20000.
select tests.eq(
  tests.value_as('bbbbbbbb-0000-0000-0000-000000000001',
    format($sql$select public.tenant_day_summary(%L, (now() at time zone 'Asia/Dhaka')::date) ->> 'profit_paisa'$sql$,
           (select id from fixtures where key = 'tenant'))),
  '24000',
  'profit is computed from the cost snapshot taken at sale time'
);

select tests.eq(
  tests.value_as('bbbbbbbb-0000-0000-0000-000000000001',
    format($sql$select public.tenant_day_summary(%L, (now() at time zone 'Asia/Dhaka')::date) ->> 'collected_paisa'$sql$,
           (select id from fixtures where key = 'tenant'))),
  '2000',
  'due collections are counted separately from sales'
);

-- ---------------------------------------------------------------- invoice numbers
select tests.ok(
  (select count(distinct invoice_no) = count(*) from public.sales where invoice_no is not null),
  'every sale gets a unique invoice number'
);

select set_config('request.jwt.claim.sub', '', true);

rollback;
