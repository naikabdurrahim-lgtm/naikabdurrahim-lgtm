-- =============================================================================
-- 0010 — Reference data: units and per-pack default categories
-- =============================================================================
-- This is configuration, not demo data: every real shop gets these on creation.
-- `app.pack_categories` drives create_tenant(); adding a business type means
-- adding rows here, never changing core code (PROJECT_RULES 5.2).
-- =============================================================================

insert into public.units (code, label_bn, label_en, kind, allows_decimal, sort_order) values
  ('piece',  'পিস',      'piece',   'count',  false, 10),
  ('dozen',  'ডজন',      'dozen',   'count',  false, 20),
  ('packet', 'প্যাকেট',  'packet',  'count',  false, 30),
  ('strip',  'স্ট্রিপ',  'strip',   'count',  false, 40),
  ('box',    'বক্স',     'box',     'count',  false, 50),
  ('bottle', 'বোতল',     'bottle',  'count',  false, 60),
  ('kg',     'কেজি',     'kg',      'weight', true,  70),
  ('gram',   'গ্রাম',    'gram',    'weight', true,  80),
  ('litre',  'লিটার',    'litre',   'volume', true,  90),
  ('ml',     'মিলি',     'ml',      'volume', true, 100)
on conflict (code) do nothing;

create table if not exists app.pack_categories (
  pack public.business_pack not null,
  name_bn text not null,
  name_en text not null,
  icon text not null default 'package',
  sort_order integer not null default 0,
  primary key (pack, name_bn)
);

comment on table app.pack_categories is
  'Default categories seeded into a new shop, per business pack.';

insert into app.pack_categories (pack, name_bn, name_en, icon, sort_order) values
  -- grocery
  ('grocery', 'চাল-ডাল',      'Rice & Lentils', 'wheat',      10),
  ('grocery', 'তেল-মসলা',     'Oil & Spices',   'flask',      20),
  ('grocery', 'সাবান-সামগ্রী', 'Soap & Care',    'droplets',   30),
  ('grocery', 'পানীয়',        'Beverages',      'cup-soda',   40),
  ('grocery', 'স্ন্যাকস',       'Snacks',         'cookie',     50),
  ('grocery', 'অন্যান্য',      'Others',         'package',    60),
  -- pharmacy
  ('pharmacy', 'ট্যাবলেট',      'Tablets',        'pill',       10),
  ('pharmacy', 'ক্যাপসুল',      'Capsules',       'pill',       20),
  ('pharmacy', 'সিরাপ',        'Syrup',          'flask',      30),
  ('pharmacy', 'ইনজেকশন',      'Injection',      'syringe',    40),
  ('pharmacy', 'প্রাথমিক চিকিৎসা', 'First aid',    'bandage',    50),
  ('pharmacy', 'অন্যান্য',      'Others',         'package',    60),
  -- clothing
  ('clothing', 'পুরুষ পোশাক',   'Men',            'shirt',      10),
  ('clothing', 'মহিলা পোশাক',   'Women',          'shirt',      20),
  ('clothing', 'শিশু পোশাক',    'Kids',           'baby',       30),
  ('clothing', 'জুতা',         'Footwear',       'footprints', 40),
  ('clothing', 'অন্যান্য',      'Others',         'package',    50),
  -- restaurant
  ('restaurant', 'ভাত-কারি',    'Rice & Curry',   'utensils',   10),
  ('restaurant', 'নাস্তা',       'Snacks',         'cookie',     20),
  ('restaurant', 'পানীয়',        'Drinks',         'cup-soda',   30),
  ('restaurant', 'মিষ্টি',       'Sweets',         'cake',       40),
  ('restaurant', 'অন্যান্য',      'Others',         'package',    50),
  -- service / salon
  ('service', 'চুল কাটা',       'Haircut',        'scissors',   10),
  ('service', 'শেভ',          'Shave',          'razor',      20),
  ('service', 'ফেসিয়াল',       'Facial',         'sparkles',   30),
  ('service', 'মেহেদী',        'Henna',          'hand',       40),
  ('service', 'অন্যান্য',      'Others',         'package',    50),
  -- general
  ('general', 'প্রধান পণ্য',    'Main',           'package',    10),
  ('general', 'অন্যান্য',      'Others',         'package',    20)
on conflict (pack, name_bn) do nothing;
