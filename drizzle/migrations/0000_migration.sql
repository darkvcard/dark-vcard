create type public.app_role as enum ('admin','user');
create type public.order_status as enum ('pending','completed','failed');
create type public.stock_status as enum ('in_stock','low_stock','out_of_stock');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- first user to sign up becomes admin
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users
for each row execute function public.handle_new_user_role();

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  card_name text not null,
  card_type text not null default 'Visa',
  price_in_usd numeric(10,2) not null default 0,
  description text,
  stock_status stock_status not null default 'in_stock',
  image_url text,
  created_at timestamptz not null default now()
);
grant select on public.cards to anon, authenticated;
grant insert, update, delete on public.cards to authenticated;
grant all on public.cards to service_role;
alter table public.cards enable row level security;
create policy "cards public read" on public.cards for select to anon, authenticated using (true);
create policy "admin insert cards" on public.cards for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update cards" on public.cards for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete cards" on public.cards for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid references public.cards(id) on delete set null,
  crypto_method text not null,
  transaction_hash text not null,
  wallet_address text,
  status order_status not null default 'pending',
  delivery_details text,
  amount_usd numeric(10,2),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own or admin read orders" on public.orders for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "users create pending orders" on public.orders for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending' and delivery_details is null);
create policy "admin update orders" on public.orders for update to authenticated
  using (public.has_role(auth.uid(),'admin'));

create policy "card images public read" on storage.objects for select using (bucket_id = 'card-images');
create policy "admin upload card images" on storage.objects for insert to authenticated with check (bucket_id = 'card-images' and public.has_role(auth.uid(),'admin'));
create policy "admin update card images" on storage.objects for update to authenticated using (bucket_id = 'card-images' and public.has_role(auth.uid(),'admin'));
create policy "admin delete card images" on storage.objects for delete to authenticated using (bucket_id = 'card-images' and public.has_role(auth.uid(),'admin'));

insert into public.cards (card_name, card_type, price_in_usd, description, stock_status) values
('Shadow Visa $50','Visa',55,'Prepaid virtual Visa loaded with $50. Works for online subscriptions worldwide.','in_stock'),
('Neon Mastercard $100','Mastercard',108,'Prepaid virtual Mastercard with $100 balance. Instant delivery after confirmation.','in_stock'),
('Ghost Visa $250','Visa',265,'High-balance prepaid virtual Visa for larger online purchases.','low_stock'),
('Cipher Mastercard $500','Mastercard',525,'Premium $500 prepaid virtual Mastercard. Ideal for ads and SaaS.','in_stock'),
('Proxy Visa $25','Visa',29,'Starter virtual Visa with $25 balance for trials and small purchases.','in_stock'),
('Null Amex $200','Amex',215,'Prepaid virtual Amex card with $200 balance.','out_of_stock');