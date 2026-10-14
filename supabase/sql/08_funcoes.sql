-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 08 — operações seguras das monitorias
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 07.
-- DEPOIS DE RODAR: no painel, Settings › Data API › Exposed schemas, ACRESCENTAR
-- `api` (ficam expostos: public, graphql_public e api). O schema `app` continua
-- privado.
--
-- O QUE FAZ
--   Toda gravação de monitoria, resposta e evidência pelo portal passa por
--   funções do schema `api` (o 07 não dá ao portal gravação direta nessas
--   tabelas). As funções conferem quem chama, o perfil, a situação e os dados,
--   e gravam tudo numa transação só. A auditoria (06) registra o login real.
--
--   api.salvar_monitoria      MONITOR   cria/edita rascunho; envia para validação
--   api.validar_monitoria     GESTOR    Pendente → Validada
--   api.reprovar_monitoria    GESTOR    Pendente → Reprovada (final), motivo obrigatório
--   api.devolver_monitoria    GESTOR    Pendente → Rascunho, motivo obrigatório
--   api.confirmar_zeramento   GESTOR    eliminatório confirmado: nota 0
--   api.afastar_eliminatorio  GESTOR    eliminatório afastado, motivo obrigatório
--   api.cancelar_monitoria    ADMIN*    qualquer situação → Cancelada, motivo obrigatório
--   api.fila_validacao        GESTOR    pendentes da equipe, de TODAS as competências
--   api.publicar_regua        ADMIN*    publica o retrato da régua atual como versão
--   (* ADMIN com MFA — script 07)
--
-- DECISÕES APROVADAS EM 12/10/2026 QUE ESTE SCRIPT APLICA
--   D3  A monitora registrada é sempre quem está logada (perfil MONITOR).
--   D4  A Monitora edita SOMENTE Rascunho. Depois do envio, só o Gestor devolve.
--   D5  Reprovada é final; motivo obrigatório.
--   D6  Validação bloqueada enquanto houver eliminatório pendente.
--   D7  Cancelamento só pelo ADMIN com MFA, com motivo.
--   D8  Lançamento retroativo desativado (nenhuma função cria retroativo).
--   D9  Competência futura é recusada.
--   D11 Envio vai sempre para validação (Pendente).
--   E1  O BANCO calcula a nota. A nota do portal é só conferência: diferença
--       maior que 0,01 é recusada (MI422); dentro disso vale a do banco.
--   E2  A versão da régua é fixada no PRIMEIRO envio e mantida em devoluções.
--       No envio, TODAS as respostas são revalidadas contra UMA única versão.
--   E3  A versão é a vigente na data do REGISTRO (envio), não a do atendimento
--       nem a competência: o que for enviado a partir de 12/10/2026 usa a 2.0.
--   E4b Monitoria migrada sem versão que JÁ HAVIA SIDO SUBMETIDA no portal
--       antigo (`enviada_na_origem = true`), ao ser reenviada após devolução,
--       usa a Régua 1 oficial (id 'regua-1'); a nota anterior fica em
--       `nota_historica`. (Ex.: MON-10001.)
--   E3m Rascunho migrado que NUNCA foi submetido (`enviada_na_origem = false`)
--       segue a E3: usa a versão vigente na data do primeiro envio (hoje, a
--       2.0) e não tem nota histórica. (Ex.: MON-10002.)
--       Migrada sem a indicação (`enviada_na_origem` nulo) NÃO é enviada: o
--       banco recusa em vez de adivinhar. Quem preenche é o 09.
--   D5m Reprovação de migrada continua permitida, com motivo obrigatório e
--       registro na auditoria (decisão de 12/10).
--   E5  `nota_calculada` guarda sempre a conta das respostas; o zeramento muda
--       só `nota`.
--   E6  No envio, o banco confere exatamente as regras atuais do formulário:
--       campos da etapa 1, todo critério aplicável respondido, justificativa
--       quando a resposta é menor que 2 (exceto classificação e N/A), checklist
--       completo. Justificativa no N/A NÃO é exigida (pendência T3). Canal sem
--       nenhum critério aplicável na versão é recusado (revisão 12/10).
--   S1  (revisão 12/10) Permissões fixadas no estado final mesmo com as
--       permissões automáticas do Supabase (seção 6); 'regua-1' reservado à
--       migração. Versões publicadas: só inclusão (03), sem alteração nem
--       exclusão pelo portal. Publicação SOMENTE por api.publicar_regua: o
--       ADMIN não grava direto em regua_versoes (decisão de 12/10).
--   M1  (revisão 12/10) Monitoria migrada cuja nota nunca foi calculada pelo
--       banco (sem versão da régua) NÃO pode ser validada nem zerada: o Gestor
--       devolve, a Monitora revisa e reenvia, e só então o banco calcula.
--       Nada é recalculado sozinho; a nota antiga fica em `nota_historica`.
--
-- A NOTA (mesma regra do formulário e de calcularNotaPrevia no portal)
--   Σ(resposta × peso) ÷ Σ(2 × peso) × 100, duas casas, só critérios aplicáveis
--   (ativos e do canal), com peso > 0 e resposta numérica (vazio e N/A ficam
--   fora). Eliminatórios têm peso 0 e nunca entram na conta; resposta 0 neles
--   marca a monitoria como "eliminatório pendente". A paridade com o portal é
--   provada pelos casos-ouro dos testes.
--
-- CÓDIGOS DE ERRO: MI401 sem identidade · MI403 sem permissão/situação ·
--   MI404 não encontrada (ou fora do seu escopo) · MI409 versão desatualizada ·
--   MI422 dado inválido · MI428 versão lida não informada.
--
-- COMPATIBILIDADE COM A MIGRAÇÃO (09): a migração grava direto pelo SQL Editor,
-- com responsável declarado (06), sem passar por estas funções, e marca
-- `origem = 'migracao'`. Situações antigas (Concluída, Aguardando Aprovação)
-- são tratadas como pendentes de validação.
--
-- PODE RODAR MAIS DE UMA VEZ. Não grava dados.
-- PARA DESFAZER (só na homologação, se pedido): drop schema api cascade; e as
-- funções app.* criadas aqui (as colunas novas ficam, vazias).
-- =============================================================================

