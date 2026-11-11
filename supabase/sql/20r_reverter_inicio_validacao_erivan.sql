-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 20r — REVERSÃO do script 20
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- O QUE FAZ: retira a competência inicial de validação do Erivan da configuração geral. O portal volta
--   a mostrar a ele todas as pendentes da equipe. Não toca em monitoria nenhuma nem nas demais
--   configurações. Tudo numa transação.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $pre$
declare
  v_cfg public.configuracoes;
begin
  select * into v_cfg from public.configuracoes where chave = 'settings';
  if not found or not coalesce(v_cfg.valor -> 'validacaoDesdePorGestor' ? 'usr-1791895673216', false) then
    raise exception 'SCRIPT 20r RECUSADO: não há competência inicial configurada para este supervisor.' using errcode = 'MI403';
  end if;
  perform set_config('app.cfg20_resto', md5((v_cfg.valor - 'validacaoDesdePorGestor')::text), true);
end;
$pre$;

update public.configuracoes
   set valor = case
                 when (valor -> 'validacaoDesdePorGestor') - 'usr-1791895673216' = '{}'::jsonb then valor - 'validacaoDesdePorGestor'
                 else jsonb_set(valor, '{validacaoDesdePorGestor}', (valor -> 'validacaoDesdePorGestor') - 'usr-1791895673216')
               end
 where chave = 'settings';

do $pos$
declare
  v_cfg public.configuracoes;
begin
  select * into v_cfg from public.configuracoes where chave = 'settings';
  if coalesce(v_cfg.valor -> 'validacaoDesdePorGestor' ? 'usr-1791895673216', false)
     or md5((v_cfg.valor - 'validacaoDesdePorGestor')::text) <> current_setting('app.cfg20_resto') then
    raise exception 'SCRIPT 20r: a reversão ficou incompleta ou mudou outra parte da configuração.';
  end if;
end;
$pos$;

commit;
