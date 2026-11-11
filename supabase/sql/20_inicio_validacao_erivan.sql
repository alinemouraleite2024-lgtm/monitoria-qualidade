-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 20 — Competência inicial de validação do Erivan
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Ensaiado no Postgres local (supabase/testes/testes-20-dados-reais.mjs). Reversão: 20r_reverter_inicio_validacao_erivan.sql.
--
-- O QUE FAZ: só dados. Na configuração geral (configuracoes, chave 'settings'), grava
--   validacaoDesdePorGestor[usr-1791895673216] = '2026-10'. O portal passa a tirar da fila e dos
--   contadores do Erivan as pendentes de competência anterior a outubro/2026.
-- O QUE NÃO FAZ: não toca em nenhuma monitoria, nota, situação, histórico, permissão ou regra de
--   privacidade; não muda a estrutura do banco; não muda as demais configurações.
-- A alteração fica na auditoria, com o responsável declarado. Tudo numa transação.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $pre$
declare
  v_cfg public.configuracoes;
begin
  if not exists (select 1 from public.perfis p where p.id = 'usr-1791895673216' and 'GESTOR' = any (p.perfis) and p.status = 'ACTIVE') then
    raise exception 'SCRIPT 20 RECUSADO: o perfil usr-1791895673216 não é um GESTOR ativo.' using errcode = 'MI403';
  end if;
  if not exists (select 1 from public.areas a where a.ativo and a.gestor_id = 'usr-1791895673216') then
    raise exception 'SCRIPT 20 RECUSADO: o perfil não supervisiona nenhuma área ativa.' using errcode = 'MI403';
  end if;
  select * into v_cfg from public.configuracoes where chave = 'settings';
  if not found or jsonb_typeof(v_cfg.valor) <> 'object' then
    raise exception 'SCRIPT 20 RECUSADO: a configuração geral (settings) não existe.' using errcode = 'MI403';
  end if;
  if v_cfg.valor -> 'validacaoDesdePorGestor' ? 'usr-1791895673216' then
    raise exception 'SCRIPT 20 RECUSADO: a competência inicial deste supervisor já está configurada (%).',
      v_cfg.valor -> 'validacaoDesdePorGestor' ->> 'usr-1791895673216' using errcode = 'MI403';
  end if;
  -- impressão do restante da configuração, para conferir que nada mais mudou
  perform set_config('app.cfg20_resto', md5((v_cfg.valor - 'validacaoDesdePorGestor')::text), true);
  perform set_config('app.cfg20_outros', coalesce((v_cfg.valor -> 'validacaoDesdePorGestor')::text, '{}'), true);
end;
$pre$;

update public.configuracoes
   set valor = jsonb_set(valor, '{validacaoDesdePorGestor}',
                         coalesce(valor -> 'validacaoDesdePorGestor', '{}'::jsonb) || jsonb_build_object('usr-1791895673216', '2026-10'))
 where chave = 'settings';

do $pos$
declare
  v_cfg public.configuracoes;
begin
  select * into v_cfg from public.configuracoes where chave = 'settings';
  if v_cfg.valor -> 'validacaoDesdePorGestor' ->> 'usr-1791895673216' is distinct from '2026-10' then
    raise exception 'SCRIPT 20: o valor não ficou gravado.';
  end if;
  if md5((v_cfg.valor - 'validacaoDesdePorGestor')::text) <> current_setting('app.cfg20_resto')
     or ((v_cfg.valor -> 'validacaoDesdePorGestor') - 'usr-1791895673216')::text <> current_setting('app.cfg20_outros') then
    raise exception 'SCRIPT 20: outra parte da configuração mudou.';
  end if;
end;
$pos$;

commit;
