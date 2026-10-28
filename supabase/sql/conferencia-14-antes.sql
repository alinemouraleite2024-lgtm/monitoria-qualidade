-- Conferência ANTES do script 14 (histórico de calibração) — SOMENTE LEITURA
-- (não cria, não altera, não apaga nada; não cria tabela). Uma única consulta.
-- O que se espera:
--   1 inclui 00…13 e NÃO inclui 14 · 2–5 retrato atual (anotar) · 6 = 0 · 7 âncora (anotar)
--   8 = 0 quebras · 9 e 10 = todas presentes · 11 = assinatura antiga (2 parâmetros), com M1
--   12 = reprovar com M1 (script 10) · 13 = nada do 14 existe ainda · 14 gatilhos atuais
--   15 = postgres · 16 = portal executa, anônimo não · 18 e 19 = impressões digitais (anotar:
--   rodar de novo IMEDIATAMENTE antes do 14 e comparar com a conferencia-14-depois)
with
fn(nome) as (values
  ('app.tg_somente_inclusao()'), ('app.tg_bloquear_exclusao()'), ('app.tg_auditoria()'), ('app.auditoria_hash(public.auditoria)'),
  ('app.monitoria_para_gestor(text,integer)'), ('app.resultado_monitoria(text)'), ('app.recusar(text,text,text)'),
  ('app.meu_perfil_id()'), ('app.tem_perfil(text)'), ('app.usuario_liberado()'), ('app.equipe_do_gestor()'),
  ('api.devolver_monitoria(text,integer,text)'), ('api.reprovar_monitoria(text,integer,text)'),
  ('api.confirmar_zeramento(text,integer)'), ('api.afastar_eliminatorio(text,integer,text)'),
  ('api.cancelar_monitoria(text,integer,text)'), ('api.salvar_monitoria(jsonb,integer,boolean)')),
col(tabela, coluna) as (values
  ('monitorias', 'id'), ('monitorias', 'status'), ('monitorias', 'versao'), ('monitorias', 'versao_lida'), ('monitorias', 'nota'),
  ('monitorias', 'origem'), ('monitorias', 'enviado_em'), ('monitorias', 'enviada_na_origem'), ('monitorias', 'motivo_ajuste'),
  ('monitorias', 'motivo_reprovacao'), ('monitorias', 'cancelado_motivo'), ('monitorias', 'zerada'),
  ('monitorias', 'eliminatorio_afastado_em'), ('monitorias', 'eliminatorio_afastado_motivo'), ('monitorias', 'regua_versao_id'),
  ('monitoria_respostas', 'monitoria_id'), ('monitoria_respostas', 'criterio_id'), ('monitoria_respostas', 'resposta'),
  ('monitoria_respostas', 'ordem'), ('regua_versoes', 'retrato'), ('perfis', 'id'),
  ('auditoria', 'antes'), ('auditoria', 'depois'), ('auditoria', 'autor_perfil_id'), ('auditoria', 'responsavel_declarado'))
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
union all select 9, 'Funções que o 14 usa ou substitui: presentes / esperadas',
       (select count(*) filter (where to_regprocedure(nome) is not null) || ' / ' || count(*)
               || coalesce(' · FALTAM: ' || string_agg(nome, ', ') filter (where to_regprocedure(nome) is null), '') from fn)
union all select 10, 'Colunas que o 14 lê: presentes / esperadas',
       (select count(*) filter (where exists (select 1 from information_schema.columns c where c.table_schema = 'public'
                                                and c.table_name = col.tabela and c.column_name = col.coluna)) || ' / ' || count(*) from col)
union all select 11, 'api.validar_monitoria hoje: assinatura · barreira M1',
       (select string_agg(p.oid::regprocedure::text || ' · ' || case when position('-- M1' in pg_get_functiondef(p.oid)) > 0 then 'com M1' else 'SEM M1' end, ' | ')
          from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'api' and p.proname = 'validar_monitoria')
union all select 12, 'api.reprovar_monitoria hoje: barreira M1 (script 10)',
       (select case when position('-- M1' in pg_get_functiondef('api.reprovar_monitoria(text,integer,text)'::regprocedure)) > 0 then 'com M1' else 'SEM M1' end)
union all select 13, 'Objetos do 14 que JÁ existem (esperado: nenhum)',
       coalesce(nullif(concat_ws(', ',
         case when to_regclass('public.monitoria_eventos') is not null then 'tabela monitoria_eventos' end,
         case when to_regclass('app.eventos_reconstituiveis') is not null then 'visão eventos_reconstituiveis' end,
         case when to_regprocedure('api.registrar_observacao(text,text,uuid)') is not null then 'api.registrar_observacao' end,
         case when to_regprocedure('api.validar_monitoria(text,integer,text)') is not null then 'validar com 3 parâmetros' end,
         case when exists (select 1 from pg_trigger where tgname = 'monitorias_y_eventos') then 'gatilho monitorias_y_eventos' end), ''), 'nenhum')
union all select 14, 'Gatilhos atuais da tabela monitorias',
       (select string_agg(tgname, ', ' order by tgname) from pg_trigger where tgrelid = 'public.monitorias'::regclass and not tgisinternal)
union all select 15, 'Dono das tabelas monitorias e auditoria',
       (select string_agg(c.relname || ' = ' || pg_get_userbyid(c.relowner), ' · ' order by c.relname)
          from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('monitorias', 'auditoria'))
union all select 16, 'Funções de decisão: portal executa · anônimo executa',
       (select string_agg(p.proname || ' ' || has_function_privilege('authenticated', p.oid, 'execute')::text || '/' || has_function_privilege('anon', p.oid, 'execute')::text, ' · ' order by p.proname)
          from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'api' and p.proname in ('validar_monitoria', 'devolver_monitoria', 'reprovar_monitoria', 'confirmar_zeramento'))
union all select 17, 'Versão do Postgres',
       current_setting('server_version')
union all select 18, 'IMPRESSÃO DIGITAL das monitorias (todas as colunas) — anotar; deve ficar IGUAL depois do 14',
       (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.monitorias m)
union all select 19, 'IMPRESSÃO DIGITAL das respostas e evidências — anotar; deve ficar IGUAL depois do 14',
       (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r)
       || ' · ' || (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e)
order by item;
