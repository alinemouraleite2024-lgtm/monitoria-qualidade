-- Conferência do script 12 (estado do acesso / MFA do ADMIN) — SOMENTE LEITURA
-- (não cria, não altera, não apaga nada; não cria tabela)
-- Rodar no SQL Editor da HOMOLOGAÇÃO ANTES do 12 (anotar os itens 7 a 9) e DEPOIS dele.
-- Coluna `ok` = true em todos os itens depois do 12, exceto os informativos (ok nulo).
with f as (select to_regprocedure('api.estado_do_meu_acesso()') oid)
select 1 as item, 'Script 12 registrado' as verificacao,
       (select count(*)::text from app.versoes_esquema where versao = '12') as resultado, '1' as esperado,
       (select count(*) = 1 from app.versoes_esquema where versao = '12') as ok
union all select 2, 'Função api.estado_do_meu_acesso() existe, sem parâmetros, security definer',
       coalesce((select 'existe · ' || pronargs || ' parâmetros · ' || case when prosecdef then 'security definer' else 'SEM security definer' end
                   from pg_proc, f where pg_proc.oid = f.oid), 'não existe'), 'existe · 0 parâmetros · security definer',
       (select coalesce(bool_and(p.pronargs = 0 and p.prosecdef), false) from pg_proc p, f where p.oid = f.oid)
union all select 3, 'Anônimo NÃO executa · logado executa',
       (select case when f.oid is null then '—' else has_function_privilege('anon', f.oid, 'execute')::text || ' · ' || has_function_privilege('authenticated', f.oid, 'execute')::text end from f),
       'false · true',
       (select f.oid is not null and not has_function_privilege('anon', f.oid, 'execute') and has_function_privilege('authenticated', f.oid, 'execute') from f)
union all select 4, 'Banco continua exigindo aal2 do ADMIN (07): sou_admin e usuario_liberado',
       (select string_agg(proname || ':' || (position('aal2' in pg_get_functiondef(oid)) > 0)::text, ' · ' order by proname)
          from pg_proc where pronamespace = 'app'::regnamespace and proname in ('sou_admin', 'usuario_liberado')),
       'sou_admin:true · usuario_liberado:true',
       (select count(*) = 2 from pg_proc where pronamespace = 'app'::regnamespace and proname in ('sou_admin', 'usuario_liberado')
          and position('aal2' in pg_get_functiondef(oid)) > 0)
union all select 5, 'Tabela de fatores do Supabase Auth disponível', (to_regclass('auth.mfa_factors') is not null)::text, 'true',
       to_regclass('auth.mfa_factors') is not null
union all select 6, 'Perfis ADMIN (informativo: 0 até a conta ADMIN ser criada)', (select count(*)::text from public.perfis where 'ADMIN' = any (perfis)), 'informativo', null::boolean
union all select 7, 'MON-10001 · MON-10002 (situação · versão) — iguais antes e depois',
       (select string_agg(id || ' ' || status || ' v' || versao, ' · ' order by id) from public.monitorias where id in ('MON-10001', 'MON-10002')),
       'anotar antes', null::boolean
union all select 8, 'Auditoria: total · ÂNCORA (seq | hash) — o 12 não grava: igual antes e depois',
       (select count(*) || ' · ' || (select seq::text || ' | ' || hash from public.auditoria order by seq desc limit 1) from public.auditoria),
       'anotar antes', null::boolean
union all select 9, 'Quebras na cadeia da auditoria', (select count(*)::text from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q), '0',
       (select count(*) = 0 from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)
order by item;
