-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 07 — segurança (acesso do portal)
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 06.
--
-- É O PRIMEIRO SCRIPT QUE LIBERA ACESSO AO PORTAL. Até aqui, nenhuma tabela
-- podia ser lida ou gravada pelo navegador. A partir dele, o portal acessa as
-- tabelas do schema `public` pela Data API — e cada linha passa pelas regras
-- abaixo (RLS). O schema `app` continua fora da API.
--
-- PRINCÍPIOS
--   - Sem login, nada: o papel `anon` não recebe permissão em nenhuma tabela.
--   - Logado sem perfil ativo no MonitorIA (perfil inexistente, INACTIVE ou
--     BLOCKED): zero registros em todas as tabelas.
--   - Ninguém exclui nada: nenhum perfil recebe DELETE nem TRUNCATE.
--   - CONTAS SEPARADAS (decisão de 12/10/2026): a administração é feita por
--     contas próprias, pessoais e exclusivamente ADMIN. Ninguém acumula ADMIN
--     com perfil operacional (R1), e o portal não concede, retira nem altera
--     acesso administrativo, nem religa logins a perfis (R2): isso só no SQL
--     Editor, com responsável declarado e auditado (script 06, revisão R5).
--   - MFA OBRIGATÓRIO PARA ADMIN (R4): a conta administrativa só tem acesso
--     numa sessão com segundo fator (aal2). Sem ele, vê zero registros e não
--     grava nada — como alguém sem perfil.
--
-- MATRIZ (L = lê, G = grava: inclui e altera; — = nada). ADMIN = conta
-- administrativa COM MFA; sem MFA ela equivale à coluna "sem perfil".
--
--   Tabela                         ADMIN   GESTOR          MONITOR         sem perfil
--   perfis                         L G     L               L               —
--   areas, area_monitores          L G     L               L               —
--   colaboradores                  L G     L               L               —
--   alocacoes (carteiras)          L       L G             L               —
--   alocacoes_historico            L       L + inclui (*)  L               —
--   criterios, sub-perguntas       L G     L               L               —
--   regua_versoes                  L + inclui (só inclusão)  L      L      —
--   monitorias, respostas,         L tudo  L da sua equipe L as suas       —
--     evidências                   (gravação: só pelas funções do script 08, para todos)
--   documentos (metas, planos,     L       L G             L               —
--     agenda, férias, demandas...)
--   catalogos                      L G     L + inclui categoria  L + inclui categoria  —
--   configuracoes                  L G     L               L               —
--   acessos_log                    L + inclui  inclui      inclui          —
--   auditoria                      L       —               —               —
--   (*) o autor declarado no histórico (alterado_por) tem de ser quem está logado.
--
-- POR QUE MONITORIAS NÃO TÊM GRAVAÇÃO DIRETA
--   O plano aprovado define que monitoria e respostas são salvas juntas, numa
--   transação, e que o Supervisor só muda a situação por funções próprias
--   (validar, reprovar, devolver, confirmar zeramento). Essas funções vêm no
--   script 08 e conferem perfil, situação e campos. Sem gravação direta, o
--   Supervisor não tem como editar uma avaliação — nem pela API.
--
-- ESCOPO DE LEITURA DAS MONITORIAS (igual ao que o portal mostra hoje)
--   - ADMIN (com MFA): todas.
--   - GESTOR: as dos monitores das áreas ATIVAS em que ele é o supervisor
--     (area_monitores ativos), e as que ele mesmo registrou.
--   - MONITOR: as que avaliou (monitor_id) ou registrou (registrado_por).
--   Respostas e evidências seguem a monitoria: quem não vê a monitoria não vê
--   as respostas.
--
-- ATENÇÃO — ORDEM DE EXECUÇÃO: os scripts 01 a 06 retiram as permissões do
-- portal das próprias tabelas. Se algum deles for rodado de novo DEPOIS deste,
-- o portal perde o acesso àquelas tabelas (falha segura: fecha, não expõe).
-- Basta rodar este 07 de novo em seguida para restaurar.
--
-- PODE RODAR MAIS DE UMA VEZ (políticas são recriadas).
-- PARA DESFAZER (só na homologação, se pedido): revogar as permissões de
--   authenticated nas tabelas de public e remover as políticas *_ler,
--   *_incluir e *_alterar. As tabelas voltam a ficar fechadas ao portal.
-- =============================================================================

