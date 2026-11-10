-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 19 — Concluir e guardar; enviar para validação
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Desenvolvido e testado só no Postgres local (supabase/testes/testes-19-concluir-liberar.mjs e
-- testes-19-dados-reais.mjs). Pré-requisito: script 18. Reversão: 19r_reverter_concluir_liberar.sql.
-- Conferência antes e depois: conferencia-19.sql.
-- Executar ANTES de publicar o portal novo: com o banco antigo, "guardar" viraria um rascunho comum.
--
-- O QUE FAZ
--   - colunas aguardando_liberacao e concluida_em;
--   - api.salvar_monitoria: igual à do 17, com as diferenças marcadas "-- 19". "guardar" passa pelas
--     conferências do envio e fixa régua e nota, sem enviar. Salvar uma guardada sem concluir
--     invalida a conclusão: volta a rascunho comum, com todo o preenchimento preservado;
--   - competência futura: aceita só na área privada, até 12 meses à frente;
--   - api.liberar_monitorias: envia uma ou várias, tudo ou nada, só para a monitora responsável.
--
-- O QUE NÃO FAZ
--   - não grava em nenhuma linha existente: toda monitoria fica sem marca e sem data de conclusão;
--   - não muda critério, peso, cálculo, relatório, importador JSON nem a regra de privacidade do 18.
--     A guardada nunca foi enviada, logo já é privada para o supervisor.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '18') then
    raise exception 'SCRIPT 19 RECUSADO: o script 18 precisa estar instalado.' using errcode = 'MI403';
  end if;
  if exists (select 1 from app.versoes_esquema where versao = '19') then
    raise exception 'SCRIPT 19 RECUSADO: já instalado.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- 1. Colunas ---------------------------------------------------------------------------------
alter table public.monitorias add column aguardando_liberacao boolean not null default false;
alter table public.monitorias add column concluida_em timestamptz;
alter table public.monitorias add constraint monitorias_guardada_coerente check (
  not aguardando_liberacao
  or (status = 'Rascunho' and concluida_em is not null and enviado_em is null and not coalesce(enviada_na_origem, false))
);
comment on column public.monitorias.aguardando_liberacao is
  'Concluída e guardada na área privada da monitora, ainda não disponibilizada para validação (script 19).';
comment on column public.monitorias.concluida_em is
  'Última conclusão válida. Nulo em monitorias anteriores ao script 19. A disponibilização é enviado_em.';

-- 2. Saiu de Rascunho, deixa de estar guardada (ex.: cancelamento pelo Administrador) -----------
create or replace function app.tg_monitorias_guarda()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from 'Rascunho' then
    new.aguardando_liberacao := false;
  end if;
  return new;
end;
$$;
revoke execute on function app.tg_monitorias_guarda() from public;
create or replace trigger monitorias_a_guarda
  before insert or update on public.monitorias
  for each row execute function app.tg_monitorias_guarda();

-- 3. api.salvar_monitoria: igual à do 17, com as diferenças marcadas "-- 19" -------------------
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

