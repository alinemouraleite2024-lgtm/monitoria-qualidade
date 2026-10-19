-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 12 — estado do acesso (MFA do ADMIN, P2)
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, depois do 10.
-- Só com autorização específica. NÃO GRAVA DADOS.
--
-- POR QUÊ
--   O banco já exige o segundo fator do ADMIN (07: app.sou_admin e app.usuario_liberado
--   só liberam a conta ADMIN numa sessão aal2). Sem aal2 a RLS esconde tudo — inclusive o
--   próprio perfil —, e o portal não tem como saber se deve pedir o CADASTRO do segundo
--   fator, a VERIFICAÇÃO do código, ou se o login simplesmente não tem perfil liberado.
--
-- O QUE CRIA
--   api.estado_do_meu_acesso() → jsonb, SEM parâmetros, só sobre a PRÓPRIA sessão:
--     tem_perfil          o login está ligado a um perfil
--     admin               o perfil é ADMIN
--     ativo               o perfil não está inativo
--     nivel               aal da sessão, lido do token assinado pelo Supabase (auth.jwt)
--     fator_verificado    a conta tem ao menos um segundo fator TOTP verificado
--     etapa               'liberado' | 'cadastrar_mfa' | 'verificar_mfa' | 'sem_perfil' | 'inativo'
--   Não devolve id, nome, e-mail, perfis de outras pessoas nem dado de monitoria. Não
--   libera acesso a nada: quem decide continua sendo a RLS do 07, pelo mesmo aal.
--
-- REGRA DA ETAPA (a mesma do portal: src/shared/compartilhado/mfa.ts)
--   sem perfil → sem_perfil; inativo → inativo;
--   ADMIN sem aal2: sem fator → cadastrar_mfa; com fator → verificar_mfa;
--   não ADMIN com fator verificado e sessão aal1 → verificar_mfa (MFA opcional, se um dia
--   for usado); demais → liberado.
--
-- ACESSO: só `authenticated` executa; anônimo e público, não.
-- UMA TRANSAÇÃO. PODE RODAR MAIS DE UMA VEZ. Não cria tabela.
-- PARA DESFAZER (só se pedido): drop function api.estado_do_meu_acesso();
--   e apagar a versão '12' do registro.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '10') then
    raise exception 'SCRIPT 12 RECUSADO: o script 10 precisa estar aplicado.' using errcode = 'MI403';
  end if;
  if to_regclass('auth.mfa_factors') is null then
    raise exception 'SCRIPT 12 RECUSADO: auth.mfa_factors não existe (MFA do Supabase Auth indisponível).' using errcode = 'MI403';
  end if;
end;
$pre$;

create or replace function api.estado_do_meu_acesso()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_nivel  text := coalesce(auth.jwt() ->> 'aal', '');
  v_perfis text[];
  v_status text;
  v_achou  boolean := false;
  v_fator  boolean := false;
  v_admin  boolean := false;
  v_etapa  text;
begin
  if v_uid is null then
    perform app.recusar('MI401', 'Sessão sem identificação. Entre novamente.');
  end if;

  select p.perfis, p.status, true into v_perfis, v_status, v_achou
    from public.perfis p where p.auth_user_id = v_uid;
  v_achou := coalesce(v_achou, false);
  v_admin := v_achou and 'ADMIN' = any (v_perfis);

  -- Só fatores DESTE login e só os verificados (um cadastro interrompido não conta).
  select exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status::text = 'verified')
    into v_fator;

  v_etapa := case
    when not v_achou                                  then 'sem_perfil'
    when v_status = 'INACTIVE'                        then 'inativo'
    when v_admin and v_nivel <> 'aal2' and not v_fator then 'cadastrar_mfa'
    when v_nivel <> 'aal2' and v_fator                then 'verificar_mfa'
    else 'liberado'
  end;

  return jsonb_build_object('tem_perfil', v_achou, 'admin', v_admin, 'ativo', v_achou and v_status is distinct from 'INACTIVE',
                            'nivel', nullif(v_nivel, ''), 'fator_verificado', v_fator, 'etapa', v_etapa);
end;
$$;

comment on function api.estado_do_meu_acesso() is
  'Estado do acesso da PRÓPRIA sessão (perfil ADMIN?, aal, segundo fator verificado?) para o portal decidir entre liberar, pedir cadastro do MFA ou pedir o código. Não libera dados: a RLS do 07 decide pelo mesmo aal.';

revoke all on function api.estado_do_meu_acesso() from public, anon, authenticated;
grant execute on function api.estado_do_meu_acesso() to authenticated;

-- Conferência dentro da transação.
do $conf$
declare
  v_f oid := 'api.estado_do_meu_acesso()'::regprocedure;
begin
  if not (select prosecdef from pg_proc where oid = v_f) then
    raise exception 'SCRIPT 12: a função precisa ser security definer.';
  end if;
  if has_function_privilege('anon', v_f, 'execute') or not has_function_privilege('authenticated', v_f, 'execute') then
    raise exception 'SCRIPT 12: permissões fora do esperado (anon não executa; authenticated executa).';
  end if;
  if (select pronargs from pg_proc where oid = v_f) <> 0 then
    raise exception 'SCRIPT 12: a função não pode receber parâmetros (só a própria sessão).';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('12', 'P2: api.estado_do_meu_acesso() — etapa do acesso da própria sessão (cadastrar/verificar MFA do ADMIN); não libera dados')
on conflict (versao) do nothing;

commit;
