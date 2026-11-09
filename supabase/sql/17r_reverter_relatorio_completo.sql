-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 17r — REVERSÃO do script 17
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Ensaiado no Postgres local (supabase/testes/testes-17-relatorio-completo.mjs).
-- Republicar antes o portal anterior: o portal novo com o banco antigo perderia o relatório.
--
-- O QUE FAZ: devolve api.salvar_monitoria à versão do script 15 (texto copiado), remove a função
-- de conferência e a coluna, e retira a versão '17' do registro.
-- O QUE NÃO FAZ: não altera nota, resposta, situação, histórico nem auditoria.
-- RECUSA se alguma monitoria já tiver relatório completo: retirar a coluna apagaria esse conteúdo,
-- e isso exige decisão à parte, com backup. A auditoria guarda o que foi gravado.
-- Tudo numa transação: se qualquer passo falhar, nada fica pela metade.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '17') then
    raise exception 'SCRIPT 17r RECUSADO: o script 17 não está instalado.' using errcode = 'MI403';
  end if;
  if exists (select 1 from public.monitorias where relatorio_completo is not null) then
    raise exception 'SCRIPT 17r RECUSADO: há monitorias com relatório completo. Retirar a coluna apagaria esse conteúdo.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- api.salvar_monitoria como no script 15
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

drop function if exists app.conferir_relatorio_completo(text);
alter table public.monitorias drop constraint if exists monitorias_relatorio_completo_tamanho;
alter table public.monitorias drop column if exists relatorio_completo;

do $conf$
begin
  if position('-- 17' in pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)) > 0
     or to_regprocedure('app.conferir_relatorio_completo(text)') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monitorias' and column_name = 'relatorio_completo') then
    raise exception 'SCRIPT 17r: a reversão ficou incompleta.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)
     or has_function_privilege('anon', 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 17r: api.salvar_monitoria perdeu a segurança ou as permissões.';
  end if;
end;
$conf$;

delete from app.versoes_esquema where versao = '17';

commit;
