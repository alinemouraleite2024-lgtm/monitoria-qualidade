-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 15 — proteção contra duplicidade na criação
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Desenvolvido e testado só no Postgres local (supabase/testes/testes-15-duplicidade.mjs),
-- 29/10/2026. Pré-requisito: script 14. O portal atual continua funcionando com ele.
--
-- O PROBLEMA (conferência de 29/10/2026)
--   Seis pares de monitorias idênticas no banco de homologação, criados com 1–2 segundos de
--   diferença: o "Concluir Monitoria" continuava ativo enquanto o banco respondia, e o segundo
--   clique criava outra monitoria. E o AGO-009 era o mesmo atendimento do MON-10007/10008,
--   com o número do atendimento e o título preenchidos de outro jeito.
--
-- O QUE FAZ
--   1. MESMA REQUISIÇÃO (clique repetido, nova tentativa da rede): o portal manda, na criação,
--      uma chave (`chaveCriacao`, uuid) gerada uma vez por formulário. Repetir a chave devolve
--      a monitoria já criada (`repetida: true`), sem criar outra. A chave é única no banco.
--   2. MESMO ATENDIMENTO (outra requisição, outra tela, importação): a mesma monitora não
--      registra duas vezes o mesmo atendimento. "Mesmo atendimento" = mesma colaboradora, mesmo
--      canal, mesmo dia e mesmo minuto de início — o que NÃO depende de como o número do
--      atendimento, o título, a categoria ou o término foram digitados.
--      Recusa com MI410 e diz qual monitoria já existe e em que situação.
--      Não bloqueiam (casos legítimos): outra monitora (calibração entre monitoras); tipo
--      Calibração; monitoria anterior Cancelada ou Reprovada; rascunho sem início preenchido
--      (a conferência acontece quando o início for preenchido).
--      Pedidos simultâneos do mesmo atendimento são enfileirados por uma trava da transação
--      (pg_advisory_xact_lock): o segundo só confere depois que o primeiro gravou.
--   3. CANCELAMENTO POR DUPLICIDADE (ADMIN com MFA): api.cancelar_por_duplicidade cancela a
--      CÓPIA indicando a original, só se as duas forem de fato o mesmo registro (mesma monitora,
--      mesmo atendimento, mesmas respostas). Usa o cancelamento que já existe (situação
--      Cancelada, motivo, auditoria, evento no histórico) e guarda a referência à original.
--
-- O QUE NÃO FAZ: não altera, não cancela e não apaga nenhuma monitoria existente. As cópias já
-- gravadas continuam como estão — elas só deixam de existir na fila, nas metas e nas médias
-- quando o ADMIN as cancelar, uma a uma, com autorização.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '14') then
    raise exception 'SCRIPT 15 RECUSADO: o script 14 precisa estar aplicado.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- 1. Colunas ---------------------------------------------------------------------------
alter table public.monitorias add column if not exists chave_criacao uuid;
alter table public.monitorias add column if not exists duplicata_de  text references public.monitorias (id) on delete restrict;
create unique index if not exists monitorias_chave_criacao_unica on public.monitorias (chave_criacao) where chave_criacao is not null;

comment on column public.monitorias.chave_criacao is
  'Chave da requisição que criou a monitoria (uuid do formulário). Repetir a chave devolve a mesma monitoria (script 15).';
comment on column public.monitorias.duplicata_de is
  'Quando cancelada por duplicidade: a monitoria original, da qual esta era cópia (script 15).';

-- 2. Mesmo atendimento -------------------------------------------------------------------
-- Colaboradora | canal | AAAA-MM-DDTHH:MI do início. Nulo quando falta algum dos três ou o
-- início não está no formato do formulário — nesse caso não há o que comparar.
create or replace function app.chave_atendimento(p_colaborador text, p_canal text, p_inicio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(coalesce(p_colaborador, '')), '') is null or nullif(btrim(coalesce(p_canal, '')), '') is null then null
    when coalesce(p_inicio, '') !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' then null
    else btrim(p_colaborador) || '|' || btrim(p_canal) || '|' || left(p_inicio, 10) || 'T' || substr(p_inicio, 12, 5)
  end;