begin;

-- 1. Equipe do supervisor ----------------------------------------------------------
-- Monitores das áreas ativas em que quem está logado é o supervisor. Espelha
-- getEquipeDoGestor do portal (área ativa, gestor = eu, monitores da área).
-- security definer: lê áreas sem depender das regras RLS dessas tabelas.
create or replace function app.equipe_do_gestor()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct am.monitor_id), '{}'::text[])
    from public.areas a
    join public.area_monitores am on am.area_id = a.id and am.ativo
   where app.tem_perfil('GESTOR')
     and a.ativo is true
     and a.gestor_id = app.meu_perfil_id();
$$;

comment on function app.equipe_do_gestor() is
  'Monitores das áreas ativas supervisionadas por quem está logado (perfil GESTOR). Vazio para os demais.';

revoke execute on function app.equipe_do_gestor() from public;
grant  execute on function app.equipe_do_gestor() to authenticated;

-- 1b. Administração com MFA e acesso liberado (R4) --------------------------------
-- auth.jwt() ->> 'aal' é o nível de autenticação da sessão: aal2 = com segundo
-- fator. Não são security definer: usam só funções já liberadas ao portal.
create or replace function app.sou_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.tem_perfil('ADMIN') and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function app.usuario_liberado()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.usuario_ativo()
     and (not app.tem_perfil('ADMIN') or coalesce(auth.jwt() ->> 'aal', '') = 'aal2');
$$;

comment on function app.sou_admin() is
  'Verdadeiro só para conta ADMIN ativa numa sessão com segundo fator (aal2).';
comment on function app.usuario_liberado() is
  'Perfil ativo e, se for conta ADMIN, sessão com segundo fator. Base de toda leitura e gravação do portal.';

revoke execute on function app.sou_admin()        from public;
revoke execute on function app.usuario_liberado() from public;
grant  execute on function app.sou_admin()        to authenticated;
grant  execute on function app.usuario_liberado() to authenticated;

-- 1c. ADMIN exclusivo (R1) ---------------------------------------------------------
-- Um perfil com ADMIN não tem nenhum outro perfil. Vale para todos, inclusive
-- para o SQL Editor e a migração.
alter table public.perfis drop constraint if exists perfis_admin_exclusivo;
alter table public.perfis add  constraint perfis_admin_exclusivo
  check (not ('ADMIN' = any (perfis)) or perfis = array['ADMIN']::text[]);

-- 1d. Acesso administrativo e vínculo de login: nunca pelo portal (R2) -------------
-- Gatilho próprio (não altera a proteção do script 01). Pelo portal — qualquer
-- papel que não seja o administrador do banco — é recusado:
--   - incluir perfil com ADMIN, ou incluir perfil já ligado a um login;
--   - dar ou retirar ADMIN de um perfil;
--   - mudar perfis, situação, e-mail ou login de um perfil ADMIN;
--   - religar qualquer perfil a outro login (auth_user_id).
-- O SQL Editor (com responsável declarado, script 06) e o vínculo automático
-- de login (que roda como dono do banco) continuam podendo.
create or replace function app.tg_perfis_admin_controlado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if 'ADMIN' = any (new.perfis) then
      raise exception 'Acesso administrativo não é concedido pelo portal.'
        using errcode = 'MI403', hint = 'Procedimento administrativo no SQL Editor, com responsável declarado.';
    end if;
    if new.auth_user_id is not null then
      raise exception 'O vínculo com o login é feito pelo próprio login, não pelo portal.'
        using errcode = 'MI403';
    end if;
    return new;
  end if;

  if ('ADMIN' = any (new.perfis)) is distinct from ('ADMIN' = any (old.perfis)) then
    raise exception 'Acesso administrativo não é concedido nem retirado pelo portal.'
      using errcode = 'MI403', hint = 'Procedimento administrativo no SQL Editor, com responsável declarado.';
  end if;
  if 'ADMIN' = any (old.perfis)
     and (new.perfis, new.status, new.email, new.auth_user_id)
         is distinct from (old.perfis, old.status, old.email, old.auth_user_id) then
    raise exception 'Conta administrativa não é alterada pelo portal.'
      using errcode = 'MI403', hint = 'Procedimento administrativo no SQL Editor, com responsável declarado.';
  end if;
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'O vínculo de um perfil com o login não é alterado pelo portal.'
      using errcode = 'MI403';
  end if;
  return new;
