-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 03 — régua de avaliação
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 02.
--
-- O QUE FAZ:
--   1. `public.criterios`: a régua vigente — os critérios que o formulário de
--      monitoria mostra. Origem: pm2_criteria. Os ids atuais (`crit-06`) são
--      mantidos: o contrato JSON do ChatGPT e as respostas das monitorias
--      referenciam esses ids.
--   2. `public.criterio_subperguntas`: as sub-perguntas dos checklists, com a
--      régua de SIM e NÃO, na ordem original. Substitui a lista `subPerguntas`
--      embutida no critério.
--   3. `public.regua_versoes`: o retrato COMPLETO da régua no momento em que uma
--      versão foi publicada (Régua 1, Régua 2.0...). Só aceita inclusão: uma
--      versão publicada nunca muda. É o que permite dizer, para sempre, com qual
--      régua cada monitoria foi avaliada (o vínculo fica no script 04).
--   4. Liga a RLS nas três tabelas SEM nenhuma política: até o script 07, o
--      portal (anon/authenticated) não lê nem grava nada aqui.
--
-- COMPATIBILIDADE COM O PORTAL (dados que existem hoje e precisam entrar):
--   - Peso fora do padrão: na produção, o crit-06 está com peso 100 (o oficial é
--     2,0; a correção pelo Admin já foi decidida). O banco NÃO limita o peso:
--     uma regra aqui recusaria o dado real. A nota gravada de cada monitoria
--     nunca é recalculada pelo banco.
--   - Peso ou número vazios: o Admin converte o texto do formulário com
--     parseFloat/parseInt; campo vazio vira nulo. Por isso `peso` e `numero`
--     aceitam nulo.
--   - Número repetido: o Admin não impede dois critérios com o mesmo número.
--     Por isso não há regra de número único.
--   - Sub-pergunta retirada (ex.: a sub-24-3, em 0.24.1): como nada é excluído,
--     vira `ativo = false`. Respostas antigas que a citam continuam válidas.
--   - Critério desativado: continua existindo com `ativo = false` (ex.: crit-03).
--
-- FIDELIDADE NA MIGRAÇÃO (mesma regra dos scripts 01 e 02):
--   - Campos do critério usados pelo portal viram colunas; qualquer outro campo
--     vai INTACTO para `extras`. `ordem` = posição na lista original.
--   - Coluna nula = campo ausente; `extras._nulos` = campos `null` explícitos.
--   - Valor original que não cabe na coluna (tipo de resposta desconhecido,
--     âncoras que não são objeto): coluna nula e original em
--     `extras._<campo>_original`.
--
-- PODE RODAR MAIS DE UMA VEZ.  PARA DESFAZER (só na homologação, se pedido):
--   drop table public.regua_versoes, public.criterio_subperguntas, public.criterios;
--   -- exige manutenção autorizada se houver dados (ver script 00)
-- =============================================================================

begin;

-- 1. Critérios (régua vigente) --------------------------------------------------
create table if not exists public.criterios (
  id              text        primary key,
  numero          integer,
  bloco           text,
  nome            text        not null,
  descricao       text,
  orientacao      text,
  tipo_resposta   text,
  eliminatorio    boolean,
  peso            numeric,
  ativo           boolean,
  canais          text[],
  opcoes          text[],
  ancoras         jsonb,
  quando_na       text,
  extras          jsonb       not null default '{}'::jsonb,
  ordem           integer,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint criterios_id_preenchido    check (btrim(id) <> ''),
  constraint criterios_nome_preenchido  check (btrim(nome) <> ''),
  constraint criterios_tipo_valido      check (tipo_resposta is null or tipo_resposta in
                                          ('ESCALA_4', 'CHECKLIST_SIM_NAO', 'FAIXA_TEMPO', 'MULTIPLA_ESCOLHA', 'SIM_NAO')),
  constraint criterios_ancoras_objeto   check (ancoras is null or jsonb_typeof(ancoras) = 'object'),
  constraint criterios_extras_objeto    check (jsonb_typeof(extras) = 'object'),
  constraint criterios_versao_lida      check (versao_lida is null)
);

comment on table  public.criterios               is 'Régua vigente: os critérios do formulário de monitoria. Origem: pm2_criteria. Nada é excluído: critério fora de uso = ativo false.';
comment on column public.criterios.id            is 'Id atual do portal (ex.: crit-06). Nunca muda: o contrato JSON e as respostas o referenciam.';
comment on column public.criterios.bloco         is 'category do portal (ex.: ABERTURA, FORMAS DO CONTATO).';
comment on column public.criterios.tipo_resposta is 'ESCALA_4, CHECKLIST_SIM_NAO, FAIXA_TEMPO, MULTIPLA_ESCOLHA ou SIM_NAO. Nulo = ausente ou desconhecido (ver extras._tipoResposta_original).';
comment on column public.criterios.peso          is 'weight do portal. 0 = classificação (fora da nota). Sem limite: o banco não decide a régua nem recalcula notas.';
comment on column public.criterios.canais        is 'channels do portal: canais em que o critério aparece.';
comment on column public.criterios.opcoes        is 'Opções de um critério MULTIPLA_ESCOLHA.';
comment on column public.criterios.ancoras       is 'O que cada resposta significa, indexado pela resposta como é gravada (2, 1, 0, 1.33, texto da opção).';
comment on column public.criterios.quando_na     is 'quandoNA do portal: quando marcar N/A.';
comment on column public.criterios.extras        is 'Demais campos do critério, intactos.';
comment on column public.criterios.ordem         is 'Posição na lista original do navegador, para reconstrução fiel.';
comment on column public.criterios.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 2. Sub-perguntas dos checklists ------------------------------------------------
-- Chave composta (critério, sub-pergunta): o portal só garante o id único
-- dentro do próprio critério, e é assim que as respostas o referenciam.
create table if not exists public.criterio_subperguntas (
  criterio_id     text        not null references public.criterios (id) on delete restrict,
  id              text        not null,
  texto           text,
  criterio_sim    text,
  criterio_nao    text,
  ordem           integer     not null,
  ativo           boolean     not null default true,
  extras          jsonb       not null default '{}'::jsonb,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  primary key (criterio_id, id),
  constraint criterio_subperguntas_id_preenchido check (btrim(id) <> ''),
  constraint criterio_subperguntas_extras_objeto check (jsonb_typeof(extras) = 'object'),
  constraint criterio_subperguntas_versao_lida   check (versao_lida is null)
);

