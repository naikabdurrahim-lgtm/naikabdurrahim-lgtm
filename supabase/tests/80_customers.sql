-- =============================================================================
-- 80 — Dues: the khata the "বাকি" screen shows
-- =============================================================================
-- One shop, three customers, two credit sales, a collection and a reversal. The
-- suite proves the numbers the customer screen relies on: the balance per
-- customer, the shop-wide total, the running balance in the ledger, and that a
-- deleted customer's history survives.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000001', 'due-owner@test.local', '{"full_name":"Owner"}'),
  ('ffffffff-0000-0000-0000-000000000002', 'due-cashier@test.local', '{"full_name":"Cashier"}'),
  ('ffffffff-0000-0000-0000-000000000003', 'due-outsider@test.local', '{"full_name":"Outsider"}');

select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('বাকির দোকান', 'grocery', 'Owner')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'বাকির দোকান';

insert into public.tenant_members (tenant_id, user_id, role, display_name)
select t.id, 'ffffffff-0000-0000-0000-000000000002', 'cashier'::public.member_role, 'Cashier'
from public.tenants t where t.name = 'বাকির দোকান';

insert into public.products (tenant_id, name, unit_code, buy_price_paisa, sell_price_paisa, stock_qty)
select id, 'মিনিকেট চাল', 'kg', 6800, 7500, 50 from public.tenants where name = 'বাকির দোকান';

insert into public.customers (tenant_id, name, phone, address)
select id, 'রহিম ভাই', '+8801712345678', 'নতুন বাজার'
from public.tenants where name = 'বাকির দোকান';

insert into public.customers (tenant_id, name, phone)
select id, 'করিম মিয়া', '+8801811111111' from public.tenants where name = 'বাকির দোকান';

insert into public.customers (tenant_id, name)
select id, 'সালমা বেগম' from public.tenants where name = 'বাকির দোকান';

insert into fixtures select 'rice', id from public.products where name = 'মিনিকেট চাল';
insert into fixtures select 'rahim', id from public.customers where name = 'রহিম ভাই';
insert into fixtures select 'karim', id from public.customers where name = 'করিম মিয়া';
insert into fixtures select 'salma', id from public.customers where name = 'সালমা বেগম';

-- ---------------------------------------------------- credit sales and a payment
-- রহিম: 2 kg = 150.00, paid 50.00 → owes 100.00.
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'ffffffff-1111-0000-0000-000000000001',
        'customer_id', %L,
        'paid_paisa', 5000,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 2, 'unit_price_paisa', 7500))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim'),
    (select id from fixtures where key = 'rice')));

-- করিম: 1 kg = 75.00, nothing paid → owes 75.00 (later cancelled).
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'ffffffff-1111-0000-0000-000000000002',
        'customer_id', %L,
        'paid_paisa', 0,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 7500))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'karim'),
    (select id from fixtures where key = 'rice')));

-- রহিম pays 40.00 later → owes 60.00.
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L,
      jsonb_build_object(
        'client_id', 'ffffffff-2222-0000-0000-000000000001',
        'customer_id', %L,
        'amount_paisa', 4000,
        'method', 'bkash',
        'note', 'বিকাশে দিল'
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim')));

-- করিম's sale is cancelled: the due disappears, the history stays.
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$select public.void_sale(%L, %L, 'ভুল করে বাকি লেখা হয়েছে')$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from public.sales where client_id = 'ffffffff-1111-0000-0000-000000000002')));

-- ------------------------------------------------------------------ the list
select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select due_paisa from public.list_customers(%L) where name = 'রহিম ভাই')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '6000',
  'a credit sale minus a collection is the customer''s due'
);

select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select due_paisa from public.list_customers(%L) where name = 'করিম মিয়া')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '0',
  'cancelling the sale takes the due back to zero'
);

select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_customers(%L, null, true)$sql$,
      (select id from fixtures where key = 'tenant'))),
  1::bigint,
  'the debtor view hides customers who owe nothing'
);

select tests.ok(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select name from public.list_customers(%L, null, true) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'))) = 'রহিম ভাই',
  'the biggest debtor comes first'
);

select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_customers(%L, '01712345678')$sql$,
      (select id from fixtures where key = 'tenant'))),
  1::bigint,
  'a phone number typed without +880 still finds the customer'
);

select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_customers(%L, 'করিম')$sql$,
      (select id from fixtures where key = 'tenant'))),
  1::bigint,
  'a Bangla name search finds the customer'
);

-- --------------------------------------------------------------- the summary
select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select total_due_paisa from public.due_summary(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '6000',
  'the shop total is the sum of the positive balances'
);

select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select debtor_count from public.due_summary(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '1',
  'one customer currently owes money'
);

select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select customer_count from public.due_summary(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  '3',
  'every live customer is counted, whether or not they owe'
);

-- ----------------------------------------------------------------- the ledger
select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.customer_ledger(%L, %L)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))),
  2::bigint,
  'রহিম has two entries: the sale and the collection'
);

select tests.ok(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select balance_after_paisa from public.customer_ledger(%L, %L) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))) = '6000',
  'the newest entry carries the current balance'
);

select tests.ok(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select entry_type from public.customer_ledger(%L, %L) limit 1)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))) = 'credit',
  'the newest entry is the collection, not the sale'
);

