-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 16 — colaboradora inativa não recebe monitoria nova
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Desenvolvido e testado só no Postgres local (supabase/testes/testes-16-colaboradora-inativa.mjs),
-- 29/10/2026. Pré-requisito: script 15. Reversão: 16r_reverter_colaboradora_inativa.sql.
--
-- O PROBLEMA (encerramento dos testes, 29/10/2026)
--   Desativada a colaboradora fictícia (11b), ela continuou aparecendo na Nova Monitoria, e o banco
--   aceitava monitoria nova para ela: api.salvar_monitoria só confere se a colaboradora EXISTE.
--
-- O QUE FAZ
--   Gatilho BEFORE INSERT/UPDATE em monitorias: pelo PORTAL (sessão autenticada — formulário e
--   importação, que gravam pela api.salvar_monitoria), recusa com MI422 quando a gravação cria
--   vínculo NOVO com colaboradora inativa:
--     - monitoria nova para colaboradora inativa;
--     - rascunho que troca a colaboradora para uma inativa.
--
-- O QUE NÃO MUDA (casos legítimos, testados)
--   - Monitoria antiga de colaboradora que DEPOIS ficou inativa: abre, o rascunho é editado e
--     enviado (mesma colaboradora), e o gestor valida, devolve, reprova; o ADMIN cancela.
--     O gatilho só age quando a colaboradora da linha MUDA (ou na inclusão).
--   - Operações direto no banco, sem sessão do portal (restauração de backup, migração, scripts de
--     manutenção do SQL Editor com responsável declarado): não passam por esta regra, para que o
--     histórico de colaboradoras desligadas possa ser restaurado.
--   - Nenhuma monitoria, colaboradora ou auditoria existente é alterada pela instalação.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '15') then
    raise exception 'SCRIPT 16 RECUSADO: o script 15 precisa estar aplicado.' using errcode = 'MI403';
  end if;
end;
$pre$;

create or replace function app.tg_monitorias_colaborador_ativo()
returns trigger
language plpgsql
security definer   -- lê o cadastro independentemente da RLS de quem grava
set search_path = ''
as $$
declare
  v_c public.colaboradores;
begin
  -- Só o portal (sessão autenticada). Restauração, migração e manutenção no SQL Editor não passam aqui.
  if auth.uid() is null then
    return new;
  end if;
  if new.colaborador_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.colaborador_id is not distinct from old.colaborador_id then
    return new;   -- a monitoria já era desta colaboradora: segue normalmente, ativa ou não
  end if;
  select * into v_c from public.colaboradores c where c.id = new.colaborador_id;
  if found and not coalesce(v_c.ativo, true) then
    raise exception '%', format('%s está inativa no cadastro e não recebe monitoria nova. As monitorias antigas dela continuam consultáveis.', v_c.nome)
      using errcode = 'MI422',
            hint = 'Se ela voltou à equipe, o Administrador reativa o cadastro antes de registrar a monitoria.';
  end if;
  return new;
end;
$$;
revoke execute on function app.tg_monitorias_colaborador_ativo() from public, anon, authenticated;

comment on function app.tg_monitorias_colaborador_ativo() is
  'Gatilho BEFORE INSERT/UPDATE em monitorias: pelo portal, colaboradora inativa não recebe monitoria nova nem é posta num rascunho (MI422). Monitorias já vinculadas seguem normalmente (script 16).';

-- "b_colaborador" vem antes de "b_duplicidade" (ordem alfabética dos gatilhos BEFORE): a
-- colaboradora inativa é recusada antes da conferência de duplicidade.
create or replace trigger monitorias_b_colaborador_ativo
  before insert or update on public.monitorias
  for each row execute function app.tg_monitorias_colaborador_ativo();

-- Conferência ---------------------------------------------------------------------------------
do $conf$
begin
  if not exists (select 1 from pg_trigger where tgname = 'monitorias_b_colaborador_ativo' and tgrelid = 'public.monitorias'::regclass and tgenabled = 'O') then
    raise exception 'SCRIPT 16: o gatilho de colaboradora inativa não ficou ativo.';
  end if;
  if has_function_privilege('authenticated', 'app.tg_monitorias_colaborador_ativo()'::regprocedure, 'execute') then
    raise exception 'SCRIPT 16: a função do gatilho ficou exposta ao portal.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'monitorias_b_duplicidade' and tgenabled = 'O') then
    raise exception 'SCRIPT 16: o gatilho de duplicidade do 15 não está ativo.';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('16', 'Colaboradora inativa não recebe monitoria nova pelo portal (MI422); monitorias antigas e operações de manutenção seguem normalmente')
on conflict (versao) do nothing;

commit;
