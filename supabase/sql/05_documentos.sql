-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 05 — documentos, catálogos,
-- configurações e histórico de acessos
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 04.
--
-- O QUE FAZ:
--   1. `public.documentos`: as coleções secundárias, cada item gravado INTEIRO,
--      exatamente como veio. Podem ser normalizadas depois, sem pressa.
--        agenda            ← pm2_agenda
--        feriados          ← pm2_holidays       (férias e substituições)
--        demandas          ← pm2_demands
--        comunicados       ← pm2_announcements
--        metas_monitor     ← pm2_mgoals         (não é mais lida pelo portal; preservada)
--        metas_colaborador ← pm2_cgoals         (metas e "sem meta neste mês")
--        planos_metas      ← pm2_planos_metas   (planos recorrentes, com vigência)
--   2. `public.catalogos`: as listas de textos do portal, na ordem original.
--        empreendimentos   ← pm2_catalog_empreendimentos (dormente desde 0.14.0)
--        categorias        ← pm2_catalog_categorias
--   3. `public.configuracoes`: parâmetros do sistema, um por chave.
--        settings ← pm2_settings · brand ← pm2_brand
--   4. `public.acessos_log`: o histórico de acessos (pm2_auth_logs). Só aceita
--      inclusão: nada é alterado nem apagado.
--   5. Liga a RLS nas quatro tabelas SEM nenhuma política: até o script 07, o
--      portal (anon/authenticated) não lê nem grava nada aqui.
--
-- COMPATIBILIDADE COM O PORTAL (dados que existem hoje e precisam entrar):
--   - O portal APAGA metas por colaboradora e substitui planos (filter). Aqui
--     nada é excluído: retirar = `ativo = false` (remoção lógica). O item
--     continua no banco, com quem retirou e quando (versão e autoria).
--   - O id do histórico de acessos é Date.now(): dois eventos no mesmo
--     milissegundo têm o mesmo id. A chave é uma sequência própria do banco; o
--     id original é preservado.
--   - Registros de acesso anteriores à 0.21.0 têm `ip` (simulado, inventado
--     pelo portal). É preservado em `extras`, como veio, sem valor de rastreio.
--   - Catálogos são listas de textos, sem id: a chave é a posição na lista.
--   - Item de documento sem id (ou com id repetido) recebe a chave `#<posição>`;
--     o conteúdo original não é alterado.
--   - Agenda, feriados, demandas, comunicados e metas por monitor não são
--     gravados pelo portal atual; entram íntegros para não perder nada.
--
-- AUTORIA NO HISTÓRICO DE ACESSOS: numa inclusão feita pelo portal, o banco
-- carimba o perfil de quem está logado (`perfil_id`) e o momento (`momento`).
-- E-mail, nome e perfil enviados ficam como vieram, só para exibição.
--
-- FIDELIDADE NA MIGRAÇÃO: em documentos e catálogos o item é o próprio
-- conteúdo; `ordem` = posição na lista original. No histórico, a mesma regra
-- dos scripts anteriores (colunas + `extras`, `_nulos`, `_<campo>_original`).
-- As marcas de versão do navegador (pm2_*_version, cópia do crit-24) vão para
-- `migracao_origem` no script 09, junto com o texto original de cada chave.
--
-- PODE RODAR MAIS DE UMA VEZ.  PARA DESFAZER (só na homologação, se pedido):
--   drop table public.acessos_log, public.configuracoes, public.catalogos, public.documentos;
--   drop function app.tg_acessos_log_autoria();
--   -- exige manutenção autorizada se houver dados (ver script 00)
-- =============================================================================

begin;

