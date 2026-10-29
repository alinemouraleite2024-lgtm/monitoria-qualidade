-- =============================================================================
-- MonitorIA · Script 16r — REVERSÃO do script 16
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Usar só se uma verificação depois do 16 falhar ou se a regra atrapalhar o uso.
-- Ensaiado no Postgres local (supabase/testes/testes-16-colaboradora-inativa.mjs).
--
-- O QUE FAZ: remove o gatilho e a função do 16 e retira a versão '16' do registro. O banco volta
-- a aceitar monitoria nova para colaboradora inativa (comportamento até o 15).
-- O QUE NÃO FAZ: não altera monitoria, colaboradora nem auditoria. Independe do 15 e do 15r.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '16') then
    raise exception 'SCRIPT 16r RECUSADO: o script 16 não está instalado.' using errcode = 'MI403';
  end if;
end;
$pre$;

drop trigger if exists monitorias_b_colaborador_ativo on public.monitorias;
drop function if exists app.tg_monitorias_colaborador_ativo();

do $conf$
begin
  if exists (select 1 from pg_trigger where tgname = 'monitorias_b_colaborador_ativo')
     or to_regprocedure('app.tg_monitorias_colaborador_ativo()') is not null then
    raise exception 'SCRIPT 16r: o gatilho ou a função do 16 continuam existindo.';
  end if;
end;
$conf$;

delete from app.versoes_esquema where versao = '16';

commit;
