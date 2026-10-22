-- =============================================================================
-- 60 — Catalog: cost visibility, server-side search, category counts
-- =============================================================================
-- Proves the two things 0012 adds, plus the behaviour the products screen relies
-- on: a cashier can see prices but never cost, search works for Bangla and for
-- a barcode, paging does not overlap, and a soft-deleted category disappears
-- from the card instead of leaving a broken join behind.
--
-- Every RPC call goes through tests.value_as / tests.count_as so it runs as the
-- `authenticated` role with a real JWT subject, exactly like PostgREST.
-- =============================================================================

begin;

create temp table fixtures (key text primary key, id uuid) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'cat-owner@test.local', '{"full_name":"Owner"}'),
  ('cccccccc-0000-0000-0000-000000000002', 'cat-manager@test.local', '{"full_name":"Manager"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'cat-cashier@test.local', '{"full_name":"Cashier"}'),
  ('cccccccc-0000-0000-0000-000000000004', 'cat-outside@test.local', '{"full_name":"Outsider"}'),
  ('cccccccc-0000-0000-0000-000000000005', 'cat-other-owner@test.local', '{"full_name":"Other"}');

select tests.as_user('cccccccc-0000-0000-0000-000000000001',
  $sql$select public.create_tenant('ক্যাটালগ দোকান', 'grocery', 'Owner')$sql$);
select tests.as_user('cccccccc-0000-0000-0000-000000000005',
  $sql$select public.create_tenant('অন্য দোকান', 'general', 'Other')$sql$);

insert into fixtures select 'tenant', id from public.tenants where name = 'ক্যাটালগ দোকান';
insert into fixtures select 'tenant_other', id from public.tenants where name = 'অন্য দোকান';

insert into public.tenant_members (tenant_id, user_id, role, display_name)
select t.id, m.uid, m.role, m.label
from public.tenants t
cross join (values
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'manager'::public.member_role, 'Manager'),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'cashier'::public.member_role, 'Cashier')
) as m(uid, role, label)
where t.name = 'ক্যাটালগ দোকান';

-- create_tenant() already copied the grocery pack's categories, so the test uses
-- those instead of inventing new ones (the name unique index would refuse them).
insert into fixtures select 'rice', id from public.categories where name = 'চাল-ডাল';
insert into fixtures select 'oil', id from public.categories where name = 'তেল-মসলা';

insert into public.products (tenant_id, category_id, name, name_en, barcode, unit_code,
                            buy_price_paisa, sell_price_paisa, is_active)
select id, (select id from fixtures where key = 'rice'), 'মিনিকেট চাল', 'Miniket rice',
       '8901234567890', 'kg', 6800, 7500, true
from public.tenants where name = 'ক্যাটালগ দোকান';

insert into public.products (tenant_id, category_id, name, name_en, barcode, unit_code,
                            buy_price_paisa, sell_price_paisa, is_active)
select id, (select id from fixtures where key = 'rice'), 'মসুর ডাল', 'Red lentils',
       null, 'kg', 11500, 13000, true
from public.tenants where name = 'ক্যাটালগ দোকান';

insert into public.products (tenant_id, category_id, name, name_en, barcode, unit_code,
                            buy_price_paisa, sell_price_paisa, is_active)
select id, (select id from fixtures where key = 'oil'), 'সয়াবিন তেল', 'Soybean oil',
       '8900000000017', 'litre', 16800, 18500, true
from public.tenants where name = 'ক্যাটালগ দোকান';

insert into public.products (tenant_id, name, sell_price_paisa, is_active, deleted_at)
select id, 'পুরনো চাল', 5000, false, now() from public.tenants where name = 'ক্যাটালগ দোকান';

-- A product that is merely deactivated (not deleted) stays in the table.
insert into public.products (tenant_id, name, sell_price_paisa, is_active)
select id, 'বন্ধ পণ্য', 2500, false from public.tenants where name = 'ক্যাটালগ দোকান';

-- ------------------------------------------------------------------- cost rules
select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000003',
    format($sql$select (select sell_price_paisa from public.products
                 where tenant_id = %L and name = 'মিনিকেট চাল')$sql$,
           (select id from fixtures where key = 'tenant'))),
  '7500',
  'a cashier can read the selling price'
);