-- 1. Documentos (coleções secundárias) ------------------------------------------
create table if not exists public.documentos (
  colecao         text        not null,
  id              text        not null,
  conteudo        jsonb       not null,
  ordem           integer     not null,
  ativo           boolean     not null default true,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  primary key (colecao, id),
  constraint documentos_colecao_valida check (colecao in
    ('agenda', 'feriados', 'demandas', 'comunicados', 'metas_monitor', 'metas_colaborador', 'planos_metas')),
  constraint documentos_id_preenchido  check (btrim(id) <> ''),
  constraint documentos_conteudo_objeto check (jsonb_typeof(conteudo) = 'object'),
  -- Se o item tem id, a chave é esse id: o conteúdo e a chave nunca divergem.
  -- Única exceção: a chave de posição (#3), dada na migração ao item cujo id
  -- repetia o de outro item da mesma coleção.
  constraint documentos_id_coerente    check (not (conteudo ? 'id') or conteudo->>'id' = id or id ~ '^#[0-9]+$'),
  constraint documentos_versao_lida    check (versao_lida is null)
);

create index if not exists documentos_colecao_ordem_idx on public.documentos (colecao, ordem);

comment on table  public.documentos          is 'Coleções secundárias do portal, um item por linha, gravado inteiro. Nada é excluído: retirar = ativo false.';
comment on column public.documentos.colecao  is 'agenda, feriados, demandas, comunicados, metas_monitor, metas_colaborador ou planos_metas.';
comment on column public.documentos.id       is 'id do item. Item sem id (ou com id repetido) na origem: #<posição>. O conteúdo guarda o id original.';
comment on column public.documentos.conteudo is 'O item exatamente como o portal grava.';
comment on column public.documentos.ordem    is 'Posição na lista original. A lista do portal é a dos ativos, por ordem.';
comment on column public.documentos.ativo    is 'false = retirado (o portal apagava: metas por colaboradora, planos substituídos).';
comment on column public.documentos.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 2. Catálogos (listas de textos) -------------------------------------------------
create table if not exists public.catalogos (
  catalogo        text        not null,
  ordem           integer     not null,
  valor           text        not null,
  ativo           boolean     not null default true,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  primary key (catalogo, ordem),
  constraint catalogos_catalogo_valido check (catalogo in ('empreendimentos', 'categorias')),
  constraint catalogos_versao_lida     check (versao_lida is null)
);

comment on table  public.catalogos       is 'Catálogos do portal (listas de textos). Chave = posição: o item não tem id. Retirar = ativo false.';
comment on column public.catalogos.valor is 'O texto exatamente como gravado (ex.: BOLETOS).';
comment on column public.catalogos.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 3. Configurações ----------------------------------------------------------------
create table if not exists public.configuracoes (
  chave           text        primary key,
  valor           jsonb       not null,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint configuracoes_chave_valida check (chave ~ '^[a-z][a-z0-9_]*$'),
  constraint configuracoes_versao_lida  check (versao_lida is null)
);

comment on table  public.configuracoes       is 'Parâmetros do sistema, um por chave: settings (pm2_settings), brand (pm2_brand). Só o Administrador altera (script 07).';
comment on column public.configuracoes.valor is 'O valor exatamente como o portal grava.';
comment on column public.configuracoes.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 4. Histórico de acessos (só inclusão) -------------------------------------------
create table if not exists public.acessos_log (
  seq             bigint      generated always as identity primary key,
  id              text,
  tipo_evento     text,
  usuario_email   text,
  usuario_nome    text,
  usuario_perfil  text,
  detalhes        text,
  momento         timestamptz,
  perfil_id       text        references public.perfis (id) on delete restrict,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint acessos_log_extras_objeto check (jsonb_typeof(extras) = 'object'),
  constraint acessos_log_versao_lida   check (versao_lida is null)
);

create index if not exists acessos_log_momento_idx on public.acessos_log (momento);
create index if not exists acessos_log_perfil_idx  on public.acessos_log (perfil_id);

comment on table  public.acessos_log                is 'Histórico de acessos (pm2_auth_logs). Só inclusão: nada é alterado nem apagado.';
comment on column public.acessos_log.seq            is 'Chave do banco. O id do portal (Date.now) pode repetir.';
comment on column public.acessos_log.id             is 'id do portal, preservado.';
comment on column public.acessos_log.tipo_evento    is 'eventType: LOGIN, LOGOUT, SWITCH_PROFILE, LOGIN_DENIED...';
comment on column public.acessos_log.usuario_perfil is 'userRole: perfil ativo no momento do evento (como o portal enviou).';
comment on column public.acessos_log.momento        is 'timestamp do portal. Em inclusão pelo portal, carimbado pelo banco.';
comment on column public.acessos_log.perfil_id      is 'Perfil de quem estava logado, carimbado pelo banco. Nulo em registros migrados.';
comment on column public.acessos_log.extras         is 'Demais campos, intactos (inclui o ip simulado de registros antigos).';
comment on column public.acessos_log.ordem          is 'Posição na lista original do navegador (o mais recente primeiro).';
comment on column public.acessos_log.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 5. Autoria do histórico de acessos -----------------------------------------------
-- Não é security definer e não chama função interna fechada ao portal: roda com
-- as permissões de quem grava, e app.meu_perfil_id() é liberada ao portal (01).
create or replace function app.tg_acessos_log_autoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.perfil_id := app.meu_perfil_id();
    new.momento   := now();
  end if;
  return new;
end;
$$;

comment on function app.tg_acessos_log_autoria() is
  'Gatilho BEFORE INSERT em acessos_log: pelo portal, carimba o perfil logado e o momento.';

revoke execute on function app.tg_acessos_log_autoria() from public;

-- 6. Gatilhos -------------------------------------------------------------------
create or replace trigger documentos_controle
  before insert or update on public.documentos
  for each row execute function app.tg_controle_registro();
create or replace trigger documentos_sem_exclusao
  before delete on public.documentos
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger documentos_sem_truncate
  before truncate on public.documentos
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger catalogos_controle
  before insert or update on public.catalogos
  for each row execute function app.tg_controle_registro();
create or replace trigger catalogos_sem_exclusao
  before delete on public.catalogos
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger catalogos_sem_truncate
  before truncate on public.catalogos
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger configuracoes_controle
  before insert or update on public.configuracoes
  for each row execute function app.tg_controle_registro();
create or replace trigger configuracoes_sem_exclusao
  before delete on public.configuracoes
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger configuracoes_sem_truncate
  before truncate on public.configuracoes
  for each statement execute function app.tg_bloquear_exclusao();

-- No histórico, a autoria e o bloqueio de alteração rodam ANTES do controle de
-- versão (gatilhos BEFORE rodam em ordem alfabética).
create or replace trigger acessos_log_a_autoria
  before insert on public.acessos_log
  for each row execute function app.tg_acessos_log_autoria();
create or replace trigger acessos_log_bloqueio_alteracao
  before update on public.acessos_log
  for each row execute function app.tg_somente_inclusao();
create or replace trigger acessos_log_controle
  before insert or update on public.acessos_log
  for each row execute function app.tg_controle_registro();
create or replace trigger acessos_log_sem_exclusao
  before delete on public.acessos_log
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger acessos_log_sem_truncate
  before truncate on public.acessos_log
  for each statement execute function app.tg_bloquear_exclusao();

-- 7. Acesso: RLS ligada, nenhuma política ainda ---------------------------------
-- Como nos scripts anteriores: retira as permissões automáticas de anon e
-- authenticated. O script 07 concede só o necessário, junto com as políticas.
alter table public.documentos    enable row level security;
alter table public.catalogos     enable row level security;
alter table public.configuracoes enable row level security;
alter table public.acessos_log   enable row level security;

revoke all on table public.documentos    from anon, authenticated;
revoke all on table public.catalogos     from anon, authenticated;
revoke all on table public.configuracoes from anon, authenticated;
revoke all on table public.acessos_log   from anon, authenticated;

-- 8. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('05', 'Documentos (agenda, feriados, demandas, comunicados, metas, planos), catálogos, configurações e histórico de acessos (só inclusão)')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select versao, descricao from app.versoes_esquema order by versao;
