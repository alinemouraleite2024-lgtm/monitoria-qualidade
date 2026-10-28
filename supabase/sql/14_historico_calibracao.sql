-- =============================================================================
-- MonitorIA · Banco compartilhado · Script 14 — histórico de calibração (Etapa B)
-- =============================================================================
--
-- *** NÃO EXECUTAR NO SUPABASE SEM AUTORIZAÇÃO ESPECÍFICA DA ALINE. ***
-- Estrutura aprovada em 26/10/2026; testado só no Postgres local (supabase/testes/
-- testes-14-historico.mjs). Ordem de implantação: este script ANTES do portal novo — o portal
-- atual continua funcionando com ele (validar sem considerações é aceito).
--
-- O QUE NÃO FAZ: não altera nenhuma monitoria, resposta, nota ou meta; não mexe nas linhas já
-- gravadas da auditoria; NÃO reconstitui eventos antigos (passo separado, ver item 6).
--
-- REGRAS APROVADAS PELA ALINE EM 26/10/2026
--   1. A monitora vê as considerações do gestor, inclusive nas validadas.
--   2. O histórico tem os envios e reenvios da monitora e as decisões do gestor.
--   3. Cada rodada guarda a nota daquele momento.
--   4. Considerações: até 2.000 caracteres.
--   5. Opcionais no Validar; obrigatórias no Devolver e no Reprovar.
--   6. Permanente: responsável, data, decisão, considerações e nota.
--   7. Confirmação de zeramento é evento próprio, com o critério e o responsável.
--   8. Reconstituição pela auditoria só com dados suficientes; marcada como reconstituída.
--   9. Nenhuma consideração fictícia em registro antigo.
--  10. Observação complementar não muda decisão nem situação da monitoria.
--
-- COMO O HISTÓRICO É GRAVADO
--   · Tabela nova `public.monitoria_eventos`, só de inclusão (sem alteração, sem exclusão,
--     sem TRUNCATE), auditada pelo 06 como as demais — a cadeia existente não é tocada,
--     apenas recebe as novas linhas.
--   · Os eventos de envio, reenvio e decisão são gravados por um GATILHO na própria tabela
--     de monitorias, na mesma transação da mudança: não existe mudança de situação sem
--     evento, nem evento sem a mudança. Isso vale para o portal, para importações e para
--     operação direta no banco.
--   · As considerações do Validar chegam ao gatilho por uma configuração local da transação
--     (app.consideracoes), preenchida e limpa pela própria api.validar_monitoria. Devolver,
--     Reprovar, Afastar e Cancelar já gravam o motivo na monitoria; o gatilho o copia.
--   · Observação complementar: api.registrar_observacao — só acrescenta um evento, não altera
--     a monitoria (nem versão, nem situação, nem nota).
--
-- DUPLICIDADE
--   · Decisões e envios exigem a versão lida (MI428/MI409): repetir a mesma requisição falha
--     porque a versão já mudou. Além disso, (monitoria, versão produzida, tipo) é único.
--   · Observação: o portal manda uma chave de requisição (uuid); repetir a mesma chave devolve
--     o evento já gravado, sem gravar outro.
--   · Reconstituição: uma linha de auditoria gera no máximo um evento (auditoria_seq único).
--
-- QUEM LÊ: o mesmo escopo da monitoria (política monitorias_ler do 07) — a monitora só as
-- suas, o gestor a sua equipe, o ADMIN tudo. Ninguém grava direto pela Data API.
-- =============================================================================

begin;

do $pre$
begin
  if not exists (select 1 from app.versoes_esquema where versao = '10') then
    raise exception 'SCRIPT 14 RECUSADO: o script 10 precisa estar aplicado.' using errcode = 'MI403';
  end if;
end;
$pre$;

