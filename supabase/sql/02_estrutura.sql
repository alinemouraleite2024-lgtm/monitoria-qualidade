-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 02 — estrutura da operação
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 01.
--
-- O QUE FAZ:
--   1. `public.areas`: as áreas (hoje só "Relacionamento"), com o supervisor
--      responsável. Origem: pm2_areas.
--   2. `public.area_monitores`: os monitores de cada área, um por linha, na
--      ordem original. Substitui a lista `monitorIds` embutida na área.
--   3. `public.colaboradores`: as pessoas avaliadas. Origem: pm2_collaborators.
--      O id é o mesmo do usuário quando a pessoa também usa o portal (usr-4).
--   4. `public.alocacoes`: as carteiras (monitor ↔ colaboradora, com vigência).
--      Origem: pm2_allocations.
--   5. `public.alocacoes_historico`: o histórico das carteiras. Origem:
--      pm2_alloc_history. Só aceita inclusão: nada aqui é alterado nem apagado.
--   6. Liga a RLS nas cinco tabelas SEM nenhuma política: até o script 07, o
--      portal (anon/authenticated) não lê nem grava nada aqui.
--
-- COMPATIBILIDADE COM O PORTAL (dados que existem hoje e precisam entrar):
--   - Área sem supervisor: o portal grava `gestorId: ''`. Aqui vira `gestor_id`
--     nulo. Nenhuma área é recusada por não ter supervisor.
--   - Carteira com o monitor vazio: o seletor de monitor começa em '' e pode ser
--     gravado assim. Por isso `monitor_id` aceita nulo.
--   - Vigência com fim ANTES do início: ao trocar a carteira, o portal encerra a
--     anterior em "hoje", mesmo que ela começasse no futuro. Por isso não há
--     regra de fim >= início — ela recusaria um dado real.
--   - Remover um monitor da área: como nada é excluído, vira `ativo = false` na
--     linha de area_monitores (remoção lógica). Recolocar = `ativo = true`.
--
-- FIDELIDADE NA MIGRAÇÃO (mesma regra do script 01):
--   - Só viram colunas os campos que o portal usa hoje. Qualquer outro campo
--     (antigo ou desconhecido) vai INTACTO para `extras`.
--   - `ordem` = posição na lista original do navegador.
--   - Coluna nula = campo ausente no original; `extras._nulos` lista os campos
--     que eram `null` explícito.
--   - Quando o valor original não cabe na coluna (texto vazio ou id que não
--     existe numa referência), a coluna fica nula e o valor original vai para
--     `extras._<campo>_original` (ex.: `_gestorId_original: ""`). Para a lista
--     de monitores: `extras._monitorIds_original` na área.
--
-- PODE RODAR MAIS DE UMA VEZ.  PARA DESFAZER (só na homologação, se pedido):
--   drop table public.alocacoes_historico, public.alocacoes,
--              public.colaboradores, public.area_monitores, public.areas;
--   -- exige manutenção autorizada se houver dados (ver script 00)
-- =============================================================================

begin;

-- 1. Gatilho de "só inclusão" (histórico e, no script 06, auditoria) -----------
-- Recusa qualquer UPDATE. Mesma exceção do bloqueio de exclusão (script 00):
-- só o administrador do banco, sem usuário do portal logado, com
-- app.manutencao e app.manutencao_motivo declarados na mesma transação.
create or replace function app.tg_somente_inclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin')
     and auth.uid() is null
     and coalesce(current_setting('app.manutencao', true), '') in ('restauracao', 'manutencao')
     and length(btrim(coalesce(current_setting('app.manutencao_motivo', true), ''))) >= 10
  then
    return new;
  end if;

  raise exception
    'Registros de histórico não podem ser alterados (tabela %). Registre um novo evento.',
    tg_table_name
    using errcode = 'MI403',
          hint    = 'Correção exige manutenção autorizada pelo administrador do banco, com motivo.';
end;
$$;

comment on function app.tg_somente_inclusao() is
  'Gatilho BEFORE UPDATE: tabela só de inclusão (MI403), salvo manutenção autorizada pelo administrador do banco com motivo.';

revoke execute on function app.tg_somente_inclusao() from public;

-- 2. Áreas ----------------------------------------------------------------------
create table if not exists public.areas (
  id              text        primary key,
  nome            text        not null,
  gestor_id       text        references public.perfis (id) on delete restrict,
  ativo           boolean,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint areas_id_preenchido    check (btrim(id) <> ''),
  constraint areas_nome_preenchido  check (btrim(nome) <> ''),
  constraint areas_extras_objeto    check (jsonb_typeof(extras) = 'object'),
  constraint areas_versao_lida      check (versao_lida is null)
);