begin;

-- 1. Schema exposto das operações -------------------------------------------------
create schema if not exists api;
revoke all on schema api from public;
grant usage on schema api to authenticated;

comment on schema api is
  'Operações do portal (RPC). Só funções; nenhuma tabela. Exposto pela Data API junto com public.';

-- 2. Colunas novas ------------------------------------------------------------------
alter table public.monitorias add column if not exists nota_calculada               numeric;
alter table public.monitorias add column if not exists nota_historica               numeric;
alter table public.monitorias add column if not exists origem                       text not null default 'portal';
alter table public.monitorias add column if not exists enviado_em                   timestamptz;
alter table public.monitorias add column if not exists motivo_reprovacao            text;
alter table public.monitorias add column if not exists eliminatorio_afastado_por    text references public.perfis (id) on delete restrict;
alter table public.monitorias add column if not exists eliminatorio_afastado_em     timestamptz;
alter table public.monitorias add column if not exists eliminatorio_afastado_motivo text;
alter table public.monitorias add column if not exists cancelado_por                text references public.perfis (id) on delete restrict;
alter table public.monitorias add column if not exists cancelado_em                 timestamptz;
alter table public.monitorias add column if not exists cancelado_motivo             text;
alter table public.monitorias add column if not exists enviada_na_origem            boolean;
alter table public.monitoria_respostas add column if not exists ativo               boolean not null default true;

alter table public.monitorias drop constraint if exists monitorias_origem_valida;
alter table public.monitorias add  constraint monitorias_origem_valida check (origem in ('portal', 'migracao'));
alter table public.monitorias drop constraint if exists monitorias_enviada_na_origem;
alter table public.monitorias add  constraint monitorias_enviada_na_origem check (origem = 'migracao' or enviada_na_origem is null);

comment on column public.monitorias.nota_calculada  is 'Conta das respostas pela versão da régua da monitoria (E5). O zeramento muda só `nota`.';
comment on column public.monitorias.nota_historica  is 'Monitoria migrada: a nota gravada no portal antigo, antes do recálculo pela Régua 1 oficial (E4b).';
comment on column public.monitorias.origem          is 'portal (registrada pelo banco compartilhado) ou migracao (veio do portal antigo).';
comment on column public.monitorias.enviada_na_origem is 'Só migradas (preenchido pelo 09): true = já havia sido submetida no portal antigo (reenvio usa a Régua 1, E4b); false = rascunho nunca submetido (usa a régua vigente no primeiro envio, E3).';
comment on column public.monitorias.enviado_em      is 'Primeiro envio para validação: a data de REGISTRO que decide a versão da régua (E3).';
comment on column public.monitoria_respostas.ativo  is 'false = critério que deixou de se aplicar numa edição (ex.: troca de canal). Nada é apagado.';

