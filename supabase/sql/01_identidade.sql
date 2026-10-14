-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 01 — identidade e perfis
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 00.
--
-- O QUE FAZ:
--   1. Cria `public.perfis`: as pessoas que usam o portal. SEM SENHA — o login
--      é do Supabase (Entra ID ou alternativa aprovada). Os ids atuais
--      (`usr-1`, ...) são mantidos como chave, porque são referenciados por
--      monitorias, carteiras e metas.
--   2. Liga cada perfil ao login (`auth_user_id`) pelo e-mail, automaticamente,
--      quando a pessoa entra pela primeira vez com e-mail confirmado.
--   3. Cria as funções de perfil usadas pelas regras de acesso (RLS):
--      app.meu_perfil_id(), app.meus_perfis(), app.tem_perfil(), app.usuario_ativo().
--   4. Protege os dados sensíveis do perfil: só o Administrador altera perfis,
--      situação, e-mail ou vínculo de login; o id nunca muda; o sistema nunca
--      fica sem um Administrador ativo; nada é excluído.
--   5. Liga a RLS na tabela SEM nenhuma política: até o script 07, o portal
--      (anon/authenticated) não lê nem grava nada aqui.
--
-- PERFIS: 'ADMIN' (Administrador), 'GESTOR' (exibido como "Supervisor"; o código
-- interno é mantido por compatibilidade com o portal) e 'MONITOR'.
--
-- FIDELIDADE NA MIGRAÇÃO: só viram colunas os campos usados por segurança e
-- consulta (id, e-mail, nome, perfis, situação). Todo o resto do usuário
-- (cargo, área, gestor, login, foto, observações, último acesso, campos antigos
-- e desconhecidos) vai INTACTO para `extras`. A senha nunca entra no banco.
-- Convenções usadas pela reconstrução (script 09):
--   - `status` nulo = campo ausente no original (o portal o trata como ativo);
--   - `extras._nulos` = lista de campos promovidos que eram `null` explícito;
--   - `extras._email_original` = e-mail com a grafia original, se diferente.
--
-- Revisão de 12/10/2026 (depois do 00 aplicado na homologação): o vínculo
-- automático de login passou a informar a versão lida. Sem isso, se o serviço
-- de login rodasse com usuário identificado, o primeiro acesso seria recusado
-- (MI428) — comprovado no PGlite.
--
-- PODE RODAR MAIS DE UMA VEZ.  PARA DESFAZER (só na homologação, se pedido):
--   drop trigger if exists perfis_vincular_login on auth.users;
--   drop table public.perfis;   -- exige manutenção autorizada (ver script 00)
-- =============================================================================

begin;

-- 1. Tabela ---------------------------------------------------------------------
create table if not exists public.perfis (
  id              text        primary key,
  auth_user_id    uuid        unique references auth.users (id) on delete restrict,
  email           text        not null,
  nome            text        not null,
  perfis          text[]      not null default '{}',
  status          text,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint perfis_id_preenchido    check (btrim(id) <> ''),
  constraint perfis_nome_preenchido  check (btrim(nome) <> ''),
  constraint perfis_email_minusculo  check (email = lower(btrim(email)) and email <> ''),
  constraint perfis_perfis_validos   check (perfis <@ array['ADMIN', 'GESTOR', 'MONITOR']::text[]),
  constraint perfis_status_valido    check (status is null or status in ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  constraint perfis_extras_objeto    check (jsonb_typeof(extras) = 'object'),
  constraint perfis_sem_senha        check (not (extras ? 'password')),
  constraint perfis_versao_lida      check (versao_lida is null)
);

comment on column public.perfis.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

create unique index if not exists perfis_email_unico on public.perfis (email);

comment on table  public.perfis              is 'Pessoas que usam o portal. Sem senha: o login é do Supabase Auth.';
comment on column public.perfis.id           is 'Id atual do portal (ex.: usr-1). Nunca muda.';
comment on column public.perfis.auth_user_id is 'Vínculo com o login do Supabase. Nulo até a primeira entrada.';
comment on column public.perfis.perfis       is 'ADMIN, GESTOR (Supervisor) e/ou MONITOR.';
comment on column public.perfis.status       is 'ACTIVE, INACTIVE ou BLOCKED. Nulo = ausente no original (tratado como ativo).';
comment on column public.perfis.extras       is 'Demais campos do usuário, intactos. Nunca contém senha.';
comment on column public.perfis.ordem        is 'Posição na lista original do navegador, para reconstrução fiel.';

-- 2. Funções de perfil (usadas pelas regras RLS) --------------------------------
-- security definer: leem `perfis` sem depender das regras RLS da própria tabela
-- (evita recursão). Só consultam o perfil de QUEM ESTÁ LOGADO (auth.uid()).
create or replace function app.meu_perfil_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.perfis p
   where p.auth_user_id = auth.uid()
     and coalesce(p.status, 'ACTIVE') = 'ACTIVE';
$$;

create or replace function app.meus_perfis()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.perfis
       from public.perfis p
      where p.auth_user_id = auth.uid()
        and coalesce(p.status, 'ACTIVE') = 'ACTIVE'),
    '{}'::text[]);