-- 1. Tabela ----------------------------------------------------------------------
create table if not exists public.monitoria_eventos (
  id                 bigint      generated always as identity primary key,
  monitoria_id       text        not null references public.monitorias (id) on delete restrict,
  tipo               text        not null,
  rodada             integer     not null,
  versao_monitoria   integer,
  status_resultante  text        not null,
  nota               numeric,
  consideracoes      text,
  criterios          jsonb,
  responsavel_id     text        not null references public.perfis (id) on delete restrict,
  ocorrido_em        timestamptz not null default now(),
  origem             text        not null default 'portal',
  auditoria_seq      bigint      unique,
  chave_requisicao   uuid,

  constraint monitoria_eventos_tipo check (tipo in ('ENVIO', 'REENVIO', 'VALIDACAO', 'DEVOLUCAO', 'REPROVACAO',
    'ZERAMENTO_CONFIRMADO', 'ELIMINATORIO_AFASTADO', 'CANCELAMENTO', 'OBSERVACAO')),
  constraint monitoria_eventos_rodada check (rodada >= 1),
  constraint monitoria_eventos_origem check (origem in ('portal', 'reconstituido')),
  constraint monitoria_eventos_tamanho check (consideracoes is null or char_length(consideracoes) between 1 and 2000),
  -- obrigatórias (regra 5) — exceto em reconstituído, que nunca inventa texto (regra 9)
  constraint monitoria_eventos_obrigatorias check (origem = 'reconstituido'
    or tipo not in ('DEVOLUCAO', 'REPROVACAO', 'ELIMINATORIO_AFASTADO', 'CANCELAMENTO', 'OBSERVACAO')
    or consideracoes is not null),
  -- observação não produz versão da monitoria; todo o resto produz
  constraint monitoria_eventos_versao check ((tipo = 'OBSERVACAO') = (versao_monitoria is null)),
  constraint monitoria_eventos_chave check (tipo <> 'OBSERVACAO' or origem = 'reconstituido' or chave_requisicao is not null),
  constraint monitoria_eventos_reconstituido check ((origem = 'reconstituido') = (auditoria_seq is not null)),
  constraint monitoria_eventos_criterios check (criterios is null or jsonb_typeof(criterios) = 'array'),
  constraint monitoria_eventos_uma_vez unique (monitoria_id, versao_monitoria, tipo),
  constraint monitoria_eventos_requisicao unique (monitoria_id, chave_requisicao)
);

create index if not exists monitoria_eventos_monitoria_idx on public.monitoria_eventos (monitoria_id, id);

comment on table public.monitoria_eventos is
  'Histórico de calibração: envios, reenvios, decisões e observações de cada monitoria. Só inclusão.';

create or replace trigger monitoria_eventos_sem_alteracao
  before update on public.monitoria_eventos
  for each row execute function app.tg_somente_inclusao();
create or replace trigger monitoria_eventos_sem_exclusao
  before delete on public.monitoria_eventos
  for each row execute function app.tg_bloquear_exclusao();
create or replace trigger monitoria_eventos_sem_truncate
  before truncate on public.monitoria_eventos
  for each statement execute function app.tg_bloquear_exclusao();
create or replace trigger monitoria_eventos_z_auditoria
  after insert or update or delete on public.monitoria_eventos
  for each row execute function app.tg_auditoria('id');
create or replace trigger monitoria_eventos_z_auditoria_truncate
  after truncate on public.monitoria_eventos
  for each statement execute function app.tg_auditoria();

-- 2. Leitura: o mesmo escopo da monitoria ------------------------------------------
alter table public.monitoria_eventos enable row level security;
revoke all on table public.monitoria_eventos from anon, authenticated;
grant select on table public.monitoria_eventos to authenticated;
drop policy if exists monitoria_eventos_ler on public.monitoria_eventos;
create policy monitoria_eventos_ler on public.monitoria_eventos for select to authenticated using (
  exists (select 1 from public.monitorias m where m.id = monitoria_id));

-- 3. Peças internas --------------------------------------------------------------
-- Rodada atual: quantos envios já houve (migrada já enviada na origem conta 1).
create or replace function app.rodada_atual(p_id text, p_ja_enviada boolean)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(coalesce(max(e.rodada) filter (where e.tipo in ('ENVIO', 'REENVIO')), 0),
                  case when p_ja_enviada then 1 else 0 end)
    from public.monitoria_eventos e where e.monitoria_id = p_id;
$$;