end;
$$;

comment on function app.tg_perfis_admin_controlado() is
  'Gatilho BEFORE INSERT/UPDATE em perfis: o portal não concede, retira nem altera acesso administrativo, nem religa logins (R2).';

revoke execute on function app.tg_perfis_admin_controlado() from public;

-- Nome começa por "a_": roda antes da proteção e do controle de versão.
create or replace trigger perfis_a_admin_controlado
  before insert or update on public.perfis
  for each row execute function app.tg_perfis_admin_controlado();

-- 2. Permissões de tabela (o que cada papel pode TENTAR; a RLS decide as linhas) ---
-- anon: nada. authenticated: leitura em tudo e gravação só onde há política.
-- Nenhuma tabela recebe DELETE ou TRUNCATE.
revoke all on table
  public.perfis, public.areas, public.area_monitores, public.colaboradores,
  public.alocacoes, public.alocacoes_historico, public.criterios,
  public.criterio_subperguntas, public.regua_versoes, public.monitorias,
  public.monitoria_respostas, public.monitoria_evidencias, public.documentos,
  public.catalogos, public.configuracoes, public.acessos_log, public.auditoria
from anon, authenticated;

grant select on table
  public.perfis, public.areas, public.area_monitores, public.colaboradores,
  public.alocacoes, public.alocacoes_historico, public.criterios,
  public.criterio_subperguntas, public.regua_versoes, public.monitorias,
  public.monitoria_respostas, public.monitoria_evidencias, public.documentos,
  public.catalogos, public.configuracoes, public.acessos_log, public.auditoria
to authenticated;

grant insert, update on table
  public.perfis, public.areas, public.area_monitores, public.colaboradores,
  public.alocacoes, public.criterios, public.criterio_subperguntas,
  public.documentos, public.catalogos, public.configuracoes
to authenticated;

-- Só inclusão (o histórico, as versões da régua e o histórico de acessos já
-- recusam alteração por gatilho; aqui nem a permissão é dada).
grant insert on table public.alocacoes_historico, public.regua_versoes, public.acessos_log to authenticated;

-- 3. Leitura -----------------------------------------------------------------------
-- Tudo que é cadastro e configuração: qualquer pessoa com perfil ativo.
drop policy if exists perfis_ler                on public.perfis;
drop policy if exists areas_ler                 on public.areas;
drop policy if exists area_monitores_ler        on public.area_monitores;
drop policy if exists colaboradores_ler         on public.colaboradores;
drop policy if exists alocacoes_ler             on public.alocacoes;
drop policy if exists alocacoes_historico_ler   on public.alocacoes_historico;
drop policy if exists criterios_ler             on public.criterios;
drop policy if exists criterio_subperguntas_ler on public.criterio_subperguntas;
drop policy if exists regua_versoes_ler         on public.regua_versoes;
drop policy if exists documentos_ler            on public.documentos;
drop policy if exists catalogos_ler             on public.catalogos;
drop policy if exists configuracoes_ler         on public.configuracoes;

