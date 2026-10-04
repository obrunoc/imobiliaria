-- =====================================================================
-- VC Imóveis — estrutura do banco no Supabase
-- Cole tudo no Supabase em: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (não apaga dados).
-- =====================================================================

-- 1) Equipe: só estes e-mails entram no painel.
--    admin    = dono: pode tudo (inclusive excluir imóveis e editar os dados do site)
--    corretor = cadastra e edita imóveis, atende clientes, gera documentos
create table if not exists public.staff (
  email text primary key,
  role  text not null default 'corretor'
);
alter table public.staff add column if not exists role text not null default 'corretor';
do $$ begin
  alter table public.staff add constraint staff_role_check check (role in ('admin', 'corretor'));
exception when duplicate_object then null; end $$;

-- >>> TROQUE pelos e-mails reais. Um por linha. <<<
insert into public.staff (email, role) values
  ('dono@vcimoveis.com.br', 'admin')
  -- , ('corretor1@gmail.com', 'corretor')
on conflict (email) do update set role = excluded.role;

alter table public.staff enable row level security;
-- Sem políticas: ninguém lê ou altera a lista pelo site. Ela é mantida aqui no Supabase.

-- O papel vem do usuário logado (auth.uid) com e-mail confirmado que está na lista da equipe.
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public, auth as $$
  select s.role
  from public.staff s
  join auth.users u on lower(u.email) = lower(s.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null
  limit 1;
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() is not null;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

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
alter table public.properties add column if not exists featured  boolean not null default false;
alter table public.properties add column if not exists old_price numeric;
alter table public.properties add column if not exists views     int not null default 0;

-- Atualiza "updated_at" só quando algo além das visualizações muda.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'views' - 'updated_at') is distinct from (to_jsonb(old) - 'views' - 'updated_at') then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

alter table public.properties enable row level security;

drop policy if exists "site le imoveis publicos" on public.properties;
create policy "site le imoveis publicos" on public.properties
  for select to anon, authenticated
  using (status in ('disponivel', 'reservado') or public.is_staff());

drop policy if exists "equipe gerencia imoveis" on public.properties;
drop policy if exists "equipe cadastra imoveis" on public.properties;
create policy "equipe cadastra imoveis" on public.properties
  for insert to authenticated with check (public.is_staff());

drop policy if exists "equipe edita imoveis" on public.properties;
create policy "equipe edita imoveis" on public.properties
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "admin exclui imoveis" on public.properties;
create policy "admin exclui imoveis" on public.properties
  for delete to authenticated using (public.is_admin());

-- Contador de visualizações (o site só consegue somar +1 em imóvel publicado).
create or replace function public.increment_view(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.properties set views = views + 1
  where id = p_id and status in ('disponivel', 'reservado');
$$;
revoke all on function public.increment_view(uuid) from public;
grant execute on function public.increment_view(uuid) to anon, authenticated;

-- 3) Pedidos de clientes (visitas, "me avise", proprietários querendo anunciar)
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('visita', 'contato', 'anunciar', 'alerta')),
  status        text not null default 'novo'
                check (status in ('novo', 'em_atendimento', 'visitou', 'fechado', 'descartado')),
  property_id   uuid references public.properties(id) on delete set null,
  property_code bigint,
  name          text not null check (char_length(name) between 2 and 120),
  phone         text not null check (char_length(phone) between 8 and 30),
  message       text not null default '' check (char_length(message) <= 1500),
  visit_date    date,
  visit_time    text check (char_length(coalesce(visit_time, '')) <= 10),
  criteria      jsonb check (criteria is null or pg_column_size(criteria) < 2000),
  notes         text not null default '' check (char_length(notes) <= 4000),
  consent       boolean not null default false check (consent)
);

-- Proteções dos pedidos enviados pelo site:
-- - data, situação e anotações são sempre definidas pelo banco (o visitante não consegue forjar);
-- - no máximo 5 pedidos por telefone por hora e 100 pedidos no total a cada 10 minutos.
create or replace function public.leads_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  new.status := 'novo';
  new.notes := '';
  if new.criteria is not null and jsonb_typeof(new.criteria) <> 'object' then
    raise exception 'Pedido inválido.';
  end if;
  if (select count(*) from public.leads
      where phone = new.phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Recebemos vários pedidos deste telefone. Tente de novo mais tarde ou chame no WhatsApp.';
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '10 minutes') >= 100 then
    raise exception 'Muitos pedidos no momento. Tente de novo em alguns minutos.';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_guard on public.leads;
create trigger leads_guard before insert on public.leads
  for each row execute function public.leads_guard();

alter table public.leads enable row level security;

-- O visitante só ENVIA. Não existe política de leitura para visitantes.
drop policy if exists "site envia pedidos" on public.leads;
create policy "site envia pedidos" on public.leads
  for insert to anon, authenticated
  with check (status = 'novo' and notes = '' and consent);

drop policy if exists "equipe le pedidos" on public.leads;
create policy "equipe le pedidos" on public.leads
  for select to authenticated using (public.is_staff());

drop policy if exists "equipe atualiza pedidos" on public.leads;
create policy "equipe atualiza pedidos" on public.leads
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "equipe apaga pedidos" on public.leads;
create policy "equipe apaga pedidos" on public.leads
  for delete to authenticated using (public.is_staff());

-- 4) Locações ativas (só dados básicos; CPF/RG ficam apenas no contrato assinado)
create table if not exists public.rentals (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  property_id    uuid references public.properties(id) on delete set null,
  property_label text not null default '',
  tenant_name    text not null check (char_length(tenant_name) between 2 and 120),
  tenant_phone   text not null default '' check (char_length(tenant_phone) <= 30),
  owner_name     text not null default '' check (char_length(owner_name) <= 120),
  rent           numeric not null default 0,
  due_day        int check (due_day between 1 and 31),
  index_name     text not null default 'IPCA',
  start_date     date not null,
  months         int not null default 30 check (months > 0),
  notes          text not null default '' check (char_length(notes) <= 4000),
  status         text not null default 'ativa' check (status in ('ativa', 'encerrada'))
);

drop trigger if exists rentals_touch on public.rentals;
create trigger rentals_touch before update on public.rentals
  for each row execute function public.touch_updated_at();

alter table public.rentals enable row level security;
drop policy if exists "equipe gerencia locacoes" on public.rentals;
create policy "equipe gerencia locacoes" on public.rentals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 5) Dados públicos do site (contatos, Quem somos, equipe, depoimentos)
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

alter table public.settings enable row level security;
drop policy if exists "site le dados" on public.settings;
create policy "site le dados" on public.settings
  for select to anon, authenticated using (true);
drop policy if exists "admin edita dados" on public.settings;
create policy "admin edita dados" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin cria dados" on public.settings;
create policy "admin cria dados" on public.settings
  for insert to authenticated with check (public.is_admin());

-- 6) Fotos e vídeos (leitura pública; só imagens e vídeos, até 50 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imoveis', 'imoveis', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

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
