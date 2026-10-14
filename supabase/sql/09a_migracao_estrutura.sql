-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 09a — estrutura da migração
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 08.
-- NÃO GRAVA DADOS. Cria só o lugar onde a migração (09b, gerado a partir da
-- exportação final do navegador) registra a proveniência de cada dado.
--
-- O QUE CRIA (tudo no schema `app`, privado: o portal não lê nem grava)
--   app.migracao_lotes        um registro por migração aplicada: impressão
--                             digital do conteúdo, manifesto (contagens, chaves,
--                             decisões aplicadas), quem declarou, transação.
--   app.migracao_origem       o texto ORIGINAL de cada chave do localStorage,
--                             com a impressão digital — sem senha, sem sessão.
--                             Em pm2_users os campos de senha são retirados e a
--                             retirada fica listada (campo e quantidade, nunca o
--                             valor).
--   app.migracao_ocorrencias  o que a migração NÃO copiou literalmente, por
--                             classe:
--                               TRANSFORMADO_POR_DECISAO  valor alterado por decisão
--                                                         aprovada (o original fica
--                                                         em extras._<campo>_original)
--                               CRIADO_POR_DECISAO        registro novo (ex.: Erivan)
--                               REMOVIDO_SENSIVEL         senha/sessão retirada
--                               DIVERGENCIA_REGISTRADA    achado documentado e NÃO
--                                                         corrigido (ex.: nota da
--                                                         MON-10001 × Régua 1)
--                               EVIDENCIA                 material guardado só como
--                                                         prova (ex.: régua de 08/10)
--   app.migracao_linha_confere()  compara a linha esperada (do gerador) com a
--                             gravada; momentos são comparados como instantes.
--
-- PROTEÇÃO: as três tabelas só aceitam inclusão (sem alteração nem exclusão,
-- salvo a manutenção autorizada do script 00) e entram na auditoria (06).
--
-- PODE RODAR MAIS DE UMA VEZ.
-- PARA DESFAZER (só na homologação, se pedido, e antes de qualquer 09b):
--   drop table app.migracao_ocorrencias, app.migracao_origem, app.migracao_lotes;
--   drop function app.migracao_linha_confere(jsonb, jsonb), app.migracao_mesmo_instante(text, text);
-- =============================================================================

begin;

-- 1. Lotes ---------------------------------------------------------------------------
create table if not exists app.migracao_lotes (
  id                text        primary key,
  conteudo_sha256   text        not null unique,
  exportado_em      text,
  exportado_de      text,
  versao_banco_navegador text,
  gerador_versao    text        not null,
  manifesto         jsonb       not null,
  responsavel       text        not null,
  sessao_usuario    text        not null default session_user,
  transacao         bigint      not null default txid_current(),
  aplicado_em       timestamptz not null default now(),

  constraint migracao_lotes_id_formato   check (id ~ '^mig-[0-9a-f]{12}$'),
  constraint migracao_lotes_sha_formato  check (conteudo_sha256 ~ '^[0-9a-f]{64}$'),
  constraint migracao_lotes_manifesto    check (jsonb_typeof(manifesto) = 'object')
);

comment on table  app.migracao_lotes                 is 'Uma linha por migração aplicada (09b). Só inclusão.';
comment on column app.migracao_lotes.conteudo_sha256 is 'SHA-256 do conteúdo migrado (já SEM senhas e sessão). Impede aplicar a mesma exportação duas vezes. A impressão do arquivo original fica só no manifesto local, fora do banco.';
comment on column app.migracao_lotes.responsavel     is 'Responsável declarado em app.responsavel (06, R5): id de um ADMIN ativo ou, antes de existir qualquer ADMIN, "Nome <e-mail>" de quem executou (implantação).';

-- 2. Origem --------------------------------------------------------------------------
create table if not exists app.migracao_origem (
  lote_id   text    not null references app.migracao_lotes (id) on delete restrict,
  chave     text    not null,
  texto     text    not null,
  sha256    text    not null,
  redacoes  jsonb   not null default '[]'::jsonb,
  ordem     integer not null,
  primary key (lote_id, chave),

  constraint migracao_origem_sha_confere check (sha256 = app.digital_texto(texto)),
  constraint migracao_origem_redacoes    check (jsonb_typeof(redacoes) = 'array'),
  -- Defesa adicional: nenhum texto guardado carrega campo de senha ou a sessão.
  constraint migracao_origem_sem_segredo check (
    texto !~* '"(password|confirmPassword|senha|token|accessToken|refreshToken|secret)"[[:space:]]*:'
    and chave <> 'pm2_auth_session')
);

comment on table  app.migracao_origem          is 'Texto original de cada chave do localStorage (sem senha e sem sessão), com a impressão digital SHA-256. Só inclusão.';
comment on column app.migracao_origem.redacoes is 'O que foi retirado do texto: [{"campo":"password","ocorrencias":7}]. Nunca o valor.';

