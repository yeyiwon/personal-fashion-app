-- Optional migration for a new dedicated Supabase project. The local app does not depend on it.
begin;
create table public.garment (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category text not null check (category in ('상의','하의','아우터','원피스','신발','가방','기타')),
  condition text not null check (condition in ('착용 중','보관 중','수선 필요')),
  price_krw bigint check (price_krw between 0 and 9999999999),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id,source_hash), unique(owner_id,id)
);
create table public.outfit (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id,id)
);
create table public.outfit_member (
  owner_id uuid not null, outfit_id uuid not null, garment_id uuid not null,
  position smallint not null check (position between 0 and 31),
  primary key (outfit_id, garment_id), unique (outfit_id, position),
  foreign key (owner_id,outfit_id) references public.outfit(owner_id,id) on delete cascade,
  foreign key (owner_id,garment_id) references public.garment(owner_id,id) on delete no action deferrable initially deferred
);
alter table public.garment enable row level security;
alter table public.outfit enable row level security;
alter table public.outfit_member enable row level security;
create policy garment_owner on public.garment for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy outfit_owner on public.outfit for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy outfit_member_owner on public.outfit_member for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
revoke all on public.garment,public.outfit,public.outfit_member from public,anon;
grant select,insert,update,delete on public.garment,public.outfit,public.outfit_member to authenticated;
-- Separate immutable original and derived objects with paths {uid}/{garmentId}/{variant}.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('wardrobe-private','wardrobe-private',false,16777216,array['image/jpeg','image/png','image/webp']);
create policy wardrobe_photos_owner on storage.objects for all to authenticated
using (bucket_id='wardrobe-private' and (storage.foldername(name))[1]=(select auth.uid()::text))
with check (bucket_id='wardrobe-private' and (storage.foldername(name))[1]=(select auth.uid()::text));
commit;