$$;
revoke execute on function app.chave_atendimento(text, text, text) from public, anon, authenticated;

create or replace function app.tg_monitorias_duplicidade()
returns trigger
language plpgsql
security definer   -- confere contra TODAS as monitorias da monitora, independentemente da RLS
set search_path = ''
as $$
declare
  v_chave text := app.chave_atendimento(new.colaborador_id, new.canal, new.inicio_atendimento);
  v_outra public.monitorias;
begin
  if tg_op = 'UPDATE' then
    -- A chave de criação nunca muda depois de gravada.
    if old.chave_criacao is not null and new.chave_criacao is distinct from old.chave_criacao then
      raise exception 'A chave de criação da monitoria não pode ser alterada.' using errcode = 'MI403';
    end if;
    -- Só confere quando o atendimento (ou a dona) mudou: decisões, devoluções e reenvios de
    -- registros antigos — inclusive das cópias que já existem — seguem normalmente.
    if v_chave is not distinct from app.chave_atendimento(old.colaborador_id, old.canal, old.inicio_atendimento)
       and new.monitor_id is not distinct from old.monitor_id then
      return new;
    end if;
  end if;

  if v_chave is null or new.monitor_id is null
     or coalesce(new.status, '') in ('Cancelada', 'Reprovada') or coalesce(new.tipo, '') = 'Calibração' then
    return new;
  end if;

  -- Pedidos simultâneos do mesmo atendimento: um de cada vez, até o fim da transação.
  perform pg_advisory_xact_lock(hashtextextended('monitoria-atendimento:' || new.monitor_id || '|' || v_chave, 0));

  select m.* into v_outra
    from public.monitorias m
   where m.monitor_id = new.monitor_id
     and m.id <> new.id
     and coalesce(m.status, '') not in ('Cancelada', 'Reprovada')
     and coalesce(m.tipo, '') <> 'Calibração'
     and app.chave_atendimento(m.colaborador_id, m.canal, m.inicio_atendimento) = v_chave
   order by m.id
   limit 1;

  if found then
    raise exception '%', format(
      case when v_outra.status = 'Rascunho'
           then 'Este atendimento já tem um rascunho seu: %s (iniciado em %s). Continue por ele em vez de criar outra monitoria.'
           else 'Este atendimento já foi avaliado por você: %s, situação %s (início em %s). Uma nova monitoria do mesmo atendimento não foi criada.' end,
      coalesce(nullif(v_outra.protocolo, ''), v_outra.id),
      case when v_outra.status = 'Rascunho' then to_char(v_outra.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') else v_outra.status end,
      to_char(to_timestamp(replace(left(new.inicio_atendimento, 16), 'T', ' '), 'YYYY-MM-DD HH24:MI'), 'DD/MM/YYYY HH24:MI'))
      using errcode = 'MI410',
            hint = 'Mesmo atendimento = mesma colaboradora, mesmo canal, mesmo dia e mesmo horário de início, mesmo que o número do atendimento ou o título tenham sido digitados de outro jeito. Se for de fato outro atendimento, confira o horário de início.';
  end if;
  return new;
end;
$$;
revoke execute on function app.tg_monitorias_duplicidade() from public, anon, authenticated;

comment on function app.tg_monitorias_duplicidade() is
  'Gatilho BEFORE INSERT/UPDATE em monitorias: a mesma monitora não registra duas vezes o mesmo atendimento (colaboradora, canal, início ao minuto). Recusa com MI410 (script 15).';

-- "b" vem depois de "a_protecao" e antes de "controle" (ordem alfabética dos gatilhos BEFORE).
create or replace trigger monitorias_b_duplicidade
  before insert or update on public.monitorias
  for each row execute function app.tg_monitorias_duplicidade();

-- 3. api.salvar_monitoria com a chave de criação ------------------------------------------
-- Igual à do 08, com duas diferenças, marcadas "-- 15": lê `chaveCriacao` e, na criação,
-- devolve a monitoria já criada com a mesma chave em vez de criar outra.
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
  v_chave    uuid;   -- 15
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('MONITOR') then
    perform app.recusar('MI403', 'Somente uma conta MONITOR ativa registra monitorias.');
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    perform app.recusar('MI422', 'Dados da monitoria ausentes.');
  end if;
  begin   -- 15
    v_chave := nullif(btrim(coalesce(p_dados ->> 'chaveCriacao', '')), '')::uuid;
  exception when invalid_text_representation then
    perform app.recusar('MI422', 'Chave de criação inválida.');
  end;
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
    -- 15: a mesma requisição (mesma chave) não cria uma segunda monitoria.
    if v_chave is not null then
      perform pg_advisory_xact_lock(hashtextextended('monitoria-criacao:' || v_chave::text, 0));
      select * into v_m from public.monitorias m where m.chave_criacao = v_chave;
      if found then
        if v_m.monitor_id is distinct from v_eu then
          perform app.recusar('MI403', 'Esta chave de criação pertence a outra conta.');
        end if;
        return app.resultado_monitoria(v_m.id) || jsonb_build_object('repetida', true);
      end if;
    end if;
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
       zerada, enviado_em, chave_criacao)   -- 15
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
       case when p_enviar then now() end,
       v_chave);   -- 15
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

