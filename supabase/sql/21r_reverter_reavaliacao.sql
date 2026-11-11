-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 21r — REVERSÃO do script 21
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA GESTÃO DA QUALIDADE. ***
-- Pré-requisito: portal anterior ao 21 republicado ANTES (o anterior não conhece "Em reavaliação").
-- O QUE FAZ: toda monitoria "Em reavaliação" (as cinco convertidas e as devolvidas depois do 21) volta a
--   Rascunho com o motivo, como era antes; sem evento novo no histórico (o gatilho do 21 ignora essa
--   troca). Depois devolve gatilho, devolver e salvar às versões do 14 e do 19 (texto copiado) e tira
--   a situação da tabela. Não toca em nota, resposta, evidência nem evento. Tudo numa transação.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '21') then
    raise exception 'SCRIPT 21r RECUSADO: o script 21 não está instalado.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- 1. Fotografia e dados primeiro, com o gatilho do 21 ainda ativo (não grava evento) ----------------
do $reverter$
declare
  r   record;
  v_m record;
  v_n integer := 0;
begin
  select md5(coalesce(string_agg((to_jsonb(m) - 'status' - 'versao' - 'versao_lida' - 'atualizado_em' - 'atualizado_por')::text, '|' order by m.id), '')) mon,
           (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
           (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
           (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
           (select count(*) from public.auditoria) aud
      from public.monitorias m
    into r;
  perform set_config('app.r21r_mon', r.mon, true);
  perform set_config('app.r21r_resp', r.resp, true);
  perform set_config('app.r21r_evid', r.evid, true);
  perform set_config('app.r21r_ev', r.ev, true);
  perform set_config('app.r21r_aud', r.aud::text, true);
  for v_m in select id, versao from public.monitorias where status = 'Em reavaliação' order by id for update loop
    update public.monitorias set status = 'Rascunho', versao_lida = v_m.versao where id = v_m.id;
    v_n := v_n + 1;
  end loop;
  perform set_config('app.r21r_n', v_n::text, true);
end;
$reverter$;

-- 2. Tabela, gatilho, devolver e salvar como antes do 21 ------------------------------------------
alter table public.monitorias drop constraint monitorias_status_valido;
alter table public.monitorias add constraint monitorias_status_valido check (status is null or status in
                                          ('Rascunho', 'Pendente', 'Concluída', 'Validada', 'Reprovada', 'Cancelada',
                                           'Aprovada', 'Aguardando Aprovação'));

create or replace function app.tg_monitoria_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resp     text;
  v_enviada  boolean;
  v_rodada   integer;
  v_tipo     text;
  v_texto    text;
begin
  -- Restauração de backup re-grava monitorias; o histórico vem no próprio backup.
  if coalesce(current_setting('app.manutencao', true), '') = 'restauracao' then
    return null;
  end if;

  v_resp := app.responsavel_do_evento();

  -- Envio e reenvio
  if new.status = 'Pendente' and (tg_op = 'INSERT' or old.status is distinct from 'Pendente') then
    if tg_op = 'INSERT' and new.origem is distinct from 'portal' then
      return null;   -- inclusão por migração não é envio feito neste banco
    end if;
    v_enviada := tg_op = 'UPDATE' and (old.enviado_em is not null or coalesce(old.enviada_na_origem, false));
    v_rodada  := app.rodada_atual(new.id, v_enviada) + 1;
    insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, responsavel_id)
    values (new.id, case when v_rodada = 1 then 'ENVIO' else 'REENVIO' end, v_rodada, new.versao, new.status, new.nota, v_resp);
    return null;
  end if;

  if tg_op = 'INSERT' then
    return null;
  end if;

  v_rodada := greatest(app.rodada_atual(new.id, old.enviado_em is not null or coalesce(old.enviada_na_origem, false)), 1);

  -- Zeramento e afastamento de eliminatório (não mudam a situação)
  if not coalesce(old.zerada, false) and coalesce(new.zerada, false) then
    insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, criterios, responsavel_id)
    values (new.id, 'ZERAMENTO_CONFIRMADO', v_rodada, new.versao, new.status, new.nota,
            app.eliminatorios_ocorridos(new.id, new.regua_versao_id), v_resp);
  end if;
  if old.eliminatorio_afastado_em is null and new.eliminatorio_afastado_em is not null then
    insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes, criterios, responsavel_id)
    values (new.id, 'ELIMINATORIO_AFASTADO', v_rodada, new.versao, new.status, new.nota, new.eliminatorio_afastado_motivo,
            app.eliminatorios_ocorridos(new.id, new.regua_versao_id), v_resp);
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  v_tipo := case new.status
              when 'Validada'  then 'VALIDACAO'
              when 'Reprovada' then 'REPROVACAO'
              when 'Rascunho'  then 'DEVOLUCAO'
              when 'Cancelada' then 'CANCELAMENTO'
            end;
  if v_tipo is null then
    return null;
  end if;
  v_texto := case v_tipo
               when 'VALIDACAO'    then nullif(btrim(coalesce(current_setting('app.consideracoes', true), '')), '')
               when 'REPROVACAO'   then new.motivo_reprovacao
               when 'DEVOLUCAO'    then new.motivo_ajuste
               when 'CANCELAMENTO' then new.cancelado_motivo
             end;
  insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes, responsavel_id)
  values (new.id, v_tipo, v_rodada, new.versao, new.status, new.nota, v_texto, v_resp);
  return null;
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
  if char_length(btrim(p_motivo)) > 2000 then
    perform app.recusar('MI422', format('O motivo tem %s caracteres; o limite é 2.000.', char_length(btrim(p_motivo))));
  end if;
  update public.monitorias m
     set status = 'Rascunho', motivo_ajuste = btrim(p_motivo), revisado_por = app.meu_perfil_id(), revisado_em = now(),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

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
  v_relatorio text;  -- 17
  v_guardar  boolean := coalesce(p_dados ->> 'guardar', '') = 'true';   -- 19
  v_concluir boolean := p_enviar or coalesce(p_dados ->> 'guardar', '') = 'true';   -- 19: guardar passa pelas conferências do envio
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('MONITOR') then
    perform app.recusar('MI403', 'Somente uma conta MONITOR ativa registra monitorias.');
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    perform app.recusar('MI422', 'Dados da monitoria ausentes.');
  end if;
  if p_enviar and v_guardar then   -- 19
    perform app.recusar('MI422', 'Escolha entre guardar e enviar para validação.');
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
    -- 19: competência futura só na área privada, até 12 meses à frente; enviar, só depois de ela começar.
    if v_comp > to_char(app.hoje() + interval '12 months', 'YYYY-MM') then
      perform app.recusar('MI422', 'A preparação antecipada alcança no máximo 12 meses à frente.');
    end if;
    if p_enviar and v_comp > to_char(app.hoje(), 'YYYY-MM') then
      perform app.recusar('MI422', 'Esta competência ainda não começou. O envio para validação fica disponível a partir do primeiro dia dela.');
    end if;
  end if;
  if nullif(p_dados ->> 'colaboradorId', '') is not null
     and not exists (select 1 from public.colaboradores c where c.id = p_dados ->> 'colaboradorId') then
    perform app.recusar('MI422', 'Colaborador inexistente.');
  end if;
  perform app.conferir_respostas(null, null, v_scores, false);   -- forma
  v_relatorio := app.conferir_relatorio_completo(p_dados ->> 'relatorioCompleto');   -- 17

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
    if v_guardar and (v_m.enviado_em is not null or coalesce(v_m.enviada_na_origem, false)) then   -- 19
      perform app.recusar('MI403', 'Esta monitoria já foi enviada para validação. Depois de corrigida, ela é reenviada, não guardada.');
    end if;
  end if;

  if v_concluir then   -- 19
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
    -- 19: a conclusão anterior não vale mais; a nova conclusão decide a régua.
    v_versao := case when v_m.aguardando_liberacao then null else v_m.regua_versao_id end;
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
       zerada, enviado_em, chave_criacao, relatorio_completo, aguardando_liberacao, concluida_em)   -- 15, 17, 19
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
       case when v_concluir then v_versao end,
       case when v_concluir then v_nota end,
       case when v_concluir then v_nota end,
       case when v_concluir then v_marcado else false end,
       false,
       case when p_enviar then now() end,
       v_chave, v_relatorio, v_guardar, case when v_concluir then now() end);   -- 15, 17, 19
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
       relatorio_completo    = case when p_dados ? 'relatorioCompleto' then v_relatorio else m.relatorio_completo end,   -- 17
       status                = case when p_enviar then 'Pendente' else m.status end,
       -- 19: concluir fixa régua e nota; salvar uma guardada sem concluir invalida a conclusão.
       regua_versao_id       = case when v_concluir then v_versao when m.aguardando_liberacao then null else m.regua_versao_id end,
       nota                  = case when v_concluir then v_nota when m.aguardando_liberacao then null else m.nota end,
       nota_calculada        = case when v_concluir then v_nota when m.aguardando_liberacao then null else m.nota_calculada end,
       nota_historica        = case when v_concluir then v_hist else m.nota_historica end,
       eliminatorio_pendente = case when v_concluir then v_marcado when m.aguardando_liberacao then false else m.eliminatorio_pendente end,
       zerada                = case when p_enviar then false else m.zerada end,
       eliminatorio_confirmado_por  = case when p_enviar then null else m.eliminatorio_confirmado_por end,
       eliminatorio_confirmado_em   = case when p_enviar then null else m.eliminatorio_confirmado_em end,
       eliminatorio_afastado_por    = case when p_enviar then null else m.eliminatorio_afastado_por end,
       eliminatorio_afastado_em     = case when p_enviar then null else m.eliminatorio_afastado_em end,
       eliminatorio_afastado_motivo = case when p_enviar then null else m.eliminatorio_afastado_motivo end,
       enviado_em            = case when p_enviar then coalesce(m.enviado_em, now()) else m.enviado_em end,
       aguardando_liberacao  = v_guardar,   -- 19
       concluida_em          = case when v_concluir then now() when m.aguardando_liberacao then null else m.concluida_em end,   -- 19
       versao_lida           = p_versao_lida
     where m.id = v_id;
  end if;

  perform app.gravar_respostas(v_id, v_scores);
  perform app.gravar_lista(v_id, 'evidencias', p_dados -> 'evidencias');
  perform app.gravar_lista(v_id, 'links', p_dados -> 'links');

  return app.resultado_monitoria(v_id);
