-- =====================================================================
-- VC Imóveis — estrutura do banco no Supabase
-- Cole tudo no Supabase em: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (não apaga dados).
-- =====================================================================

-- 1) Quem é da equipe: só estes e-mails podem mexer no painel.
create table if not exists public.staff (
  email text primary key
);

-- >>> TROQUE pelos e-mails reais do dono e dos funcionários <<<
insert into public.staff (email) values
  ('dono@vcimoveis.com.br')
on conflict do nothing;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.staff enable row level security;
-- Ninguém lê/edita a lista pelo site; ela é mantida aqui no Supabase.

-- 2) Imóveis
create table if not exists public.properties (
  id           uuid primary key default gen_random_uuid(),
  code         bigint generated always as identity unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  mode         text not null check (mode in ('comprar', 'alugar')),
  status       text not null default 'disponivel'
               check (status in ('disponivel', 'reservado', 'alugado', 'vendido', 'oculto')),
  type         text not null,
  neighborhood text not null,
  street       text not null default '',
  price        numeric not null default 0,
  condo        numeric not null default 0,
  iptu         numeric not null default 0,
  area         numeric not null default 0,
  beds         int not null default 0,
  baths        int not null default 0,
  parking      int not null default 0,
  amenities    text[] not null default '{}',
  description  text not null default '',
  media        jsonb not null default '[]'::jsonb
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

alter table public.properties enable row level security;

-- Visitantes do site veem só o que está disponível ou reservado.
drop policy if exists "site le imoveis publicos" on public.properties;
create policy "site le imoveis publicos" on public.properties
  for select to anon, authenticated
  using (status in ('disponivel', 'reservado'));

-- A equipe vê e altera tudo.
drop policy if exists "equipe gerencia imoveis" on public.properties;
create policy "equipe gerencia imoveis" on public.properties
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- 3) Fotos e vídeos (bucket público para leitura, limite de 50 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit)
values ('imoveis', 'imoveis', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "equipe envia arquivos" on storage.objects;
create policy "equipe envia arquivos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imoveis' and public.is_staff());

drop policy if exists "equipe altera arquivos" on storage.objects;
create policy "equipe altera arquivos" on storage.objects
  for update to authenticated
  using (bucket_id = 'imoveis' and public.is_staff());

drop policy if exists "equipe apaga arquivos" on storage.objects;
create policy "equipe apaga arquivos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'imoveis' and public.is_staff());