-- 3. Ocorrências ---------------------------------------------------------------------
create table if not exists app.migracao_ocorrencias (
  lote_id   text    not null references app.migracao_lotes (id) on delete restrict,
  seq       integer not null,
  classe    text    not null,
  entidade  text    not null,
  chave     text,
  campo     text,
  antes     jsonb,
  depois    jsonb,
  decisao   text,
  detalhe   text,
  primary key (lote_id, seq),

  constraint migracao_ocorrencias_classe check (classe in
    ('TRANSFORMADO_POR_DECISAO', 'CRIADO_POR_DECISAO', 'REMOVIDO_SENSIVEL', 'DIVERGENCIA_REGISTRADA', 'EVIDENCIA'))
);

comment on table app.migracao_ocorrencias is 'Tudo o que a migração não copiou literalmente: decisões aplicadas, registros criados, retiradas de dado sensível, divergências documentadas sem correção e evidências. Só inclusão.';

-- 4. Proteção: só inclusão, sem exclusão, auditadas --------------------------------
create or replace trigger migracao_lotes_bloqueio_alteracao       before update   on app.migracao_lotes       for each row       execute function app.tg_somente_inclusao();
create or replace trigger migracao_lotes_sem_exclusao             before delete   on app.migracao_lotes       for each row       execute function app.tg_bloquear_exclusao();
create or replace trigger migracao_lotes_sem_truncate             before truncate on app.migracao_lotes       for each statement execute function app.tg_bloquear_exclusao();
create or replace trigger migracao_origem_bloqueio_alteracao      before update   on app.migracao_origem      for each row       execute function app.tg_somente_inclusao();
create or replace trigger migracao_origem_sem_exclusao            before delete   on app.migracao_origem      for each row       execute function app.tg_bloquear_exclusao();
create or replace trigger migracao_origem_sem_truncate            before truncate on app.migracao_origem      for each statement execute function app.tg_bloquear_exclusao();
create or replace trigger migracao_ocorrencias_bloqueio_alteracao before update   on app.migracao_ocorrencias for each row       execute function app.tg_somente_inclusao();
create or replace trigger migracao_ocorrencias_sem_exclusao       before delete   on app.migracao_ocorrencias for each row       execute function app.tg_bloquear_exclusao();
create or replace trigger migracao_ocorrencias_sem_truncate       before truncate on app.migracao_ocorrencias for each statement execute function app.tg_bloquear_exclusao();

create or replace trigger migracao_lotes_z_auditoria          after insert or update or delete on app.migracao_lotes       for each row       execute function app.tg_auditoria('id');
create or replace trigger migracao_lotes_z_auditoria_truncate after truncate                   on app.migracao_lotes       for each statement execute function app.tg_auditoria();
create or replace trigger migracao_origem_z_auditoria         after insert or update or delete on app.migracao_origem      for each row       execute function app.tg_auditoria('lote_id', 'chave');
create or replace trigger migracao_origem_z_auditoria_truncate after truncate                  on app.migracao_origem      for each statement execute function app.tg_auditoria();
create or replace trigger migracao_ocorrencias_z_auditoria    after insert or update or delete on app.migracao_ocorrencias for each row       execute function app.tg_auditoria('lote_id', 'seq');
create or replace trigger migracao_ocorrencias_z_auditoria_truncate after truncate             on app.migracao_ocorrencias for each statement execute function app.tg_auditoria();

-- 5. Comparação linha esperada × gravada -----------------------------------------------
create or replace function app.migracao_mesmo_instante(p_a text, p_b text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_a::timestamptz = p_b::timestamptz;
exception when others then
  return false;
end;
$$;

-- Toda chave da linha esperada precisa existir na gravada com o mesmo valor
-- (igualdade jsonb; textos de momento comparados como instantes, porque o banco
-- devolve o horário no fuso da sessão).
create or replace function app.migracao_linha_confere(p_esperado jsonb, p_gravado jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(
           p_gravado ? e.key
           and (e.value = p_gravado -> e.key
                or (jsonb_typeof(e.value) = 'string' and jsonb_typeof(p_gravado -> e.key) = 'string'
                    and (e.value #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                    and app.migracao_mesmo_instante(e.value #>> '{}', p_gravado ->> e.key)))), true)
    from jsonb_each(p_esperado) e;
$$;

-- 6. Acesso: nada para o portal --------------------------------------------------------
alter table app.migracao_lotes       enable row level security;
alter table app.migracao_origem      enable row level security;
alter table app.migracao_ocorrencias enable row level security;
revoke all on table app.migracao_lotes, app.migracao_origem, app.migracao_ocorrencias from public, anon, authenticated;
revoke execute on function app.migracao_mesmo_instante(text, text)  from public, anon, authenticated;
revoke execute on function app.migracao_linha_confere(jsonb, jsonb) from public, anon, authenticated;

-- 7. Registro deste script ------------------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('09a', 'Estrutura da migração: lotes, texto original de cada chave (sem senha/sessão), ocorrências por classe; só inclusão, auditadas, fechadas ao portal')
on conflict (versao) do nothing;

commit;
