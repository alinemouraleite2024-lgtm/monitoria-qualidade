-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 18 — Privacidade das monitorias nunca enviadas
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Desenvolvido e testado só no Postgres local (supabase/testes/testes-18-privacidade.mjs e
-- testes-18-dados-reais.mjs). Pré-requisito: script 17. Reversão: 18r_reverter_privacidade.sql.
-- Conferência antes e depois: conferencia-18.sql.
--
-- A REGRA
--   É privada a monitoria que NUNCA foi disponibilizada para validação: em Rascunho ou Cancelada,
--   sem data de envio e sem envio registrado no portal antigo. O perfil de supervisor não a alcança
--   por nenhum caminho. Enviada alguma vez, continua visível como sempre, inclusive se devolvida.
--
-- O QUE FAZ
--   - app.monitoria_privada: a regra, num lugar só;
--   - regra de leitura de monitorias: o ramo do supervisor deixa de alcançar as privadas. Respostas,
--     evidências e histórico dependem da leitura da monitoria e seguem sozinhos;
--   - app.monitoria_para_gestor e api.registrar_observacao: para o supervisor, a monitoria privada
--     é "não encontrada", com a mesma resposta de um código que não existe.
--
-- O QUE NÃO FAZ
--   - não grava em nenhuma linha: sem mudança de versão, sem registro novo na auditoria;
--   - não muda coluna, nota, critério, relatório, importador JSON nem o portal;
--   - não muda o acesso da monitora nem o do Administrador (com MFA, nem o SQL Editor e o backup).
--
-- RECUSA se alguma monitoria com ENVIO ou REENVIO no histórico fosse ficar privada: isso significaria
-- esconder do supervisor algo que ele já recebeu.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '17') then
    raise exception 'SCRIPT 18 RECUSADO: o script 17 precisa estar instalado.' using errcode = 'MI403';
  end if;
  if exists (select 1 from app.versoes_esquema where versao = '18') then
    raise exception 'SCRIPT 18 RECUSADO: já instalado.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- 1. A regra --------------------------------------------------------------------------------
create or replace function app.monitoria_privada(p_status text, p_enviado_em timestamptz, p_enviada_na_origem boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_status, 'Rascunho') in ('Rascunho', 'Cancelada')
     and p_enviado_em is null
     and not coalesce(p_enviada_na_origem, false);
$$;
comment on function app.monitoria_privada(text, timestamptz, boolean) is
  'Monitoria que nunca foi disponibilizada para validação: não alcança o perfil de supervisor (script 18).';
-- Recebe só valores e devolve verdadeiro ou falso: não lê tabela nenhuma.
revoke all on function app.monitoria_privada(text, timestamptz, boolean) from public, anon;
grant execute on function app.monitoria_privada(text, timestamptz, boolean) to authenticated;

do $guarda$
declare
  v_lista text;
begin
  select string_agg(m.id, ', ' order by m.id) into v_lista
    from public.monitorias m
   where app.monitoria_privada(m.status, m.enviado_em, m.enviada_na_origem)
     and exists (select 1 from public.monitoria_eventos e where e.monitoria_id = m.id and e.tipo in ('ENVIO', 'REENVIO'));
  if v_lista is not null then
    raise exception 'SCRIPT 18 RECUSADO: monitorias com envio no histórico ficariam privadas: %.', v_lista using errcode = 'MI403';
  end if;
end;
$guarda$;

-- 2. Regra de leitura -----------------------------------------------------------------------
drop policy if exists monitorias_ler on public.monitorias;
create policy monitorias_ler on public.monitorias for select to authenticated using (
  (select app.sou_admin())
  or ((select app.tem_perfil('MONITOR'))
      and (monitor_id = (select app.meu_perfil_id()) or registrado_por = (select app.meu_perfil_id())))
  or ((select app.tem_perfil('GESTOR'))
      and ((monitor_id in (select unnest(app.equipe_do_gestor()))
            and not app.monitoria_privada(status, enviado_em, enviada_na_origem))
           or registrado_por = (select app.meu_perfil_id())
           or retroativo_por = (select app.meu_perfil_id())))
);