-- 4. Cancelamento por duplicidade -------------------------------------------------------------
-- O cancelamento do 08 aceita qualquer motivo; este confere que a monitoria É uma cópia da
-- original antes de cancelar, preenche o motivo padrão e guarda a referência. A cópia sai da
-- fila, das metas e das médias (Cancelada); o histórico recebe o evento de cancelamento (14).
-- NADA é cancelado na instalação: só quando alguém chama, uma monitoria por chamada.
--
-- A regra fica numa função interna (app.cancelar_duplicata), usada por dois caminhos:
--   · api.cancelar_por_duplicidade — o portal, ADMIN com MFA (o responsável é quem está logado);
--   · o SQL Editor, numa transação com o ADMIN responsável declarado (app.responsavel) — o mesmo
--     caminho da reconstituição do 14 (script 15b, com a lista conferida das cópias).
create or replace function app.cancelar_duplicata(p_id text, p_versao_lida integer, p_original text, p_responsavel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.monitorias;
  v_o public.monitorias;
  v_resp_c text;
  v_resp_o text;
begin
  if not exists (select 1 from public.perfis p where p.id = p_responsavel and 'ADMIN' = any (p.perfis) and p.status = 'ACTIVE') then
    perform app.recusar('MI403', 'O cancelamento por duplicidade exige um ADMIN ativo como responsável.');
  end if;
  if p_id is not distinct from p_original then
    perform app.recusar('MI422', 'Informe uma original diferente da cópia.');
  end if;
  select * into v_c from public.monitorias m where m.id = p_id for update;
  if not found then
    perform app.recusar('MI404', 'Monitoria (cópia) não encontrada.');
  end if;
  select * into v_o from public.monitorias m where m.id = p_original;
  if not found then
    perform app.recusar('MI404', 'Monitoria original não encontrada.');
  end if;
  if p_versao_lida is null then
    perform app.recusar('MI428', 'Informe a versão da monitoria que foi carregada.');
  end if;
  if p_versao_lida <> v_c.versao then
    perform app.recusar('MI409', format('A monitoria foi alterada por outra pessoa (versão lida: %s, atual: %s).', p_versao_lida, v_c.versao));
  end if;
  if v_c.status in ('Cancelada', 'Validada', 'Reprovada') then
    perform app.recusar('MI403', format('A cópia está %s e não é cancelada por duplicidade. Só Rascunho ou Pendente.', v_c.status));
  end if;
  if v_o.status = 'Cancelada' then
    perform app.recusar('MI403', 'A original indicada está cancelada.');
  end if;
  if v_c.monitor_id is distinct from v_o.monitor_id
     or app.chave_atendimento(v_c.colaborador_id, v_c.canal, v_c.inicio_atendimento) is null
     or app.chave_atendimento(v_c.colaborador_id, v_c.canal, v_c.inicio_atendimento)
        is distinct from app.chave_atendimento(v_o.colaborador_id, v_o.canal, v_o.inicio_atendimento) then
    perform app.recusar('MI422', 'As duas monitorias não são do mesmo atendimento (monitora, colaboradora, canal e início).');
  end if;
  select string_agg(r.criterio_id || '=' || coalesce(r.resposta::text, '') || '|' || coalesce(r.justificativa, '') || '|' || coalesce(r.sub_respostas::text, ''), ';' order by r.criterio_id)
    into v_resp_c from public.monitoria_respostas r where r.monitoria_id = v_c.id;
  select string_agg(r.criterio_id || '=' || coalesce(r.resposta::text, '') || '|' || coalesce(r.justificativa, '') || '|' || coalesce(r.sub_respostas::text, ''), ';' order by r.criterio_id)
    into v_resp_o from public.monitoria_respostas r where r.monitoria_id = v_o.id;
  if v_resp_c is distinct from v_resp_o then
    perform app.recusar('MI422', 'As respostas das duas monitorias são diferentes: não é cópia. Use o cancelamento comum, com o motivo.');
  end if;

  update public.monitorias m
     set status = 'Cancelada', cancelado_por = p_responsavel, cancelado_em = now(),
         cancelado_motivo = format('Duplicidade: cópia de %s, criada em dobro (%s).',
                                   coalesce(nullif(v_o.protocolo, ''), v_o.id),
                                   to_char(v_c.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS')),
         duplicata_de = v_o.id,
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;
revoke execute on function app.cancelar_duplicata(text, integer, text, text) from public, anon, authenticated;

create or replace function api.cancelar_por_duplicidade(p_id text, p_versao_lida integer, p_original text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not app.sou_admin() then
    perform app.recusar('MI403', 'Somente o Administrador, com MFA, cancela monitorias.');
  end if;
  return app.cancelar_duplicata(p_id, p_versao_lida, p_original, app.meu_perfil_id());
end;
$$;

-- 5. Permissões ---------------------------------------------------------------------------
revoke all on function api.salvar_monitoria(jsonb, integer, boolean)          from public, anon;
revoke all on function api.cancelar_por_duplicidade(text, integer, text)      from public, anon;
grant execute on function api.salvar_monitoria(jsonb, integer, boolean)       to authenticated;
grant execute on function api.cancelar_por_duplicidade(text, integer, text)   to authenticated;

-- 6. Conferência ---------------------------------------------------------------------------
do $conf$
declare
  v_f text;
begin
  if has_function_privilege('authenticated', 'app.cancelar_duplicata(text, integer, text, text)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 15: a função interna de cancelamento ficou exposta ao portal.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'monitorias_b_duplicidade' and tgrelid = 'public.monitorias'::regclass and tgenabled = 'O') then
    raise exception 'SCRIPT 15: o gatilho de duplicidade não ficou ativo.';
  end if;
  foreach v_f in array array['api.salvar_monitoria(jsonb, integer, boolean)', 'api.cancelar_por_duplicidade(text, integer, text)'] loop
    if not (select prosecdef from pg_proc where oid = v_f::regprocedure)
       or has_function_privilege('anon', v_f::regprocedure, 'execute')
       or not has_function_privilege('authenticated', v_f::regprocedure, 'execute') then
      raise exception 'SCRIPT 15: % com segurança ou permissão diferente da esperada.', v_f;
    end if;
  end loop;
  if position('-- 15' in pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)) = 0 then
    raise exception 'SCRIPT 15: api.salvar_monitoria não recebeu a chave de criação.';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('15', 'Duplicidade na criação: chave de criação idempotente, mesmo atendimento recusado (MI410), cancelamento por duplicidade pelo ADMIN')
on conflict (versao) do nothing;

notify pgrst, 'reload schema';

commit;