-- Eliminatórios marcados como ocorridos (resposta 0), pela régua da monitoria.
create or replace function app.eliminatorios_ocorridos(p_id text, p_regua text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_agg(jsonb_build_object('id', c ->> 'id', 'numero', c -> 'numero', 'nome', c ->> 'name') order by r.ordem)
    from public.monitoria_respostas r
    join public.regua_versoes v on v.id = p_regua
    cross join lateral jsonb_array_elements(v.retrato) c
   where r.monitoria_id = p_id and c ->> 'id' = r.criterio_id
     and coalesce((c ->> 'eliminatorio')::boolean, false)
     and jsonb_typeof(r.resposta) = 'number' and (r.resposta #>> '{}')::numeric = 0;
$$;

-- Quem fez: o login (portal) ou o ADMIN declarado (operação direta, já exigido pelo 06).
create or replace function app.responsavel_do_evento()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.meu_perfil_id(), nullif(btrim(coalesce(current_setting('app.responsavel', true), '')), ''));
$$;

-- 4. Gatilho: cada mudança de situação vira evento ----------------------------------
create or replace function app.tg_monitoria_eventos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resp     text;
  v_enviada  boolean;
  v_rodada   integer;
  v_tipo     text;
  v_texto    text;
begin
  -- Restauração de backup re-grava monitorias; o histórico vem no próprio backup.
  if coalesce(current_setting('app.manutencao', true), '') = 'restauracao' then
    return null;
  end if;

  v_resp := app.responsavel_do_evento();

  -- Envio e reenvio
  if new.status = 'Pendente' and (tg_op = 'INSERT' or old.status is distinct from 'Pendente') then
    if tg_op = 'INSERT' and new.origem is distinct from 'portal' then
      return null;   -- inclusão por migração não é envio feito neste banco
    end if;
    v_enviada := tg_op = 'UPDATE' and (old.enviado_em is not null or coalesce(old.enviada_na_origem, false));
    v_rodada  := app.rodada_atual(new.id, v_enviada) + 1;
    insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, responsavel_id)
    values (new.id, case when v_rodada = 1 then 'ENVIO' else 'REENVIO' end, v_rodada, new.versao, new.status, new.nota, v_resp);
    return null;
  end if;

  if tg_op = 'INSERT' then
    return null;
  end if;

  v_rodada := greatest(app.rodada_atual(new.id, old.enviado_em is not null or coalesce(old.enviada_na_origem, false)), 1);

  -- Zeramento e afastamento de eliminatório (não mudam a situação)
  if not coalesce(old.zerada, false) and coalesce(new.zerada, false) then
    insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, criterios, responsavel_id)
    values (new.id, 'ZERAMENTO_CONFIRMADO', v_rodada, new.versao, new.status, new.nota,
            app.eliminatorios_ocorridos(new.id, new.regua_versao_id), v_resp);
  end if;
  if old.eliminatorio_afastado_em is null and new.eliminatorio_afastado_em is not null then
    insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes, criterios, responsavel_id)
    values (new.id, 'ELIMINATORIO_AFASTADO', v_rodada, new.versao, new.status, new.nota, new.eliminatorio_afastado_motivo,
            app.eliminatorios_ocorridos(new.id, new.regua_versao_id), v_resp);
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  v_tipo := case new.status
              when 'Validada'  then 'VALIDACAO'
              when 'Reprovada' then 'REPROVACAO'
              when 'Rascunho'  then 'DEVOLUCAO'
              when 'Cancelada' then 'CANCELAMENTO'
            end;
  if v_tipo is null then
    return null;
  end if;
  v_texto := case v_tipo
               when 'VALIDACAO'    then nullif(btrim(coalesce(current_setting('app.consideracoes', true), '')), '')
               when 'REPROVACAO'   then new.motivo_reprovacao
               when 'DEVOLUCAO'    then new.motivo_ajuste
               when 'CANCELAMENTO' then new.cancelado_motivo
             end;
  insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes, responsavel_id)
  values (new.id, v_tipo, v_rodada, new.versao, new.status, new.nota, v_texto, v_resp);
  return null;
end;
$$;

revoke execute on function app.rodada_atual(text, boolean)            from public;
revoke execute on function app.eliminatorios_ocorridos(text, text)    from public;
revoke execute on function app.responsavel_do_evento()                from public;
revoke execute on function app.tg_monitoria_eventos()                 from public;

-- "y" antes do "z" da auditoria: o evento entra na mesma transação, logo depois da mudança.
create or replace trigger monitorias_y_eventos
  after insert or update on public.monitorias
  for each row execute function app.tg_monitoria_eventos();