-- 3. Funções internas -----------------------------------------------------------------
create or replace function app.recusar(p_codigo text, p_mensagem text, p_dica text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_mensagem using errcode = p_codigo, hint = coalesce(p_dica, '');
end;
$$;

create or replace function app.hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Versão da régua vigente hoje: a de maior "vigente_desde" que já começou.
create or replace function app.regua_vigente()
returns text
language sql
stable
set search_path = ''
as $$
  select r.id from public.regua_versoes r
   where r.vigente_desde <= app.hoje()
   order by r.vigente_desde desc, r.criado_em desc
   limit 1;
$$;

-- A nota. Mesma regra do formulário (MonitoringForm) e de calcularNotaPrevia.
create or replace function app.calcular_nota(p_retrato jsonb, p_canal text, p_scores jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with aplicaveis as (
    select c ->> 'id' as id, coalesce((c ->> 'weight')::numeric, 0) as peso
      from jsonb_array_elements(coalesce(p_retrato, '[]'::jsonb)) c
     where coalesce((c ->> 'active')::boolean, false)
       and (p_canal is null or coalesce(c -> 'channels', '[]'::jsonb) ? p_canal)
  ), respostas as (
    select distinct on (i ->> 'criterionId') i ->> 'criterionId' as id, i -> 'score' as resposta
      from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) i
  ), soma as (
    select sum(r.resposta::numeric * a.peso) as obtido, sum(2 * a.peso) as possivel
      from aplicaveis a
      join respostas r on r.id = a.id
     where a.peso > 0 and jsonb_typeof(r.resposta) = 'number'
  )
  select case when coalesce(possivel, 0) > 0 then round(obtido / possivel * 100, 2) else 0 end
    from soma;
$$;

-- Confere as respostas. Rascunho (p_completo = false): só a forma. Envio
-- (p_completo = true): tudo contra UMA versão da régua. Devolve true se algum
-- eliminatório aplicável foi marcado (resposta 0).
create or replace function app.conferir_respostas(p_retrato jsonb, p_canal text, p_scores jsonb, p_completo boolean)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_aplic    jsonb;
  v_item     jsonb;
  v_c        jsonb;
  v_id       text;
  v_resp     jsonb;
  v_tipo     text;
  v_subs     jsonb;
  v_sr       jsonb;
  v_n        integer;
  v_sim      integer;
  v_vistos   text[] := '{}';
  v_marcado  boolean := false;
  v_faltando text;
  v_r29      jsonb;
  v_r25      jsonb;
begin
  if p_scores is null then p_scores := '[]'::jsonb; end if;
  if jsonb_typeof(p_scores) <> 'array' then
    perform app.recusar('MI422', 'As respostas (scores) precisam ser uma lista.');
  end if;

  select coalesce(jsonb_object_agg(c ->> 'id', c), '{}'::jsonb) into v_aplic
    from jsonb_array_elements(coalesce(p_retrato, '[]'::jsonb)) c
   where coalesce((c ->> 'active')::boolean, false)
     and coalesce(c -> 'channels', '[]'::jsonb) ? p_canal;
  if p_completo and v_aplic = '{}'::jsonb then
    perform app.recusar('MI422', format('O canal %s não tem critério aplicável nesta versão da régua.', coalesce(p_canal, '(vazio)')));
  end if;

  for v_item in select * from jsonb_array_elements(p_scores) loop
    if jsonb_typeof(v_item) <> 'object' or coalesce(v_item ->> 'criterionId', '') = '' then
      perform app.recusar('MI422', 'Resposta sem critério identificado.');
    end if;
    v_id := v_item ->> 'criterionId';
    if v_id = any (v_vistos) then
      perform app.recusar('MI422', format('O critério %s foi respondido mais de uma vez.', v_id));
    end if;
    v_vistos := v_vistos || v_id;
    v_resp := v_item -> 'score';
    if v_resp is not null and jsonb_typeof(v_resp) not in ('number', 'string', 'null') then
      perform app.recusar('MI422', format('Resposta do critério %s em formato inválido.', v_id));
    end if;
    if v_item ? 'subRespostas' and jsonb_typeof(v_item -> 'subRespostas') not in ('object', 'null') then
      perform app.recusar('MI422', format('Sub-respostas do critério %s em formato inválido.', v_id));
    end if;

    continue when not p_completo;   -- rascunho: só a forma

    v_c := v_aplic -> v_id;
    if v_c is null then
      perform app.recusar('MI422', format('O critério %s não pertence à versão da régua ou não se aplica ao canal %s.', v_id, p_canal));
    end if;
    if v_resp is null or jsonb_typeof(v_resp) = 'null' or (jsonb_typeof(v_resp) = 'string' and v_resp #>> '{}' = '') then
      perform app.recusar('MI422', format('O critério %s está sem resposta.', v_id),
                          'Todos os critérios aplicáveis precisam ser avaliados antes do envio.');
    end if;

    v_tipo := v_c ->> 'tipoResposta';
    if v_tipo = 'MULTIPLA_ESCOLHA' then
      if jsonb_typeof(v_resp) <> 'string' or not (coalesce(v_c -> 'opcoes', '[]'::jsonb) ? (v_resp #>> '{}')) then
        perform app.recusar('MI422', format('Resposta do critério %s não é uma das opções da régua.', v_id));
      end if;
    elsif v_tipo = 'CHECKLIST_SIM_NAO' then
      if jsonb_typeof(v_resp) <> 'number' then
        perform app.recusar('MI422', format('O checklist %s precisa de nota numérica (não aceita N/A).', v_id));
      end if;
      v_subs := coalesce(v_c -> 'subPerguntas', '[]'::jsonb);
      v_sr   := v_item -> 'subRespostas';
      if v_sr is null or jsonb_typeof(v_sr) <> 'object' then
        perform app.recusar('MI422', format('O checklist %s está sem sub-respostas.', v_id));
      end if;
      if exists (select 1 from jsonb_object_keys(v_sr) k
                  where not exists (select 1 from jsonb_array_elements(v_subs) s where s ->> 'id' = k)) then
        perform app.recusar('MI422', format('O checklist %s tem sub-pergunta que não pertence à versão da régua.', v_id),
                            'Responda só as sub-perguntas da régua vigente.');
      end if;
      if exists (select 1 from jsonb_array_elements(v_subs) s
                  where coalesce(v_sr ->> (s ->> 'id'), '') not in ('SIM', 'NAO')) then
        perform app.recusar('MI422', format('O checklist %s está incompleto.', v_id));
      end if;
      v_n   := jsonb_array_length(v_subs);
      select count(*) into v_sim from jsonb_array_elements(v_subs) s where v_sr ->> (s ->> 'id') = 'SIM';
      -- Tolerância de 0,01: o portal arredonda com toFixed (ponto flutuante).
      if v_n = 0 or abs(round(v_sim::numeric / v_n * 2, 2) - v_resp::numeric) > 0.01 then
        perform app.recusar('MI422', format('A nota do checklist %s não confere com as sub-respostas.', v_id));
      end if;
    elsif v_tipo = 'FAIXA_TEMPO' then
      if not ((jsonb_typeof(v_resp) = 'string' and v_resp #>> '{}' = 'N/A')
              or (jsonb_typeof(v_resp) = 'number' and v_resp::numeric in (0, 0.67, 1.33, 2))) then
        perform app.recusar('MI422', format('Resposta do critério %s fora da faixa de tempo (2, 1.33, 0.67, 0 ou N/A).', v_id));
      end if;
    elsif v_tipo = 'SIM_NAO' then
      if not ((jsonb_typeof(v_resp) = 'string' and v_resp #>> '{}' = 'N/A')
              or (jsonb_typeof(v_resp) = 'number' and v_resp::numeric in (0, 2))) then
        perform app.recusar('MI422', format('Resposta do eliminatório %s inválida (2 = não ocorreu, 0 = ocorreu).', v_id));
      end if;
    else   -- ESCALA_4 e qualquer outro tipo: a escala padrão
      if not ((jsonb_typeof(v_resp) = 'string' and v_resp #>> '{}' = 'N/A')
              or (jsonb_typeof(v_resp) = 'number' and v_resp::numeric in (0, 1, 2))) then
        perform app.recusar('MI422', format('Resposta do critério %s fora da escala (2, 1, 0 ou N/A).', v_id));
      end if;
    end if;

    -- Justificativa: resposta menor que 2, exceto classificação e N/A.
    if v_tipo is distinct from 'MULTIPLA_ESCOLHA' and jsonb_typeof(v_resp) = 'number'
       and v_resp::numeric < 2 and btrim(coalesce(v_item ->> 'lowScoreReason', '')) = '' then
      perform app.recusar('MI422', format('Justificativa obrigatória no critério %s (resposta menor que a máxima).', v_id));
    end if;

    if coalesce((v_c ->> 'eliminatorio')::boolean, false) and jsonb_typeof(v_resp) = 'number' and v_resp::numeric = 0 then
      v_marcado := true;
    end if;
  end loop;

  if p_completo then
    select string_agg(k, ', ' order by k) into v_faltando
      from jsonb_object_keys(v_aplic) k where not (k = any (v_vistos));
    if v_faltando is not null then
      perform app.recusar('MI422', format('Critérios sem resposta: %s.', v_faltando),
                          'Todos os critérios aplicáveis precisam ser avaliados antes do envio.');
    end if;
    -- Portão 29 → 25 (criterionGating.ts): cliente autenticado dispensa o 25,
    -- salvo se o eliminatório foi marcado.
    if v_aplic ? 'crit-29' and v_aplic ? 'crit-25' then
      select i -> 'score' into v_r29 from jsonb_array_elements(p_scores) i where i ->> 'criterionId' = 'crit-29';
      select i -> 'score' into v_r25 from jsonb_array_elements(p_scores) i where i ->> 'criterionId' = 'crit-25';
      if v_r29 = '"Sim"'::jsonb and not (v_r25 = '"N/A"'::jsonb or v_r25 = '0'::jsonb) then
        perform app.recusar('MI422', 'Com o cliente autenticado (critério 29 = Sim), o critério 25 é N/A, salvo eliminatório marcado.');
      end if;
    end if;
  end if;

  return v_marcado;
end;
$$;

-- Código interno MON-#####: sucessor do maior existente (mesma regra do portal).
create or replace function app.proximo_id_monitoria()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_n bigint;
begin
  perform pg_advisory_xact_lock(hashtext('monitoria.id'));
  select greatest(10000, coalesce(max((substring(m.id from '^[Mm][Oo][Nn]-([0-9]+)$'))::bigint), 0)) + 1
    into v_n from public.monitorias m;
  while exists (select 1 from public.monitorias m where m.id = 'MON-' || v_n) loop
    v_n := v_n + 1;
  end loop;
  return 'MON-' || v_n;
end;
$$;

-- Protocolo MON-AAAA-NNNN, sequência por ano da data do atendimento.
create or replace function app.proximo_protocolo(p_data text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ano integer := coalesce((substring(coalesce(p_data, '') from '^([0-9]{4})-'))::integer,
                            extract(year from app.hoje())::integer);
  v_n   integer;
  v_p   text;
begin
  perform pg_advisory_xact_lock(hashtext('monitoria.protocolo'));
  select coalesce(max((substring(m.protocolo from '^MON-' || v_ano || '-([0-9]+)$'))::integer), 0) + 1
    into v_n from public.monitorias m;
  loop
    v_p := 'MON-' || v_ano || '-' || case when v_n < 10000 then lpad(v_n::text, 4, '0') else v_n::text end;
    exit when not exists (select 1 from public.monitorias m where m.protocolo = v_p);
    v_n := v_n + 1;
  end loop;
  return v_p;
end;
$$;

-- Retrato da régua atual (formato do portal), para publicar uma versão.
create or replace function app.retrato_regua_atual()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(obj order by ordem), '[]'::jsonb) from (
    select c.ordem,
           (select jsonb_object_agg(k, coalesce(v, 'null'::jsonb)) from (values
              ('id', to_jsonb(c.id)), ('numero', to_jsonb(c.numero)), ('category', to_jsonb(c.bloco)), ('name', to_jsonb(c.nome)),
              ('description', to_jsonb(c.descricao)), ('orientacao', to_jsonb(c.orientacao)), ('tipoResposta', to_jsonb(c.tipo_resposta)),
              ('eliminatorio', to_jsonb(c.eliminatorio)), ('weight', to_jsonb(c.peso)), ('active', to_jsonb(c.ativo)),
              ('channels', to_jsonb(c.canais)), ('opcoes', to_jsonb(c.opcoes)), ('ancoras', c.ancoras), ('quandoNA', to_jsonb(c.quando_na)),
              ('subPerguntas', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', s.id, 'texto', s.texto, 'criterioSim', s.criterio_sim, 'criterioNao', s.criterio_nao)) || s.extras order by s.ordem)
                                  from public.criterio_subperguntas s where s.criterio_id = c.id and s.ativo))
            ) x(k, v) where v is not null or coalesce(c.extras -> '_nulos', '[]'::jsonb) ? k)
           || (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(c.extras) y(k, v) where k not like '\_%') as obj
      from public.criterios c) z;
$$;

-- Grava as respostas: atualiza as existentes, inclui as novas e inativa as
-- que não vieram (critério que deixou de se aplicar). Nada é apagado.
create or replace function app.gravar_respostas(p_monitoria text, p_scores jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ord  bigint;
  v_ids  text[] := '{}';
begin
  for v_item, v_ord in select i, o from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) with ordinality t(i, o) loop
    v_ids := v_ids || (v_item ->> 'criterionId');
    update public.monitoria_respostas r
       set resposta      = nullif(v_item -> 'score', 'null'::jsonb),
           justificativa = v_item ->> 'lowScoreReason',
           sub_respostas = nullif(v_item -> 'subRespostas', 'null'::jsonb),
           ordem         = (v_ord - 1)::integer,
           ativo         = true,
           versao_lida   = r.versao
     where r.monitoria_id = p_monitoria and r.criterio_id = v_item ->> 'criterionId'
       and (r.resposta, r.justificativa, r.sub_respostas, r.ordem, r.ativo)
           is distinct from (nullif(v_item -> 'score', 'null'::jsonb), v_item ->> 'lowScoreReason',
                             nullif(v_item -> 'subRespostas', 'null'::jsonb), (v_ord - 1)::integer, true);
    if not exists (select 1 from public.monitoria_respostas r
                    where r.monitoria_id = p_monitoria and r.criterio_id = v_item ->> 'criterionId') then
      insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, justificativa, sub_respostas, ordem)
      values (p_monitoria, v_item ->> 'criterionId', nullif(v_item -> 'score', 'null'::jsonb), v_item ->> 'lowScoreReason',
              nullif(v_item -> 'subRespostas', 'null'::jsonb), (v_ord - 1)::integer);
    end if;
  end loop;
  update public.monitoria_respostas r set ativo = false, versao_lida = r.versao
   where r.monitoria_id = p_monitoria and r.ativo and not (r.criterio_id = any (v_ids));
end;
$$;

-- Grava uma lista (evidencias ou links) por posição; item retirado = inativo.
create or replace function app.gravar_lista(p_monitoria text, p_lista text, p_itens jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ord  bigint;
  v_tot  integer := coalesce(jsonb_array_length(p_itens), 0);
begin
  if p_itens is null then return; end if;
  for v_item, v_ord in select i, o from jsonb_array_elements(p_itens) with ordinality t(i, o) loop
    update public.monitoria_evidencias e set conteudo = v_item, ativo = true, versao_lida = e.versao
     where e.monitoria_id = p_monitoria and e.lista = p_lista and e.ordem = (v_ord - 1)::integer
       and (e.conteudo is distinct from v_item or not e.ativo);
    if not exists (select 1 from public.monitoria_evidencias e
                    where e.monitoria_id = p_monitoria and e.lista = p_lista and e.ordem = (v_ord - 1)::integer) then
      insert into public.monitoria_evidencias (monitoria_id, lista, ordem, conteudo)
      values (p_monitoria, p_lista, (v_ord - 1)::integer, v_item);
    end if;
  end loop;
  update public.monitoria_evidencias e set ativo = false, versao_lida = e.versao
   where e.monitoria_id = p_monitoria and e.lista = p_lista and e.ordem >= v_tot and e.ativo;
end;
$$;

-- Carrega uma monitoria para decisão do Gestor, com todas as conferências.
create or replace function app.monitoria_para_gestor(p_id text, p_versao_lida integer)
returns public.monitorias
language plpgsql
set search_path = ''
as $$
declare
  v_eu text := app.meu_perfil_id();
  v_m  public.monitorias;
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('GESTOR') then
    perform app.recusar('MI403', 'Somente um Gestor ativo valida, reprova, devolve ou decide eliminatórios.');
  end if;
  select * into v_m from public.monitorias m where m.id = p_id for update;
  if not found or not (v_m.monitor_id = any (app.equipe_do_gestor())) then
    perform app.recusar('MI404', 'Monitoria não encontrada na sua equipe.');
  end if;
  if v_m.monitor_id = v_eu or v_m.registrado_por = v_eu then
    perform app.recusar('MI403', 'Você avaliou ou registrou esta monitoria. A decisão cabe a outro gestor.');
  end if;
  if p_versao_lida is null then
    perform app.recusar('MI428', 'Informe a versão da monitoria que foi carregada.');
  end if;
  if p_versao_lida <> v_m.versao then
    perform app.recusar('MI409', format('A monitoria foi alterada por outra pessoa (versão lida: %s, atual: %s).', p_versao_lida, v_m.versao),
                        'Recarregue a monitoria e refaça a ação.');
  end if;
  if v_m.status not in ('Pendente', 'Concluída', 'Aguardando Aprovação') then
    perform app.recusar('MI403', format('A monitoria não está pendente de validação (situação: %s).', v_m.status));
  end if;
  return v_m;
end;
$$;

-- Resultado padrão das funções.
create or replace function app.resultado_monitoria(p_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', m.id, 'protocolo', m.protocolo, 'status', m.status, 'versao', m.versao,
                            'nota', m.nota, 'nota_calculada', m.nota_calculada, 'regua_versao_id', m.regua_versao_id,
                            'eliminatorio_pendente', m.eliminatorio_pendente, 'zerada', m.zerada)
    from public.monitorias m where m.id = p_id;
$$;

-- 4. Vigência das versões da régua -------------------------------------------------
-- Pelo portal (ADMIN, via api.publicar_regua), uma versão nova não pode valer
-- para trás.
-- Este gatilho roda com as permissões de quem grava: por isso não chama
-- nenhuma função interna — calcula a data e recusa aqui mesmo.
create or replace function app.tg_regua_vigencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.vigente_desde < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A vigência de uma versão nova da régua não pode ser anterior a hoje.'
      using errcode = 'MI422';
  end if;
  -- 'regua-1' é a Régua 1 oficial, usada pelo reenvio das migradas (E4b):
  -- reservada para a migração (09); o portal não a cria.
  if auth.uid() is not null and lower(btrim(new.id)) = 'regua-1' then
    raise exception 'O identificador regua-1 é reservado para a Régua 1 oficial (migração).'
      using errcode = 'MI403';
  end if;
  return new;
end;
$$;

create or replace trigger regua_versoes_a_vigencia
  before insert on public.regua_versoes
  for each row execute function app.tg_regua_vigencia();

-- 5. Operações do portal (schema api) -------------------------------------------------

-- Cria ou edita (só Rascunho) e, se p_enviar, envia para validação.
create or replace function api.salvar_monitoria(p_dados jsonb, p_versao_lida integer default null, p_enviar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu       text := app.meu_perfil_id();
  v_m        public.monitorias;
  v_id       text := nullif(btrim(coalesce(p_dados ->> 'id', '')), '');
  v_novo     boolean := false;
  v_comp     text := nullif(p_dados ->> 'competencia', '');
  v_canal    text := nullif(p_dados ->> 'canal', '');
  v_scores   jsonb := coalesce(p_dados -> 'scores', '[]'::jsonb);
  v_versao   text;
  v_retrato  jsonb;
  v_nota     numeric;
  v_marcado  boolean;
  v_cliente  numeric;
  v_hist     numeric;
  v_campo    text;
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('MONITOR') then
    perform app.recusar('MI403', 'Somente uma conta MONITOR ativa registra monitorias.');
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    perform app.recusar('MI422', 'Dados da monitoria ausentes.');
  end if;
  if v_comp is not null then
    if v_comp !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      perform app.recusar('MI422', 'Competência fora do formato AAAA-MM.');
    end if;
    if v_comp > to_char(app.hoje(), 'YYYY-MM') then
      perform app.recusar('MI422', 'Competência futura não é aceita.');
    end if;
  end if;
  if nullif(p_dados ->> 'colaboradorId', '') is not null
     and not exists (select 1 from public.colaboradores c where c.id = p_dados ->> 'colaboradorId') then
    perform app.recusar('MI422', 'Colaborador inexistente.');
  end if;
  perform app.conferir_respostas(null, null, v_scores, false);   -- forma

  if v_id is null then
    v_novo := true;
  else
    select * into v_m from public.monitorias m where m.id = v_id for update;
    if not found or v_m.monitor_id is distinct from v_eu then
      perform app.recusar('MI404', 'Monitoria não encontrada entre as suas.');
    end if;
    if p_versao_lida is null then
      perform app.recusar('MI428', 'Informe a versão da monitoria que foi carregada.');
    end if;
    if p_versao_lida <> v_m.versao then
      perform app.recusar('MI409', format('A monitoria foi alterada por outra pessoa (versão lida: %s, atual: %s).', p_versao_lida, v_m.versao),
                          'Recarregue a monitoria e refaça a edição.');
    end if;
    if v_m.status <> 'Rascunho' then
      perform app.recusar('MI403', format('Só rascunho pode ser editado (situação: %s). Depois do envio, só o Gestor devolve para correção.', v_m.status));
    end if;
  end if;

  if p_enviar then
    -- Etapa 1 do formulário (E6).
    foreach v_campo in array array['colaboradorId', 'categoriaAtendimento', 'numeroAtendimento', 'numeroTitulo',
                                   'canal', 'date', 'competencia', 'inicioAtendimento', 'fimAtendimento'] loop
      if btrim(coalesce(p_dados ->> v_campo, '')) = '' then
        perform app.recusar('MI422', format('Campo obrigatório para o envio: %s.', v_campo));
      end if;
    end loop;
    begin
      if (p_dados ->> 'fimAtendimento')::timestamp < (p_dados ->> 'inicioAtendimento')::timestamp then
        perform app.recusar('MI422', 'O encerramento precisa ser igual ou posterior ao início do atendimento.');
      end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      perform app.recusar('MI422', 'Início ou encerramento do atendimento em formato inválido.');
    end;

    -- Versão da régua (E2, E3, E4b).
    v_versao := v_m.regua_versao_id;
    if v_versao is null then
      if not v_novo and v_m.origem = 'migracao' and v_m.enviada_na_origem is null then
        perform app.recusar('MI422', 'Monitoria migrada sem a indicação de envio no portal antigo (enviada_na_origem). Corrija pela migração.');
      end if;
      if not v_novo and v_m.origem = 'migracao' and v_m.enviada_na_origem then   -- E4b
        v_versao := 'regua-1';
        if not exists (select 1 from public.regua_versoes r where r.id = v_versao) then
          perform app.recusar('MI422', 'A Régua 1 oficial (regua-1) não está publicada.');
        end if;
      else   -- E3 (inclusive rascunho migrado nunca submetido)
        v_versao := app.regua_vigente();
        if v_versao is null then
          perform app.recusar('MI422', 'Não há versão da régua vigente publicada.');
        end if;
      end if;
    end if;
    select r.retrato into v_retrato from public.regua_versoes r where r.id = v_versao;

    v_marcado := app.conferir_respostas(v_retrato, v_canal, v_scores, true);
    v_nota    := app.calcular_nota(v_retrato, v_canal, v_scores);

    -- E1: a nota do portal é conferência.
    if jsonb_typeof(p_dados -> 'finalScore') = 'number' then
      v_cliente := (p_dados ->> 'finalScore')::numeric;
      if abs(v_cliente - v_nota) > 0.01 then
        perform app.recusar('MI422', format('A nota enviada (%s) não confere com a calculada pelo banco (%s).', v_cliente, v_nota),
                            'A nota é calculada pelo banco a partir das respostas e dos pesos da régua.');
      end if;
    end if;

    -- E4b: guarda a nota do portal antigo antes do recálculo (só de quem já
    -- havia sido submetida; rascunho nunca submetido não tem nota oficial).
    v_hist := case when not v_novo and v_m.origem = 'migracao' and v_m.enviada_na_origem
                   then coalesce(v_m.nota_historica, v_m.nota) else v_m.nota_historica end;
  end if;

  if v_novo then
    v_id := app.proximo_id_monitoria();
    insert into public.monitorias
      (id, protocolo, monitor_id, colaborador_id, data, competencia, canal, tipo, categoria_atendimento,
       numero_atendimento, numero_titulo, inicio_atendimento, fim_atendimento, duracao_minutos,
       comentarios, pontos_fortes, oportunidades, contexto, leitura_tecnica, erros_identificados, conclusao,
       evidencia_observacoes, origem, status, regua_versao_id, nota, nota_calculada, eliminatorio_pendente,
       zerada, enviado_em)
    values
      (v_id, app.proximo_protocolo(p_dados ->> 'date'), v_eu, nullif(p_dados ->> 'colaboradorId', ''),
       nullif(p_dados ->> 'date', ''), v_comp, v_canal, nullif(p_dados ->> 'tipo', ''), nullif(p_dados ->> 'categoriaAtendimento', ''),
       nullif(p_dados ->> 'numeroAtendimento', ''), nullif(p_dados ->> 'numeroTitulo', ''),
       nullif(p_dados ->> 'inicioAtendimento', ''), nullif(p_dados ->> 'fimAtendimento', ''),
       case when jsonb_typeof(p_dados -> 'duracaoMinutos') = 'number' then (p_dados ->> 'duracaoMinutos')::numeric end,
       p_dados ->> 'comments', p_dados ->> 'strengths', p_dados ->> 'opportunities', p_dados ->> 'contexto',
       p_dados ->> 'leituraTecnica', p_dados ->> 'errosIdentificados', p_dados ->> 'conclusao', p_dados ->> 'evidenciaObservacoes',
       'portal',
       case when p_enviar then 'Pendente' else 'Rascunho' end,
       case when p_enviar then v_versao end,
       case when p_enviar then v_nota end,
       case when p_enviar then v_nota end,
       case when p_enviar then v_marcado else false end,
       false,
       case when p_enviar then now() end);
  else
    update public.monitorias m set
       colaborador_id        = nullif(p_dados ->> 'colaboradorId', ''),
       data                  = nullif(p_dados ->> 'date', ''),
       competencia           = v_comp,
       canal                 = v_canal,
       tipo                  = nullif(p_dados ->> 'tipo', ''),
       categoria_atendimento = nullif(p_dados ->> 'categoriaAtendimento', ''),
       numero_atendimento    = nullif(p_dados ->> 'numeroAtendimento', ''),
       numero_titulo         = nullif(p_dados ->> 'numeroTitulo', ''),
       inicio_atendimento    = nullif(p_dados ->> 'inicioAtendimento', ''),
       fim_atendimento       = nullif(p_dados ->> 'fimAtendimento', ''),
       duracao_minutos       = case when jsonb_typeof(p_dados -> 'duracaoMinutos') = 'number' then (p_dados ->> 'duracaoMinutos')::numeric end,
       comentarios           = p_dados ->> 'comments',
       pontos_fortes         = p_dados ->> 'strengths',
       oportunidades         = p_dados ->> 'opportunities',
       contexto              = p_dados ->> 'contexto',
       leitura_tecnica       = p_dados ->> 'leituraTecnica',
       erros_identificados   = p_dados ->> 'errosIdentificados',
       conclusao             = p_dados ->> 'conclusao',
       evidencia_observacoes = p_dados ->> 'evidenciaObservacoes',
       status                = case when p_enviar then 'Pendente' else m.status end,
       regua_versao_id       = case when p_enviar then v_versao else m.regua_versao_id end,
       nota                  = case when p_enviar then v_nota else m.nota end,
       nota_calculada        = case when p_enviar then v_nota else m.nota_calculada end,
       nota_historica        = case when p_enviar then v_hist else m.nota_historica end,
       eliminatorio_pendente = case when p_enviar then v_marcado else m.eliminatorio_pendente end,
       zerada                = case when p_enviar then false else m.zerada end,
       eliminatorio_confirmado_por  = case when p_enviar then null else m.eliminatorio_confirmado_por end,
       eliminatorio_confirmado_em   = case when p_enviar then null else m.eliminatorio_confirmado_em end,
       eliminatorio_afastado_por    = case when p_enviar then null else m.eliminatorio_afastado_por end,
       eliminatorio_afastado_em     = case when p_enviar then null else m.eliminatorio_afastado_em end,
       eliminatorio_afastado_motivo = case when p_enviar then null else m.eliminatorio_afastado_motivo end,
       enviado_em            = case when p_enviar then coalesce(m.enviado_em, now()) else m.enviado_em end,
       versao_lida           = p_versao_lida
     where m.id = v_id;
  end if;

  perform app.gravar_respostas(v_id, v_scores);
  perform app.gravar_lista(v_id, 'evidencias', p_dados -> 'evidencias');
  perform app.gravar_lista(v_id, 'links', p_dados -> 'links');

  return app.resultado_monitoria(v_id);
end;
$$;

create or replace function api.validar_monitoria(p_id text, p_versao_lida integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if v_m.regua_versao_id is null then   -- M1
    perform app.recusar('MI403', 'A nota desta monitoria migrada não foi calculada pelo banco. Devolva para revisão e reenvio.');
  end if;
  if v_m.eliminatorio_pendente then
    perform app.recusar('MI422', 'Há eliminatório pendente: confirme o zeramento ou afaste o eliminatório antes de validar.');
  end if;
  update public.monitorias m
     set status = 'Validada', aprovado_por = app.meu_perfil_id(), aprovado_em = now(), versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

create or replace function api.reprovar_monitoria(p_id text, p_versao_lida integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if btrim(coalesce(p_motivo, '')) = '' then
    perform app.recusar('MI422', 'Informe o motivo da reprovação.');
  end if;
  update public.monitorias m
     set status = 'Reprovada', motivo_reprovacao = btrim(p_motivo), revisado_por = app.meu_perfil_id(), revisado_em = now(),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

create or replace function api.devolver_monitoria(p_id text, p_versao_lida integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if btrim(coalesce(p_motivo, '')) = '' then
    perform app.recusar('MI422', 'Informe o motivo da devolução (o que deve ser corrigido).');
  end if;
  update public.monitorias m
     set status = 'Rascunho', motivo_ajuste = btrim(p_motivo), revisado_por = app.meu_perfil_id(), revisado_em = now(),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

create or replace function api.confirmar_zeramento(p_id text, p_versao_lida integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if v_m.regua_versao_id is null then   -- M1
    perform app.recusar('MI403', 'A nota desta monitoria migrada não foi calculada pelo banco. Devolva para revisão e reenvio.');
  end if;
  if not v_m.eliminatorio_pendente then
    perform app.recusar('MI403', 'A monitoria não tem eliminatório pendente.');
  end if;
  update public.monitorias m
     set nota_calculada = coalesce(m.nota_calculada, m.nota), nota = 0, zerada = true, eliminatorio_pendente = false,
         eliminatorio_confirmado_por = app.meu_perfil_id(), eliminatorio_confirmado_em = now(), versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

create or replace function api.afastar_eliminatorio(p_id text, p_versao_lida integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if not v_m.eliminatorio_pendente then
    perform app.recusar('MI403', 'A monitoria não tem eliminatório pendente.');
  end if;
  if btrim(coalesce(p_motivo, '')) = '' then
    perform app.recusar('MI422', 'Informe o motivo para afastar o eliminatório.');
  end if;
  update public.monitorias m
     set eliminatorio_pendente = false, eliminatorio_afastado_por = app.meu_perfil_id(), eliminatorio_afastado_em = now(),
         eliminatorio_afastado_motivo = btrim(p_motivo), versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

create or replace function api.cancelar_monitoria(p_id text, p_versao_lida integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias;
begin
  if auth.uid() is null or not app.sou_admin() then
    perform app.recusar('MI403', 'Somente o Administrador, com MFA, cancela monitorias.');
  end if;
  select * into v_m from public.monitorias m where m.id = p_id for update;
  if not found then
    perform app.recusar('MI404', 'Monitoria não encontrada.');
  end if;
  if p_versao_lida is null then
    perform app.recusar('MI428', 'Informe a versão da monitoria que foi carregada.');
  end if;
  if p_versao_lida <> v_m.versao then
    perform app.recusar('MI409', format('A monitoria foi alterada por outra pessoa (versão lida: %s, atual: %s).', p_versao_lida, v_m.versao));
  end if;
  if v_m.status = 'Cancelada' then
    perform app.recusar('MI403', 'A monitoria já está cancelada.');
  end if;
  if btrim(coalesce(p_motivo, '')) = '' then
    perform app.recusar('MI422', 'Informe o motivo do cancelamento.');
  end if;
  update public.monitorias m
     set status = 'Cancelada', cancelado_por = app.meu_perfil_id(), cancelado_em = now(), cancelado_motivo = btrim(p_motivo),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

-- Fila de validação: pendentes da equipe, de TODAS as competências (inclusive
-- agosto), da mais antiga para a mais nova. Roda com as permissões de quem
-- chama: a RLS do 07 continua valendo.
create or replace function api.fila_validacao()
returns setof public.monitorias
language sql
stable
security invoker
set search_path = ''
as $$
  select m.* from public.monitorias m
   where m.status in ('Pendente', 'Concluída', 'Aguardando Aprovação')
     and m.monitor_id in (select unnest(app.equipe_do_gestor()))
   order by m.competencia nulls last, m.data nulls last, m.id;
$$;

-- Publica o retrato da régua atual como nova versão (vigência de hoje em diante).
create or replace function api.publicar_regua(p_id text, p_rotulo text, p_vigente_desde date, p_descricao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not app.sou_admin() then
    perform app.recusar('MI403', 'Somente o Administrador, com MFA, publica versões da régua.');
  end if;
  insert into public.regua_versoes (id, rotulo, vigente_desde, descricao, retrato)
  values (p_id, p_rotulo, p_vigente_desde, p_descricao, app.retrato_regua_atual());
  return (select jsonb_build_object('id', r.id, 'rotulo', r.rotulo, 'vigente_desde', r.vigente_desde,
                                    'criterios', jsonb_array_length(r.retrato))
            from public.regua_versoes r where r.id = p_id);
end;
$$;

-- 6. Permissões ----------------------------------------------------------------------
-- O Supabase pode dar permissões AUTOMÁTICAS (ALTER DEFAULT PRIVILEGES) a anon e
-- authenticated em toda função, sequência ou schema novo. Um `revoke ... from
-- public` não retira uma permissão dada diretamente a esses papéis. Por isso
-- esta seção fixa o estado FINAL, qualquer que seja o padrão do projeto:
--   - schemas app e api: só USO, e só para o portal logado; ninguém cria objetos;
--   - funções do app: nenhuma para anon; para o portal, SÓ as 7 auxiliares que
--     as regras RLS (07) usam; todas as demais (internas e gatilhos) ficam
--     fechadas — inclusive as criadas pelos scripts 00 a 07;
--   - funções do api: nenhuma para anon; as 9 operações para o portal logado;
--   - sequências de public e app: nenhuma para anon e authenticated (a numeração
--     é do banco; `acessos_log.seq` é identity e não precisa de permissão).
--   - régua: versão nova SÓ por api.publicar_regua (login, ADMIN, MFA, retrato
--     montado pelo banco a partir dos critérios, auditoria). O 08 retira a
--     inclusão direta que o 07 dava ao ADMIN (permissão e política).
-- As demais tabelas não entram aqui: cada script já retira as permissões
-- automáticas e o 07 concede só o necessário.
-- ATENÇÃO: se o 07 for rodado de novo, rode o 08 em seguida (o 07 recria a
-- inclusão direta na régua).
revoke insert, update, delete, truncate on table public.regua_versoes from public, anon, authenticated;
drop policy if exists regua_versoes_incluir on public.regua_versoes;

revoke all   on schema app from public, anon, authenticated;
grant  usage on schema app to authenticated;
revoke all   on schema api from public, anon, authenticated;
grant  usage on schema api to authenticated;

do $$
declare
  v_f regprocedure;
  v_s regclass;
begin
  for v_f in select p.oid::regprocedure from pg_proc p
              where p.pronamespace in ('app'::regnamespace, 'api'::regnamespace) loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_f);
  end loop;
  for v_s in select c.oid::regclass from pg_class c
              where c.relkind = 'S' and c.relnamespace in ('public'::regnamespace, 'app'::regnamespace) loop
    execute format('revoke all on sequence %s from public, anon, authenticated', v_s);
  end loop;
end;
$$;

-- Auxiliares que as regras RLS do 07 chamam (as mesmas 7 de antes do 08).
grant execute on function app.meu_perfil_id()                             to authenticated;
grant execute on function app.meus_perfis()                               to authenticated;
grant execute on function app.tem_perfil(text)                            to authenticated;
grant execute on function app.usuario_ativo()                             to authenticated;
grant execute on function app.equipe_do_gestor()                          to authenticated;
grant execute on function app.sou_admin()                                 to authenticated;
grant execute on function app.usuario_liberado()                          to authenticated;

-- Operações do portal.
grant execute on function api.salvar_monitoria(jsonb, integer, boolean)   to authenticated;
grant execute on function api.validar_monitoria(text, integer)            to authenticated;
grant execute on function api.reprovar_monitoria(text, integer, text)     to authenticated;
grant execute on function api.devolver_monitoria(text, integer, text)     to authenticated;
grant execute on function api.confirmar_zeramento(text, integer)          to authenticated;
grant execute on function api.afastar_eliminatorio(text, integer, text)   to authenticated;
grant execute on function api.cancelar_monitoria(text, integer, text)     to authenticated;
grant execute on function api.fila_validacao()                            to authenticated;
grant execute on function api.publicar_regua(text, text, date, text)      to authenticated;

-- 7. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('08', 'Operações seguras das monitorias (schema api): salvar/enviar com nota calculada pelo banco e régua fixada no envio; validar, reprovar, devolver, eliminatório, cancelar; fila de todas as competências; publicação da régua')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select proname from pg_proc where pronamespace = 'api'::regnamespace order by 1;
