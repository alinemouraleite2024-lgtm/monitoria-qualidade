-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 11a — colaborador FICTÍCIO para o teste
-- =============================================================================
--
-- ONDE RODAR: somente no projeto de HOMOLOGAÇÃO, pelo SQL Editor, depois do 12a
-- (o ADMIN adm-aline-oliveira precisa existir e estar ativo).
-- Só com autorização específica.
--
-- POR QUÊ
--   O teste de homologação ponta a ponta (Aline MONITOR → Erivan GESTOR) precisa
--   de uma monitoria fictícia. Para que ela não apareça no histórico de uma pessoa
--   real, ela é registrada para um colaborador FICTÍCIO. O portal não cadastra
--   colaboradores sem conta ADMIN (que ainda não existe), por isso este script.
--
-- O QUE FAZ
--   Inclui UM colaborador, `col-teste-homolog-1`, "TESTE HOMOLOGAÇÃO — FICTÍCIO",
--   na área do Relacionamento (area-1), ativo, com `extras.ficticio = true`.
--   Não cria alocação nem meta: o colaborador não entra em carteira de ninguém.
--   Não altera nenhum registro existente.
--
-- AUTORIZAÇÃO E AUDITORIA (revisão de 19/10/2026 — P3, "Ordem 2")
--   Roda DEPOIS do 12a: declara o ADMIN ativo `adm-aline-oliveira` como responsável
--   (regra R5 do 06), e a auditoria registra a inclusão com essa declaração. A exceção de
--   implantação ("Nome <e-mail>") já está fechada e NÃO é usada. Se não houver esse ADMIN
--   ativo, o script RECUSA antes de gravar. NÃO simula login de ninguém.
--
-- UMA TRANSAÇÃO. PODE RODAR MAIS DE UMA VEZ: se o colaborador já existir exatamente
-- como abaixo, não faz nada; se existir diferente, recusa. Não cria tabela.
-- =============================================================================

begin;

set local app.responsavel = 'adm-aline-oliveira';

do $pre$
declare
  v_c public.colaboradores;
begin
  if not exists (select 1 from app.versoes_esquema where versao = '10') then
    raise exception 'SCRIPT 11a RECUSADO: o script 10 precisa estar aplicado.' using errcode = 'MI403';
  end if;
  if not exists (select 1 from public.perfis where id = 'adm-aline-oliveira' and perfis = array['ADMIN']::text[]
                   and coalesce(status, 'ACTIVE') = 'ACTIVE') then
    raise exception 'SCRIPT 11a RECUSADO: o ADMIN ativo adm-aline-oliveira não existe. Rode antes o 12a (Ordem 2, P3).' using errcode = 'MI403';
  end if;
  if not exists (select 1 from public.areas where id = 'area-1') then
    raise exception 'SCRIPT 11a RECUSADO: a área area-1 (Relacionamento) não existe.' using errcode = 'MI404';
  end if;
  select * into v_c from public.colaboradores where id = 'col-teste-homolog-1';
  if found and (v_c.nome <> 'TESTE HOMOLOGAÇÃO — FICTÍCIO' or v_c.area_id is distinct from 'area-1'
                or coalesce((v_c.extras ->> 'ficticio')::boolean, false) is not true) then
    raise exception 'SCRIPT 11a RECUSADO: já existe col-teste-homolog-1 com outros dados. Nada foi alterado.' using errcode = 'MI409';
  end if;
  if exists (select 1 from public.colaboradores where nome = 'TESTE HOMOLOGAÇÃO — FICTÍCIO' and id <> 'col-teste-homolog-1') then
    raise exception 'SCRIPT 11a RECUSADO: já existe outro colaborador com o nome do fictício.' using errcode = 'MI409';
  end if;
end;
$pre$;

insert into public.colaboradores (id, nome, email, cargo, area_id, ativo, extras, ordem)
select 'col-teste-homolog-1', 'TESTE HOMOLOGAÇÃO — FICTÍCIO', null, 'Fictício (teste)', 'area-1', true,
       jsonb_build_object('ficticio', true,
                          'finalidade', 'Teste de homologação ponta a ponta do portal compartilhado (Aline MONITOR → Erivan GESTOR)',
                          'autorizado_em', '2026-10-15'),
       coalesce((select max(ordem) from public.colaboradores), 0) + 1
 where not exists (select 1 from public.colaboradores where id = 'col-teste-homolog-1');

-- Conferência dentro da transação: falhou = nada gravado.
do $conf$
begin
  if (select count(*) from public.colaboradores where id = 'col-teste-homolog-1' and ativo and area_id = 'area-1'
         and (extras ->> 'ficticio')::boolean) <> 1 then
    raise exception 'SCRIPT 11a: o colaborador fictício não ficou como esperado.';
  end if;
  if exists (select 1 from public.alocacoes where colaborador_id = 'col-teste-homolog-1') then
    raise exception 'SCRIPT 11a: o colaborador fictício não pode ter alocação.';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('11a', 'Colaborador fictício col-teste-homolog-1 para o teste de homologação ponta a ponta (sem alocação, sem meta)')
on conflict (versao) do nothing;

commit;
