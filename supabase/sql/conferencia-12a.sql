-- Conferência da criação do ADMIN (12a → login no Auth → MFA) — SOMENTE LEITURA
-- (não cria, não altera, não apaga nada; não cria tabela)
-- Rodar: ANTES do 12a (linha de base: anotar 10 e 11), DEPOIS do 12a, DEPOIS de criar o
-- usuário no Auth e DEPOIS do cadastro dos autenticadores. O que muda em cada momento:
--   antes do 12a ......... 1 = 0; 2 = 0 · —; 4 a 6 = —; 9 = aberta
--   depois do 12a ........ 1 = 1; 2 = 1 · adm-aline-oliveira; 4 = ainda sem login; 5 = 0; 9 = fechada
--   depois do Auth ....... 4 = ligado; 5 = 0
--   depois do MFA ........ 5 = 2 (dois autenticadores verificados)
--   sempre ............... 7 e 8 iguais aos de hoje; 10 igual à linha de base; 12 = 0
with adm as (select * from public.perfis where id = 'adm-aline-oliveira')
select 1 as item, 'Script 12a registrado' as verificacao,
       (select count(*)::text from app.versoes_esquema where versao = '12a') as resultado
union all select 2, 'Perfis ADMIN: quantidade · ids',
       (select count(*) || ' · ' || coalesce(string_agg(id, ', ' order by id), '—') from public.perfis where 'ADMIN' = any (perfis))
union all select 3, 'adm-aline-oliveira: perfis · situação · e-mail',
       coalesce((select array_to_string(perfis, ',') || ' · ' || coalesce(status, '—') || ' · ' || email from adm), '—')
union all select 4, 'adm-aline-oliveira: login do Supabase Auth',
       coalesce((select case when auth_user_id is null then 'ainda sem login' else 'ligado' end from adm), '—')
union all select 5, 'adm-aline-oliveira: segundos fatores (TOTP) verificados',
       coalesce((select count(*)::text from adm join auth.mfa_factors f on f.user_id = adm.auth_user_id and f.status::text = 'verified'), '—')
union all select 6, 'Auditoria da criação do ADMIN: ação · responsável declarado',
       coalesce((select acao || ' · ' || coalesce(responsavel_declarado, '—') from public.auditoria
                  where tabela = 'perfis' and chave ->> 'id' = 'adm-aline-oliveira' and acao = 'INSERT' order by seq limit 1), '—')
union all select 7, 'usr-1 (Aline monitora): perfis · situação · e-mail · login — deve ficar IGUAL',
       (select array_to_string(perfis, ',') || ' · ' || coalesce(status, 'ACTIVE') || ' · ' || email || ' · '
               || case when auth_user_id is null then 'sem login' else 'ligado' end from public.perfis where id = 'usr-1')
union all select 8, 'Erivan: perfis · login · gestor da area-1 — deve ficar IGUAL',
       (select array_to_string(p.perfis, ',') || ' · ' || case when p.auth_user_id is null then 'sem login' else 'ligado' end || ' · '
               || case when (select gestor_id from public.areas where id = 'area-1') = p.id then 'gestor da area-1' else 'NÃO é gestor da area-1' end
          from public.perfis p where p.id = 'usr-1791895673216')
union all select 9, 'Exceção de implantação (R5): aberta enquanto não existe ADMIN',
       case when exists (select 1 from public.perfis where 'ADMIN' = any (perfis)) then 'fechada' else 'aberta' end
union all select 10, 'MON-10001 · MON-10002 (situação · versão) — devem ficar IGUAIS',
       (select string_agg(id || ' ' || status || ' v' || versao, ' · ' order by id) from public.monitorias where id in ('MON-10001', 'MON-10002'))
union all select 11, 'Auditoria: total · ÂNCORA (seq | hash)',
       (select count(*) || ' · ' || (select seq::text || ' | ' || hash from public.auditoria order by seq desc limit 1) from public.auditoria)
union all select 12, 'Quebras na cadeia da auditoria (esperado: 0)',
       (select count(*)::text from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)
order by item;