-- 5. Funções do portal --------------------------------------------------------------
-- Validar: considerações opcionais. A assinatura antiga (2 parâmetros) sai; a nova aceita a
-- chamada antiga do portal (p_consideracoes tem valor padrão), então o Preview atual continua
-- funcionando entre o script e a publicação do portal novo.
drop function if exists api.validar_monitoria(text, integer);
create or replace function api.validar_monitoria(p_id text, p_versao_lida integer, p_consideracoes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m     public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
  v_texto text := nullif(btrim(coalesce(p_consideracoes, '')), '');
begin
  if v_m.regua_versao_id is null then   -- M1
    perform app.recusar('MI403', 'A nota desta monitoria migrada não foi calculada pelo banco. Devolva para revisão e reenvio.');
  end if;
  if v_m.eliminatorio_pendente then
    perform app.recusar('MI422', 'Há eliminatório pendente: confirme o zeramento ou afaste o eliminatório antes de validar.');
  end if;
  if char_length(v_texto) > 2000 then
    perform app.recusar('MI422', format('As considerações têm %s caracteres; o limite é 2.000.', char_length(v_texto)));
  end if;
  perform set_config('app.consideracoes', coalesce(v_texto, ''), true);
  update public.monitorias m
     set status = 'Validada', aprovado_por = app.meu_perfil_id(), aprovado_em = now(), versao_lida = p_versao_lida
   where m.id = p_id;
  perform set_config('app.consideracoes', '', true);
  return app.resultado_monitoria(p_id);
end;
$$;

-- Devolver e Reprovar: iguais ao 08/10, com o limite de 2.000 caracteres (MI422).
create or replace function api.devolver_monitoria(p_id text, p_versao_lida integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.monitorias := app.monitoria_para_gestor(p_id, p_versao_lida);
begin
  if btrim(coalesce(p_motivo, '')) = '' then
    perform app.recusar('MI422', 'Informe o motivo da devolução (o que deve ser corrigido).');
  end if;
  if char_length(btrim(p_motivo)) > 2000 then
    perform app.recusar('MI422', format('O motivo tem %s caracteres; o limite é 2.000.', char_length(btrim(p_motivo))));
  end if;
  update public.monitorias m
     set status = 'Rascunho', motivo_ajuste = btrim(p_motivo), revisado_por = app.meu_perfil_id(), revisado_em = now(),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

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
  if char_length(btrim(p_motivo)) > 2000 then
    perform app.recusar('MI422', format('O motivo tem %s caracteres; o limite é 2.000.', char_length(btrim(p_motivo))));
  end if;
  update public.monitorias m
     set status = 'Reprovada', motivo_reprovacao = btrim(p_motivo), revisado_por = app.meu_perfil_id(), revisado_em = now(),
         versao_lida = p_versao_lida
   where m.id = p_id;
  return app.resultado_monitoria(p_id);
end;
$$;

-- Observação complementar (regra 10): só acrescenta um evento. Gestor ativo da equipe, que
-- não avaliou nem registrou a monitoria; monitoria já enviada alguma vez.
create or replace function api.registrar_observacao(p_id text, p_texto text, p_chave uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu    text := app.meu_perfil_id();
  v_m     public.monitorias;
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_ev    public.monitoria_eventos;
begin
  if auth.uid() is null or v_eu is null or not app.usuario_liberado() or not app.tem_perfil('GESTOR') then
    perform app.recusar('MI403', 'Somente um Gestor ativo registra observações.');
  end if;
  select * into v_m from public.monitorias m where m.id = p_id;
  if not found or not (v_m.monitor_id = any (app.equipe_do_gestor())) then
    perform app.recusar('MI404', 'Monitoria não encontrada na sua equipe.');
  end if;
  if v_m.monitor_id = v_eu or v_m.registrado_por = v_eu then
    perform app.recusar('MI403', 'Você avaliou ou registrou esta monitoria.');
  end if;
  if p_chave is null then
    perform app.recusar('MI428', 'Informe a chave da requisição.');
  end if;
  if v_texto is null then
    perform app.recusar('MI422', 'Escreva a observação.');
  end if;
  if char_length(v_texto) > 2000 then
    perform app.recusar('MI422', format('A observação tem %s caracteres; o limite é 2.000.', char_length(v_texto)));
  end if;
  if v_m.enviado_em is null and not coalesce(v_m.enviada_na_origem, false)
     and not exists (select 1 from public.monitoria_eventos e where e.monitoria_id = p_id) then
    perform app.recusar('MI403', 'A monitoria ainda não foi enviada para validação.');
  end if;

  insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes,
                                        responsavel_id, chave_requisicao)
  values (p_id, 'OBSERVACAO', greatest(app.rodada_atual(p_id, v_m.enviado_em is not null or coalesce(v_m.enviada_na_origem, false)), 1),
          null, v_m.status, v_m.nota, v_texto, v_eu, p_chave)
  on conflict (monitoria_id, chave_requisicao) do nothing
  returning * into v_ev;
  if v_ev.id is null then   -- repetição da mesma requisição: devolve o que já está gravado
    select * into v_ev from public.monitoria_eventos e where e.monitoria_id = p_id and e.chave_requisicao = p_chave;
    if v_ev.consideracoes is distinct from v_texto or v_ev.responsavel_id is distinct from v_eu then
      perform app.recusar('MI409', 'Esta chave de requisição já foi usada com outro conteúdo.');
    end if;
  end if;
  return to_jsonb(v_ev);
end;
$$;

revoke execute on function api.validar_monitoria(text, integer, text)  from public, anon, authenticated;
revoke execute on function api.devolver_monitoria(text, integer, text) from public, anon, authenticated;
revoke execute on function api.reprovar_monitoria(text, integer, text) from public, anon, authenticated;
revoke execute on function api.registrar_observacao(text, text, uuid)  from public, anon, authenticated;
grant  execute on function api.validar_monitoria(text, integer, text)  to authenticated;
grant  execute on function api.devolver_monitoria(text, integer, text) to authenticated;
grant  execute on function api.reprovar_monitoria(text, integer, text) to authenticated;
grant  execute on function api.registrar_observacao(text, text, uuid)  to authenticated;

-- 6. Reconstituição pela auditoria (regras 8 e 9) ----------------------------------
-- NÃO roda neste script. Primeiro se CONSULTA (só leitura) o que seria recuperado:
--   select * from app.eventos_reconstituiveis order by auditoria_seq;
-- (ver conferencia-14-reconstituicao.sql). Só depois, com autorização, se grava:
--   begin; set local app.responsavel = '<ADMIN>'; select app.reconstituir_eventos(); commit;
--
-- A visão lê a trilha das monitorias e aplica as MESMAS regras do gatilho. Cada linha diz a
-- fonte (linha da auditoria, data, quem e por qual via) e a situação:
--   'recuperável'  — dados suficientes: entra no histórico, marcado como reconstituído;
--   'descartado: …' — dado insuficiente ou não confiável (fica de fora, com o motivo);
--   'já no histórico' — o evento já existe (gatilho ou reconstituição anterior).
-- Considerações: só o texto que JÁ estava gravado (motivo de devolução, reprovação,
-- afastamento, cancelamento). Validação reconstituída fica SEM considerações (regra 9).
create or replace view app.eventos_reconstituiveis as
with trilha as (
  select a.seq, a.momento, a.acao, a.antes v_a, a.depois v_d, coalesce(a.depois, a.antes) ->> 'id' monitoria_id,
         coalesce(a.autor_perfil_id, a.responsavel_declarado) responsavel_id,
         case when a.autor_perfil_id is not null then 'login do portal'
              when a.responsavel_declarado is not null then 'ADMIN declarado (operação direta)' end via,
         coalesce((a.antes ->> 'enviado_em') is not null or coalesce((a.antes ->> 'enviada_na_origem')::boolean, false), false) ja_enviada
    from public.auditoria a
   where a.tabela = 'monitorias' and a.acao in ('INSERT', 'UPDATE')
), classificada as (
  select t.*,
         case
           when t.v_d ->> 'status' = 'Pendente' and (t.acao = 'INSERT' or t.v_a ->> 'status' is distinct from 'Pendente') then 'ENVIO'
           when t.acao = 'UPDATE' and t.v_a ->> 'status' is distinct from t.v_d ->> 'status' then
             case t.v_d ->> 'status' when 'Validada' then 'VALIDACAO' when 'Reprovada' then 'REPROVACAO'
                                     when 'Rascunho' then 'DEVOLUCAO' when 'Cancelada' then 'CANCELAMENTO' end
           when t.acao = 'UPDATE' and not coalesce((t.v_a ->> 'zerada')::boolean, false) and coalesce((t.v_d ->> 'zerada')::boolean, false)
             then 'ZERAMENTO_CONFIRMADO'
           when t.acao = 'UPDATE' and t.v_a ->> 'eliminatorio_afastado_em' is null and t.v_d ->> 'eliminatorio_afastado_em' is not null
             then 'ELIMINATORIO_AFASTADO'
         end tipo_base
    from trilha t
), avaliada as (
  select c.*,
         case
           when c.acao = 'INSERT' and c.v_d ->> 'origem' is distinct from 'portal'
             then 'descartado: inclusão pela migração (não foi envio feito neste banco)'
           when c.v_d ->> 'versao' is null or (c.acao = 'UPDATE' and c.v_a is null)
             then 'descartado: registro incompleto na auditoria'
           when c.responsavel_id is null or not exists (select 1 from public.perfis p where p.id = c.responsavel_id)
             then 'descartado: responsável não identificado'
           when exists (select 1 from public.monitoria_eventos e where e.auditoria_seq = c.seq)
             or exists (select 1 from public.monitoria_eventos e where e.monitoria_id = c.monitoria_id
                           and e.versao_monitoria = (c.v_d ->> 'versao')::integer)
             then 'já no histórico'
           else 'recuperável'
         end situacao
    from classificada c
   where c.tipo_base is not null
), numerada as (
  select a.*,
         count(*) filter (where a.tipo_base = 'ENVIO' and a.situacao = 'recuperável')
           over (partition by a.monitoria_id order by a.seq rows between unbounded preceding and current row) envios_ate_aqui,
         -- base: a monitoria já tinha sido enviada antes do primeiro envio que a trilha mostra
         coalesce(first_value(a.ja_enviada) over (partition by a.monitoria_id, (a.tipo_base = 'ENVIO' and a.situacao = 'recuperável')
                                                   order by a.seq), false) primeiro_ja_enviada
    from avaliada a
), base as (
  select n.*,
         coalesce(bool_or(n.primeiro_ja_enviada) filter (where n.tipo_base = 'ENVIO' and n.situacao = 'recuperável')
                    over (partition by n.monitoria_id), n.ja_enviada) ja_enviada_antes
    from numerada n
)
select b.seq auditoria_seq,
       b.momento ocorrido_em,
       b.monitoria_id,
       case when b.tipo_base = 'ENVIO' and b.envios_ate_aqui + (case when b.ja_enviada_antes then 1 else 0 end) > 1 then 'REENVIO'
            else b.tipo_base end tipo,
       greatest(b.envios_ate_aqui + (case when b.ja_enviada_antes then 1 else 0 end), 1) rodada,
       (b.v_d ->> 'versao')::integer versao_monitoria,
       b.v_d ->> 'status' status_resultante,
       (b.v_d ->> 'nota')::numeric nota,
       nullif(btrim(coalesce(case b.tipo_base when 'REPROVACAO' then b.v_d ->> 'motivo_reprovacao' when 'DEVOLUCAO' then b.v_d ->> 'motivo_ajuste'
                                              when 'CANCELAMENTO' then b.v_d ->> 'cancelado_motivo'
                                              when 'ELIMINATORIO_AFASTADO' then b.v_d ->> 'eliminatorio_afastado_motivo' end, '')), '') consideracoes,
       b.responsavel_id,
       b.via,
       b.situacao,
       concat_ws('; ',
         case when b.tipo_base = 'VALIDACAO' then 'sem considerações: o campo não existia (regra 9)' end,
         case when b.tipo_base in ('ZERAMENTO_CONFIRMADO', 'ELIMINATORIO_AFASTADO') then 'sem identificação do critério' end,
         case when b.tipo_base in ('DEVOLUCAO', 'REPROVACAO', 'CANCELAMENTO', 'ELIMINATORIO_AFASTADO')
                   and nullif(btrim(coalesce(case b.tipo_base when 'REPROVACAO' then b.v_d ->> 'motivo_reprovacao'
                         when 'DEVOLUCAO' then b.v_d ->> 'motivo_ajuste' when 'CANCELAMENTO' then b.v_d ->> 'cancelado_motivo'
                         else b.v_d ->> 'eliminatorio_afastado_motivo' end, '')), '') is null then 'motivo não gravado na época' end,
         case when b.via like 'ADMIN%' then 'responsável declarado, não autenticado' end) limitacoes
  from base b;

comment on view app.eventos_reconstituiveis is
  'SÓ LEITURA. O que a reconstituição pela auditoria recuperaria, com fonte, situação e limitações (regras 8 e 9).';
revoke all on app.eventos_reconstituiveis from public, anon, authenticated;

-- Grava SÓ o que a visão marca como 'recuperável'. Exige o ADMIN responsável declarado (06).
-- Pode rodar de novo: cada linha de auditoria gera no máximo um evento.
create or replace function app.reconstituir_eventos()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, nota, consideracoes,
                                        responsavel_id, ocorrido_em, origem, auditoria_seq)
  select r.monitoria_id, r.tipo, r.rodada, r.versao_monitoria, r.status_resultante, r.nota, r.consideracoes,
         r.responsavel_id, r.ocorrido_em, 'reconstituido', r.auditoria_seq
    from app.eventos_reconstituiveis r
   where r.situacao = 'recuperável'
   order by r.auditoria_seq
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function app.reconstituir_eventos() from public;

-- 7. Conferência dentro da transação: falhou = nada aplicado -----------------------
do $conf$
declare
  v_f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.monitoria_eventos'::regclass) then
    raise exception 'SCRIPT 14: a tabela de eventos ficou sem RLS.';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.monitoria_eventos'::regclass and not tgisinternal
       and tgname in ('monitoria_eventos_sem_alteracao', 'monitoria_eventos_sem_exclusao', 'monitoria_eventos_sem_truncate',
                      'monitoria_eventos_z_auditoria', 'monitoria_eventos_z_auditoria_truncate')) <> 5 then
    raise exception 'SCRIPT 14: faltam gatilhos de proteção ou de auditoria na tabela de eventos.';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.monitorias'::regclass and tgname = 'monitorias_y_eventos') then
    raise exception 'SCRIPT 14: o gatilho de eventos não ficou na tabela de monitorias.';
  end if;
  if has_table_privilege('authenticated', 'public.monitoria_eventos', 'insert')
     or has_table_privilege('authenticated', 'public.monitoria_eventos', 'update')
     or has_table_privilege('authenticated', 'public.monitoria_eventos', 'delete')
     or has_table_privilege('anon', 'public.monitoria_eventos', 'select') then
    raise exception 'SCRIPT 14: permissão de escrita (ou leitura anônima) indevida na tabela de eventos.';
  end if;
  foreach v_f in array array['api.validar_monitoria(text, integer, text)', 'api.devolver_monitoria(text, integer, text)',
                             'api.reprovar_monitoria(text, integer, text)', 'api.registrar_observacao(text, text, uuid)'] loop
    if not (select prosecdef from pg_proc where oid = v_f::regprocedure)
       or has_function_privilege('anon', v_f::regprocedure, 'execute')
       or not has_function_privilege('authenticated', v_f::regprocedure, 'execute') then
      raise exception 'SCRIPT 14: % com segurança ou permissão diferente da esperada.', v_f;
    end if;
  end loop;
  if position('-- M1' in pg_get_functiondef('api.reprovar_monitoria(text, integer, text)'::regprocedure)) = 0
     or position('-- M1' in pg_get_functiondef('api.validar_monitoria(text, integer, text)'::regprocedure)) = 0 then
    raise exception 'SCRIPT 14: a barreira M1 não ficou nas funções de decisão.';
  end if;
  if exists (select 1 from pg_proc where oid = to_regprocedure('api.validar_monitoria(text, integer)')) then
    raise exception 'SCRIPT 14: a assinatura antiga de validar_monitoria continua existindo (chamada ambígua).';
  end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('14', 'Histórico de calibração: monitoria_eventos (só inclusão), eventos por gatilho, considerações no Validar, observação complementar, reconstituição pela auditoria')
on conflict (versao) do nothing;

notify pgrst, 'reload schema';

commit;
