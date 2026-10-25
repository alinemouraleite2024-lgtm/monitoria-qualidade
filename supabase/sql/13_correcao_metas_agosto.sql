-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 13 — monitora responsável nas metas de agosto/2026
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor. SÓ COM AUTORIZAÇÃO
-- ESPECÍFICA DA ALINE — é correção de dado já gravado.
--
-- O PROBLEMA (diagnóstico de 25/10/2026)
--   As metas de agosto/2026 existem no banco: vieram da exportação final de 13/10 (pm2_cgoals,
--   `month: 7` = agosto, convenção 0-indexada de domain/period.ts), íntegras. Foram
--   cadastradas no portal antigo com `monitorId: ''`: o formulário de meta começava com o
--   monitor vazio e exibia o primeiro nome da lista, e salvar sem mexer gravava ''.
--   Painel, fila e progresso só contam metas da monitora (goalService: `g.monitorId ===
--   monitorId`), então agosto aparece "sem meta". O formulário foi corrigido no portal.
--
-- O QUE FAZ (uma transação)
--   1. Confere que as 7 metas de agosto estão EXATAMENTE como a migração gravou (versão 1,
--      ativas, monitorId '', valores abaixo). Qualquer diferença: recusa e não altera nada.
--   2. Nas 6 metas com colaboradora, grava monitorId = 'usr-1' (Aline Oliveira Verneck).
--      Evidências: única monitora da área Relacionamento; todas as linhas do "Plano 2026"
--      (plano-1789126301654) são dela; as monitorias de agosto são dela. Valores, canais e
--      ids NÃO mudam.
--        cgoal-1789126047497  Nathalia (usr-3)  WhatsApp  5
--        cgoal-1789126050904  Nathalia (usr-3)  Telefone  5
--        cgoal-1789126055453  Allanis  (usr-4)  Telefone  5
--        cgoal-1789126059712  Allanis  (usr-4)  WhatsApp  5
--        cgoal-1789126078236  Susana   (usr-5)  geral     5
--        cgoal-1789126085844  Ana Carla(usr-6)  geral     5
--   3. A sétima (cgoal-1789126035423: SEM colaboradora e sem monitora, meta geral de 5) não
--      é meta de ninguém — nenhuma tela consegue contá-la. É RETIRADA (ativo = false): a
--      linha continua no banco, com o conteúdo original, e a auditoria registra.
--      >>> Este passo depende de decisão própria da Aline. Sem ela, apague o bloco 3. <<<
--   4. Mostra o resultado.
--
-- AUDITORIA: o 06 registra antes/depois de cada linha, com o responsável declarado abaixo.
-- O conteúdo original de cada meta fica no campo `antes` da trilha.
--
-- PODE RODAR MAIS DE UMA VEZ: se já estiver corrigido, a conferência do passo 1 recusa
-- (versão ≠ 1) e nada muda.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

-- 1. Conferência do estado esperado ---------------------------------------------------------
do $pre$
declare
  v_esperado jsonb := '{
    "cgoal-1789126035423": {"id":"cgoal-1789126035423","monitorId":"","colaboradorId":"","year":2026,"month":7,"targetQty":5},
    "cgoal-1789126047497": {"id":"cgoal-1789126047497","monitorId":"","colaboradorId":"usr-3","year":2026,"month":7,"canal":"WhatsApp","targetQty":5},
    "cgoal-1789126050904": {"id":"cgoal-1789126050904","monitorId":"","colaboradorId":"usr-3","year":2026,"month":7,"canal":"Telefone","targetQty":5},
    "cgoal-1789126055453": {"id":"cgoal-1789126055453","monitorId":"","colaboradorId":"usr-4","year":2026,"month":7,"canal":"Telefone","targetQty":5},
    "cgoal-1789126059712": {"id":"cgoal-1789126059712","monitorId":"","colaboradorId":"usr-4","year":2026,"month":7,"canal":"WhatsApp","targetQty":5},
    "cgoal-1789126078236": {"id":"cgoal-1789126078236","monitorId":"","colaboradorId":"usr-5","year":2026,"month":7,"targetQty":5},
    "cgoal-1789126085844": {"id":"cgoal-1789126085844","monitorId":"","colaboradorId":"usr-6","year":2026,"month":7,"targetQty":5}
  }';
  v_n integer;
begin
  select count(*) into v_n
    from public.documentos d
   where d.colecao = 'metas_colaborador' and d.ativo and d.versao = 1
     and v_esperado ? d.id and d.conteudo = v_esperado -> d.id;
  if v_n <> 7 then
    raise exception 'SCRIPT 13 RECUSADO: esperava as 7 metas de agosto exatamente como a migração gravou; encontrei % assim. Nada foi alterado.', v_n
      using errcode = 'MI409';
  end if;
  if not exists (select 1 from public.perfis where id = 'usr-1' and 'MONITOR' = any (perfis) and coalesce(status, 'ACTIVE') = 'ACTIVE') then
    raise exception 'SCRIPT 13 RECUSADO: usr-1 não é MONITOR ativo. Nada foi alterado.' using errcode = 'MI409';
  end if;
end
$pre$;

-- 2. Monitora responsável nas 6 metas com colaboradora --------------------------------------
update public.documentos
   set conteudo = jsonb_set(conteudo, '{monitorId}', '"usr-1"')
 where colecao = 'metas_colaborador' and ativo and versao = 1
   and id in ('cgoal-1789126047497', 'cgoal-1789126050904', 'cgoal-1789126055453',
              'cgoal-1789126059712', 'cgoal-1789126078236', 'cgoal-1789126085844');

-- 3. Retirada da meta sem colaboradora (DECISÃO DA ALINE — sem ela, apague este bloco) -----
update public.documentos
   set ativo = false
 where colecao = 'metas_colaborador' and ativo and versao = 1
   and id = 'cgoal-1789126035423';

-- 4. Resultado --------------------------------------------------------------------------------
select id, ativo, versao, conteudo->>'monitorId' as monitora, conteudo->>'colaboradorId' as colaboradora,
       coalesce(conteudo->>'canal', 'geral') as escopo, conteudo->>'targetQty' as meta
  from public.documentos
 where colecao = 'metas_colaborador' and (conteudo->>'year')::int = 2026 and (conteudo->>'month')::int = 7
 order by ordem;

commit;