-- The important one: cost is not in the authenticated role's column grant at all.
select tests.denied('cccccccc-0000-0000-0000-000000000003',
  $sql$select buy_price_paisa from public.products limit 1$sql$,
  'a cashier cannot read the cost column'
);

select tests.denied('cccccccc-0000-0000-0000-000000000003',
  $sql$select * from public.products limit 1$sql$,
  'a cashier cannot select * and pick cost up along the way'
);

-- Even an owner cannot read the raw column: the grant is role-wide and Postgres
-- cannot vary it per tenant role. Cost comes from search_products(), which
-- decides per shop.
select tests.denied('cccccccc-0000-0000-0000-000000000001',
  $sql$select buy_price_paisa from public.products limit 1$sql$,
  'cost is only available through the RPC, not the raw column'
);

-- ------------------------------------------------------------ search: the RPC
select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.search_products(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  4::bigint,
  'search returns the live catalogue (soft-deleted rows excluded)'
);

select tests.ok(
  tests.value_as('cccccccc-0000-0000-0000-000000000003',
    format($sql$select (select buy_price_paisa from public.search_products(%L)
                 where name = 'মিনিকেট চাল')$sql$,
           (select id from fixtures where key = 'tenant'))) is null,
  'search hides cost from a cashier'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000002',
    format($sql$select (select buy_price_paisa from public.search_products(%L)
                 where name = 'মিনিকেট চাল')$sql$,
           (select id from fixtures where key = 'tenant'))),
  '6800',
  'search shows cost to a manager'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(*) from public.search_products(%L, 'চাল'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  '1',
  'a Bangla substring finds the matching product only'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select name from public.search_products(%L, 'মিনিকেট'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  'মিনিকেট চাল',
  'a Bangla word finds the product'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select name from public.search_products(%L, '8901234'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  'মিনিকেট চাল',
  'a partially typed barcode finds the product'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select name from public.search_products(%L, 'LENTILS'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  'মসুর ডাল',
  'search is case-insensitive on the English name'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(*) from public.search_products(%L, null, %L))$sql$,
           (select id from fixtures where key = 'tenant'),
           (select id from fixtures where key = 'oil'))),
  '1',
  'the category filter narrows the list'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(*) from public.search_products(%L, 'কিছুই নেই'))$sql$,
           (select id from fixtures where key = 'tenant'))),
  '0',
  'an unmatched search returns an empty page, not an error'
);

-- Paging: four live products, two pages of two, no overlap.
select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(distinct name) from (
       select name from public.search_products(%L, null, null, 2, 0)
       union all
       select name from public.search_products(%L, null, null, 2, 2)
     ) p)$sql$, (select id from fixtures where key = 'tenant'),
       (select id from fixtures where key = 'tenant'))),
  '4',
  'paging returns every product exactly once'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(*) from public.search_products(%L, null, null, 2, 0))$sql$,
           (select id from fixtures where key = 'tenant'))),
  '2',
  'the page size is respected'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(*) from public.search_products(%L, null, null, 50, 0, false)
                        where is_active = false)$sql$,
           (select id from fixtures where key = 'tenant'))),
  '0',
  'inactive products are hidden when asked'
);

select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select count(*) from public.search_products(%L, null, null, 500, 0))$sql$,
           (select id from fixtures where key = 'tenant'))),
  '4',
  'an oversized page size is clamped, not rejected'
);

select tests.denied('cccccccc-0000-0000-0000-000000000005',
  format($sql$select 1 from public.search_products(%L)$sql$,
    (select id from fixtures where key = 'tenant')),
  'another shop cannot search this catalogue'
);

select tests.denied('cccccccc-0000-0000-0000-000000000004',
  format($sql$select 1 from public.search_products(%L)$sql$,
    (select id from fixtures where key = 'tenant')),
  'a user with no membership cannot search the catalogue'
);

select tests.ok(
  not has_function_privilege('anon',
    'public.search_products(uuid, text, uuid, integer, integer, boolean, uuid, boolean)', 'execute'),
  'anonymous users cannot execute the search RPC'
);

