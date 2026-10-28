-- =============================================================================
-- MonitorIA · Prévia da reconstituição ANTES do script 14 — SOMENTE LEITURA
-- =============================================================================
-- Mesma lógica da visão app.eventos_reconstituiveis do script 14 (copiada dela, sem o ramo
-- 'já no histórico', que não existe antes do 14). Não grava nada: um único SELECT sobre a
-- auditoria. O teste testes-14-historico.mjs confere que o resultado é IDÊNTICO ao da visão.
--
-- Colunas: linha e data da auditoria (fonte), monitoria, evento, rodada, nota, responsável e
-- via, situação ('recuperável' ou 'descartado: motivo'), limitações e se há texto (o texto em
-- si não é exibido).
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
  from (
with trilha as (
  select a.seq, a.momento, a.acao, a.antes v_a, a.depois v_d, coalesce(a.depois, a.antes) ->> 'id' monitoria_id,
         coalesce(a.autor_perfil_id, a.responsavel_declarado) responsavel_id,
         case when a.autor_perfil_id is not null then 'login do portal'
              when a.responsavel_declarado is not null then 'ADMIN declarado (operação direta)' end via,
         coalesce((a.antes ->> 'enviado_em') is not null or coalesce((a.antes ->> 'enviada_na_origem')::boolean, false), false) ja_enviada
    from public.auditoria a
   where a.tabela = 'monitorias' and a.acao in ('INSERT', 'UPDATE')
), classificada as (
  select t.*,
         case
           when t.v_d ->> 'status' = 'Pendente' and (t.acao = 'INSERT' or t.v_a ->> 'status' is distinct from 'Pendente') then 'ENVIO'
           when t.acao = 'UPDATE' and t.v_a ->> 'status' is distinct from t.v_d ->> 'status' then
             case t.v_d ->> 'status' when 'Validada' then 'VALIDACAO' when 'Reprovada' then 'REPROVACAO'
                                     when 'Rascunho' then 'DEVOLUCAO' when 'Cancelada' then 'CANCELAMENTO' end
           when t.acao = 'UPDATE' and not coalesce((t.v_a ->> 'zerada')::boolean, false) and coalesce((t.v_d ->> 'zerada')::boolean, false)
             then 'ZERAMENTO_CONFIRMADO'
           when t.acao = 'UPDATE' and t.v_a ->> 'eliminatorio_afastado_em' is null and t.v_d ->> 'eliminatorio_afastado_em' is not null
             then 'ELIMINATORIO_AFASTADO'
         end tipo_base
    from trilha t
), avaliada as (
  select c.*,
         case
           when c.acao = 'INSERT' and c.v_d ->> 'origem' is distinct from 'portal'
             then 'descartado: inclusão pela migração (não foi envio feito neste banco)'
           when c.v_d ->> 'versao' is null or (c.acao = 'UPDATE' and c.v_a is null)
             then 'descartado: registro incompleto na auditoria'
           when c.responsavel_id is null or not exists (select 1 from public.perfis p where p.id = c.responsavel_id)
             then 'descartado: responsável não identificado'
           else 'recuperável'
         end situacao
    from classificada c
   where c.tipo_base is not null
), numerada as (
  select a.*,
         count(*) filter (where a.tipo_base = 'ENVIO' and a.situacao = 'recuperável')
           over (partition by a.monitoria_id order by a.seq rows between unbounded preceding and current row) envios_ate_aqui,
         -- base: a monitoria já tinha sido enviada antes do primeiro envio que a trilha mostra
         coalesce(first_value(a.ja_enviada) over (partition by a.monitoria_id, (a.tipo_base = 'ENVIO' and a.situacao = 'recuperável')
                                                   order by a.seq), false) primeiro_ja_enviada
    from avaliada a
), base as (
  select n.*,
         coalesce(bool_or(n.primeiro_ja_enviada) filter (where n.tipo_base = 'ENVIO' and n.situacao = 'recuperável')
                    over (partition by n.monitoria_id), n.ja_enviada) ja_enviada_antes
    from numerada n
)
select b.seq auditoria_seq,
       b.momento ocorrido_em,
       b.monitoria_id,
       case when b.tipo_base = 'ENVIO' and b.envios_ate_aqui + (case when b.ja_enviada_antes then 1 else 0 end) > 1 then 'REENVIO'
            else b.tipo_base end tipo,
       greatest(b.envios_ate_aqui + (case when b.ja_enviada_antes then 1 else 0 end), 1) rodada,
       (b.v_d ->> 'versao')::integer versao_monitoria,
       b.v_d ->> 'status' status_resultante,
       (b.v_d ->> 'nota')::numeric nota,
       nullif(btrim(coalesce(case b.tipo_base when 'REPROVACAO' then b.v_d ->> 'motivo_reprovacao' when 'DEVOLUCAO' then b.v_d ->> 'motivo_ajuste'
                                              when 'CANCELAMENTO' then b.v_d ->> 'cancelado_motivo'
                                              when 'ELIMINATORIO_AFASTADO' then b.v_d ->> 'eliminatorio_afastado_motivo' end, '')), '') consideracoes,
       b.responsavel_id,
       b.via,
       b.situacao,
       concat_ws('; ',
         case when b.tipo_base = 'VALIDACAO' then 'sem considerações: o campo não existia (regra 9)' end,
         case when b.tipo_base in ('ZERAMENTO_CONFIRMADO', 'ELIMINATORIO_AFASTADO') then 'sem identificação do critério' end,
         case when b.tipo_base in ('DEVOLUCAO', 'REPROVACAO', 'CANCELAMENTO', 'ELIMINATORIO_AFASTADO')
                   and nullif(btrim(coalesce(case b.tipo_base when 'REPROVACAO' then b.v_d ->> 'motivo_reprovacao'
                         when 'DEVOLUCAO' then b.v_d ->> 'motivo_ajuste' when 'CANCELAMENTO' then b.v_d ->> 'cancelado_motivo'
                         else b.v_d ->> 'eliminatorio_afastado_motivo' end, '')), '') is null then 'motivo não gravado na época' end,
         case when b.via like 'ADMIN%' then 'responsável declarado, não autenticado' end) limitacoes
  from base b
  ) r
 order by r.monitoria_id, r.auditoria_seq;
