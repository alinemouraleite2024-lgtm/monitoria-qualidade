-- MonitorIA · Conferência do script 17 · SOMENTE LEITURA
-- Rodar antes e depois da instalação. A impressão de monitorias desconsidera o relatório completo,
-- para ser comparável com a registrada nos backups anteriores.
select * from (values
 ('1 versão 17', (select count(*)::text from app.versoes_esquema where versao = '17')),
 ('2 situações', (select string_agg(status || ' ' || n, ', ' order by status) from (select status, count(*) n from public.monitorias group by status) s)),
 ('3 monitorias com relatório', (select count(*)::text from public.monitorias m where to_jsonb(m) ->> 'relatorio_completo' is not null)),
 ('4 impressão monitorias', (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo')::text, '|' order by m.id), '')) from public.monitorias m)),
 ('5 impressão respostas', (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r)),
 ('6 impressão evidências', (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e)),
 ('7 impressão eventos', (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e)),
 ('8 notas', (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(nota_calculada::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias)),
 ('9 fila · agosto', (select count(*) filter (where status = 'Pendente') from public.monitorias) || ' · ' || (select string_agg(k || '=' || n, ', ' order by k) from (select colaborador_id || '·' || canal k, count(*) n from public.monitorias where competencia = '2026-08' and status in ('Pendente', 'Validada', 'Concluída') group by 1) s)),
 ('10 auditoria', (select count(*) || ' · último ' || max(seq) || ' · quebras ' || (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q) from public.auditoria))
) t(item, resultado) order by split_part(item, ' ', 1)::int;
