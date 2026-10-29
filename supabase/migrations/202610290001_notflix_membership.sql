-- NOTFLIX: tek kullanıcı tablosu; SQL Editor'de çalıştır.
-- Parola pgcrypto bcrypt ($2a/$2b) biçiminde hash olarak tutulur.
create extension if not exists pgcrypto;

create table if not exists public.notflix_kullanicilar (
  id uuid primary key default gen_random_uuid(),
  kullanici_adi text not null unique check (char_length(kullanici_adi) between 4 and 20),
  sifre_hash text not null,
  eposta text not null unique,
  hediye_kodu_kullanildi boolean not null default false,
  hwid text,
  ip_adresi text,
  son_gorulme timestamptz not null default now(),
  abonelik_bitis timestamptz,
  abonelik_kaynagi text not null default 'Yok',
  durum text not null default 'aktif' check (durum in ('aktif', 'bloklu')),
  olusturulma timestamptz not null default now()
);

alter table public.notflix_kullanicilar enable row level security;
revoke all on table public.notflix_kullanicilar from anon, authenticated;

create index if not exists notflix_kullanicilar_durum_idx on public.notflix_kullanicilar (durum);
create index if not exists notflix_kullanicilar_abonelik_idx on public.notflix_kullanicilar (abonelik_bitis);

-- Hashing and verification use bcrypt through pgcrypto; the browser cannot call these.
create or replace function public.notflix_sifre_hashle(p_sifre text)
returns text language sql volatile security definer set search_path = public, extensions, pg_temp as $$
  select crypt(p_sifre, gen_salt('bf', 12));
$$;

create or replace function public.notflix_sifre_dogrula(p_kullanici_adi text, p_sifre text)
returns setof public.notflix_kullanicilar language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  return query
  update public.notflix_kullanicilar u
  set son_gorulme = now()
  where u.kullanici_adi = p_kullanici_adi
    and u.durum = 'aktif'
    and u.sifre_hash = crypt(p_sifre, u.sifre_hash)
  returning u.*;
end;
$$;

create or replace function public.notflix_hediye_kodu_kullan(p_kullanici_adi text, p_hwid text, p_ip text, p_kod text)
returns setof public.notflix_kullanicilar language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_kod <> 'W&Q%*8M*Afree' then
    return;
  end if;
  return query
  update public.notflix_kullanicilar u
  set abonelik_bitis = greatest(coalesce(u.abonelik_bitis, now()), now()) + interval '12 months',
      abonelik_kaynagi = 'Hediye Kodu',
      hediye_kodu_kullanildi = true,
      hwid = coalesce(u.hwid, p_hwid),
      ip_adresi = p_ip,
      son_gorulme = now()
  where u.kullanici_adi = p_kullanici_adi and u.durum = 'aktif'
    and (not u.hediye_kodu_kullanildi)
    and (u.hwid is null or u.hwid = p_hwid)
  returning u.*;
end;
$$;

revoke all on function public.notflix_sifre_hashle(text) from public, anon, authenticated;
revoke all on function public.notflix_sifre_dogrula(text, text) from public, anon, authenticated;
revoke all on function public.notflix_hediye_kodu_kullan(text, text, text, text) from public, anon, authenticated;
grant execute on function public.notflix_sifre_hashle(text) to service_role;
grant execute on function public.notflix_sifre_dogrula(text, text) to service_role;
grant execute on function public.notflix_hediye_kodu_kullan(text, text, text, text) to service_role;

comment on table public.notflix_kullanicilar is 'NOTFLIX üyeleri; doğrudan tablo erişimi kapalıdır. Backend secret key ile çalışır.';
comment on column public.notflix_kullanicilar.sifre_hash is 'pgcrypto bcrypt hash. Düz metin parola saklanmaz.';
comment on column public.notflix_kullanicilar.hwid is 'Sunucunun HMAC ile imzaladığı tarayıcı belirteci; fiziksel HWID değildir.';
