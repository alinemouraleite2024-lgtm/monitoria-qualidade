-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 10 — P1: reprovação também respeita a M1
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, DEPOIS do 08
-- (e do 09). Só com autorização específica.
--
-- POR QUÊ (pendência P1, aberta em 14/10/2026 — supabase/PENDENCIAS.md)
--   A regra M1 (08, revisão de 12/10) impede validar e confirmar zeramento de uma
--   monitoria migrada cuja nota nunca foi calculada pelo banco (sem versão da
--   régua). A api.reprovar_monitoria não tinha essa barreira: o gestor conseguia
--   REPROVAR — decisão final — a MON-10001 direto pela API. Decisão de 14/10: nas
--   migradas sem régua o gestor só DEVOLVE; a decisão final vem depois do reenvio.
--
-- O QUE FAZ
--   Substitui SOMENTE o corpo de api.reprovar_monitoria, acrescentando a mesma
--   barreira M1 de api.validar_monitoria (MI403, mesma mensagem). Assinatura,
--   segurança (security definer, search_path vazio), guarda do gestor, motivo
--   obrigatório e gravação ficam idênticos ao 08.
--   NÃO altera dados, NÃO toca nos scripts 00–09, NÃO muda outra função.
--   Permissões refeitas explicitamente: executa só `authenticated`.
--
-- UMA TRANSAÇÃO. PODE RODAR MAIS DE UMA VEZ. Não cria tabela.
-- PARA DESFAZER (só se pedido): rodar de novo o bloco de api.reprovar_monitoria
-- do 08 e as linhas de permissão abaixo, e apagar a versão '10' do registro.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '08') then
    raise exception 'SCRIPT 10 RECUSADO: o script 08 precisa estar aplicado.' using errcode = 'MI403';
  end if;
end;
$pre$;

create or replace function api.reprovar_monitoria(p_id text, p_versao_lida integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if v_m.regua_versao_id is null then   -- M1 (P1, 14/10)
    perform app.recusar('MI403', 'A nota desta monitoria migrada não foi calculada pelo banco. Devolva para revisão e reenvio.');
  end if;
  if btrim(coalesce(p_motivo, '')) = '' then
    perform app.recusar('MI422', 'Informe o motivo da reprovação.');
  end if;
  update public.monitorias m
     set status = 'Reprovada', motivo_reprovacao = btrim(p_motivo), revisado_por = app.meu_perfil_id(), revisado_em = now(),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

revoke execute on function api.reprovar_monitoria(text, integer, text) from public, anon, authenticated;
grant  execute on function api.reprovar_monitoria(text, integer, text) to authenticated;

-- Conferência dentro da transação: falhou = nada aplicado.
do $conf$
declare
  v_f oid := 'api.reprovar_monitoria(text, integer, text)'::regprocedure;
begin
  if position('-- M1' in pg_get_functiondef(v_f)) = 0 then
    raise exception 'SCRIPT 10: a barreira M1 não ficou na função.';
  end if;
  if not (select prosecdef from pg_proc where oid = v_f) then
    raise exception 'SCRIPT 10: a função deixou de ser security definer.';
  end if;
  if has_function_privilege('anon', v_f, 'execute') or not has_function_privilege('authenticated', v_f, 'execute') then
    raise exception 'SCRIPT 10: permissões da função fora do esperado (anon não executa; authenticated executa).';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('10', 'P1: api.reprovar_monitoria recusa monitoria migrada sem versão da régua (mesma barreira M1 da validação e do zeramento)')
on conflict (versao) do nothing;

commit;