-- 3. Decisões do supervisor: igual à do 08, com a diferença marcada "-- 18" -------------------
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
  if not found or not (v_m.monitor_id = any (app.equipe_do_gestor()))
     or app.monitoria_privada(v_m.status, v_m.enviado_em, v_m.enviada_na_origem) then   -- 18
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

-- 4. Observação complementar: igual à do 14, com a diferença marcada "-- 18" ------------------
create or replace function api.registrar_observacao(p_id text, p_texto text, p_chave uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu    text := app.meu_perfil_id();
  v_m     public.monitorias;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_ev    public.monitoria_eventos;
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('GESTOR') then
    perform app.recusar('MI403', 'Somente um Gestor ativo registra observações.');
  end if;
  select * into v_m from public.monitorias m where m.id = p_id;
  if not found or not (v_m.monitor_id = any (app.equipe_do_gestor()))
     or app.monitoria_privada(v_m.status, v_m.enviado_em, v_m.enviada_na_origem) then   -- 18
    perform app.recusar('MI404', 'Monitoria não encontrada na sua equipe.');
  end if;
  if v_m.monitor_id = v_eu or v_m.registrado_por = v_eu then
    perform app.recusar('MI403', 'Você avaliou ou registrou esta monitoria.');
  end if;
  if p_chave is null then
    perform app.recusar('MI428', 'Informe a chave da requisição.');
  end if;
  if v_texto is null then
    perform app.recusar('MI422', 'Escreva a observação.');
  end if;
  if char_length(v_texto) > 2000 then
    perform app.recusar('MI422', format('A observação tem %s caracteres; o limite é 2.000.', char_length(v_texto)));
  end if;
  if v_m.enviado_em is null and not coalesce(v_m.enviada_na_origem, false)
     and not exists (select 1 from public.monitoria_eventos e where e.monitoria_id = p_id) then
    perform app.recusar('MI403', 'A monitoria ainda não foi enviada para validação.');
  end if;

  insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes,
                                        responsavel_id, chave_requisicao)
  values (p_id, 'OBSERVACAO', greatest(app.rodada_atual(p_id, v_m.enviado_em is not null or coalesce(v_m.enviada_na_origem, false)), 1),
          null, v_m.status, v_m.nota, v_texto, v_eu, p_chave)
  on conflict (monitoria_id, chave_requisicao) do nothing
  returning * into v_ev;
  if v_ev.id is null then   -- repetição da mesma requisição: devolve o que já está gravado
    select * into v_ev from public.monitoria_eventos e where e.monitoria_id = p_id and e.chave_requisicao = p_chave;
    if v_ev.consideracoes is distinct from v_texto or v_ev.responsavel_id is distinct from v_eu then
      perform app.recusar('MI409', 'Esta chave de requisição já foi usada com outro conteúdo.');
    end if;
  end if;
  return to_jsonb(v_ev);
end;
$$;

-- Conferência ---------------------------------------------------------------------------------
do $conf$
declare
  v_f text;
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monitorias' and policyname = 'monitorias_ler'
                  and qual like '%monitoria_privada%') then
    raise exception 'SCRIPT 18: a regra de leitura não foi atualizada.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.monitorias'::regclass) then
    raise exception 'SCRIPT 18: a tabela de monitorias está sem regra de leitura ativa.';
  end if;
  foreach v_f in array array['app.monitoria_para_gestor(text, integer)', 'api.registrar_observacao(text, text, uuid)'] loop
    if position('-- 18' in pg_get_functiondef(v_f::regprocedure)) = 0 then
      raise exception 'SCRIPT 18: % não foi atualizada.', v_f;
    end if;
  end loop;
  if not (select prosecdef from pg_proc where oid = 'api.registrar_observacao(text, text, uuid)'::regprocedure)
     or has_function_privilege('anon', 'api.registrar_observacao(text, text, uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.registrar_observacao(text, text, uuid)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 18: api.registrar_observacao perdeu a segurança ou as permissões.';
  end if;
  if has_function_privilege('anon', 'app.monitoria_privada(text, timestamptz, boolean)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'app.monitoria_privada(text, timestamptz, boolean)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 18: permissões erradas em app.monitoria_privada.';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('18', 'Privacidade: monitoria nunca enviada não alcança o perfil de supervisor; nenhuma linha alterada')
on conflict (versao) do nothing;

commit;