-- -------------------------------------------------------- categories and counts
select tests.eq(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select product_count from public.list_categories(%L)
                         where name = 'চাল-ডাল')$sql$,
           (select id from fixtures where key = 'tenant'))),
  '2',
  'category counts include only live products'
);

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_categories(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  6::bigint,
  'list_categories returns the six categories the grocery pack created'
);

-- Soft-deleting a category must not remove its products, and the card must stop
-- showing the old category name.
update public.categories set deleted_at = now()
where id = (select id from fixtures where key = 'oil');

select tests.ok(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select category_name from public.search_products(%L)
                 where name = 'সয়াবিন তেল')$sql$,
           (select id from fixtures where key = 'tenant'))) is null,
  'a soft-deleted category disappears from the product card'
);

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.list_categories(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  5::bigint,
  'a soft-deleted category disappears from the category list'
);

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.search_products(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  4::bigint,
  'soft-deleting a category keeps its products'
);

-- ------------------------------------------------------------- write permissions
select tests.denied('cccccccc-0000-0000-0000-000000000003',
  $sql$insert into public.categories (tenant_id, name) values (gen_random_uuid(), 'নতুন')$sql$,
  'a cashier cannot create a category'
);

select tests.as_user('cccccccc-0000-0000-0000-000000000003',
  format($sql$update public.categories set name = 'হ্যাক' where tenant_id = %L$sql$,
         (select id from fixtures where key = 'tenant')));

select tests.eq(
  (select count(*) from public.categories where name = 'হ্যাক'),
  0::bigint,
  'a cashier cannot rename a category'
);

select tests.as_user('cccccccc-0000-0000-0000-000000000002',
  $sql$insert into public.categories (tenant_id, name)
      select id, 'নতুন ক্যাটাগরি' from public.tenants where name = 'ক্যাটালগ দোকান'$sql$);

select tests.eq(
  (select count(*) from public.categories where name = 'নতুন ক্যাটাগরি'),
  1::bigint,
  'a manager can create a category'
);

-- Duplicate names are refused case-insensitively; the UI turns this into a
-- friendly message instead of showing a raw index error.
select tests.ok(
  (select count(*) from pg_indexes
    where tablename = 'categories' and indexname = 'categories_unique_active_name') = 1,
  'the case-insensitive unique index on category names exists'
);

-- Deleting a product is a soft delete: the row stays for the sales history.
update public.products set deleted_at = now(), is_active = false
where name = 'মসুর ডাল';

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.search_products(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  3::bigint,
  'a soft-deleted product leaves the list'
);

select tests.ok(
  (select count(*) from public.products
    where name = 'মসুর ডাল' and deleted_at is not null) = 1,
  'a soft-deleted product is still in the table'
);

-- Restoring is the same row with deleted_at cleared, so the undo toast works.
update public.products set deleted_at = null, is_active = true
where name = 'মসুর ডাল';

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.search_products(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  4::bigint,
  'an undone delete puts the product back'
);

-- ------------------------------------------------------------- low-stock filter
-- The products screen offers a "running out" chip; it must be a server filter,
-- otherwise it would only filter the page already downloaded.
update public.products set stock_alert_qty = 5
where tenant_id = (select id from fixtures where key = 'tenant') and name = 'মিনিকেট চাল';

insert into public.products (tenant_id, name, sell_price_paisa, is_service, stock_alert_qty)
select id, 'হোম ডেলিভারি', 5000, true, 5
from public.tenants where name = 'ক্যাটালগ দোকান';

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.search_products(%L, null, null, 50, 0, true, null, true)$sql$,
           (select id from fixtures where key = 'tenant'))),
  1::bigint,
  'the low-stock filter returns only products at or below their alert level'
);

select tests.ok(
  tests.value_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select (select name from public.search_products(%L, null, null, 50, 0, true, null, true))$sql$,
           (select id from fixtures where key = 'tenant'))) = 'মিনিকেট চাল',
  'a service never counts as running out, even with zero stock'
);

select tests.eq(
  tests.count_as('cccccccc-0000-0000-0000-000000000001',
    format($sql$select 1 from public.search_products(%L)$sql$,
           (select id from fixtures where key = 'tenant'))),
  5::bigint,
  'the filter is off by default: the whole catalogue still comes back'
);

rollback;
