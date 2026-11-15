-- ============================================================
-- Bản online của "Quản lý quán" / "Quản lý tiệm"
-- Chạy file này MỘT LẦN trong Supabase: SQL Editor -> dán toàn bộ -> Run.
-- Không chứa mật khẩu hay khóa bí mật nào.
-- ============================================================

-- 1. Cửa hàng. Mỗi quán/tiệm mua gói online là một dòng.
--    Gia hạn bằng tay: người bán sửa cột paid_until và max_users trong Table Editor.
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  app         text not null default 'quan' check (app in ('quan', 'tiem')),
  max_users   int  not null default 3,                       -- gói 3 / 5 / 10 người dùng
  paid_until  date not null default (current_date + 14),     -- 14 ngày dùng thử
  join_code   text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  owner       uuid not null references auth.users (id),
  created_at  timestamptz not null default now()
);

-- 2. Người dùng của từng cửa hàng và vai trò.
create table if not exists public.members (
  shop_id  uuid not null references public.shops (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     text not null default 'staff' check (role in ('owner', 'manager', 'cashier', 'staff')),
  name     text not null default '',
  joined_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

-- 3. Dữ liệu của cửa hàng. Mỗi bản ghi trong app (món, đơn hàng, phiếu kho…) là một dòng.
create table if not exists public.records (
  shop_id     uuid not null references public.shops (id) on delete cascade,
  coll        text not null,            -- loại dữ liệu: products, orders, moves…
  id          text not null,
  data        jsonb not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (shop_id, coll, id)
);
create index if not exists records_sync_idx on public.records (shop_id, updated_at);

-- Giờ sửa và người sửa do máy chủ ghi, app không tự đặt được (để đồng bộ đúng thứ tự, biết ai sửa).
create or replace function public.records_stamp() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records
  for each row execute function public.records_stamp();

-- ------------------------------------------------------------
-- Hàm kiểm tra quyền
-- ------------------------------------------------------------
create or replace function public.is_member(shop uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where shop_id = shop and user_id = auth.uid());
$$;
create or replace function public.is_owner(shop uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where shop_id = shop and user_id = auth.uid() and role = 'owner');
$$;
create or replace function public.shop_active(shop uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shops where id = shop and paid_until >= current_date);
$$;

-- ------------------------------------------------------------
-- Khóa dữ liệu theo từng cửa hàng (quán này không đọc được quán kia)
-- ------------------------------------------------------------
alter table public.shops   enable row level security;
alter table public.members enable row level security;
alter table public.records enable row level security;

drop policy if exists shops_read on public.shops;
create policy shops_read on public.shops for select using (public.is_member(id));
-- Không cho app tự thêm/sửa cửa hàng: tạo qua hàm create_shop, gia hạn do người bán làm.

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (public.is_member(shop_id));
-- Thêm/xóa/đổi vai trò qua các hàm bên dưới.

drop policy if exists records_read on public.records;
create policy records_read on public.records for select using (public.is_member(shop_id));
-- Hết hạn gói: vẫn xem được, không ghi được.
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert
  with check (public.is_member(shop_id) and public.shop_active(shop_id));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update
  using (public.is_member(shop_id) and public.shop_active(shop_id))
  with check (public.is_member(shop_id) and public.shop_active(shop_id));

-- ------------------------------------------------------------
-- Hàm app gọi
-- ------------------------------------------------------------
-- Chủ quán tạo cửa hàng mới (14 ngày dùng thử, gói 3 người).
create or replace function public.create_shop(shop_name text, shop_app text, my_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  insert into shops (name, app, owner) values (shop_name, coalesce(shop_app, 'quan'), auth.uid()) returning id into sid;
  insert into members (shop_id, user_id, role, name) values (sid, auth.uid(), 'owner', coalesce(my_name, ''));
  return sid;
end $$;

-- Nhân viên vào cửa hàng bằng mã tham gia chủ quán đưa. Chặn khi vượt số người của gói.
create or replace function public.join_shop(code text, my_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare s shops%rowtype; n int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into s from shops where join_code = upper(trim(code));
  if not found then raise exception 'Mã tham gia không đúng'; end if;
  if exists (select 1 from members where shop_id = s.id and user_id = auth.uid()) then return s.id; end if;
  select count(*) into n from members where shop_id = s.id;
  if n >= s.max_users then raise exception 'Gói hiện tại chỉ cho % người dùng', s.max_users; end if;
  insert into members (shop_id, user_id, role, name) values (s.id, auth.uid(), 'staff', coalesce(my_name, ''));
  return s.id;
end $$;

-- Chủ quán đổi vai trò một người (không tự hạ quyền chính mình).
create or replace function public.set_role(shop uuid, target uuid, new_role text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(shop) then raise exception 'Chỉ chủ cửa hàng mới đổi được vai trò'; end if;
  if target = auth.uid() then raise exception 'Không tự đổi vai trò của chính mình'; end if;
  if new_role not in ('manager', 'cashier', 'staff') then raise exception 'Vai trò không hợp lệ'; end if;
  update members set role = new_role where shop_id = shop and user_id = target;
end $$;

-- Chủ quán cho một người ra khỏi cửa hàng.
create or replace function public.remove_member(shop uuid, target uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(shop) then raise exception 'Chỉ chủ cửa hàng mới xóa được người dùng'; end if;
  if target = auth.uid() then raise exception 'Chủ cửa hàng không tự xóa mình'; end if;
  delete from members where shop_id = shop and user_id = target;
end $$;

-- Chủ quán đổi mã tham gia (khi lỡ lộ mã).
create or replace function public.new_join_code(shop uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_owner(shop) then raise exception 'Chỉ chủ cửa hàng mới đổi được mã'; end if;
  c := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  update shops set join_code = c where id = shop;
  return c;
end $$;