create policy perfis_ler                on public.perfis                for select to authenticated using ((select app.usuario_liberado()));
create policy areas_ler                 on public.areas                 for select to authenticated using ((select app.usuario_liberado()));
create policy area_monitores_ler        on public.area_monitores        for select to authenticated using ((select app.usuario_liberado()));
create policy colaboradores_ler         on public.colaboradores         for select to authenticated using ((select app.usuario_liberado()));
create policy alocacoes_ler             on public.alocacoes             for select to authenticated using ((select app.usuario_liberado()));
create policy alocacoes_historico_ler   on public.alocacoes_historico   for select to authenticated using ((select app.usuario_liberado()));
create policy criterios_ler             on public.criterios             for select to authenticated using ((select app.usuario_liberado()));
create policy criterio_subperguntas_ler on public.criterio_subperguntas for select to authenticated using ((select app.usuario_liberado()));
create policy regua_versoes_ler         on public.regua_versoes         for select to authenticated using ((select app.usuario_liberado()));
create policy documentos_ler            on public.documentos            for select to authenticated using ((select app.usuario_liberado()));
create policy catalogos_ler             on public.catalogos             for select to authenticated using ((select app.usuario_liberado()));
create policy configuracoes_ler         on public.configuracoes         for select to authenticated using ((select app.usuario_liberado()));

-- Monitorias: pelo escopo de cada perfil.
drop policy if exists monitorias_ler on public.monitorias;
create policy monitorias_ler on public.monitorias for select to authenticated using (
  (select app.sou_admin())
  or ((select app.tem_perfil('MONITOR'))
      and (monitor_id = (select app.meu_perfil_id()) or registrado_por = (select app.meu_perfil_id())))
  or ((select app.tem_perfil('GESTOR'))
      and (monitor_id in (select unnest(app.equipe_do_gestor()))
           or registrado_por = (select app.meu_perfil_id())
           or retroativo_por = (select app.meu_perfil_id())))
);

-- Respostas e evidências: visíveis se, e somente se, a monitoria for visível
-- (a consulta à monitoria passa pela política acima).
drop policy if exists monitoria_respostas_ler  on public.monitoria_respostas;
drop policy if exists monitoria_evidencias_ler on public.monitoria_evidencias;
create policy monitoria_respostas_ler on public.monitoria_respostas for select to authenticated using (
  exists (select 1 from public.monitorias m where m.id = monitoria_id));
create policy monitoria_evidencias_ler on public.monitoria_evidencias for select to authenticated using (
  exists (select 1 from public.monitorias m where m.id = monitoria_id));

-- Histórico de acessos e auditoria: só o Administrador lê.
drop policy if exists acessos_log_ler on public.acessos_log;
drop policy if exists auditoria_ler   on public.auditoria;
create policy acessos_log_ler on public.acessos_log for select to authenticated using ((select app.sou_admin()));
create policy auditoria_ler   on public.auditoria   for select to authenticated using ((select app.sou_admin()));

-- 4. Gravação: Administrador (cadastros, régua, configurações) ----------------------
drop policy if exists perfis_incluir                on public.perfis;
drop policy if exists perfis_alterar                on public.perfis;
drop policy if exists areas_incluir                 on public.areas;
drop policy if exists areas_alterar                 on public.areas;
drop policy if exists area_monitores_incluir        on public.area_monitores;
drop policy if exists area_monitores_alterar        on public.area_monitores;
drop policy if exists colaboradores_incluir         on public.colaboradores;
drop policy if exists colaboradores_alterar         on public.colaboradores;
drop policy if exists criterios_incluir             on public.criterios;
drop policy if exists criterios_alterar             on public.criterios;
drop policy if exists criterio_subperguntas_incluir on public.criterio_subperguntas;
drop policy if exists criterio_subperguntas_alterar on public.criterio_subperguntas;
drop policy if exists regua_versoes_incluir         on public.regua_versoes;
drop policy if exists configuracoes_incluir         on public.configuracoes;
drop policy if exists configuracoes_alterar         on public.configuracoes;