create index if not exists areas_gestor_idx on public.areas (gestor_id);

comment on table  public.areas           is 'Áreas da operação. Origem: pm2_areas. O supervisor responsável define o escopo do que ele acompanha e valida.';
comment on column public.areas.gestor_id is 'Supervisor responsável (perfil GESTOR). Nulo = área ainda sem supervisor (gestorId vazio no portal).';
comment on column public.areas.ativo     is 'Nulo = campo ausente no original.';
comment on column public.areas.extras    is 'Demais campos da área, intactos.';
comment on column public.areas.ordem     is 'Posição na lista original do navegador, para reconstrução fiel.';
comment on column public.areas.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 3. Monitores de cada área -----------------------------------------------------
create table if not exists public.area_monitores (
  area_id         text        not null references public.areas (id) on delete restrict,
  monitor_id      text        not null references public.perfis (id) on delete restrict,
  ordem           integer     not null,
  ativo           boolean     not null default true,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  primary key (area_id, monitor_id),
  constraint area_monitores_versao_lida check (versao_lida is null)
);

create index if not exists area_monitores_monitor_idx on public.area_monitores (monitor_id);

comment on table  public.area_monitores        is 'Monitores de cada área (antes: monitorIds dentro da área). Nada é excluído: remover da área = ativo false.';
comment on column public.area_monitores.ordem  is 'Posição do monitor na lista monitorIds original.';
comment on column public.area_monitores.ativo  is 'false = removido da área (remoção lógica). A lista do portal é a dos ativos, por ordem.';
comment on column public.area_monitores.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 4. Colaboradores --------------------------------------------------------------
create table if not exists public.colaboradores (
  id              text        primary key,
  nome            text        not null,
  email           text,
  cargo           text,
  area_id         text        references public.areas (id) on delete restrict,
  ativo           boolean,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint colaboradores_id_preenchido    check (btrim(id) <> ''),
  constraint colaboradores_nome_preenchido  check (btrim(nome) <> ''),
  constraint colaboradores_extras_objeto    check (jsonb_typeof(extras) = 'object'),
  constraint colaboradores_sem_senha        check (not (extras ? 'password')),
  constraint colaboradores_versao_lida      check (versao_lida is null)
);

create index if not exists colaboradores_area_idx on public.colaboradores (area_id);

comment on table  public.colaboradores         is 'Pessoas avaliadas. Origem: pm2_collaborators. Id igual ao do usuário quando a pessoa também usa o portal.';
comment on column public.colaboradores.email   is 'Gravado como veio do portal (pode ser vazio). Não é usado para login.';
comment on column public.colaboradores.area_id is 'Área da pessoa. Nulo = ausente, vazio ou área inexistente no original (ver extras._areaId_original).';
comment on column public.colaboradores.ativo   is 'Nulo = campo ausente no original.';
comment on column public.colaboradores.extras  is 'Demais campos, intactos. Nunca contém senha.';
comment on column public.colaboradores.ordem   is 'Posição na lista original do navegador, para reconstrução fiel.';
comment on column public.colaboradores.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 5. Alocações (carteiras) ------------------------------------------------------
create table if not exists public.alocacoes (
  id              text        primary key,
  monitor_id      text        references public.perfis (id) on delete restrict,
  colaborador_id  text        references public.colaboradores (id) on delete restrict,
  data_inicio     date,
  data_fim        date,
  ativo           boolean,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint alocacoes_id_preenchido  check (btrim(id) <> ''),
  constraint alocacoes_extras_objeto  check (jsonb_typeof(extras) = 'object'),
  constraint alocacoes_versao_lida    check (versao_lida is null)
);

create index if not exists alocacoes_monitor_idx     on public.alocacoes (monitor_id);
create index if not exists alocacoes_colaborador_idx on public.alocacoes (colaborador_id);

comment on table  public.alocacoes             is 'Carteiras: monitor responsável por uma colaboradora, com vigência. Origem: pm2_allocations.';
comment on column public.alocacoes.monitor_id  is 'Monitor responsável. Nulo = vazio ou inexistente no original (o seletor do portal começa vazio).';
comment on column public.alocacoes.data_fim    is 'Nulo = vigência em aberto. Pode ser anterior ao início: o portal encerra em "hoje" uma carteira que começaria no futuro.';
comment on column public.alocacoes.ativo       is 'Nulo = campo ausente no original.';
comment on column public.alocacoes.ordem       is 'Posição na lista original do navegador, para reconstrução fiel.';
comment on column public.alocacoes.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 6. Histórico das alocações (só inclusão) --------------------------------------
create table if not exists public.alocacoes_historico (
  id              text        primary key,
  alocacao_id     text        references public.alocacoes (id) on delete restrict,
  acao            text        not null,
  alterado_por    text        references public.perfis (id) on delete restrict,
  alterado_em     timestamptz,
  detalhes        text,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint alocacoes_historico_id_preenchido check (btrim(id) <> ''),
  constraint alocacoes_historico_acao_valida   check (acao in ('INSERT', 'TERMINATE')),
  constraint alocacoes_historico_extras_objeto check (jsonb_typeof(extras) = 'object'),
  constraint alocacoes_historico_versao_lida   check (versao_lida is null)
);

