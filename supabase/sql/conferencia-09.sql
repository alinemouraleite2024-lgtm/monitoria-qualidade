-- Conferência do 09 (09a + 09b) — SOMENTE LEITURA (não cria, não altera, não apaga nada)
-- Rodar no SQL Editor depois do 09b. Rodar de novo depois de criar os logins de Aline e Erivan
-- (itens 14 e 15). Coluna `ok` = true em todos os itens, exceto os informativos (ok nulo).
with lote as (select * from app.migracao_lotes order by aplicado_em limit 1),
     man as (select manifesto m from lote),
     erivan as (select (select m -> 'novos_perfis' ->> 'erivan' from man) id),
     cont as (
       select k tabela, (v)::int esperado,
              case k
                when 'perfis'                then (select count(*) from public.perfis where not ('ADMIN' = any (perfis)))
                when 'areas'                 then (select count(*) from public.areas)
                when 'area_monitores'        then (select count(*) from public.area_monitores)
                when 'colaboradores'         then (select count(*) from public.colaboradores)
                when 'alocacoes'             then (select count(*) from public.alocacoes)
                when 'alocacoes_historico'   then (select count(*) from public.alocacoes_historico)
                when 'criterios'             then (select count(*) from public.criterios)
                when 'criterio_subperguntas' then (select count(*) from public.criterio_subperguntas)
                when 'monitorias'            then (select count(*) from public.monitorias where origem = 'migracao')
                when 'monitoria_respostas'   then (select count(*) from public.monitoria_respostas r join public.monitorias m on m.id = r.monitoria_id and m.origem = 'migracao' and m.enviado_em is null)
                when 'monitoria_evidencias'  then (select count(*) from public.monitoria_evidencias e join public.monitorias m on m.id = e.monitoria_id and m.origem = 'migracao' and m.enviado_em is null)
                when 'documentos'            then (select count(*) from public.documentos)
                when 'catalogos'             then (select count(*) from public.catalogos)
                when 'configuracoes'         then (select count(*) from public.configuracoes)
                when 'acessos_log'           then (select count(*) from public.acessos_log where perfil_id is null)
              end obtido
         from man, jsonb_each_text(m -> 'contagens') x(k, v))
select 1 as item, 'Scripts registrados (inclui 09a e 09)' as verificacao,
       (select string_agg(versao, ',' order by versao) from app.versoes_esquema) as resultado,
       '…,08,09,09a' as esperado,
       (select count(*) = 2 from app.versoes_esquema where versao in ('09', '09a')) as ok
union all select 2, 'Lote da migração (id · responsável declarado)',
       (select id || ' · ' || responsavel from lote), 'um lote', (select count(*) = 1 from app.migracao_lotes)
union all select 3, 'Contagens no banco × manifesto (tabelas que divergem)',
       coalesce((select string_agg(tabela || ' ' || obtido || '≠' || esperado, ', ') from cont where obtido <> esperado), 'nenhuma'), 'nenhuma',
       not exists (select 1 from cont where obtido <> esperado)
union all select 4, 'Monitorias migradas: origem, indicação de envio e régua (E3/E4b/E3m)',
       (select count(*) || ' migradas; ' || count(*) filter (where enviada_na_origem) || ' já enviadas; ' || count(*) filter (where not enviada_na_origem) || ' rascunhos nunca enviados'
          from public.monitorias where origem = 'migracao'),
       'sem nenhuma inconsistência',
       not exists (select 1 from public.monitorias where origem = 'migracao' and enviado_em is null
                   and (enviada_na_origem is null or regua_versao_id is not null or nota_calculada is not null))
union all select 5, 'Nota histórica preservada nas enviadas (nada recalculado)',
       (select count(*) || ' com nota_historica = nota' from public.monitorias where origem = 'migracao' and enviada_na_origem and enviado_em is null and nota_historica = nota),
       'todas as enviadas com nota',
       not exists (select 1 from public.monitorias where origem = 'migracao' and enviada_na_origem and enviado_em is null and nota is not null and nota_historica is distinct from nota)
union all select 6, 'Aline operacional (usr-1): e-mail corporativo, só MONITOR, e-mail anterior guardado',
       (select email || ' · ' || array_to_string(perfis, ',') || ' · anterior: ' || coalesce(extras ->> '_email_original', '—') from public.perfis where id = 'usr-1'),
       'aline.oliveira@… · MONITOR',
       (select email = 'aline.oliveira@mouraleite.com.br' and perfis = '{MONITOR}' and status is distinct from 'INACTIVE' from public.perfis where id = 'usr-1')
