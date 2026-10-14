-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 04 — monitorias
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 03.
--
-- O QUE FAZ:
--   1. `public.monitorias`: todos os campos atuais da monitoria — identificadores,
--      competência, datas, canal, tipo, situação, NOTA GRAVADA, os seis blocos do
--      relatório, eliminatório, validação, devolução e lançamento retroativo —
--      mais o vínculo com a versão da régua. Origem: pm2_monitorings.
--   2. `public.monitoria_respostas`: uma linha por critério, com a resposta
--      gravada EXATAMENTE como veio (2, 0, 1.33, "N/A", "" ou "Reclamação"),
--      a justificativa e as sub-respostas do checklist.
--   3. `public.monitoria_evidencias`: os itens das listas `evidencias` (hoje só
--      os metadados do arquivo) e `links`, cada um gravado como veio.
--   4. Proteção da identidade e da autoria (gatilho app.tg_monitorias_protecao).
--   5. Liga a RLS nas três tabelas SEM nenhuma política: até o script 07, o
--      portal (anon/authenticated) não lê nem grava nada aqui.
--
-- QUEM AVALIOU × QUEM REGISTROU
--   - `monitor_id`: quem fez a avaliação (monitorId do portal).
--   - `registrado_por`: quem cadastrou a monitoria. Numa inclusão feita pelo
--     portal, o BANCO carimba o perfil de quem está logado — o valor enviado é
--     ignorado — e ele nunca mais muda. Isso vale para toda monitoria, não só a
--     retroativa: o portal troca o monitorId pelo monitor da carteira vigente,
--     então quem registrou pode não ser quem aparece como monitor.
--   - `retroativo`, `retroativo_por`, `retroativo_em`: o selo do lançamento
--     retroativo (lancamentoRetroativo { por, em }). Quando o portal marca a
--     monitoria como retroativa, o banco carimba quem e quando; depois disso o
--     selo não muda nem pode ser retirado.
--
-- NOTA HISTÓRICA: `nota` é o finalScore gravado. O banco NUNCA recalcula nota.
--
-- O QUE NUNCA MUDA (MI403), salvo manutenção autorizada (ver script 00):
--   id; protocolo, depois de preenchido; registrado_por; o selo retroativo.
--
-- COMPATIBILIDADE COM O PORTAL (dados que existem hoje e precisam entrar):
--   - Datas em formatos diferentes: `date` ("2026-08-25T12:00:00Z"), início e
--     fim do atendimento ("2026-08-25T14:20", sem fuso). São gravadas como
--     texto, exatamente como vieram. Os carimbos de validação (approvedAt etc.,
--     gerados por toISOString) viram data e hora com fuso.
--   - Protocolo: os anteriores à 0.15.0 foram digitados à mão e podem repetir.
--     A unicidade vale para o protocolo gerado (MON-AAAA-NNNN), que é o que o
--     portal produz desde então.
--   - Evidências: o id é sorteado entre 0 e 999 e pode repetir na mesma
--     monitoria. Por isso a chave é a posição na lista, não o id.
--   - Resposta ausente, nula, vazia ("") e zero são coisas diferentes e
--     continuam diferentes. Um 0 num eliminatório nunca vira vazio.
--   - Critério citado numa resposta: sem referência obrigatória à tabela de
--     critérios — monitoria antiga pode citar critério de régua anterior, e a
--     resposta histórica não pode ser recusada por isso.
--   - Campos antigos (empreendimento, tempo) e desconhecidos são preservados.
--
-- FIDELIDADE NA MIGRAÇÃO (mesma regra dos scripts 01 a 03):
--   - Campos usados pelo portal viram colunas; o resto vai INTACTO para
--     `extras`. `ordem` = posição na lista original (o portal grava a mais
--     recente primeiro).
--   - Coluna nula = campo ausente; `extras._nulos` = campos `null` explícitos.
--   - Valor que não cabe na coluna: coluna nula e original em
--     `extras._<campo>_original`.
--   - Lista vazia que vira tabela filha (scores, evidencias, links): o nome do
--     campo entra em `extras._listas_vazias`.
--
-- PODE RODAR MAIS DE UMA VEZ.  PARA DESFAZER (só na homologação, se pedido):
--   drop table public.monitoria_evidencias, public.monitoria_respostas, public.monitorias;
--   drop function app.tg_monitorias_protecao();
--   -- exige manutenção autorizada se houver dados (ver script 00)
-- =============================================================================

begin;

