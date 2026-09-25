-- =====================================================================
-- INVENTARISKU V6 - FULL DATABASE SETUP (PROJECT BARU)
-- 1) Jalankan file ini di Supabase SQL Editor.
-- 2) Buat Storage bucket PUBLIC bernama: barang-images
-- 3) Buat user login di Authentication -> Users.
-- =====================================================================

create table if not exists public.barang (
  id uuid primary key default gen_random_uuid(),
  kode_barang text not null unique,
  nama_barang text not null,
  kategori text not null,
  harga numeric(14,2) not null default 0 check (harga >= 0),
  stok integer not null default 0 check (stok >= 0),
  satuan text not null,
  supplier text not null,
  kondisi text not null default 'Baik' check (kondisi in ('Baik','Perlu Dicek','Rusak')),
  lokasi text,
  gambar_url text,
  gambar_path text,
  diarsipkan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kode_barang_tidak_kosong check (length(trim(kode_barang)) > 0),
  constraint nama_barang_tidak_kosong check (length(trim(nama_barang)) > 0),
  constraint kategori_tidak_kosong check (length(trim(kategori)) > 0),
  constraint satuan_tidak_kosong check (length(trim(satuan)) > 0),
  constraint supplier_tidak_kosong check (length(trim(supplier)) > 0)
);

