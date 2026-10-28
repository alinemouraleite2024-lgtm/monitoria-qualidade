-- Conferência DEPOIS do script 14 (histórico de calibração) — SOMENTE LEITURA
-- (não cria, não altera, não apaga nada). Uma única consulta. Rodar logo após o 14 e ANTES de
-- qualquer reconstituição ou publicação do portal novo. O que se espera:
--   1 inclui 14 · 2–5 IGUAIS à conferencia-14-antes · 6 = 0 · 7 total e âncora IGUAIS aos de antes
--   (o 14 não grava na auditoria) · 8 = 0 quebras · 9 = 0 eventos (nada reconstituído; se alguém
--   decidir/enviar pelo portal no meio-tempo, aparecem eventos 'portal' e o total da auditoria
--   sobe — esperado) · 10 = 0 reconstituídos · 11 RLS ligada · 12 = 5 gatilhos de proteção e
--   auditoria · 13 = gatilho nas monitorias · 14 portal só lê; anônimo nada · 15 validar com 3
--   parâmetros, sem a assinatura antiga, com M1 · 16 funções do 14 · 17 prévia: recuperáveis
--   (devem ser os 22 já conferidos) · 18 e 19 impressões digitais IGUAIS às de antes
select 1 as item, 'Scripts aplicados (app.versoes_esquema)' as verificacao,
       (select string_agg(versao, ', ' order by versao) from app.versoes_esquema) as resultado
union all select 2, 'Monitorias: total',
       (select count(*)::text from public.monitorias)
union all select 3, 'Monitorias por situação',
       (select string_agg(status || ' ' || n, ' · ' order by status) from (select status, count(*) n from public.monitorias group by status) x)
union all select 4, 'Monitorias por origem',
       (select string_agg(coalesce(origem, '—') || ' ' || n, ' · ' order by origem) from (select origem, count(*) n from public.monitorias group by origem) x)
union all select 5, 'Respostas gravadas · evidências gravadas',
       (select count(*) from public.monitoria_respostas)::text || ' · ' || (select count(*) from public.monitoria_evidencias)::text
union all select 6, 'Anomalias: enviada sem nota/régua ou sem data de envio (esperado: 0)',
       (select count(*)::text from public.monitorias m
         where m.status in ('Pendente', 'Validada', 'Reprovada') and m.origem = 'portal'
           and (m.nota is null or m.regua_versao_id is null or m.enviado_em is null))
union all select 7, 'Auditoria: total · ÂNCORA (seq | hash)',
       (select count(*) || ' · ' || (select seq::text || ' | ' || hash from public.auditoria order by seq desc limit 1) from public.auditoria)
union all select 8, 'Quebras na cadeia da auditoria (esperado: 0)',
       (select count(*)::text from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)
union all select 9, 'Histórico: eventos gravados (por tipo · origem)',
       coalesce((select string_agg(tipo || '/' || origem || ' ' || n, ' · ' order by tipo) from (select tipo, origem, count(*) n from public.monitoria_eventos group by tipo, origem) x), '0 eventos')
union all select 10, 'Histórico: eventos reconstituídos (esperado: 0 até a autorização)',
       (select count(*)::text from public.monitoria_eventos where origem = 'reconstituido')
union all select 11, 'Tabela de eventos: RLS ligada',
       (select case when relrowsecurity then 'sim' else 'NÃO' end from pg_class where oid = 'public.monitoria_eventos'::regclass)
union all select 12, 'Tabela de eventos: gatilhos de proteção e auditoria',
       (select count(*) || ' · ' || string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid = 'public.monitoria_eventos'::regclass and not tgisinternal)
union all select 13, 'Gatilhos da tabela monitorias (deve incluir monitorias_y_eventos)',
       (select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid = 'public.monitorias'::regclass and not tgisinternal)
union all select 14, 'Tabela de eventos: portal lê/inclui/altera/apaga · anônimo lê',
       has_table_privilege('authenticated', 'public.monitoria_eventos', 'select')::text || '/'
       || has_table_privilege('authenticated', 'public.monitoria_eventos', 'insert')::text || '/'
       || has_table_privilege('authenticated', 'public.monitoria_eventos', 'update')::text || '/'
       || has_table_privilege('authenticated', 'public.monitoria_eventos', 'delete')::text || ' · '
       || has_table_privilege('anon', 'public.monitoria_eventos', 'select')::text
union all select 15, 'api.validar_monitoria: assinaturas · barreira M1',
       (select string_agg(p.oid::regprocedure::text || ' · ' || case when position('-- M1' in pg_get_functiondef(p.oid)) > 0 then 'com M1' else 'SEM M1' end, ' | ')
          from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'api' and p.proname = 'validar_monitoria')
union all select 16, 'Funções do 14: portal executa · anônimo executa',
       (select string_agg(p.proname || ' ' || has_function_privilege('authenticated', p.oid, 'execute')::text || '/' || has_function_privilege('anon', p.oid, 'execute')::text, ' · ' order by p.proname)
          from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'api' and p.proname in ('validar_monitoria', 'devolver_monitoria', 'reprovar_monitoria', 'registrar_observacao'))
union all select 17, 'Prévia da reconstituição (só leitura): situação · eventos',
       (select string_agg(situacao || ' ' || n, ' · ' order by situacao) from (select situacao, count(*) n from app.eventos_reconstituiveis group by situacao) x)
union all select 18, 'IMPRESSÃO DIGITAL das monitorias (todas as colunas) — IGUAL à de antes',
       (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.monitorias m)
union all select 19, 'IMPRESSÃO DIGITAL das respostas e evidências — IGUAL à de antes',
       (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r)
       || ' · ' || (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e)
order by item;
