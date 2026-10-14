-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 06 — auditoria
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 05.
--
-- O QUE FAZ:
--   1. `public.auditoria`: um registro para CADA inclusão, alteração, exclusão
--      autorizada e TRUNCATE autorizado, em todas as 16 tabelas de dados, com:
--        - o estado ANTES e DEPOIS do registro, completos, e os campos alterados;
--        - QUEM: o login (auth.uid), o perfil do portal e o papel no banco
--          (authenticated = portal, postgres = SQL Editor, service_role...);
--        - QUANDO e em qual transação (alterações salvas juntas ficam juntas);
--        - o MOTIVO, quando a operação foi uma manutenção autorizada.
--   2. Integridade verificável: cada registro guarda uma impressão digital
--      (SHA-256) encadeada com a do registro anterior. Alterar, apagar ou
--      inserir um registro fora de ordem quebra a cadeia — e a conferência
--      mostra onde. Vale até contra o administrador do banco.
--      LIMITE: apagar o ÚLTIMO registro não quebra a cadeia (não há sucessor
--      para acusar). Por isso a conferência mostra a ÂNCORA — número e
--      impressão digital do último registro — para ser anotada FORA do banco
--      (relatório de homologação). Na conferência seguinte, a âncora anotada
--      precisa continuar existindo.
--   3. A auditoria só aceita inclusão, e só pelo banco: o portal não grava,
--      não lê (até o script 07, que libera a leitura ao Administrador), não
--      altera e não apaga nada aqui.
--
-- COMO FUNCIONA:
--   - Um gatilho AFTER em cada tabela chama app.tg_auditoria(), que roda com
--     os privilégios do dono do banco (security definer). Por isso o portal
--     não precisa — e não tem — permissão nenhuma sobre a tabela de auditoria.
--   - Os gatilhos rodam DEPOIS dos de versão e autoria (scripts 00 a 05):
--     o "depois" registrado é exatamente o que ficou gravado.
--   - Para a cadeia não ter ramificações, as gravações de auditoria entram uma
--     de cada vez (uma trava curta, liberada ao fim de cada transação). Com o
--     volume do MonitorIA isso não é perceptível.
--
-- O QUE NÃO FAZ: não audita leituras (o histórico de acessos cobre os logins)
-- nem a tabela de versões do esquema.
--
-- PODE RODAR MAIS DE UMA VEZ.  PARA DESFAZER (só na homologação, se pedido):
--   remover os gatilhos *_z_auditoria e *_z_auditoria_truncate das 16 tabelas;
--   drop table public.auditoria;   -- exige manutenção autorizada se houver dados
--   drop function app.tg_auditoria(), app.tg_auditoria_cadeia(), app.auditoria_hash(public.auditoria);
--   drop sequence app.auditoria_seq;
-- =============================================================================

begin;

-- 1. Tabela de auditoria ----------------------------------------------------------
create sequence if not exists app.auditoria_seq;