create policy perfis_incluir                on public.perfis                for insert to authenticated with check ((select app.sou_admin()));
create policy perfis_alterar                on public.perfis                for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));
create policy areas_incluir                 on public.areas                 for insert to authenticated with check ((select app.sou_admin()));
create policy areas_alterar                 on public.areas                 for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));
create policy area_monitores_incluir        on public.area_monitores        for insert to authenticated with check ((select app.sou_admin()));
create policy area_monitores_alterar        on public.area_monitores        for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));
create policy colaboradores_incluir         on public.colaboradores         for insert to authenticated with check ((select app.sou_admin()));
create policy colaboradores_alterar         on public.colaboradores         for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));
create policy criterios_incluir             on public.criterios             for insert to authenticated with check ((select app.sou_admin()));
create policy criterios_alterar             on public.criterios             for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));
create policy criterio_subperguntas_incluir on public.criterio_subperguntas for insert to authenticated with check ((select app.sou_admin()));
create policy criterio_subperguntas_alterar on public.criterio_subperguntas for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));
create policy regua_versoes_incluir         on public.regua_versoes         for insert to authenticated with check ((select app.sou_admin()));
create policy configuracoes_incluir         on public.configuracoes         for insert to authenticated with check ((select app.sou_admin()));
create policy configuracoes_alterar         on public.configuracoes         for update to authenticated using ((select app.sou_admin())) with check ((select app.sou_admin()));

-- 5. Gravação: Supervisor (carteiras, metas, planos, agenda, férias) ---------------
drop policy if exists alocacoes_incluir           on public.alocacoes;
drop policy if exists alocacoes_alterar           on public.alocacoes;
drop policy if exists alocacoes_historico_incluir on public.alocacoes_historico;
drop policy if exists documentos_incluir          on public.documentos;
drop policy if exists documentos_alterar          on public.documentos;

create policy alocacoes_incluir  on public.alocacoes  for insert to authenticated with check ((select app.tem_perfil('GESTOR')));
create policy alocacoes_alterar  on public.alocacoes  for update to authenticated using ((select app.tem_perfil('GESTOR'))) with check ((select app.tem_perfil('GESTOR')));
-- O autor declarado no histórico tem de ser quem está logado: o histórico não
-- aceita evento em nome de outra pessoa.
create policy alocacoes_historico_incluir on public.alocacoes_historico for insert to authenticated
  with check ((select app.tem_perfil('GESTOR')) and alterado_por = (select app.meu_perfil_id()));
create policy documentos_incluir on public.documentos for insert to authenticated with check ((select app.tem_perfil('GESTOR')));
create policy documentos_alterar on public.documentos for update to authenticated using ((select app.tem_perfil('GESTOR'))) with check ((select app.tem_perfil('GESTOR')));

-- 6. Catálogos: categoria nova por qualquer perfil ativo; o resto, Administrador -----
drop policy if exists catalogos_incluir on public.catalogos;
drop policy if exists catalogos_alterar on public.catalogos;
create policy catalogos_incluir on public.catalogos for insert to authenticated with check (
  (select app.usuario_liberado()) and (catalogo = 'categorias' or (select app.sou_admin())));
create policy catalogos_alterar on public.catalogos for update to authenticated
  using ((select app.sou_admin())) with check ((select app.sou_admin()));

-- 7. Histórico de acessos: cada pessoa ativa registra os próprios eventos ----------
-- (o perfil e o momento são carimbados pelo banco — script 05).
drop policy if exists acessos_log_incluir on public.acessos_log;
create policy acessos_log_incluir on public.acessos_log for insert to authenticated with check ((select app.usuario_liberado()));

-- 8. Registro deste script ----------------------------------------------------
insert into app.versoes_esquema (versao, descricao)
values ('07', 'Segurança: RLS por perfil; contas ADMIN exclusivas, com MFA (aal2) e concedidas só fora do portal; anônimo sem acesso; monitorias só leitura (gravação pelo 08); auditoria só para o Administrador')
on conflict (versao) do nothing;

commit;

-- Conferência rápida depois de rodar (só leitura):
--   select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
