-- =============================================================================
-- MonitorIA · Script 15c — encerramento dos testes do 15: cancela os 4 rascunhos fictícios
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Ensaiado no Postgres local (supabase/testes/testes-15c-encerramento.mjs). Procedimento SEPARADO
-- do 15b (que trata as duplicidades reais): não depende dele e não o substitui.
--
-- O QUE FAZ: cancela MON-10020, 10021, 10022 e 10023 — os rascunhos criados na validação V1–V8 do
-- script 15 no Preview (29/10/2026), da colaboradora fictícia `col-teste-homolog-1`, título
-- TESTE15. Mesmo efeito do cancelamento do portal (api.cancelar_monitoria): situação Cancelada,
-- motivo, quem cancelou e quando; o gatilho do 14 grava o evento "Cancelada" no histórico e a
-- auditoria registra o ADMIN responsável declarado.
--
-- O QUE NÃO FAZ: não apaga nada (as 4 continuam consultáveis, com respostas e histórico); não
-- toca em nenhuma outra monitoria; não desativa a colaboradora (isso é o 11b, depois deste).
--
-- TRAVAS: uma transação. Cada uma das 4 precisa estar exatamente como foi criada nos testes
-- (Rascunho, colaboradora fictícia, título TESTE15, o nº do atendimento do teste, criada pela
-- monitora usr-1). Se o resultado não for exatamente 4 canceladas, se outra monitoria mudar de
-- situação, ou se a auditoria acusar quebra, nada é gravado. Roda uma vez: depois, recusa.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $cancelar$
declare
  -- monitoria → nº do atendimento do teste (identificação conferida antes de cancelar)
  v_alvos text[][] := array[
    ['MON-10020', 'TESTE15-V1', 'V1'],
    ['MON-10021', 'TESTE15-V4', 'V4'],
    ['MON-10022', 'TESTE15-V5', 'V5'],
    ['MON-10023', 'TESTE15-V6-B', 'V6']];
  v_i       integer;
  v_m       public.monitorias;
  v_outras  text;
  v_depois  text;
  v_feitas  integer;
begin
  if not exists (select 1 from public.colaboradores
                  where id = 'col-teste-homolog-1' and coalesce((extras ->> 'ficticio')::boolean, false)) then
    raise exception '15c RECUSADO: a colaboradora fictícia col-teste-homolog-1 não existe.' using errcode = 'MI404';
  end if;
  if exists (select 1 from public.monitorias where id = any (array['MON-10020', 'MON-10021', 'MON-10022', 'MON-10023'])
                and status = 'Cancelada') then
    raise exception '15c RECUSADO: há rascunho fictício já cancelado — este script roda uma única vez.' using errcode = 'MI403';
  end if;

  -- Situação de todas as OUTRAS monitorias, para provar no fim que nenhuma mudou.
  select string_agg(id || '=' || status || '/' || versao, ',' order by id) into v_outras
    from public.monitorias where not (id = any (array['MON-10020', 'MON-10021', 'MON-10022', 'MON-10023']));

  for v_i in 1 .. array_length(v_alvos, 1) loop
    select * into v_m from public.monitorias where id = v_alvos[v_i][1];
    if not found or v_m.status <> 'Rascunho' or v_m.colaborador_id <> 'col-teste-homolog-1'
       or coalesce(v_m.numero_titulo, '') <> 'TESTE15' or coalesce(v_m.numero_atendimento, '') <> v_alvos[v_i][2]
       or v_m.monitor_id <> 'usr-1' then
      raise exception '15c RECUSADO: % não está como foi criada no teste % (situação %, colaboradora %, título %, nº %).',
        v_alvos[v_i][1], v_alvos[v_i][3], coalesce(v_m.status, 'inexistente'), v_m.colaborador_id, v_m.numero_titulo, v_m.numero_atendimento
        using errcode = 'MI403';
    end if;
    update public.monitorias m
       set status = 'Cancelada', cancelado_por = current_setting('app.responsavel'), cancelado_em = now(),
           cancelado_motivo = format('Registro fictício da validação do script 15 (%s) — 29/10/2026. Encerramento dos testes.', v_alvos[v_i][3]),
           versao_lida = v_m.versao
     where m.id = v_m.id;
  end loop;

  select count(*) into v_feitas from public.monitorias
   where id = any (array['MON-10020', 'MON-10021', 'MON-10022', 'MON-10023']) and status = 'Cancelada';
  if v_feitas <> 4 then
    raise exception '15c: % cancelamentos em vez de exatamente 4 — nada foi gravado.', v_feitas;
  end if;
  select string_agg(id || '=' || status || '/' || versao, ',' order by id) into v_depois
    from public.monitorias where not (id = any (array['MON-10020', 'MON-10021', 'MON-10022', 'MON-10023']));
  if v_depois is distinct from v_outras then
    raise exception '15c: outra monitoria mudou durante o cancelamento — nada foi gravado.';
  end if;
  if exists (select 1 from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q
                              from public.auditoria a) x where q) then
    raise exception '15c: a cadeia da auditoria acusou quebra — nada foi gravado.';
  end if;
end;
$cancelar$;

commit;
