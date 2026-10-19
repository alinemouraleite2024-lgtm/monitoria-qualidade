-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 12a — PRIMEIRO perfil ADMIN (P2/P3)
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, depois do 12.
-- Só com autorização específica.
--
-- O QUE FAZ
--   Inclui o perfil ADMIN da Aline, SEPARADO do perfil de monitora (usr-1), decisão de
--   19/10/2026 (caminho B):
--     id      adm-aline-oliveira
--     nome    Aline Oliveira (Administração)
--     e-mail  aline.oliveira+admin@mouraleite.com.br   (mesma caixa corporativa, outro login)
--     perfis  {ADMIN} — exclusivo (R1)        situação  ACTIVE
--   Sem login ligado: o vínculo acontece quando o usuário for criado no Supabase Auth com
--   esse e-mail (gatilho do 01). O acesso só abre com segundo fator (07: aal2; 12: etapa).
--   NÃO altera o usr-1, o perfil do Erivan nem nenhum outro registro.
--
-- ⚠ IRREVERSÍVEL NA PRÁTICA
--   · Perfis não têm exclusão (01), e o banco não deixa o último ADMIN ativo ser
--     desativado (01: "nunca deixar o MonitorIA sem Administrador ativo").
--   · FECHA A EXCEÇÃO DE IMPLANTAÇÃO (R5, 06): a partir daqui, toda gravação direta por SQL
--     precisa declarar `set local app.responsavel = 'adm-aline-oliveira'` (ADMIN ativo).
--     A declaração "Nome <e-mail>" passa a ser recusada para sempre.
--   · Antes de rodar: o 11a precisa estar na versão REVISADA (declara o ADMIN).
--
-- AUTORIZAÇÃO E AUDITORIA
--   É o último uso da exceção de implantação: declara quem executa ("Nome <e-mail>"); o
--   06 aceita porque o único ADMIN existente é o que está sendo incluído. A auditoria
--   registra a inclusão com esse responsável. Não simula login de ninguém.
--
-- UMA TRANSAÇÃO. PODE RODAR MAIS DE UMA VEZ: se o perfil já existir exatamente como
-- abaixo, não faz nada; se existir outro ADMIN, ou o id/e-mail com outros dados, recusa.
-- Não cria tabela.
-- =============================================================================

begin;

set local app.responsavel = 'Aline Oliveira <aline.oliveira@mouraleite.com.br>';

do $pre$
declare
  v_p public.perfis;
begin
  if not exists (select 1 from app.versoes_esquema where versao = '12') then
    raise exception 'SCRIPT 12a RECUSADO: o script 12 (estado do acesso / MFA) precisa estar aplicado.' using errcode = 'MI403';
  end if;
  select * into v_p from public.perfis where id = 'adm-aline-oliveira';
  if found then
    if v_p.email <> 'aline.oliveira+admin@mouraleite.com.br' or v_p.perfis <> array['ADMIN']::text[]
       or v_p.nome <> 'Aline Oliveira (Administração)' or coalesce(v_p.status, 'ACTIVE') <> 'ACTIVE' then
      raise exception 'SCRIPT 12a RECUSADO: adm-aline-oliveira já existe com outros dados. Nada foi alterado.' using errcode = 'MI409';
    end if;
    raise notice 'adm-aline-oliveira já existe como esperado: nada a fazer.';
    return;
  end if;
  if exists (select 1 from public.perfis where 'ADMIN' = any (perfis)) then
    raise exception 'SCRIPT 12a RECUSADO: já existe outro perfil ADMIN. Este script cria só o PRIMEIRO.' using errcode = 'MI409';
  end if;
  if exists (select 1 from public.perfis where email = 'aline.oliveira+admin@mouraleite.com.br') then
    raise exception 'SCRIPT 12a RECUSADO: o e-mail aline.oliveira+admin@… já está em outro perfil.' using errcode = 'MI409';
  end if;
  if exists (select 1 from auth.users where lower(email) = 'aline.oliveira+admin@mouraleite.com.br') then
    raise exception 'SCRIPT 12a RECUSADO: já existe login com esse e-mail no Auth. A ordem é: perfil (12a) e DEPOIS o usuário no Auth.' using errcode = 'MI409';
  end if;
end;
$pre$;

insert into public.perfis (id, email, nome, perfis, status, extras, ordem)
select 'adm-aline-oliveira', 'aline.oliveira+admin@mouraleite.com.br', 'Aline Oliveira (Administração)', array['ADMIN']::text[], 'ACTIVE',
       jsonb_build_object('conta_administrativa_de', 'usr-1', 'decisao', 'Caminho B (19/10/2026): conta ADMIN separada da conta MONITOR, MFA obrigatório'),
       coalesce((select max(ordem) from public.perfis), 0) + 1
 where not exists (select 1 from public.perfis where id = 'adm-aline-oliveira');

-- Conferência dentro da transação: falhou = nada gravado.
do $conf$
begin
  if (select count(*) from public.perfis where 'ADMIN' = any (perfis)) <> 1
     or not exists (select 1 from public.perfis where id = 'adm-aline-oliveira' and perfis = array['ADMIN']::text[]
                      and status = 'ACTIVE' and email = 'aline.oliveira+admin@mouraleite.com.br' and auth_user_id is null) then
    raise exception 'SCRIPT 12a: o perfil ADMIN não ficou como esperado.';
  end if;
  if not exists (select 1 from public.perfis where id = 'usr-1' and perfis = array['MONITOR']::text[] and email = 'aline.oliveira@mouraleite.com.br') then
    raise exception 'SCRIPT 12a: o perfil de monitora (usr-1) não está como antes.';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('12a', 'Primeiro perfil ADMIN: adm-aline-oliveira (aline.oliveira+admin@…), exclusivo, ativo, MFA obrigatório; fecha a exceção de implantação (R5)')
on conflict (versao) do nothing;

commit;