-- 4. Enviar para validação --------------------------------------------------------------------
-- p_itens: [{"id": "MON-1", "versao": 3}, ...]. Tudo ou nada: confere todas antes de gravar qualquer
-- uma. A já enviada é só informada, para que repetir o pedido não dê erro nem gere novo envio.
create or replace function api.liberar_monitorias(p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu        text := app.meu_perfil_id();
  v_id        text;
  v_versao    integer;
  v_m         public.monitorias;
  v_retrato   jsonb;
  v_scores    jsonb;
  v_problemas text[] := '{}';
  v_ja        text[] := '{}';
  v_ok        text[] := '{}';
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('MONITOR') then
    perform app.recusar('MI403', 'Somente uma conta MONITOR ativa envia monitorias para validação.');
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    perform app.recusar('MI422', 'Selecione ao menos uma monitoria.');
  end if;
  if jsonb_array_length(p_itens) > 100 then
    perform app.recusar('MI422', 'Envie no máximo 100 monitorias por vez.');
  end if;
  if (select count(distinct i ->> 'id') from jsonb_array_elements(p_itens) i) <> jsonb_array_length(p_itens)
     or exists (select 1 from jsonb_array_elements(p_itens) i where nullif(btrim(coalesce(i ->> 'id', '')), '') is null) then
    perform app.recusar('MI422', 'A lista de monitorias tem código vazio ou repetido.');
  end if;

  -- Sempre na mesma ordem, para dois pedidos simultâneos não se travarem.
  for v_id, v_versao in
    select i ->> 'id', case when i ->> 'versao' ~ '^[0-9]+$' then (i ->> 'versao')::integer end
      from jsonb_array_elements(p_itens) i order by 1
  loop
    select * into v_m from public.monitorias m where m.id = v_id for update;
    if not found or v_m.monitor_id is distinct from v_eu then
      v_problemas := array_append(v_problemas, format('%s: não encontrada entre as suas', v_id));
      continue;
    end if;
    if not v_m.aguardando_liberacao then
      if coalesce(v_m.status, 'Rascunho') not in ('Rascunho', 'Cancelada') then
        v_ja := array_append(v_ja, v_id);
      else
        v_problemas := array_append(v_problemas, format('%s: não está guardada', v_id));
      end if;
      continue;
    end if;
    if v_versao is null or v_versao <> v_m.versao then
      v_problemas := array_append(v_problemas, format('%s: foi alterada depois que a lista foi aberta', v_id));
      continue;
    end if;
    if v_m.competencia > to_char(app.hoje(), 'YYYY-MM') then
      v_problemas := array_append(v_problemas, format('%s: a competência ainda não começou', v_id));
      continue;
    end if;
    select r.retrato into v_retrato from public.regua_versoes r where r.id = v_m.regua_versao_id;
    select coalesce(jsonb_agg(jsonb_build_object('criterionId', x.criterio_id, 'score', x.resposta, 'subRespostas', x.sub_respostas) order by x.ordem), '[]'::jsonb)
      into v_scores from public.monitoria_respostas x where x.monitoria_id = v_id and x.ativo;
    if v_retrato is null or v_m.nota is null or abs(app.calcular_nota(v_retrato, v_m.canal, v_scores) - v_m.nota) > 0.01 then
      v_problemas := array_append(v_problemas, format('%s: a nota fixada não confere; conclua novamente', v_id));
      continue;
    end if;
    v_ok := array_append(v_ok, v_id);
  end loop;

  if cardinality(v_problemas) > 0 then
    perform app.recusar('MI422', 'Nenhuma monitoria foi enviada. ' || array_to_string(v_problemas, '; ') || '.');
  end if;

  update public.monitorias m
     set status = 'Pendente', aguardando_liberacao = false, enviado_em = coalesce(m.enviado_em, now()),
         versao_lida = (select (i ->> 'versao')::integer from jsonb_array_elements(p_itens) i where i ->> 'id' = m.id)
   where m.id = any (v_ok);

  return jsonb_build_object('liberadas', to_jsonb(v_ok), 'ja_enviadas', to_jsonb(v_ja));
end;
$$;
revoke all on function api.liberar_monitorias(jsonb) from public, anon;
grant execute on function api.liberar_monitorias(jsonb) to authenticated;

-- Conferência ---------------------------------------------------------------------------------
do $conf$
begin
  if position('-- 19' in pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)) = 0 then
    raise exception 'SCRIPT 19: api.salvar_monitoria não foi atualizada.';
  end if;
  if position('-- 17' in pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)) = 0 then
    raise exception 'SCRIPT 19: api.salvar_monitoria perdeu o relatório completo.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure)
     or not (select prosecdef from pg_proc where oid = 'api.liberar_monitorias(jsonb)'::regprocedure)
     or has_function_privilege('anon', 'api.liberar_monitorias(jsonb)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.liberar_monitorias(jsonb)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 19: as funções perderam a segurança ou as permissões.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monitorias' and policyname = 'monitorias_ler' and qual like '%monitoria_privada%') then
    raise exception 'SCRIPT 19: a privacidade do script 18 não está ativa.';
  end if;
  if exists (select 1 from public.monitorias where aguardando_liberacao or concluida_em is not null) then
    raise exception 'SCRIPT 19: alguma monitoria mudou na instalação.';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('19', 'Concluir e guardar, competência futura na área privada e envio para validação individual ou em lote')
on conflict (versao) do nothing;

commit;