select tests.ok(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select invoice_no from public.customer_ledger(%L, %L) where sale_id is not null)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))) is not null,
  'a sale entry carries the invoice number for the receipt link'
);

select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.customer_ledger(%L, %L, 1, 1)$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'rahim'))),
  1::bigint,
  'the ledger pages without repeating rows'
);

-- ------------------------------------------------------------- who may look
select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000002',
    format($sql$select 1 from public.list_customers(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  3::bigint,
  'a cashier can see the dues: that is the whole point of the বাকি screen'
);

select tests.denied('ffffffff-0000-0000-0000-000000000003',
  format($sql$select 1 from public.list_customers(%L)$sql$,
    (select id from fixtures where key = 'tenant')),
  'someone who is not a member cannot read the shop''s dues');

select tests.denied('ffffffff-0000-0000-0000-000000000003',
  format($sql$select 1 from public.customer_ledger(%L, %L)$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim')),
  'someone who is not a member cannot read a customer''s history');

-- ------------------------------------------------------- undoing a collection
-- সালমা owes nothing yet; give her a credit sale so there is something to collect.
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$select public.create_sale(%L,
      jsonb_build_object(
        'client_id', 'ffffffff-1111-0000-0000-000000000003',
        'customer_id', %L,
        'paid_paisa', 0,
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', %L, 'qty', 1, 'unit_price_paisa', 7500))
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'salma'),
    (select id from fixtures where key = 'rice')));

select tests.as_user('ffffffff-0000-0000-0000-000000000002'::uuid,
  format($sql$select public.collect_due(%L,
      jsonb_build_object(
        'client_id', 'ffffffff-2222-0000-0000-000000000002',
        'customer_id', %L,
        'amount_paisa', 2000
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'salma')));

select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select due_paisa from public.list_customers(%L) where name = 'সালমা বেগম')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '5500',
  'a cashier''s collection reduces the due'
);

-- The cashier undoes their own mistake seconds later.
select tests.as_user('ffffffff-0000-0000-0000-000000000002',
  format($sql$select public.void_payment(%L, (select id from public.payments
      where client_id = 'ffffffff-2222-0000-0000-000000000002'), 'ভুল করে আদায়')$sql$,
    (select id from fixtures where key = 'tenant')));

select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select due_paisa from public.list_customers(%L) where name = 'সালমা বেগম')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '7500',
  'undoing a collection puts the due back — the payment row is reversed, not deleted'
);

select tests.eq(
  (select count(*) from public.payments
    where client_id = 'ffffffff-2222-0000-0000-000000000002' and voided_at is not null),
  1::bigint,
  'the payment stays in the books, marked voided'
);

select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.customer_ledger(%L, %L) where note = 'ভুল করে আদায়'$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'salma'))),
  1::bigint,
  'the khata shows the reversal as its own line'
);

-- Undoing twice is harmless: the button may be double-tapped.
select tests.ok(
  tests.value_as('ffffffff-0000-0000-0000-000000000002',
    format($sql$select (public.void_payment(%L, (select id from public.payments
        where client_id = 'ffffffff-2222-0000-0000-000000000002'), null)) ->> 'already_voided'$sql$,
      (select id from fixtures where key = 'tenant'))) = 'true',
  'a second undo reports already_voided instead of reversing twice'
);

select tests.denied('ffffffff-0000-0000-0000-000000000002',
  format($sql$select public.void_payment(%L, (select id from public.payments
      where client_id = 'ffffffff-2222-0000-0000-000000000001'), 'নিজের নয়')$sql$,
    (select id from fixtures where key = 'tenant')),
  'a cashier cannot reverse a collection someone else took');

select tests.denied('ffffffff-0000-0000-0000-000000000002',
  $sql$update public.payments set amount_paisa = 1$sql$,
  'a payment amount can never be edited, not even by an undo');

-- ---------------------------------------------------------- deleting a customer
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$update public.customers set deleted_at = now() where id = %L$sql$,
    (select id from fixtures where key = 'karim')));

select tests.eq(
  tests.count_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_customers(%L)$sql$,
      (select id from fixtures where key = 'tenant'))),
  2::bigint,
  'a deleted customer leaves the list'
);

select tests.ok(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select is_deleted from public.get_customer(%L, %L))$sql$,
      (select id from fixtures where key = 'tenant'),
      (select id from fixtures where key = 'karim'))) = 'true',
  'but the khata is still readable, marked as deleted'
);

-- ------------------------------------------------------- collecting twice is safe
select tests.as_user('ffffffff-0000-0000-0000-000000000001',
  format($sql$select public.collect_due(%L,
      jsonb_build_object(
        'client_id', 'ffffffff-2222-0000-0000-000000000001',
        'customer_id', %L,
        'amount_paisa', 4000
      ))$sql$,
    (select id from fixtures where key = 'tenant'),
    (select id from fixtures where key = 'rahim')));

select tests.eq(
  (select count(*) from public.payments
    where client_id = 'ffffffff-2222-0000-0000-000000000001'),
  1::bigint,
  'resending a payment from a flaky device does not collect it twice'
);

select tests.eq(
  tests.value_as('ffffffff-0000-0000-0000-000000000001',
    format($sql$select (select due_paisa from public.list_customers(%L) where name = 'রহিম ভাই')$sql$,
      (select id from fixtures where key = 'tenant'))),
  '6000',
  'the duplicate payment did not change the balance'
);

rollback;
