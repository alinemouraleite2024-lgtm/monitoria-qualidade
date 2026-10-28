-- =============================================================================
-- MonitorIA · Conferência SÓ LEITURA · o que a reconstituição do histórico recuperaria
-- =============================================================================
-- Rodar no SQL Editor DEPOIS do script 14 e ANTES de qualquer reconstituição. Não grava nada:
-- só SELECT. A reconstituição em si (app.reconstituir_eventos) depende de autorização.
--
-- Colunas: linha e data da auditoria (fonte), monitoria, evento, rodada, nota, quem e por qual
-- via, situação ('recuperável', 'já no histórico' ou 'descartado: motivo'), limitações e se há
-- texto de considerações (o texto em si não é exibido aqui).

-- 1. Resumo
select situacao, tipo, count(*) eventos
  from app.eventos_reconstituiveis
 group by situacao, tipo
 order by situacao, tipo;

-- 2. Linha a linha
select r.auditoria_seq                                  as "linha da auditoria",
       to_char(r.ocorrido_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as "quando",
       r.monitoria_id                                   as "monitoria",
       r.tipo                                           as "evento",
       r.rodada                                         as "rodada",
       r.nota                                           as "nota",
       r.responsavel_id                                 as "responsável",
       r.via                                            as "via",
       r.situacao                                       as "situação",
       nullif(r.limitacoes, '')                         as "limitações",
       case when r.consideracoes is null then 'não' else 'sim' end as "tem texto"
  from app.eventos_reconstituiveis r
 order by r.monitoria_id, r.auditoria_seq;