create table if not exists public.auditoria (
  seq               bigint      primary key,
  momento           timestamptz not null default now(),
  transacao         bigint      not null default txid_current(),
  tabela            text        not null,
  acao              text        not null,
  chave             jsonb,
  antes             jsonb,
  depois            jsonb,
  campos_alterados  text[],
  autor_uid         uuid,
  autor_perfil_id   text,
  papel             text,
  manutencao_modo   text,
  manutencao_motivo text,
  hash_anterior     text,
  hash              text        not null,

  constraint auditoria_acao_valida check (acao in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'))
);

create index if not exists auditoria_tabela_chave_idx on public.auditoria (tabela, chave);
create index if not exists auditoria_momento_idx      on public.auditoria (momento);
create index if not exists auditoria_autor_idx        on public.auditoria (autor_perfil_id);

comment on table  public.auditoria                  is 'Trilha de auditoria de todas as tabelas de dados. Só inclusão, só pelo banco, com cadeia de impressões digitais.';
comment on column public.auditoria.seq              is 'Ordem da cadeia. Atribuída sob trava: a ordem da sequência é a ordem de gravação.';
comment on column public.auditoria.transacao        is 'Transação do banco: alterações salvas juntas (monitoria e respostas) têm o mesmo número.';
comment on column public.auditoria.chave            is 'Chave do registro afetado (ex.: {"id":"MON-10001"}). Nula em TRUNCATE.';
comment on column public.auditoria.antes            is 'Registro completo antes da operação (UPDATE e DELETE).';
comment on column public.auditoria.depois           is 'Registro completo depois da operação (INSERT e UPDATE), exatamente como ficou gravado.';
comment on column public.auditoria.campos_alterados is 'Em UPDATE: as colunas cujo valor mudou.';
comment on column public.auditoria.autor_uid        is 'Login (auth.uid). Nulo no SQL Editor e em processos internos.';
comment on column public.auditoria.autor_perfil_id  is 'Perfil do portal de quem estava logado (ex.: usr-1).';
comment on column public.auditoria.papel            is 'Papel no banco: authenticated (portal), postgres (SQL Editor), service_role, supabase_auth_admin (login).';
comment on column public.auditoria.manutencao_motivo is 'Motivo declarado (app.manutencao_motivo), quando a operação foi manutenção autorizada.';
comment on column public.auditoria.hash_anterior    is 'Impressão digital do registro anterior da cadeia.';
comment on column public.auditoria.hash             is 'SHA-256 deste registro encadeado ao anterior. Ver app.auditoria_hash().';

-- 2. Impressão digital de um registro de auditoria --------------------------------
-- Usada ao gravar e para conferir. Momento em UTC com microssegundos: o
-- resultado não depende do fuso de quem confere.
create or replace function app.auditoria_hash(a public.auditoria)
returns text
language sql
stable
set search_path = ''
as $$
  select app.digital_texto(concat_ws('|',
    coalesce(a.hash_anterior, ''),
    a.seq::text,
    to_char(a.momento at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    a.transacao::text,
    a.tabela,
    a.acao,
    coalesce(a.chave::text, ''),
    coalesce(a.antes::text, ''),
    coalesce(a.depois::text, ''),
    coalesce(array_to_string(a.campos_alterados, ','), ''),
    coalesce(a.autor_uid::text, ''),
    coalesce(a.autor_perfil_id, ''),
    coalesce(a.papel, ''),
    coalesce(a.manutencao_modo, ''),
    coalesce(a.manutencao_motivo, '')));
$$;

comment on function app.auditoria_hash(public.auditoria) is
  'SHA-256 de um registro de auditoria, encadeado ao hash_anterior. Recalcular e comparar com a coluna hash confere a integridade.';

-- 3. Encadeamento: ordem e impressão digital ---------------------------------------
-- BEFORE INSERT na auditoria. A trava vem ANTES de tirar o número da sequência:
-- assim a ordem dos números é a ordem real de gravação, e cada registro aponta
-- para o anterior já gravado. A trava dura até o fim da transação.
create or replace function app.tg_auditoria_cadeia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('monitoria.auditoria.cadeia'));
  new.seq           := nextval('app.auditoria_seq');
  new.hash_anterior := (select a.hash from public.auditoria a order by a.seq desc limit 1);
  new.hash          := app.auditoria_hash(new);
  return new;
end;
$$;

comment on function app.tg_auditoria_cadeia() is
  'Gatilho BEFORE INSERT em auditoria: numera sob trava e calcula a impressão digital encadeada.';

-- 4. Registro da auditoria (gatilho AFTER em todas as tabelas de dados) -----------
-- security definer: grava na auditoria com os privilégios do dono do banco. O
-- portal não tem permissão sobre a tabela; quem grava é sempre este gatilho.
-- Argumentos do gatilho: as colunas da chave da tabela.
create or replace function app.tg_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registro jsonb;
  v_antes    jsonb;
  v_depois   jsonb;
  v_chave    jsonb;
  v_campos   text[];
  v_papel    text := nullif(current_setting('role', true), 'none');
  v_modo     text := nullif(current_setting('app.manutencao', true), '');
  v_motivo   text := nullif(btrim(coalesce(current_setting('app.manutencao_motivo', true), '')), '');
begin
  if tg_level = 'ROW' then
    if tg_op in ('UPDATE', 'DELETE') then v_antes  := to_jsonb(old); end if;
    if tg_op in ('INSERT', 'UPDATE') then v_depois := to_jsonb(new); end if;
    v_registro := coalesce(v_depois, v_antes);
    select jsonb_object_agg(k, v_registro -> k) into v_chave from unnest(tg_argv) k;

    if tg_op = 'UPDATE' then
      select array_agg(d.key order by d.key) into v_campos
        from jsonb_each(v_depois) d
       where d.value is distinct from v_antes -> d.key;
      -- UPDATE que não muda nada não gera registro.
      if v_campos is null then
        return null;
      end if;
    end if;
  end if;

  insert into public.auditoria
    (tabela, acao, chave, antes, depois, campos_alterados,
     autor_uid, autor_perfil_id, papel, manutencao_modo, manutencao_motivo, hash)
  values
    (tg_table_name, tg_op, v_chave, v_antes, v_depois, v_campos,
     auth.uid(), app.meu_perfil_id(), coalesce(v_papel, session_user),
     v_modo, case when v_modo is not null then v_motivo end, '');

  return null;
end;
$$;

comment on function app.tg_auditoria() is
  'Gatilho AFTER (linha e TRUNCATE) nas tabelas de dados: grava antes, depois, autor e motivo na auditoria.';

revoke execute on function app.auditoria_hash(public.auditoria) from public;
revoke execute on function app.tg_auditoria_cadeia()             from public;
revoke execute on function app.tg_auditoria()                    from public;
revoke all on sequence app.auditoria_seq from public, anon, authenticated;

-- 5. Proteção da própria auditoria --------------------------------------------------
-- Só inclusão (script 02), sem exclusão nem TRUNCATE (script 00). A cadeia
-- roda primeiro na inclusão; o bloqueio de alteração, primeiro na alteração.
create or replace trigger auditoria_a_cadeia
  before insert on public.auditoria
  for each row execute function app.tg_auditoria_cadeia();
create or replace trigger auditoria_bloqueio_alteracao
  before update on public.auditoria
  for each row execute function app.tg_somente_inclusao();
create or replace trigger auditoria_sem_exclusao
  before delete on public.auditoria
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger auditoria_sem_truncate
  before truncate on public.auditoria
  for each statement execute function app.tg_bloquear_exclusao();

alter table public.auditoria enable row level security;
revoke all on table public.auditoria from anon, authenticated;

-- 6. Gatilhos de auditoria nas 16 tabelas de dados ---------------------------------
-- Prefixo "z_" e AFTER: rodam depois de todos os gatilhos de versão e autoria.
create or replace trigger perfis_z_auditoria
  after insert or update or delete on public.perfis
  for each row execute function app.tg_auditoria('id');
create or replace trigger perfis_z_auditoria_truncate
  after truncate on public.perfis
  for each statement execute function app.tg_auditoria();

create or replace trigger areas_z_auditoria
  after insert or update or delete on public.areas
  for each row execute function app.tg_auditoria('id');
create or replace trigger areas_z_auditoria_truncate
  after truncate on public.areas
  for each statement execute function app.tg_auditoria();

create or replace trigger area_monitores_z_auditoria
  after insert or update or delete on public.area_monitores
  for each row execute function app.tg_auditoria('area_id', 'monitor_id');
create or replace trigger area_monitores_z_auditoria_truncate
  after truncate on public.area_monitores
  for each statement execute function app.tg_auditoria();

create or replace trigger colaboradores_z_auditoria
  after insert or update or delete on public.colaboradores
  for each row execute function app.tg_auditoria('id');
create or replace trigger colaboradores_z_auditoria_truncate
  after truncate on public.colaboradores
  for each statement execute function app.tg_auditoria();

create or replace trigger alocacoes_z_auditoria
  after insert or update or delete on public.alocacoes
  for each row execute function app.tg_auditoria('id');
create or replace trigger alocacoes_z_auditoria_truncate
  after truncate on public.alocacoes
  for each statement execute function app.tg_auditoria();

create or replace trigger alocacoes_historico_z_auditoria
  after insert or update or delete on public.alocacoes_historico
  for each row execute function app.tg_auditoria('id');
create or replace trigger alocacoes_historico_z_auditoria_truncate
  after truncate on public.alocacoes_historico
  for each statement execute function app.tg_auditoria();

create or replace trigger criterios_z_auditoria
  after insert or update or delete on public.criterios
  for each row execute function app.tg_auditoria('id');
create or replace trigger criterios_z_auditoria_truncate
  after truncate on public.criterios
  for each statement execute function app.tg_auditoria();

create or replace trigger criterio_subperguntas_z_auditoria
  after insert or update or delete on public.criterio_subperguntas
  for each row execute function app.tg_auditoria('criterio_id', 'id');
create or replace trigger criterio_subperguntas_z_auditoria_truncate
  after truncate on public.criterio_subperguntas
  for each statement execute function app.tg_auditoria();

create or replace trigger regua_versoes_z_auditoria
  after insert or update or delete on public.regua_versoes
  for each row execute function app.tg_auditoria('id');
create or replace trigger regua_versoes_z_auditoria_truncate
  after truncate on public.regua_versoes
  for each statement execute function app.tg_auditoria();

create or replace trigger monitorias_z_auditoria
  after insert or update or delete on public.monitorias
  for each row execute function app.tg_auditoria('id');
create or replace trigger monitorias_z_auditoria_truncate
  after truncate on public.monitorias
  for each statement execute function app.tg_auditoria();

create or replace trigger monitoria_respostas_z_auditoria
  after insert or update or delete on public.monitoria_respostas
  for each row execute function app.tg_auditoria('monitoria_id', 'criterio_id');
create or replace trigger monitoria_respostas_z_auditoria_truncate
  after truncate on public.monitoria_respostas
  for each statement execute function app.tg_auditoria();

create or replace trigger monitoria_evidencias_z_auditoria
  after insert or update or delete on public.monitoria_evidencias
  for each row execute function app.tg_auditoria('monitoria_id', 'lista', 'ordem');
create or replace trigger monitoria_evidencias_z_auditoria_truncate
  after truncate on public.monitoria_evidencias
  for each statement execute function app.tg_auditoria();

create or replace trigger documentos_z_auditoria
  after insert or update or delete on public.documentos
  for each row execute function app.tg_auditoria('colecao', 'id');
create or replace trigger documentos_z_auditoria_truncate
  after truncate on public.documentos
  for each statement execute function app.tg_auditoria();

create or replace trigger catalogos_z_auditoria
  after insert or update or delete on public.catalogos
  for each row execute function app.tg_auditoria('catalogo', 'ordem');
create or replace trigger catalogos_z_auditoria_truncate
  after truncate on public.catalogos
  for each statement execute function app.tg_auditoria();

create or replace trigger configuracoes_z_auditoria
  after insert or update or delete on public.configuracoes
  for each row execute function app.tg_auditoria('chave');
create or replace trigger configuracoes_z_auditoria_truncate
  after truncate on public.configuracoes
  for each statement execute function app.tg_auditoria();

create or replace trigger acessos_log_z_auditoria
  after insert or update or delete on public.acessos_log
  for each row execute function app.tg_auditoria('seq');
create or replace trigger acessos_log_z_auditoria_truncate
  after truncate on public.acessos_log
  for each statement execute function app.tg_auditoria();

-- 7. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('06', 'Auditoria: antes e depois de toda alteração nas 16 tabelas, autor, motivo de manutenção e cadeia de impressões digitais')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select versao, descricao from app.versoes_esquema order by versao;
--   Integridade da cadeia (deve dar 0):
--   select count(*) from (select a.hash <> app.auditoria_hash(a)
--                            or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra
--                           from public.auditoria a) x where quebra;
