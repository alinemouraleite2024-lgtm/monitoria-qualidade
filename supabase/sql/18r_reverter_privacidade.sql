-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 18r — REVERSÃO do script 18
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Ensaiado no Postgres local (supabase/testes/testes-18-privacidade.mjs).
--
-- O QUE FAZ: devolve a regra de leitura ao texto do script 07, app.monitoria_para_gestor ao do 08 e
-- api.registrar_observacao ao do 14, remove app.monitoria_privada e retira a versão '18' do registro.
-- EFEITO: o supervisor volta a enxergar os rascunhos da equipe.
-- O QUE NÃO FAZ: não grava em nenhuma monitoria, resposta, evidência, histórico ou auditoria.
-- Tudo numa transação: se qualquer passo falhar, nada fica pela metade.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '18') then
    raise exception 'SCRIPT 18r RECUSADO: o script 18 não está instalado.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- Regra de leitura como no script 07
drop policy if exists monitorias_ler on public.monitorias;
create policy monitorias_ler on public.monitorias for select to authenticated using (
  (select app.sou_admin())
  or ((select app.tem_perfil('MONITOR'))
      and (monitor_id = (select app.meu_perfil_id()) or registrado_por = (select app.meu_perfil_id())))
  or ((select app.tem_perfil('GESTOR'))
      and (monitor_id in (select unnest(app.equipe_do_gestor()))
           or registrado_por = (select app.meu_perfil_id())
           or retroativo_por = (select app.meu_perfil_id())))
);

-- app.monitoria_para_gestor como no script 08
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

-- api.registrar_observacao como no script 14
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
  if not found or not (v_m.monitor_id = any (app.equipe_do_gestor())) then
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

drop function app.monitoria_privada(text, timestamptz, boolean);

do $conf$
begin
  if to_regprocedure('app.monitoria_privada(text, timestamptz, boolean)') is not null
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monitorias' and policyname = 'monitorias_ler'
                 and qual like '%monitoria_privada%')
     or position('-- 18' in pg_get_functiondef('app.monitoria_para_gestor(text, integer)'::regprocedure)) > 0
     or position('-- 18' in pg_get_functiondef('api.registrar_observacao(text, text, uuid)'::regprocedure)) > 0 then
    raise exception 'SCRIPT 18r: a reversão ficou incompleta.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monitorias' and policyname = 'monitorias_ler') then
    raise exception 'SCRIPT 18r: a tabela de monitorias ficou sem regra de leitura.';
  end if;
  if not (select prosecdef from pg_proc where oid = 'api.registrar_observacao(text, text, uuid)'::regprocedure)
     or has_function_privilege('anon', 'api.registrar_observacao(text, text, uuid)'::regprocedure, 'execute')
     or not has_function_privilege('authenticated', 'api.registrar_observacao(text, text, uuid)'::regprocedure, 'execute') then
    raise exception 'SCRIPT 18r: api.registrar_observacao perdeu a segurança ou as permissões.';
  end if;
end;
$conf$;

delete from app.versoes_esquema where versao = '18';

commit;
