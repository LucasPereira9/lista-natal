-- =========================================================
--  Lista de Natal da Família — estrutura do banco (Supabase)
--  Cole tudo no SQL Editor do Supabase e clique em "Run".
--  ⚠️ Troque o código da família na linha marcada abaixo!
-- =========================================================

-- Tabelas -------------------------------------------------
create table if not exists public.people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create unique index if not exists people_name_key on public.people (lower(name));
-- Foto de perfil (opcional) que aparece na bolinha
alter table public.people add column if not exists avatar_url text check (avatar_url ~* '^https?://');

create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.people(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  details    text check (char_length(details) <= 140),
  link       text check (link ~* '^https?://'),
  photo_url  text check (photo_url ~* '^https?://'),
  price_min  numeric(10,2) check (price_min >= 0),
  price_max  numeric(10,2) check (price_max >= 0),
  created_at timestamptz not null default now()
);
create index if not exists items_person_idx on public.items (person_id);

-- Código da família (fica num schema que a API não expõe) --
create schema if not exists private;
create table if not exists private.settings (key text primary key, value text not null);

insert into private.settings (key, value)
values ('family_code', 'TROQUE-ESTE-CODIGO')            -- ⚠️ TROQUE AQUI
on conflict (key) do update set value = excluded.value;

-- Confere o cabeçalho x-family-code que o site envia em toda requisição
create or replace function public.family_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.settings
    where key = 'family_code'
      and value = coalesce(current_setting('request.headers', true)::json ->> 'x-family-code', '')
  );
$$;

-- Usada pela tela de entrada para validar o código digitado
create or replace function public.check_family_code(code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.settings where key = 'family_code' and value = code);
$$;

revoke all on function public.family_ok() from public;
grant execute on function public.family_ok() to anon, authenticated;
grant execute on function public.check_family_code(text) to anon, authenticated;

-- Segurança: só quem tem o código lê/edita ----------------
alter table public.people enable row level security;
alter table public.items  enable row level security;

-- Pessoas: o site pode ver, criar e editar, mas NÃO excluir.
-- Excluir pessoa só pelo painel do Supabase (Table Editor → people), pelo dono.
drop policy if exists "familia pessoas" on public.people;
drop policy if exists "familia pessoas ver" on public.people;
drop policy if exists "familia pessoas criar" on public.people;
drop policy if exists "familia pessoas editar" on public.people;
create policy "familia pessoas ver" on public.people
  for select to anon, authenticated using (public.family_ok());
create policy "familia pessoas criar" on public.people
  for insert to anon, authenticated with check (public.family_ok());
create policy "familia pessoas editar" on public.people
  for update to anon, authenticated using (public.family_ok()) with check (public.family_ok());

drop policy if exists "familia itens" on public.items;
create policy "familia itens" on public.items
  for all to anon, authenticated using (public.family_ok()) with check (public.family_ok());

grant select, insert, update on public.people to anon, authenticated;
revoke delete, truncate on public.people from anon, authenticated;
grant select, insert, update, delete on public.items to anon, authenticated;

-- Fotos (Storage) -----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "fotos upload" on storage.objects;
create policy "fotos upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'fotos');
