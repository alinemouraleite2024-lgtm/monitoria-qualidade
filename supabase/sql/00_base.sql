-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 00 — base do esquema
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO (monitoria-homologacao), pelo
--             SQL Editor do Supabase. Nunca na produção sem nova autorização.
--
-- O QUE FAZ (e só isso):
--   1. Habilita a extensão pgcrypto (impressões digitais SHA-256).
--   2. Cria o schema privado `app`, onde ficam as funções internas. Ele NÃO é
--      exposto pela API do Supabase; anon e authenticated não têm acesso a ele
--      (o script 01 libera apenas as funções de perfil usadas pelas regras RLS).
--   3. Cria `app.versoes_esquema`, que registra cada script aplicado.
--   4. Cria `app.tg_controle_registro()`: em toda tabela de dados, carimba
--      versão, autor e datas — e RECUSA a alteração feita sobre uma versão
--      desatualizada (duas pessoas editando o mesmo registro).
--   5. Cria `app.tg_bloquear_exclusao()`: nenhuma tabela do MonitorIA aceita
--      exclusão nem TRUNCATE no uso normal. A única exceção é a manutenção ou
--      restauração autorizada, descrita abaixo.
--   6. Cria `app.digital_texto()` e `app.digital_json()`: impressões digitais
--      usadas para provar que um registro migrado é idêntico ao original.
--
-- MANUTENÇÃO E RESTAURAÇÃO AUTORIZADAS
--   Exclusão/TRUNCATE só passa quando as quatro condições valem juntas:
--     a) o comando é executado pelo administrador do banco (role postgres, que
--        é quem usa o SQL Editor) — nunca pelo portal, que roda como
--        anon/authenticated, nem pela chave secreta da API (service_role);
--     a2) não há usuário do portal logado na requisição — o que barra também
--        funções privilegiadas chamadas a partir do portal;
--     b) a transação declara o modo:    set local app.manutencao = 'restauracao';
--        (ou 'manutencao');
--     c) a transação declara o motivo:  set local app.manutencao_motivo = '...';
--        com pelo menos 10 caracteres.
--   Exemplo:
--     begin;
--       set local app.manutencao = 'restauracao';
--       set local app.manutencao_motivo = 'Teste de restauração da homologação, 11/10/2026';
--       truncate public.tabela_x;
--     commit;
--   O `set local` vale só até o fim da transação. O script 06 registra essas
--   operações na auditoria, com o motivo.
--
-- O QUE NÃO FAZ: não cria nenhuma tabela de dados, não grava nenhum dado, não
-- altera nada do portal atual nem do localStorage.
--
-- PODE RODAR MAIS DE UMA VEZ: todos os comandos são "se não existir" ou
-- "substituir função"; a segunda execução não muda nada.
--
-- PARA DESFAZER (somente na homologação, e só se pedido):
--   drop schema app cascade;
--
-- Os gatilhos (4) e (5) só passam a valer quando cada tabela os declarar, nos
-- scripts seguintes. Aqui eles apenas passam a existir.
--
-- Revisão de 10/10/2026: o `citext` saiu. Testado no PGlite, ele compara de
-- forma sensível a maiúsculas dentro de funções com search_path vazio (que é o
-- padrão seguro adotado aqui), sem dar erro. Os e-mails passam a ser gravados
-- sempre em minúsculas, com regra no próprio banco (script 01).
--
-- Revisão final antes da homologação: retirado o `revoke ... from anon,
-- authenticated` no schema `app`. Rodar o 00 de novo depois do 01 desfaria a
-- permissão que o 01 dá ao portal. A tabela de versões ganhou proteção própria.
--
-- Revisão de concorrência: a versão lida passou a ser OBRIGATÓRIA (versao_lida,
-- MI428). Antes, um UPDATE que simplesmente não mencionasse a versão passava e
-- sobrescrevia a alteração de outra pessoa — comprovado no PGlite. A exclusão
-- autorizada passou a exigir também ausência de usuário logado.
-- =============================================================================

begin;

-- 1. Extensão -----------------------------------------------------------------
-- No Supabase, as extensões ficam no schema `extensions`.
create extension if not exists pgcrypto with schema extensions;

-- 2. Schema privado -----------------------------------------------------------
create schema if not exists app;

-- Um schema novo não dá acesso a ninguém além do dono. Aqui só se garante que
-- PUBLIC não tenha nada. NÃO se retira nada de anon/authenticated: o script 01
-- concede ao portal o uso das funções de perfil, e rodar este 00 de novo depois
-- do 01 não pode desfazer essa concessão.
revoke all on schema app from public;

-- 3. Controle de versões do esquema -------------------------------------------
create table if not exists app.versoes_esquema (
  versao        text        primary key,
  descricao     text        not null,
  aplicado_em   timestamptz not null default now(),
  aplicado_por  text        not null default current_user
);

comment on table app.versoes_esquema is
  'Um registro por script SQL aplicado. Scripts só acrescentam; nenhum apaga dados.';

-- Só o dono do banco lê e grava esta tabela, mesmo depois de o script 01
-- liberar ao portal o uso do schema `app`.
revoke all on table app.versoes_esquema from public, anon, authenticated;

