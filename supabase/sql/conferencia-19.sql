-- MonitorIA · Conferência do script 19 · SOMENTE LEITURA
-- Rodar antes e depois da instalação. Lê as colunas novas por to_jsonb para funcionar também antes do 19.
-- Mudam só os itens 1 e 16. A auditoria pode crescer apenas por registros de acesso (item 12).
with privadas as (
  select m.id from public.monitorias m
   where coalesce(m.status, 'Rascunho') in ('Rascunho', 'Cancelada') and m.enviado_em is null and not coalesce(m.enviada_na_origem, false)
)
select * from (values
 ('1 versão 19', (select count(*)::text from app.versoes_esquema where versao = '19')),
 ('2 situações', (select string_agg(status || ' ' || n, ', ' order by status) from (select status, count(*) n from public.monitorias group by status) s)),
 ('3 privadas pela regra', (select count(*) || ' · ' || coalesce(string_agg(id, ', ' order by id), 'nenhuma') from privadas)),
 ('4 visíveis ao supervisor', (select (select count(*) from public.monitorias) - (select count(*) from privadas))::text),
 ('5 impressão monitorias', (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em')::text, '|' order by m.id), '')) from public.monitorias m)),
 ('6 impressão relatórios', (select md5(coalesce(string_agg(m.id || '=' || (to_jsonb(m) ->> 'relatorio_completo'), '|' order by m.id), '')) from public.monitorias m)),
 ('7 impressão respostas', (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r)),
 ('8 impressão evidências', (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e)),
 ('9 impressão eventos', (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e)),
 ('10 notas', (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(nota_calculada::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias)),
 ('11 fila', (select count(*)::text from public.monitorias where status = 'Pendente')),
 ('12 auditoria', (select count(*) || ' · último ' || max(seq) || ' · quebras ' || (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q) from public.auditoria)),
 ('13 auditoria de monitorias', (select count(*)::text from public.auditoria where tabela like 'monitoria%')),
 ('14 guardadas', (select count(*)::text from public.monitorias m where to_jsonb(m) ->> 'aguardando_liberacao' = 'true')),
 ('15 com data de conclusão', (select count(*)::text from public.monitorias m where to_jsonb(m) ->> 'concluida_em' is not null)),
 ('16 função de envio instalada', (select (to_regprocedure('api.liberar_monitorias(jsonb)') is not null)::text)),
 ('17 privacidade ativa (esperado 1)', (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'monitorias' and policyname = 'monitorias_ler' and qual like '%monitoria_privada%'))
) t(item, resultado) order by split_part(item, ' ', 1)::int;
