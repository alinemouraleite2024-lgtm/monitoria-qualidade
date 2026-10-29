-- =============================================================================
-- MonitorIA · Script 15b — cancelamento das 5 cópias criadas em dobro (homologação)
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Só depois do script 15, de um backup novo e da conferencia-15.sql. Ensaiado no Postgres local
-- (supabase/testes/testes-15-implantacao.mjs), numa réplica com a mesma numeração.
--
-- O QUE FAZ: cancela, uma a uma, as 5 CÓPIAS identificadas em 29/10/2026, mantendo a primeira
-- de cada par. Cada cancelamento passa pela regra do 15 (app.cancelar_duplicata): só cancela se
-- a cópia e a original forem da mesma monitora, do mesmo atendimento e tiverem as mesmas
-- respostas, e se a cópia estiver Pendente ou Rascunho. Motivo padrão, referência à original,
-- evento "Cancelada" no histórico e registro na auditoria com o ADMIN responsável declarado.
--
-- O QUE NÃO FAZ: não apaga nada; não mexe nas originais, nas respostas, nas evidências nem no
-- histórico já gravado; não toca na MON-10004/10005 (o gestor já resolveu: validou e reprovou).
--
-- TRAVAS: tudo numa transação. Se qualquer cópia não estiver como esperado (situação, mesma
-- versão, mesmo atendimento, mesmas respostas), ou se o resultado não for EXATAMENTE 5 canceladas
-- por duplicidade, nada é gravado.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $cancelar$
declare
  -- cópia → original (a original é sempre a primeira criada do par)
  v_pares text[][] := array[
    ['MON-10008', 'MON-10007'],
    ['MON-10012', 'MON-10011'],
    ['MON-10014', 'MON-10013'],
    ['MON-10017', 'MON-10016'],
    ['MON-10019', 'MON-10018']];
  v_i      integer;
  v_c      public.monitorias;
  v_antes  integer;
  v_feitas integer;
begin
  if not exists (select 1 from app.versoes_esquema where versao = '15') then
    raise exception '15b RECUSADO: o script 15 precisa estar instalado.' using errcode = 'MI403';
  end if;
  select count(*) into v_antes from public.monitorias where duplicata_de is not null;
  if v_antes <> 0 then
    raise exception '15b RECUSADO: já existem % cancelamentos por duplicidade — este script roda uma única vez.', v_antes using errcode = 'MI403';
  end if;

  for v_i in 1 .. array_length(v_pares, 1) loop
    select * into v_c from public.monitorias where id = v_pares[v_i][1];
    if not found or v_c.status <> 'Pendente' then
      raise exception '15b RECUSADO: % deveria estar Pendente (está %).', v_pares[v_i][1], coalesce(v_c.status, 'inexistente') using errcode = 'MI403';
    end if;
    -- A regra completa (mesmo atendimento, mesmas respostas, ADMIN responsável) é a do 15.
    perform app.cancelar_duplicata(v_c.id, v_c.versao, v_pares[v_i][2], current_setting('app.responsavel'));
  end loop;

  select count(*) into v_feitas from public.monitorias where duplicata_de is not null and status = 'Cancelada';
  if v_feitas <> 5 then
    raise exception '15b: % cancelamentos em vez de exatamente 5 — nada foi gravado.', v_feitas;
  end if;
  if exists (select 1 from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q
                              from public.auditoria a) x where q) then
    raise exception '15b: a cadeia da auditoria acusou quebra — nada foi gravado.';
  end if;
end;
$cancelar$;

commit;