-- 4. Controle de registro: versão, autoria e alteração simultânea -------------
--
-- Toda tabela de dados terá as colunas:
--   versao integer not null, versao_lida integer (sempre nula quando gravada),
--   criado_em timestamptz, criado_por uuid, atualizado_em timestamptz, atualizado_por uuid
-- e a regra:  check (versao_lida is null)
--
-- Regra de alteração simultânea — a versão lida é OBRIGATÓRIA:
--   - quem altera informa em `versao_lida` a versão que carregou;
--   - sem `versao_lida`, a alteração é recusada (MI428);
--   - se o registro mudou nesse meio-tempo, `versao_lida` não bate com a versão
--     atual e a alteração é recusada (MI409);
--   - `versao` é sempre calculada aqui; o valor enviado é ignorado;
--   - `versao_lida` é esvaziada antes de gravar (só serve para a conferência).
-- Única dispensa: o administrador do banco SEM usuário do portal logado (SQL
-- Editor e processos internos, como o vínculo de login). Mesmo assim a versão
-- sobe, e quem estiver editando no portal recebe o aviso de conflito.
-- Funções privilegiadas chamadas pelo portal têm usuário logado: não são
-- dispensadas e precisam repassar a versão lida.
--
-- `auth.uid()` é o usuário logado no Supabase. Em comandos rodados pelo SQL
-- Editor ele é nulo — por isso as colunas de autoria aceitam nulo.
create or replace function app.tg_controle_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.versao         := 1;
    new.versao_lida    := null;
    new.criado_em      := now();
    new.criado_por     := auth.uid();
    new.atualizado_em  := new.criado_em;
    new.atualizado_por := new.criado_por;
    return new;
  end if;

  -- UPDATE
  if new.versao_lida is null then
    if not (current_user in ('postgres', 'supabase_admin') and auth.uid() is null) then
      raise exception
        'A alteração não informou a versão do registro que foi carregada.'
        using errcode = 'MI428',
              hint    = 'Envie versao_lida com o valor de versao lido antes de editar.';
    end if;
  elsif new.versao_lida <> old.versao then
    raise exception
      'Este registro foi alterado por outra pessoa enquanto você editava (versão lida: %, versão atual: %).',
      new.versao_lida, old.versao
      using errcode = 'MI409',
            hint    = 'Recarregue o registro e refaça a alteração.';
  end if;

  new.versao_lida    := null;
  new.versao         := old.versao + 1;
  new.criado_em      := old.criado_em;   -- autoria original é imutável
  new.criado_por     := old.criado_por;
  new.atualizado_em  := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

comment on function app.tg_controle_registro() is
  'Gatilho BEFORE INSERT OR UPDATE: carimba versão/autoria e recusa alteração sobre versão desatualizada (MI409).';

-- 5. Bloqueio de exclusão, com manutenção autorizada --------------------------
--
-- Usar em dois gatilhos por tabela:
--   BEFORE DELETE   ... FOR EACH ROW       EXECUTE FUNCTION app.tg_bloquear_exclusao();
--   BEFORE TRUNCATE ... FOR EACH STATEMENT EXECUTE FUNCTION app.tg_bloquear_exclusao();
--
-- A verificação fica DENTRO desta função, e ela NÃO é security definer: assim
-- `current_user` é quem executou o comando. O portal roda como anon ou
-- authenticated e nunca passa, mesmo que consiga declarar as variáveis. A chave
-- secreta da API (service_role) também nunca passa.
-- Funções security definer rodam como o dono do banco; por isso a exclusão
-- também exige que NÃO haja usuário do portal logado (auth.uid() nulo). Uma
-- função privilegiada chamada pelo portal sempre tem usuário logado e é recusada.
create or replace function app.tg_bloquear_exclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin')
     and auth.uid() is null
     and coalesce(current_setting('app.manutencao', true), '') in ('restauracao', 'manutencao')
     and length(btrim(coalesce(current_setting('app.manutencao_motivo', true), ''))) >= 10
  then
    if tg_level = 'ROW' then
      return old;      -- exclusão de linha autorizada
    end if;
    return null;       -- TRUNCATE autorizado (o retorno é ignorado)
  end if;

  raise exception
    'Exclusão não é permitida no MonitorIA (tabela %). Cancele pela situação ou marque como inativo.',
    tg_table_name
    using errcode = 'MI403',
          hint    = 'Manutenção ou restauração exigem o administrador do banco, app.manutencao e app.manutencao_motivo na mesma transação.';
end;
$$;

comment on function app.tg_bloquear_exclusao() is
  'Gatilho BEFORE DELETE/TRUNCATE: recusa exclusão (MI403), salvo manutenção autorizada pelo administrador do banco com motivo.';

-- 6. Impressões digitais ------------------------------------------------------
-- digital_texto: SHA-256 do texto exato, byte a byte. Usado para conferir a
--   cópia original de cada chave do localStorage guardada na migração.
-- digital_json: SHA-256 do conteúdo JSON normalizado (a ordem das chaves não
--   importa). Usado para provar que o registro reconstruído a partir das
--   tabelas tem o mesmo conteúdo do original.
create or replace function app.digital_texto(conteudo text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(conteudo, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function app.digital_json(conteudo jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(conteudo::text, 'UTF8'), 'sha256'), 'hex');
$$;

-- Funções no Postgres nascem executáveis por todos; aqui, ninguém além do dono.
revoke execute on function app.tg_controle_registro()  from public;
revoke execute on function app.tg_bloquear_exclusao()  from public;
revoke execute on function app.digital_texto(text)     from public;
revoke execute on function app.digital_json(jsonb)     from public;

-- 7. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('00', 'Base: pgcrypto, schema app, controle de registro, bloqueio de exclusão com manutenção autorizada, impressões digitais')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select * from app.versoes_esquema;
--   select app.digital_texto('MonitorIA');   -- 64 caracteres hexadecimais