alter table public.barang add column if not exists diarsipkan_at timestamptz;
create index if not exists barang_diarsipkan_at_idx on public.barang(diarsipkan_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists barang_set_updated_at on public.barang;
create trigger barang_set_updated_at before update on public.barang
for each row execute function public.set_updated_at();
-- =====================================================================
-- INVENTARISKU V6 - UPGRADE DATABASE EXISTING PROJECT
-- Jalankan SEKALI di Supabase Dashboard -> SQL Editor.
-- Setelah script sukses, buat minimal satu user di Authentication -> Users.
-- =====================================================================

-- ---------- 1. KUNCI DATA BARANG: HANYA USER LOGIN ----------
alter table public.barang enable row level security;

drop policy if exists "Inventaris public read" on public.barang;
drop policy if exists "Inventaris public insert" on public.barang;
drop policy if exists "Inventaris public update" on public.barang;
drop policy if exists "Inventaris public delete" on public.barang;
drop policy if exists "Inventaris authenticated read" on public.barang;
drop policy if exists "Inventaris authenticated insert" on public.barang;
drop policy if exists "Inventaris authenticated update" on public.barang;
drop policy if exists "Inventaris authenticated delete" on public.barang;

create policy "Inventaris authenticated read"
on public.barang for select to authenticated using (true);

create policy "Inventaris authenticated insert"
on public.barang for insert to authenticated with check (true);

create policy "Inventaris authenticated update"
on public.barang for update to authenticated using (true) with check (true);

create policy "Inventaris authenticated delete"
on public.barang for delete to authenticated using (true);

revoke all on table public.barang from anon;
revoke all on table public.barang from authenticated;
grant select, insert, update, delete on table public.barang to authenticated;

-- ---------- 2. STORAGE: TULIS/HAPUS HANYA USER LOGIN ----------
-- Bucket barang-images tetap PUBLIC supaya URL foto existing tidak rusak.
-- Database dan UI tetap terkunci oleh Auth; hanya file yang URL-nya sudah diketahui
-- yang dapat dibaca langsung dari public bucket.
drop policy if exists "Inventory images read" on storage.objects;
drop policy if exists "Inventory images insert" on storage.objects;
drop policy if exists "Inventory images delete" on storage.objects;
drop policy if exists "Inventory images authenticated insert" on storage.objects;
drop policy if exists "Inventory images authenticated delete" on storage.objects;

create policy "Inventory images read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'barang-images');

create policy "Inventory images authenticated insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'barang-images');

create policy "Inventory images authenticated delete"
on storage.objects for delete to authenticated
using (bucket_id = 'barang-images');

-- ---------- 3. STOK OPNAME ----------
create table if not exists public.stok_opname (
  id uuid primary key default gen_random_uuid(),
  nomor_opname text not null unique,
  status text not null default 'draft' check (status in ('draft','selesai','batal')),
  catatan text,
  dibuat_oleh uuid not null default auth.uid(),
  diselesaikan_oleh uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.stok_opname_detail (
  id uuid primary key default gen_random_uuid(),
  stok_opname_id uuid not null references public.stok_opname(id) on delete cascade,
  barang_id uuid not null references public.barang(id) on delete restrict,
  kode_barang text not null,
  nama_barang text not null,
  kategori text not null,
  satuan text not null,
  stok_sistem integer not null check (stok_sistem >= 0),
  stok_fisik integer check (stok_fisik is null or stok_fisik >= 0),
  selisih integer generated always as (
    case when stok_fisik is null then null else stok_fisik - stok_sistem end
  ) stored,
  catatan text,
  unique (stok_opname_id, barang_id)
);

create unique index if not exists stok_opname_hanya_satu_draft
on public.stok_opname(status) where status = 'draft';

-- trigger updated_at menggunakan fungsi yang sudah ada dari setup lama
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stok_opname_set_updated_at on public.stok_opname;
create trigger stok_opname_set_updated_at
before update on public.stok_opname
for each row execute function public.set_updated_at();

alter table public.stok_opname enable row level security;
alter table public.stok_opname_detail enable row level security;

-- policies sederhana: seluruh user authenticated aplikasi dapat melihat riwayat.
drop policy if exists "Stok opname authenticated read" on public.stok_opname;
drop policy if exists "Stok opname detail authenticated read" on public.stok_opname_detail;
create policy "Stok opname authenticated read"
on public.stok_opname for select to authenticated using (true);
create policy "Stok opname detail authenticated read"
on public.stok_opname_detail for select to authenticated using (true);

revoke all on table public.stok_opname from anon, authenticated;
revoke all on table public.stok_opname_detail from anon, authenticated;
grant select on table public.stok_opname to authenticated;
grant select on table public.stok_opname_detail to authenticated;

-- ---------- 4. RPC: BUAT OPNAME ----------
create or replace function public.buat_stok_opname(p_catatan text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nomor text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if exists (select 1 from public.stok_opname where status = 'draft') then
    raise exception 'DRAFT_EXISTS';
  end if;

  if not exists (select 1 from public.barang where diarsipkan_at is null) then
    raise exception 'INVENTORY_EMPTY';
  end if;

  v_nomor := 'OP-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' ||
             upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into public.stok_opname (nomor_opname, catatan, dibuat_oleh)
  values (v_nomor, nullif(trim(coalesce(p_catatan,'')), ''), auth.uid())
  returning id into v_id;

  insert into public.stok_opname_detail
    (stok_opname_id, barang_id, kode_barang, nama_barang, kategori, satuan, stok_sistem)
  select v_id, b.id, b.kode_barang, b.nama_barang, b.kategori, b.satuan, b.stok
  from public.barang b
  where b.diarsipkan_at is null
  order by b.kode_barang;

  return v_id;
end;
$$;

-- ---------- 5. RPC: AUTOSAVE DRAFT OPNAME ----------
create or replace function public.simpan_draft_stok_opname(
  p_opname_id uuid,
  p_details jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_count integer := 0;
  r record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select status into v_status
  from public.stok_opname
  where id = p_opname_id
  for update;

  if v_status is null then raise exception 'OPNAME_NOT_FOUND'; end if;
  if v_status <> 'draft' then raise exception 'OPNAME_NOT_DRAFT'; end if;

  for r in
    select * from jsonb_to_recordset(coalesce(p_details, '[]'::jsonb))
      as x(id uuid, stok_fisik integer, catatan text)
  loop
    if r.stok_fisik is not null and r.stok_fisik < 0 then
      raise exception 'INVALID_STOCK';
    end if;

    update public.stok_opname_detail d
    set stok_fisik = r.stok_fisik,
        catatan = nullif(trim(coalesce(r.catatan,'')), '')
    where d.id = r.id and d.stok_opname_id = p_opname_id;

    if found then v_count := v_count + 1; end if;
  end loop;

  update public.stok_opname set updated_at = now() where id = p_opname_id;
  return v_count;
end;
$$;

-- ---------- 6. RPC: FINALISASI OPNAME (ATOMIC) ----------
create or replace function public.finalisasi_stok_opname(p_opname_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_total integer;
  v_selisih integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select status into v_status
  from public.stok_opname
  where id = p_opname_id
  for update;

  if v_status is null then raise exception 'OPNAME_NOT_FOUND'; end if;
  if v_status <> 'draft' then raise exception 'OPNAME_NOT_DRAFT'; end if;

  if exists (
    select 1 from public.stok_opname_detail
    where stok_opname_id = p_opname_id and stok_fisik is null
  ) then
    raise exception 'OPNAME_INCOMPLETE';
  end if;

  update public.barang b
  set stok = d.stok_fisik,
      updated_at = now()
  from public.stok_opname_detail d
  where d.stok_opname_id = p_opname_id and d.barang_id = b.id;

  select count(*), count(*) filter (where selisih <> 0)
  into v_total, v_selisih
  from public.stok_opname_detail
  where stok_opname_id = p_opname_id;

  update public.stok_opname
  set status = 'selesai',
      completed_at = now(),
      diselesaikan_oleh = auth.uid(),
      updated_at = now()
  where id = p_opname_id;

  return jsonb_build_object('total', v_total, 'berbeda', v_selisih);
end;
$$;

-- ---------- 7. RPC: BATALKAN OPNAME ----------
create or replace function public.batalkan_stok_opname(p_opname_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.stok_opname
  set status = 'batal', updated_at = now()
  where id = p_opname_id and status = 'draft';

  return found;
end;
$$;

-- ---------- 8. RPC: IMPORT BARANG ATOMIC ----------
create or replace function public.import_barang_bulk(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  with rows as (
    select * from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      kode_barang text,
      nama_barang text,
      kategori text,
      harga numeric,
      stok integer,
      satuan text,
      supplier text,
      kondisi text,
      lokasi text
    )
  ), inserted as (
    insert into public.barang
      (kode_barang, nama_barang, kategori, harga, stok, satuan, supplier, kondisi, lokasi, gambar_url, gambar_path)
    select
      trim(kode_barang), trim(nama_barang), trim(kategori), harga, stok,
      trim(satuan), trim(supplier), coalesce(nullif(trim(kondisi),''),'Baik'),
      nullif(trim(coalesce(lokasi,'')), ''), null, null
    from rows
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

-- ---------- 9. HAK AKSES FUNCTION ----------
revoke all on function public.buat_stok_opname(text) from public, anon;
revoke all on function public.simpan_draft_stok_opname(uuid, jsonb) from public, anon;
revoke all on function public.finalisasi_stok_opname(uuid) from public, anon;
revoke all on function public.batalkan_stok_opname(uuid) from public, anon;
revoke all on function public.import_barang_bulk(jsonb) from public, anon;

grant execute on function public.buat_stok_opname(text) to authenticated;
grant execute on function public.simpan_draft_stok_opname(uuid, jsonb) to authenticated;
grant execute on function public.finalisasi_stok_opname(uuid) to authenticated;
grant execute on function public.batalkan_stok_opname(uuid) to authenticated;
grant execute on function public.import_barang_bulk(jsonb) to authenticated;
