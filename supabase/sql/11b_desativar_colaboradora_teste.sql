-- =============================================================================
-- MonitorIA · Script 11b — desativa a colaboradora FICTÍCIA do teste de homologação
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Ensaiado no Postgres local (supabase/testes/testes-15c-encerramento.mjs). Roda DEPOIS do 15c.
--
-- O QUE FAZ: marca `col-teste-homolog-1` ("TESTE HOMOLOGAÇÃO — FICTÍCIO", script 11a) como
-- inativa. Ela sai das listas de seleção do portal; o registro continua no banco.
--
-- O QUE NÃO FAZ: não apaga a colaboradora (o banco nem permitiria: as monitorias dela a
-- referenciam); não altera monitorias, respostas, histórico nem nenhuma outra colaboradora.
--
-- TRAVAS: uma transação; ADMIN responsável declarado (auditoria). Recusa se a colaboradora não
-- for a fictícia, se já estiver inativa, se tiver carteira ou meta, ou se alguma monitoria dela
-- não estiver Cancelada (rode antes o 15c). Se qualquer outra colaboradora mudar, nada é gravado.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $desativar$
declare
  v_c       public.colaboradores;
  v_outras  text;
  v_mon     text;
begin
  select * into v_c from public.colaboradores where id = 'col-teste-homolog-1';
  if not found or v_c.nome <> 'TESTE HOMOLOGAÇÃO — FICTÍCIO' or not coalesce((v_c.extras ->> 'ficticio')::boolean, false) then
    raise exception '11b RECUSADO: col-teste-homolog-1 não é a colaboradora fictícia do 11a.' using errcode = 'MI403';
  end if;
  if not v_c.ativo then
    raise exception '11b RECUSADO: a colaboradora fictícia já está inativa.' using errcode = 'MI403';
  end if;
  if exists (select 1 from public.monitorias where colaborador_id = v_c.id and coalesce(status, '') <> 'Cancelada') then
    raise exception '11b RECUSADO: há monitoria da colaboradora fictícia que não está Cancelada. Rode antes o 15c.' using errcode = 'MI403';
  end if;
  if exists (select 1 from public.alocacoes where colaborador_id = v_c.id)
     or exists (select 1 from public.documentos d where d.colecao = 'metas_colaborador' and to_jsonb(d)::text like '%col-teste-homolog-1%') then
    raise exception '11b RECUSADO: a colaboradora fictícia tem carteira ou meta — verifique antes de desativar.' using errcode = 'MI403';
  end if;

  select string_agg(to_jsonb(c)::text, '|' order by c.id) into v_outras from public.colaboradores c where c.id <> v_c.id;
  select string_agg(id || '=' || status || '/' || versao, ',' order by id) into v_mon from public.monitorias;

  update public.colaboradores c set ativo = false, versao_lida = v_c.versao where c.id = v_c.id;

  if (select ativo from public.colaboradores where id = v_c.id) then
    raise exception '11b: a colaboradora não ficou inativa — nada foi gravado.';
  end if;
  if (select string_agg(to_jsonb(c)::text, '|' order by c.id) from public.colaboradores c where c.id <> v_c.id) is distinct from v_outras
     or (select string_agg(id || '=' || status || '/' || versao, ',' order by id) from public.monitorias) is distinct from v_mon then
    raise exception '11b: outra colaboradora ou alguma monitoria mudou — nada foi gravado.';
  end if;
  if exists (select 1 from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q
                              from public.auditoria a) x where q) then
    raise exception '11b: a cadeia da auditoria acusou quebra — nada foi gravado.';
  end if;
end;
$desativar$;

insert into app.versoes_esquema (versao, descricao)
values ('11b', 'Colaboradora fictícia col-teste-homolog-1 desativada no encerramento dos testes (monitorias e histórico preservados)')
on conflict (versao) do nothing;

commit;
