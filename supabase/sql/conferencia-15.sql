-- =============================================================================
-- MonitorIA · Conferência do script 15 — SOMENTE LEITURA
-- =============================================================================
-- Rodar ANTES e DEPOIS da instalação do 15 (e antes e depois do 15b). Não grava nada.
-- Os itens 2 a 7 têm de sair IGUAIS antes e depois do 15: as impressões digitais deixam de
-- fora as duas colunas novas (chave_criacao, duplicata_de) — sem isso, a simples existência
-- das colunas mudaria a impressão sem que nenhum dado tivesse mudado.
-- A auditoria é contada sem os registros de acesso (acessos_log): cada abertura do portal
-- grava um, e isso não tem a ver com a instalação.
-- =============================================================================
with
mon as (select (to_jsonb(m) - 'chave_criacao' - 'duplicata_de') j, m.* from public.monitorias m),
grupos as (
  select string_agg(id || ' ' || status, ' = ' order by id) g
    from mon
   where coalesce(status, '') not in ('Cancelada', 'Reprovada') and coalesce(tipo, '') <> 'Calibração'
     and colaborador_id is not null and canal is not null and inicio_atendimento ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}'
   group by monitor_id, colaborador_id, canal, left(inicio_atendimento, 10), substr(inicio_atendimento, 12, 5)
  having count(*) > 1)
select * from (values
  (1, 'scripts aplicados',
      (select string_agg(versao, ', ' order by versao) from app.versoes_esquema)),
  (2, 'monitorias por situação',
      (select sum(n) || ' · ' || string_agg(status || ' ' || n, ', ' order by status) from (select status, count(*) n from public.monitorias group by status) s)),
  (3, 'impressão das monitorias (sem as colunas do 15)',
      (select md5(coalesce(string_agg(j::text, '|' order by id), '')) from mon)),
  (4, 'impressão das respostas',
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r)),
  (5, 'impressão das evidências',
      (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e)),
  (6, 'histórico: eventos · impressão',
      (select count(*) || ' · ' || md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e)),
  (7, 'auditoria sem acessos: linhas · quebras na cadeia inteira',
      (select count(*) filter (where tabela <> 'acessos_log') || ' · quebras ' ||
              (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)
         from public.auditoria)),
  (8, 'canceladas',
      (select count(*)::text from public.monitorias where status = 'Cancelada')),
  (9, 'mesmo atendimento ativo em dobro (grupos)',
      (select count(*) || ' · ' || coalesce(string_agg(g, ' | ' order by g), 'nenhum') from grupos)),
  (10, 'objetos do 15',
      concat_ws(' · ',
        case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monitorias' and column_name = 'chave_criacao') then 'coluna chave_criacao' end,
        case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monitorias' and column_name = 'duplicata_de') then 'coluna duplicata_de' end,
        case when exists (select 1 from pg_trigger where tgname = 'monitorias_b_duplicidade') then 'gatilho' end,
        case when to_regprocedure('api.cancelar_por_duplicidade(text, integer, text)') is not null then 'cancelar_por_duplicidade' end,
        case when to_regprocedure('app.cancelar_duplicata(text, integer, text, text)') is not null then 'cancelar_duplicata' end)),
  (11, 'canceladas por duplicidade (cópia → original)',
      (select coalesce(string_agg(m.id || ' → ' || (to_jsonb(m) ->> 'duplicata_de'), ', ' order by m.id), 'nenhuma')
         from public.monitorias m where to_jsonb(m) ->> 'duplicata_de' is not null))
) t(item, verificacao, resultado)
order by item;