union all select 7, 'usr-7 genérico: inativo e sem perfis',
       (select coalesce(status, '—') || ' · {' || array_to_string(perfis, ',') || '}' from public.perfis where id = 'usr-7'), 'INACTIVE · {}',
       coalesce((select status = 'INACTIVE' and cardinality(perfis) = 0 from public.perfis where id = 'usr-7'), true)
union all select 8, 'Erivan: perfil novo GESTOR e supervisor do Relacionamento, com a Aline na equipe',
       (select p.id || ' · ' || p.email || ' · ' || array_to_string(p.perfis, ',') from public.perfis p, erivan e where p.id = e.id),
       'GESTOR, gestor da area-1, usr-1 monitora',
       (select p.perfis = '{GESTOR}' and (select gestor_id from public.areas where id = 'area-1') = p.id
               and exists (select 1 from public.area_monitores where area_id = 'area-1' and monitor_id = 'usr-1' and ativo)
          from public.perfis p, erivan e where p.id = e.id)
union all select 9, 'Réguas publicadas e vigente hoje',
       (select string_agg(id || ' desde ' || vigente_desde, ', ' order by vigente_desde) from public.regua_versoes) || ' · vigente: ' || coalesce(app.regua_vigente(), '—'),
       'regua-1 (2026-08-31), regua-2.0 (2026-10-12) · vigente regua-2.0',
       (select count(*) = 2 from public.regua_versoes where id in ('regua-1', 'regua-2.0')) and app.regua_vigente() = 'regua-2.0'
union all select 10, 'Ocorrências registradas, por classe',
       (select string_agg(classe || ' ' || n, ', ' order by classe) from (select classe, count(*) n from app.migracao_ocorrencias group by classe) x),
       'REMOVIDO_SENSIVEL presente', exists (select 1 from app.migracao_ocorrencias where classe = 'REMOVIDO_SENSIVEL')
union all select 11, 'Nenhuma senha ou sessão no banco (perfis, origem, auditoria)',
       (select count(*)::text from (select extras::text t from public.perfis union all select texto from app.migracao_origem
                                    union all select coalesce(depois::text, '') from public.auditoria) z
         where t ~* '"(password|confirmPassword|senha|perfilAtivo)"[[:space:]]*:'), '0',
       not exists (select 1 from (select extras::text t from public.perfis union all select texto from app.migracao_origem
                                  union all select coalesce(depois::text, '') from public.auditoria) z
                    where t ~* '"(password|confirmPassword|senha|perfilAtivo)"[[:space:]]*:')
union all select 12, 'Auditoria da migração: todas as linhas da transação com o responsável do lote',
       (select count(*) || ' linhas · ' || count(*) filter (where responsavel_declarado = (select responsavel from lote)) || ' declaradas'
          from public.auditoria where transacao = (select transacao from lote)),
       'todas declaradas',
       (select count(*) > 0 and count(*) = count(*) filter (where responsavel_declarado = (select responsavel from lote))
          from public.auditoria where transacao = (select transacao from lote))
union all select 13, 'Quebras na cadeia da auditoria', (select count(*)::text from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra), '0',
       (select count(*) = 0 from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra)
union all select 14, 'Login da Aline ligado ao usr-1 (depois de criar o usuário no Supabase Auth)',
       (select case when auth_user_id is null then 'ainda sem login' else 'ligado' end from public.perfis where id = 'usr-1'), 'ligado',
       (select auth_user_id is not null from public.perfis where id = 'usr-1')
union all select 15, 'Login do Erivan ligado ao perfil dele (depois de criar o usuário no Supabase Auth)',
       (select case when p.auth_user_id is null then 'ainda sem login' else 'ligado' end from public.perfis p, erivan e where p.id = e.id), 'ligado',
       (select p.auth_user_id is not null from public.perfis p, erivan e where p.id = e.id)
union all select 16, 'Perfis com ADMIN (informativo: zero até a conta ADMIN ser definida)',
       (select count(*)::text from public.perfis where 'ADMIN' = any (perfis)), 'informativo', null::boolean
union all select 17, 'ÂNCORA da auditoria — anotar fora do banco',
       (select seq::text || ' | ' || hash from public.auditoria order by seq desc limit 1), 'anotar', null::boolean
order by item;
