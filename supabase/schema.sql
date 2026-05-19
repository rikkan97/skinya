-- ============================================================
-- SKINYA · INITIAL SCHEMA
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1) ENUM TYPES ----------------------------------------------
do $$ begin
  create type order_status as enum (
    'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_kind as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;


-- 2) CATEGORIES ----------------------------------------------
create table if not exists categories (
  id          text primary key,
  name        text not null,
  step        text,
  eyebrow     text,
  description text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- 3) BRANDS --------------------------------------------------
create table if not exists brands (
  id          text primary key,           -- π.χ. 'anua', 'cosrx'
  name        text not null,              -- 'Anua', 'COSRX'
  country     text,                       -- 'Korea'
  created_at  timestamptz default now()
);

-- 4) PRODUCTS ------------------------------------------------
create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,    -- 'cl1', 'cl2' — short codes
  name            text not null,
  brand_id        text references brands(id) on delete set null,
  category_id     text references categories(id) on delete set null,
  size            text,
  description     text,
  img             text,                    -- path/URL to image
  price           numeric(10,2),           -- per-product price
  default_price   numeric(10,2),           -- category default fallback
  stock           int default 0,
  is_active       boolean default true,
  is_featured     boolean default false,
  badges          text[] default '{}',     -- ['vegan','viral','cruelty-free']
  ingredients     text[] default '{}',
  concerns        text[] default '{}',     -- ['sensitivity','acne','pigmentation']
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists products_category_idx on products(category_id);
create index if not exists products_brand_idx on products(brand_id);
create index if not exists products_sku_idx on products(sku);

-- 5) CUSTOMERS (linked to auth.users) ------------------------
create table if not exists customers (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  first_name   text,
  last_name    text,
  phone        text,
  role         user_role default 'customer',
  newsletter   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-create customer row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.customers (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) ADDRESSES -----------------------------------------------
create table if not exists addresses (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id) on delete cascade,
  line1         text not null,
  line2         text,
  city          text not null,
  postcode      text not null,
  country       text default 'GR',
  phone         text,
  is_default    boolean default false,
  created_at    timestamptz default now()
);

create index if not exists addresses_customer_idx on addresses(customer_id);

-- 7) ORDERS --------------------------------------------------
create table if not exists orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text unique not null,         -- 'SK-2026-0001'
  customer_id           uuid references customers(id) on delete set null,
  customer_email        text not null,                 -- snapshot
  status                order_status default 'pending',
  subtotal              numeric(10,2) not null,
  discount              numeric(10,2) default 0,
  shipping              numeric(10,2) default 0,
  total                 numeric(10,2) not null,
  currency              text default 'EUR',
  coupon_code           text,
  shipping_address      jsonb,                         -- snapshot {line1, city, postcode...}
  billing_address       jsonb,
  notes                 text,
  viva_order_code       text,                          -- Viva Wallet transaction
  paid_at               timestamptz,
  shipped_at            timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists orders_customer_idx on orders(customer_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_idx on orders(created_at desc);

-- Order number generator (SK-YYYY-NNNN)
create sequence if not exists order_number_seq start 1;
create or replace function generate_order_number() returns text as $$
declare
  yr text := to_char(now(), 'YYYY');
  n  text := lpad(nextval('order_number_seq')::text, 4, '0');
begin
  return 'SK-' || yr || '-' || n;
end;
$$ language plpgsql;

-- 8) ORDER ITEMS ---------------------------------------------
create table if not exists order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid references orders(id) on delete cascade,
  product_id        uuid references products(id) on delete set null,
  product_snapshot  jsonb not null,            -- {sku, name, brand, size, img}
  quantity          int not null check (quantity > 0),
  unit_price        numeric(10,2) not null,
  line_total        numeric(10,2) not null
);

create index if not exists order_items_order_idx on order_items(order_id);

-- 9) COUPONS -------------------------------------------------
create table if not exists coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,
  discount_kind     discount_kind not null,
  discount_value    numeric(10,2) not null,
  min_order_amount  numeric(10,2),
  max_uses          int,
  uses_count        int default 0,
  valid_from        timestamptz default now(),
  valid_until       timestamptz,
  is_active         boolean default true,
  created_at        timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table categories  enable row level security;
alter table brands      enable row level security;
alter table products    enable row level security;
alter table customers   enable row level security;
alter table addresses   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table coupons     enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from customers
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- PUBLIC READ: categories, brands, active products, active coupons (for code lookup)
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

drop policy if exists "public read brands" on brands;
create policy "public read brands" on brands for select using (true);

drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select using (is_active = true);

drop policy if exists "public read active coupons" on coupons;
create policy "public read active coupons" on coupons for select using (is_active = true);

-- CUSTOMERS: each user reads/updates own row, admins read all
drop policy if exists "customers read own" on customers;
create policy "customers read own" on customers for select using (auth.uid() = id or is_admin());

drop policy if exists "customers update own" on customers;
create policy "customers update own" on customers for update using (auth.uid() = id);

-- ADDRESSES: own CRUD
drop policy if exists "addresses own" on addresses;
create policy "addresses own" on addresses for all using (auth.uid() = customer_id or is_admin());

-- ORDERS: customer sees own; admin sees all; customer can insert own
drop policy if exists "orders read own" on orders;
create policy "orders read own" on orders for select using (auth.uid() = customer_id or is_admin());

drop policy if exists "orders insert own" on orders;
create policy "orders insert own" on orders for insert with check (auth.uid() = customer_id or customer_id is null);

drop policy if exists "orders admin update" on orders;
create policy "orders admin update" on orders for update using (is_admin());

-- ORDER ITEMS: visible if order is visible
drop policy if exists "order items via order" on order_items;
create policy "order items via order" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and (o.customer_id = auth.uid() or is_admin()))
);

drop policy if exists "order items insert via order" on order_items;
create policy "order items insert via order" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_items.order_id and (o.customer_id = auth.uid() or o.customer_id is null))
);

-- ADMIN-ONLY: products / categories / brands / coupons write
drop policy if exists "admin write products" on products;
create policy "admin write products" on products for all using (is_admin()) with check (is_admin());

drop policy if exists "admin write categories" on categories;
create policy "admin write categories" on categories for all using (is_admin()) with check (is_admin());

drop policy if exists "admin write brands" on brands;
create policy "admin write brands" on brands for all using (is_admin()) with check (is_admin());

drop policy if exists "admin write coupons" on coupons;
create policy "admin write coupons" on coupons for all using (is_admin()) with check (is_admin());

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

drop trigger if exists customers_updated_at on customers;
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();