-- 1. Monitorias -----------------------------------------------------------------
create table if not exists public.monitorias (
  id                          text        primary key,
  protocolo                   text,
  competencia                 text,
  data                        text,
  monitor_id                  text        references public.perfis (id) on delete restrict,
  colaborador_id              text        references public.colaboradores (id) on delete restrict,
  gestor_id                   text        references public.perfis (id) on delete restrict,
  canal                       text,
  tipo                        text,
  status                      text,
  nota                        numeric,
  regua_versao_id             text        references public.regua_versoes (id) on delete restrict,

  -- identificação do atendimento e campos legados
  numero_atendimento          text,
  numero_titulo               text,
  categoria_atendimento       text,
  empreendimento              text,
  tempo                       text,
  inicio_atendimento          text,
  fim_atendimento             text,
  duracao_minutos             numeric,

  -- relatório (os seis blocos) e comentários
  comentarios                 text,
  pontos_fortes               text,
  oportunidades               text,
  contexto                    text,
  leitura_tecnica             text,
  erros_identificados         text,
  conclusao                   text,
  evidencia_observacoes       text,

  -- eliminatório, validação e devolução
  eliminatorio_pendente       boolean,
  zerada                      boolean,
  eliminatorio_confirmado_por text        references public.perfis (id) on delete restrict,
  eliminatorio_confirmado_em  timestamptz,
  aprovado_por                text        references public.perfis (id) on delete restrict,
  aprovado_em                 timestamptz,
  revisado_por                text        references public.perfis (id) on delete restrict,
  revisado_em                 timestamptz,
  motivo_ajuste               text,

  -- autoria e lançamento retroativo
  registrado_por              text        references public.perfis (id) on delete restrict,
  retroativo                  boolean     not null default false,
  retroativo_por              text        references public.perfis (id) on delete restrict,
  retroativo_em               timestamptz,

  extras                      jsonb       not null default '{}'::jsonb,
  ordem                       integer,
  versao                      integer     not null default 1,
  versao_lida                 integer,
  criado_em                   timestamptz,
  criado_por                  uuid,
  atualizado_em               timestamptz,
  atualizado_por              uuid,

  constraint monitorias_id_preenchido   check (btrim(id) <> ''),
  constraint monitorias_competencia     check (competencia is null or competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint monitorias_status_valido   check (status is null or status in
                                          ('Rascunho', 'Pendente', 'Concluída', 'Validada', 'Reprovada', 'Cancelada',
                                           'Aprovada', 'Aguardando Aprovação')),
  constraint monitorias_retroativo      check (retroativo or (retroativo_por is null and retroativo_em is null)),
  constraint monitorias_extras_objeto   check (jsonb_typeof(extras) = 'object'),
  constraint monitorias_versao_lida     check (versao_lida is null)
);

-- Protocolo gerado (MON-AAAA-NNNN) é único. Os digitados antes da 0.15.0 ficam
-- de fora da regra: têm formato livre e podem repetir.
create unique index if not exists monitorias_protocolo_unico
  on public.monitorias (protocolo) where protocolo ~ '^MON-[0-9]{4}-[0-9]+$';

create index if not exists monitorias_competencia_idx    on public.monitorias (competencia);
create index if not exists monitorias_status_idx         on public.monitorias (status);
create index if not exists monitorias_monitor_idx        on public.monitorias (monitor_id);
create index if not exists monitorias_colaborador_idx    on public.monitorias (colaborador_id);
create index if not exists monitorias_gestor_idx         on public.monitorias (gestor_id);
create index if not exists monitorias_regua_idx          on public.monitorias (regua_versao_id);
create index if not exists monitorias_registrado_idx     on public.monitorias (registrado_por);
create index if not exists monitorias_retroativo_por_idx on public.monitorias (retroativo_por);
create index if not exists monitorias_aprovado_idx       on public.monitorias (aprovado_por);
create index if not exists monitorias_revisado_idx       on public.monitorias (revisado_por);
create index if not exists monitorias_elim_conf_idx      on public.monitorias (eliminatorio_confirmado_por);

comment on table  public.monitorias                 is 'Monitorias. Origem: pm2_monitorings. A nota gravada nunca é recalculada pelo banco. Nada é excluído: cancelar = status Cancelada.';
comment on column public.monitorias.id              is 'Código interno do portal (MON-10001). Nunca muda: é usado nas rotas e nas demandas.';
comment on column public.monitorias.protocolo       is 'Identidade da monitoria (MON-2026-0001). Gerado uma vez e nunca reescrito.';
comment on column public.monitorias.competencia     is 'Mês a que o trabalho pertence (AAAA-MM): eixo de metas, fila e relatórios.';
comment on column public.monitorias.data            is 'date do portal: data do atendimento avaliado, como texto, exatamente como foi gravada.';
comment on column public.monitorias.monitor_id      is 'Quem fez a avaliação.';
comment on column public.monitorias.nota            is 'finalScore gravado (0 a 100). Histórico: o banco nunca recalcula.';
comment on column public.monitorias.regua_versao_id is 'Versão da régua com que a monitoria foi avaliada. Nulo = ainda não vinculada.';
comment on column public.monitorias.tempo           is 'Legado (até 0.13.0): duração digitada à mão.';
comment on column public.monitorias.empreendimento  is 'Legado (até 0.14.0).';
comment on column public.monitorias.inicio_atendimento is 'Data e hora locais, sem fuso, como o portal grava ("2026-08-25T14:20").';
comment on column public.monitorias.registrado_por  is 'Quem cadastrou a monitoria. Carimbado pelo banco a partir do login; nunca muda.';
comment on column public.monitorias.retroativo      is 'Lançamento retroativo (nasce Validada sem passar pela fila). Uma vez marcado, não é retirado.';
comment on column public.monitorias.retroativo_por  is 'lancamentoRetroativo.por — carimbado pelo banco a partir do login.';
comment on column public.monitorias.retroativo_em   is 'lancamentoRetroativo.em.';
comment on column public.monitorias.extras          is 'Demais campos da monitoria, intactos.';
comment on column public.monitorias.ordem           is 'Posição na lista original do navegador (a mais recente primeiro).';
comment on column public.monitorias.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 2. Respostas por critério -----------------------------------------------------
create table if not exists public.monitoria_respostas (
  monitoria_id    text        not null references public.monitorias (id) on delete restrict,
  criterio_id     text        not null,
  resposta        jsonb,
  justificativa   text,
  sub_respostas   jsonb,
  ordem           integer     not null,
  extras          jsonb       not null default '{}'::jsonb,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  primary key (monitoria_id, criterio_id),
  constraint monitoria_respostas_criterio_preenchido check (btrim(criterio_id) <> ''),
  constraint monitoria_respostas_resposta_tipo       check (resposta is null or jsonb_typeof(resposta) in ('number', 'string')),
  constraint monitoria_respostas_sub_objeto          check (sub_respostas is null or jsonb_typeof(sub_respostas) = 'object'),
  constraint monitoria_respostas_extras_objeto       check (jsonb_typeof(extras) = 'object'),
  constraint monitoria_respostas_versao_lida         check (versao_lida is null)
);

create index if not exists monitoria_respostas_criterio_idx on public.monitoria_respostas (criterio_id);

comment on table  public.monitoria_respostas               is 'Uma linha por critério respondido (scores do portal), na ordem original.';
comment on column public.monitoria_respostas.criterio_id   is 'criterionId. Sem referência obrigatória: a resposta histórica pode citar critério de régua anterior.';
comment on column public.monitoria_respostas.resposta      is 'score EXATAMENTE como veio: número (0, 2, 1.33), "N/A", "" (não respondido) ou o texto da opção. Nulo = ausente.';
comment on column public.monitoria_respostas.justificativa is 'lowScoreReason.';
comment on column public.monitoria_respostas.sub_respostas is 'subRespostas do checklist: { "sub-04-1": "SIM" | "NAO" }.';
comment on column public.monitoria_respostas.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 3. Evidências e links ---------------------------------------------------------
create table if not exists public.monitoria_evidencias (
  monitoria_id    text        not null references public.monitorias (id) on delete restrict,
  lista           text        not null,
  ordem           integer     not null,
  conteudo        jsonb       not null,
  ativo           boolean     not null default true,
  versao          integer     not null default 1,
  versao_lida     integer,
  criado_em       timestamptz,
  criado_por      uuid,
  atualizado_em   timestamptz,
  atualizado_por  uuid,

  primary key (monitoria_id, lista, ordem),
  constraint monitoria_evidencias_lista_valida check (lista in ('evidencias', 'links')),
  constraint monitoria_evidencias_versao_lida  check (versao_lida is null)
);

comment on table  public.monitoria_evidencias          is 'Itens das listas evidencias (metadados do arquivo) e links. Nada é excluído: retirar = ativo false.';
comment on column public.monitoria_evidencias.lista    is 'evidencias ou links: de qual lista do portal o item veio.';
comment on column public.monitoria_evidencias.ordem    is 'Posição na lista original. É a chave: o id da evidência é sorteado e pode repetir.';
comment on column public.monitoria_evidencias.conteudo is 'O item exatamente como veio ({ id, name, type, size, date } ou o texto do link).';
comment on column public.monitoria_evidencias.versao_lida is
  'Só para a alteração informar a versão carregada (controle de concorrência, script 00). Nunca fica gravada.';

-- 4. Proteção da identidade e da autoria ---------------------------------------
create or replace function app.tg_monitorias_protecao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_portal boolean := auth.uid() is not null;
begin
  if tg_op = 'INSERT' then
    -- Pelo portal, quem registrou é quem está logado, não o que foi enviado.
    if v_portal then
      new.registrado_por := app.meu_perfil_id();
      if new.retroativo then
        new.retroativo_por := new.registrado_por;
        new.retroativo_em  := now();
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  -- Manutenção autorizada (mesma regra dos scripts 00 e 02). A conferência fica
  -- aqui dentro, e não numa função à parte: este gatilho roda com as permissões
  -- de quem grava (o portal), que não pode executar funções internas.
  if current_user in ('postgres', 'supabase_admin')
     and not v_portal
     and coalesce(current_setting('app.manutencao', true), '') in ('restauracao', 'manutencao')
     and length(btrim(coalesce(current_setting('app.manutencao_motivo', true), ''))) >= 10
  then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'O código da monitoria não pode ser alterado.' using errcode = 'MI403';
  end if;
  if coalesce(old.protocolo, '') <> '' and new.protocolo is distinct from old.protocolo then
    raise exception 'O protocolo da monitoria não pode ser alterado (protocolo: %).', old.protocolo using errcode = 'MI403';
  end if;
  if new.registrado_por is distinct from old.registrado_por then
    raise exception 'Quem registrou a monitoria não pode ser alterado.' using errcode = 'MI403';
  end if;

  if old.retroativo then
    if (new.retroativo, new.retroativo_por, new.retroativo_em)
       is distinct from (old.retroativo, old.retroativo_por, old.retroativo_em) then
      raise exception 'O selo de lançamento retroativo não pode ser alterado nem retirado.' using errcode = 'MI403';
    end if;
  elsif new.retroativo then
    -- Marcação nova: pelo portal, o banco carimba quem e quando.
    if v_portal then
      new.retroativo_por := app.meu_perfil_id();
      new.retroativo_em  := now();
    end if;
  end if;

  return new;
end;
$$;

comment on function app.tg_monitorias_protecao() is
  'Gatilho BEFORE INSERT/UPDATE em monitorias: carimba quem registrou e o selo retroativo pelo login; id, protocolo, autoria e selo nunca mudam (MI403).';

revoke execute on function app.tg_monitorias_protecao() from public;

-- 5. Gatilhos -------------------------------------------------------------------
-- A proteção roda ANTES do controle de versão (ordem alfabética dos gatilhos
-- BEFORE): "monitorias_a_protecao" < "monitorias_controle".
create or replace trigger monitorias_a_protecao
  before insert or update on public.monitorias
  for each row execute function app.tg_monitorias_protecao();
create or replace trigger monitorias_controle
  before insert or update on public.monitorias
  for each row execute function app.tg_controle_registro();
create or replace trigger monitorias_sem_exclusao
  before delete on public.monitorias
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger monitorias_sem_truncate
  before truncate on public.monitorias
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger monitoria_respostas_controle
  before insert or update on public.monitoria_respostas
  for each row execute function app.tg_controle_registro();
create or replace trigger monitoria_respostas_sem_exclusao
  before delete on public.monitoria_respostas
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger monitoria_respostas_sem_truncate
  before truncate on public.monitoria_respostas
  for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger monitoria_evidencias_controle
  before insert or update on public.monitoria_evidencias
  for each row execute function app.tg_controle_registro();
create or replace trigger monitoria_evidencias_sem_exclusao
  before delete on public.monitoria_evidencias
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger monitoria_evidencias_sem_truncate
  before truncate on public.monitoria_evidencias
  for each statement execute function app.tg_bloquear_exclusao();

-- 6. Acesso: RLS ligada, nenhuma política ainda ---------------------------------
-- Como nos scripts anteriores: retira as permissões automáticas de anon e
-- authenticated. O script 07 concede só o necessário, junto com as políticas
-- (o Supervisor não edita a avaliação; só muda a situação, por função própria).
alter table public.monitorias           enable row level security;
alter table public.monitoria_respostas  enable row level security;
alter table public.monitoria_evidencias enable row level security;

revoke all on table public.monitorias           from anon, authenticated;
revoke all on table public.monitoria_respostas  from anon, authenticated;
revoke all on table public.monitoria_evidencias from anon, authenticated;

-- 7. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('04', 'Monitorias: monitorias com nota histórica, respostas exatas, evidências, autoria (avaliou × registrou), selo retroativo e vínculo com a régua')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select versao, descricao from app.versoes_esquema order by versao;
