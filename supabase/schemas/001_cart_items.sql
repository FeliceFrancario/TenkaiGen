-- cart_items table and RLS policies (declarative schema)

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id integer not null,
  variant_id integer not null,
  color text,
  size text,
  quantity integer not null default 1 check (quantity > 0),
  files jsonb not null default '[]'::jsonb,
  mockups jsonb not null default '[]'::jsonb,
  prompt text,
  style text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cart_items enable row level security;

create index if not exists cart_items_user_id_idx on public.cart_items(user_id);
create index if not exists cart_items_user_variant_idx on public.cart_items(user_id, variant_id);

create policy if not exists "Cart items are viewable by owner" on public.cart_items
for select to authenticated using ( (select auth.uid()) = user_id );

create policy if not exists "Cart items can be inserted by owner" on public.cart_items
for insert to authenticated with check ( (select auth.uid()) = user_id );

create policy if not exists "Cart items can be updated by owner" on public.cart_items
for update to authenticated using ( (select auth.uid()) = user_id ) with check ( (select auth.uid()) = user_id );

create policy if not exists "Cart items can be deleted by owner" on public.cart_items
for delete to authenticated using ( (select auth.uid()) = user_id );


