-- =============================================================================
-- MonitorIA · BACKUP COMPLETO do banco compartilhado — SOMENTE LEITURA
-- =============================================================================
-- Um único SELECT. Não cria, não altera, não apaga nada. Devolve UMA linha com duas colunas:
--   resumo  — texto curto para anotar (contagens, auditoria, tabelas fora do backup);
--   backup  — o arquivo: todas as tabelas de dados, inteiras, mais a conferência (meta).
-- Uso: SQL Editor → Run → Export → JSON. Procedimento: docs/BACKUP-MANUAL.md.
--
-- Cada linha vai como TEXTO EXATO do banco (não como objeto): leitores de JSON comuns trocam
-- "100.00" por "100", o que mudaria as impressões digitais e quebraria a cadeia da auditoria.
--
-- O que NÃO vem (e não tem como vir por aqui): senhas e autenticadores (ficam no Supabase Auth),
-- arquivos de áudio e documentos (o portal guarda só nome, tipo e tamanho), configurações do
-- painel do Supabase e da Vercel.
-- =============================================================================
with
tab(nome) as (values
  ('app.versoes_esquema'), ('app.migracao_lotes'), ('app.migracao_origem'), ('app.migracao_ocorrencias'),
  ('public.perfis'), ('public.areas'), ('public.area_monitores'), ('public.colaboradores'), ('public.alocacoes'),
  ('public.alocacoes_historico'), ('public.criterios'), ('public.criterio_subperguntas'), ('public.regua_versoes'),
  ('public.documentos'), ('public.catalogos'), ('public.configuracoes'), ('public.monitorias'),
  ('public.monitoria_respostas'), ('public.monitoria_evidencias'), ('public.monitoria_eventos'),
  ('public.acessos_log'), ('public.auditoria')),
dados as (
  select jsonb_build_object(
    'app.versoes_esquema',          (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from app.versoes_esquema t),
    'app.migracao_lotes',           (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from app.migracao_lotes t),
    'app.migracao_origem',          (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from app.migracao_origem t),
    'app.migracao_ocorrencias',     (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from app.migracao_ocorrencias t),
    'public.perfis',                (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.perfis t),
    'public.areas',                 (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.areas t),
    'public.area_monitores',        (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.area_monitores t),
    'public.colaboradores',         (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.colaboradores t),
    'public.alocacoes',             (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.alocacoes t),
    'public.alocacoes_historico',   (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.alocacoes_historico t),
    'public.criterios',             (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.criterios t),
    'public.criterio_subperguntas', (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.criterio_subperguntas t),
    'public.regua_versoes',         (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.regua_versoes t),
    'public.documentos',            (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.documentos t),
    'public.catalogos',             (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.catalogos t),
    'public.configuracoes',         (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.configuracoes t),
    'public.monitorias',            (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.monitorias t),
    'public.monitoria_respostas',   (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.monitoria_id, t.criterio_id), '[]') from public.monitoria_respostas t),
    'public.monitoria_evidencias',  (select coalesce(jsonb_agg(to_jsonb(t)::text order by to_jsonb(t)::text), '[]') from public.monitoria_evidencias t),
    'public.monitoria_eventos',     (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.id), '[]') from public.monitoria_eventos t),
    'public.acessos_log',           (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.seq), '[]') from public.acessos_log t),
    'public.auditoria',             (select coalesce(jsonb_agg(to_jsonb(t)::text order by t.seq), '[]') from public.auditoria t)
  ) d
),
meta as (
  select jsonb_build_object(
    'gerado_em', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'banco', current_database(),
    'postgres', current_setting('server_version'),
    'versoes', (select jsonb_agg(versao order by versao) from app.versoes_esquema),
    'contagens', (select jsonb_object_agg(k, jsonb_array_length(v)) from dados, jsonb_each(dados.d) e(k, v)),
    'auditoria', jsonb_build_object(
       'total', (select count(*) from public.auditoria),
       'ultimo_seq', (select max(seq) from public.auditoria),
       'ultimo_hash', (select hash from public.auditoria order by seq desc limit 1),
       'quebras', (select count(*) from (select a.hash <> app.auditoria_hash(a)
                     or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)),
    'impressoes', jsonb_build_object(
       'monitorias', (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em')::text, '|' order by m.id), '')) from public.monitorias m),
       'relatorios', (select md5(coalesce(string_agg(m.id || '=' || (to_jsonb(m) ->> 'relatorio_completo'), '|' order by m.id), '')) from public.monitorias m),
       'guardas', (select md5(coalesce(string_agg(m.id || '=' || coalesce(to_jsonb(m) ->> 'aguardando_liberacao', '-') || '/' || coalesce(to_jsonb(m) ->> 'concluida_em', '-'), '|' order by m.id), '')) from public.monitorias m),
       'respostas', (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r),
       'evidencias', (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e),
       'eventos', (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e)),
    'sequencias', jsonb_build_object('app.auditoria_seq', (select last_value from app.auditoria_seq)),
    -- toda tabela de dados de public/app que NÃO está no backup (esperado: nenhuma)
    'tabelas_fora_do_backup', (select coalesce(jsonb_agg(n.nspname || '.' || c.relname order by 1), '[]')
                                 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                where c.relkind in ('r', 'p') and n.nspname in ('public', 'app')
                                  and (n.nspname || '.' || c.relname) not in (select nome from tab)),
    'logins_no_supabase_auth', (select count(*) from auth.users),
    'perfis_com_login', (select count(*) from public.perfis where auth_user_id is not null),
    'tamanho_dados', (select length(d::text) from dados)
  ) m
  from dados
)
select concat_ws(' · ',
         'MonitorIA backup ' || (meta.m ->> 'gerado_em'),
         (meta.m -> 'contagens' ->> 'public.monitorias') || ' monitorias',
         (meta.m -> 'contagens' ->> 'public.monitoria_eventos') || ' eventos',
         'auditoria ' || (meta.m -> 'auditoria' ->> 'total') || ' (quebras ' || (meta.m -> 'auditoria' ->> 'quebras') || ')',
         'tabelas fora: ' || case when jsonb_array_length(meta.m -> 'tabelas_fora_do_backup') = 0 then 'nenhuma'
                                  else (meta.m ->> 'tabelas_fora_do_backup') end,
         'tamanho ' || (meta.m ->> 'tamanho_dados')) as resumo,
       jsonb_build_object('formato', 'monitoria-backup-v1', 'meta', meta.m, 'dados', dados.d) as backup
  from meta, dados;