$$;

create or replace function app.tem_perfil(p_perfil text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_perfil = any (app.meus_perfis());
$$;

create or replace function app.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.meu_perfil_id() is not null;
$$;

revoke execute on function app.meu_perfil_id()   from public;
revoke execute on function app.meus_perfis()     from public;
revoke execute on function app.tem_perfil(text)  from public;
revoke execute on function app.usuario_ativo()   from public;

-- O portal logado precisa executar estas quatro (dentro das regras RLS).
-- O schema `app` continua fora da API: isto não as expõe por HTTP.
grant usage   on schema app                      to authenticated;
grant execute on function app.meu_perfil_id()    to authenticated;
grant execute on function app.meus_perfis()      to authenticated;
grant execute on function app.tem_perfil(text)   to authenticated;
grant execute on function app.usuario_ativo()    to authenticated;

-- 3. Proteção dos campos sensíveis e do último Administrador ---------------------
create or replace function app.tg_perfis_protecao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_admin_antes  boolean := 'ADMIN' = any (old.perfis) and coalesce(old.status, 'ACTIVE') = 'ACTIVE';
  v_admin_depois boolean := 'ADMIN' = any (new.perfis) and coalesce(new.status, 'ACTIVE') = 'ACTIVE';
begin
  if new.id is distinct from old.id then
    raise exception 'O identificador do perfil não pode ser alterado.'
      using errcode = 'MI403';
  end if;

  -- Pelo portal (anon/authenticated), só o Administrador mexe em perfis,
  -- situação, e-mail e vínculo de login. O dono do banco (SQL Editor e as
  -- funções internas, como o vínculo automático de login) passa.
  if current_user not in ('postgres', 'supabase_admin')
     and (new.perfis, new.status, new.email, new.auth_user_id)
         is distinct from (old.perfis, old.status, old.email, old.auth_user_id)
     and not app.tem_perfil('ADMIN')
  then
    raise exception 'Somente o Administrador altera perfis, situação, e-mail ou vínculo de login.'
      using errcode = 'MI403';
  end if;

  -- Nunca deixar o sistema sem Administrador ativo (vale para todos).
  if v_admin_antes and not v_admin_depois and not exists (
       select 1 from public.perfis p
        where p.id <> old.id
          and 'ADMIN' = any (p.perfis)
          and coalesce(p.status, 'ACTIVE') = 'ACTIVE')
  then
    raise exception 'Esta alteração deixaria o MonitorIA sem nenhum Administrador ativo.'
      using errcode = 'MI403';
  end if;

  return new;
end;
$$;

revoke execute on function app.tg_perfis_protecao() from public;

-- 4. Vínculo automático com o login -------------------------------------------
-- Quando alguém entra pela primeira vez (ou confirma o e-mail), o perfil com o
-- mesmo e-mail é ligado a esse login. Só liga se: o e-mail está confirmado, o
-- perfil ainda não tem login ligado, e esse login ainda não está ligado a outro
-- perfil. Quem entra sem perfil cadastrado não ganha acesso a nada.
-- O vínculo informa a versão lida (versao_lida = versao), como qualquer outra
-- alteração: assim ele não depende da dispensa do administrador do banco
-- (script 00), que exige auth.uid() nulo. Se o serviço de login do Supabase um
-- dia rodar com usuário identificado, o login continua funcionando.
create or replace function app.tg_vincular_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  update public.perfis p
     set auth_user_id = new.id,
         versao_lida  = p.versao
   where p.email = lower(btrim(new.email))
     and p.auth_user_id is null
     and not exists (select 1 from public.perfis q where q.auth_user_id = new.id);

  return new;
end;
$$;

revoke execute on function app.tg_vincular_login() from public;

-- 5. Gatilhos -------------------------------------------------------------------
create or replace trigger perfis_controle
  before insert or update on public.perfis
  for each row execute function app.tg_controle_registro();

create or replace trigger perfis_protecao
  before update on public.perfis
  for each row execute function app.tg_perfis_protecao();

create or replace trigger perfis_sem_exclusao
  before delete on public.perfis
  for each row execute function app.tg_bloquear_exclusao();

create or replace trigger perfis_sem_truncate
  before truncate on public.perfis
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger perfis_vincular_login
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function app.tg_vincular_login();

-- 6. Acesso: RLS ligada, nenhuma política ainda ---------------------------------
-- No Supabase, tabelas novas em `public` recebem permissões para anon e
-- authenticated por padrão. Aqui elas são retiradas; o script 07 concede só
-- o necessário, junto com as políticas.
alter table public.perfis enable row level security;
revoke all on table public.perfis from anon, authenticated;

-- 7. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('01', 'Identidade: perfis sem senha, vínculo de login por e-mail, funções de perfil, proteção do Administrador')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select versao, descricao from app.versoes_esquema order by versao;
--   select count(*) from public.perfis;   -- 0: a tabela nasce vazia