comment on table  public.criterio_subperguntas              is 'Sub-perguntas dos checklists (antes: subPerguntas dentro do critério). Nada é excluído: retirar = ativo false.';
comment on column public.criterio_subperguntas.criterio_sim is 'criterioSim do portal: quando responder SIM.';
comment on column public.criterio_subperguntas.criterio_nao is 'criterioNao do portal: quando responder NÃO.';
comment on column public.criterio_subperguntas.ordem        is 'Posição na lista subPerguntas original.';
comment on column public.criterio_subperguntas.ativo        is 'false = retirada da régua (ex.: sub-24-3). O formulário mostra só as ativas, por ordem.';
comment on column public.criterio_subperguntas.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 3. Versões publicadas da régua (só inclusão) -----------------------------------
create table if not exists public.regua_versoes (
  id              text        primary key,
  rotulo          text        not null,
  vigente_desde   date        not null,
  descricao       text,
  retrato         jsonb       not null,
  extras          jsonb       not null default '{}'::jsonb,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  constraint regua_versoes_id_preenchido     check (btrim(id) <> ''),
  constraint regua_versoes_rotulo_preenchido check (btrim(rotulo) <> ''),
  constraint regua_versoes_retrato_lista     check (jsonb_typeof(retrato) = 'array' and jsonb_array_length(retrato) > 0),
  constraint regua_versoes_extras_objeto     check (jsonb_typeof(extras) = 'object'),
  constraint regua_versoes_versao_lida       check (versao_lida is null)
);

create unique index if not exists regua_versoes_rotulo_unico on public.regua_versoes (rotulo);

comment on table  public.regua_versoes               is 'Versões publicadas da régua. Só inclusão: uma versão publicada nunca muda.';
comment on column public.regua_versoes.rotulo        is 'Nome da versão (ex.: Régua 1, Régua 2.0). Único.';
comment on column public.regua_versoes.vigente_desde is 'Data a partir da qual a versão vale para as avaliações registradas.';
comment on column public.regua_versoes.retrato       is 'Lista completa dos critérios (com sub-perguntas, pesos e âncoras) exatamente como estavam na publicação.';
comment on column public.regua_versoes.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 4. Gatilhos -------------------------------------------------------------------
-- Em todas: versão/autoria (script 00) e bloqueio de exclusão e TRUNCATE.
create or replace trigger criterios_controle
  before insert or update on public.criterios
  for each row execute function app.tg_controle_registro();
create or replace trigger criterios_sem_exclusao
  before delete on public.criterios
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger criterios_sem_truncate
  before truncate on public.criterios
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger criterio_subperguntas_controle
  before insert or update on public.criterio_subperguntas
  for each row execute function app.tg_controle_registro();
create or replace trigger criterio_subperguntas_sem_exclusao
  before delete on public.criterio_subperguntas
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger criterio_subperguntas_sem_truncate
  before truncate on public.criterio_subperguntas
  for each statement execute function app.tg_bloquear_exclusao();

-- Versão publicada é imutável. O bloqueio de alteração tem nome que o faz rodar
-- ANTES do controle de versão (gatilhos BEFORE rodam em ordem alfabética).
create or replace trigger regua_versoes_bloqueio_alteracao
  before update on public.regua_versoes
  for each row execute function app.tg_somente_inclusao();
create or replace trigger regua_versoes_controle
  before insert or update on public.regua_versoes
  for each row execute function app.tg_controle_registro();
create or replace trigger regua_versoes_sem_exclusao
  before delete on public.regua_versoes
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger regua_versoes_sem_truncate
  before truncate on public.regua_versoes
  for each statement execute function app.tg_bloquear_exclusao();

-- 5. Acesso: RLS ligada, nenhuma política ainda ---------------------------------
-- Como nos scripts 01 e 02: retira as permissões automáticas de anon e
-- authenticated. O script 07 concede só o necessário (a régua só o
-- Administrador altera), junto com as políticas.
alter table public.criterios             enable row level security;
alter table public.criterio_subperguntas enable row level security;
alter table public.regua_versoes         enable row level security;

revoke all on table public.criterios             from anon, authenticated;
revoke all on table public.criterio_subperguntas from anon, authenticated;
revoke all on table public.regua_versoes         from anon, authenticated;

-- 6. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('03', 'Régua: critérios vigentes, sub-perguntas dos checklists e versões publicadas (só inclusão)')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select versao, descricao from app.versoes_esquema order by versao;