end;
$$;

do $conf$
declare
  v_d record;
begin
  select md5(coalesce(string_agg((to_jsonb(m) - 'status' - 'versao' - 'versao_lida' - 'atualizado_em' - 'atualizado_por')::text, '|' order by m.id), '')) mon,
           (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
           (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
           (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
           (select count(*) from public.auditoria) aud
      from public.monitorias m
    into v_d;
  if current_setting('app.r21r_mon') <> v_d.mon or current_setting('app.r21r_resp') <> v_d.resp
     or current_setting('app.r21r_evid') <> v_d.evid or current_setting('app.r21r_ev') <> v_d.ev then
    raise exception 'SCRIPT 21r: dados, respostas, evidências ou histórico mudaram — nada foi gravado.';
  end if;
  if v_d.aud <> current_setting('app.r21r_aud')::bigint + current_setting('app.r21r_n')::integer then
    raise exception 'SCRIPT 21r: a auditoria não registrou exatamente as reversões — nada foi gravado.';
  end if;
  if exists (select 1 from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q
                              from public.auditoria a) x where q) then
    raise exception 'SCRIPT 21r: a cadeia da auditoria acusou quebra — nada foi gravado.';
  end if;
  if position('-- 21' in pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)) > 0
     or position('-- 19' in pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)) = 0
     or position('-- 21' in pg_get_functiondef('api.devolver_monitoria(text, integer, text)'::regprocedure)) > 0
     or position('-- 21' in pg_get_functiondef('app.tg_monitoria_eventos()'::regprocedure)) > 0 then
    raise exception 'SCRIPT 21r: alguma função não voltou à versão anterior.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)
     or has_function_privilege('anon', 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'api.devolver_monitoria(text, integer, text)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.devolver_monitoria(text, integer, text)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 21r: as funções perderam a segurança ou as permissões.';
  end if;
end;
$conf$;

delete from app.versoes_esquema where versao = '21';

commit;
