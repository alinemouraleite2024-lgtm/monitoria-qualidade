-- Conferência do teste de homologação ponta a ponta — SOMENTE LEITURA
-- (não cria, não altera, não apaga nada; não cria tabela)
--
-- Rodar no SQL Editor da HOMOLOGAÇÃO:
--   · ANTES do 11a e antes do passo 1 (linha de base — anotar os itens 7 a 10 fora do banco);
--   · depois de cada passo do roteiro;
--   · no fim, para a conferência de integridade.
-- A monitoria do teste é achada pela marca: colaborador col-teste-homolog-1 + atendimento HOMOLOG-TESTE-001.
with teste as (select * from public.monitorias
                where colaborador_id = 'col-teste-homolog-1' and numero_atendimento = 'HOMOLOG-TESTE-001'),
     aud as (select a.* from public.auditoria a, teste t where a.tabela = 'monitorias' and a.chave ->> 'id' = t.id)
select 1 as item, 'Colaborador fictício (11a)' as verificacao,
       coalesce((select id || ' · ' || nome || ' · ' || case when ativo then 'ativo' else 'INATIVO' end
                   || ' · alocações: ' || (select count(*) from public.alocacoes where colaborador_id = c.id)
                   from public.colaboradores c where id = 'col-teste-homolog-1'), 'ainda não existe') as resultado
union all select 2, 'Monitorias com a marca do teste (deve ser 0 antes do passo 1 e 1 depois)', (select count(*)::text from teste)
union all select 3, 'Monitoria do teste: código · protocolo · situação · tipo · competência',
       (select id || ' · ' || protocolo || ' · ' || status || ' · ' || coalesce(tipo, '—') || ' · ' || competencia from teste)
union all select 4, 'Régua · nota do banco · versão',
       (select coalesce(regua_versao_id, 'sem régua') || ' · ' || coalesce(nota::text, 'sem nota') || ' · v' || versao from teste)
union all select 5, 'Devolução (motivo · quem) e validação (quem · quando)',
       (select coalesce(motivo_ajuste, '—') || ' · ' || coalesce(revisado_por, '—') || ' | ' || coalesce(aprovado_por, '—') || ' · '
               || coalesce(to_char(aprovado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), '—') from teste)
union all select 6, 'Auditoria da monitoria do teste: linhas · autores · declaradas (esperado: 0 declaradas)',
       (select count(*) || ' linhas · ' || coalesce(string_agg(distinct autor_perfil_id, ', '), '—') || ' · '
               || count(*) filter (where responsavel_declarado is not null) || ' declaradas' from aud)
union all select 7, 'MON-10001 (real): situação · versão · nota · régua — deve ficar IGUAL à linha de base',
       (select status || ' · v' || versao || ' · ' || coalesce(nota::text, '—') || ' · ' || coalesce(regua_versao_id, 'sem régua') from public.monitorias where id = 'MON-10001')
union all select 8, 'MON-10002 (real): situação · versão — deve ficar IGUAL à linha de base',
       (select status || ' · v' || versao from public.monitorias where id = 'MON-10002')
union all select 9, 'Total de monitorias · última numeração',
       (select count(*) || ' · ' || max(id) from public.monitorias)
union all select 10, 'Auditoria: total de linhas · ÂNCORA (seq | hash) — anotar fora do banco',
       (select count(*) || ' · ' || (select seq::text || ' | ' || hash from public.auditoria order by seq desc limit 1) from public.auditoria)
-- A cadeia (cada linha carrega o hash da anterior) acusa qualquer linha apagada ou alterada.
union all select 11, 'Quebras na cadeia da auditoria (esperado: 0)',
       (select count(*)::text from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q
                                      from public.auditoria a) x where q)
order by item;