create index if not exists alocacoes_historico_alocacao_idx on public.alocacoes_historico (alocacao_id);
create index if not exists alocacoes_historico_autor_idx    on public.alocacoes_historico (alterado_por);

comment on table  public.alocacoes_historico              is 'Histórico das carteiras. Origem: pm2_alloc_history. Só inclusão: nada é alterado nem apagado.';
comment on column public.alocacoes_historico.acao         is 'INSERT (vínculo criado) ou TERMINATE (vigência encerrada).';
comment on column public.alocacoes_historico.alterado_por is 'Quem o portal registrou como autor (changedBy). O login real fica em criado_por.';
comment on column public.alocacoes_historico.alterado_em  is 'changedAt do portal.';
comment on column public.alocacoes_historico.ordem        is 'Posição na lista original do navegador, para reconstrução fiel.';
comment on column public.alocacoes_historico.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 7. Gatilhos -------------------------------------------------------------------
-- Em todas: versão/autoria (script 00) e bloqueio de exclusão e TRUNCATE.
create or replace trigger areas_controle
  before insert or update on public.areas
  for each row execute function app.tg_controle_registro();
create or replace trigger areas_sem_exclusao
  before delete on public.areas
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger areas_sem_truncate
  before truncate on public.areas
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger area_monitores_controle
  before insert or update on public.area_monitores
  for each row execute function app.tg_controle_registro();
create or replace trigger area_monitores_sem_exclusao
  before delete on public.area_monitores
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger area_monitores_sem_truncate
  before truncate on public.area_monitores
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger colaboradores_controle
  before insert or update on public.colaboradores
  for each row execute function app.tg_controle_registro();
create or replace trigger colaboradores_sem_exclusao
  before delete on public.colaboradores
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger colaboradores_sem_truncate
  before truncate on public.colaboradores
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger alocacoes_controle
  before insert or update on public.alocacoes
  for each row execute function app.tg_controle_registro();
create or replace trigger alocacoes_sem_exclusao
  before delete on public.alocacoes
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger alocacoes_sem_truncate
  before truncate on public.alocacoes
  for each statement execute function app.tg_bloquear_exclusao();

-- No histórico, o bloqueio de alteração tem nome que o faz rodar ANTES do
-- controle de versão (os gatilhos BEFORE rodam em ordem alfabética): quem
-- tenta alterar recebe "só inclusão" (MI403), e não um aviso de versão.
create or replace trigger alocacoes_historico_bloqueio_alteracao
  before update on public.alocacoes_historico
  for each row execute function app.tg_somente_inclusao();
create or replace trigger alocacoes_historico_controle
  before insert or update on public.alocacoes_historico
  for each row execute function app.tg_controle_registro();
create or replace trigger alocacoes_historico_sem_exclusao
  before delete on public.alocacoes_historico
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger alocacoes_historico_sem_truncate
  before truncate on public.alocacoes_historico
  for each statement execute function app.tg_bloquear_exclusao();

-- 8. Acesso: RLS ligada, nenhuma política ainda ---------------------------------
-- Como no script 01: retira as permissões automáticas de anon e authenticated.
-- O script 07 concede só o necessário, junto com as políticas.
alter table public.areas               enable row level security;
alter table public.area_monitores      enable row level security;
alter table public.colaboradores       enable row level security;
alter table public.alocacoes           enable row level security;
alter table public.alocacoes_historico enable row level security;

revoke all on table public.areas               from anon, authenticated;
revoke all on table public.area_monitores      from anon, authenticated;
revoke all on table public.colaboradores       from anon, authenticated;
revoke all on table public.alocacoes           from anon, authenticated;
revoke all on table public.alocacoes_historico from anon, authenticated;

-- 9. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('02', 'Estrutura: áreas e seus monitores, colaboradores, alocações (carteiras) e histórico só de inclusão')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select versao, descricao from app.versoes_esquema order by versao;
