// =============================================================================
// MonitorIA · Conferência e restauração de um backup (backup-completo.sql)
// =============================================================================
// Roda NESTE computador. Não acessa o Supabase nem envia nada a lugar nenhum.
//
//   node restauracao.mjs conferir <backup.json>
//       Confere se o arquivo está completo: formato, todas as tabelas, contagens iguais às da
//       conferência embutida, nenhuma tabela fora do backup, auditoria sem quebras. Mostra só
//       contagens e datas — nenhum dado pessoal.
//
//   node restauracao.mjs gerar <backup.json> <saida.sql> --responsavel <id ADMIN> --motivo "<texto>"
//       Gera o SQL de restauração (uma transação) para o SQL Editor. O SQL CONTÉM OS DADOS DO
//       BACKUP: guardar com o mesmo cuidado do backup e apagar depois do uso.
//
// O que a restauração faz (tudo ou nada):
//   1. confere que o banco de destino tem os mesmos scripts de ESTRUTURA do backup;
//   2. desliga, só dentro da transação, os gatilhos das tabelas restauradas — assim as linhas da
//      auditoria voltam com a numeração e as impressões digitais ORIGINAIS, e a cadeia continua;
//   3. troca o conteúdo das tabelas pelo do backup (o banco volta ao momento do backup);
//   4. acerta as numerações automáticas; religa os gatilhos;
//   5. confere contagens, impressões digitais e a cadeia da auditoria — qualquer diferença desfaz tudo;
//   6. registra a própria restauração como novo elo da auditoria (responsável e motivo declarados).
//
// Não restaura (não está no backup): logins, senhas e autenticadores (Supabase Auth), arquivos
// de áudio/documentos (o portal não os guarda), configurações do Supabase e da Vercel. Perfis
// cujo login não existe no banco de destino voltam sem vínculo; o vínculo se refaz sozinho no
// primeiro login com o mesmo e-mail (script 01).
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Ordem de inclusão: quem é referenciado vem antes (a exclusão usa a ordem inversa).
export const TABELAS = [
  'app.migracao_lotes', 'app.migracao_origem', 'app.migracao_ocorrencias',
  'public.perfis', 'public.areas', 'public.area_monitores', 'public.colaboradores', 'public.alocacoes',
  'public.alocacoes_historico', 'public.criterios', 'public.criterio_subperguntas', 'public.regua_versoes',
  'public.documentos', 'public.catalogos', 'public.configuracoes', 'public.monitorias',
  'public.monitoria_respostas', 'public.monitoria_evidencias', 'public.monitoria_eventos',
  'public.acessos_log', 'public.auditoria',
];
const COM_IDENTIDADE = { 'public.acessos_log': 'seq', 'public.monitoria_eventos': 'id' };
// Scripts que só gravam DADOS (migração, colaborador de teste, primeiro ADMIN): os dados vêm do
// backup, então o banco de destino não precisa deles — só dos scripts de ESTRUTURA.
export const SO_DE_DADOS = ['09', '11a', '12a'];

/** CSV (RFC 4180) → linhas de campos. Campos entre aspas podem ter vírgulas, quebras e "" (aspas). */
const lerCsv = (texto) => {
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (aspas) throw new Error('CSV cortado: aspas abertas no fim do arquivo.');
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
};

/**
 * Aceita o arquivo como o SQL Editor entrega: "Download CSV" (colunas resumo,backup), "Copy as JSON"
 * (lista com a linha resumo/backup), o objeto do backup ou o backup como texto.
 */
export const lerBackup = (texto) => {
  texto = texto.replace(/^﻿/, '');
  if (!/^\s*[[{"]/.test(texto)) {
    const [cab, ...linhas] = lerCsv(texto);
    const col = (cab ?? []).indexOf('backup');
    if (col < 0) throw new Error('CSV sem a coluna "backup" — não é o resultado de backup-completo.sql.');
    const dados = linhas.filter((l) => l.some((x) => x !== ''));
    if (dados.length !== 1) throw new Error(`CSV com ${dados.length} linhas de resultado; o esperado é 1.`);
    texto = dados[0][col];
  }
  let v = JSON.parse(texto);
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === 'object' && 'backup' in v) v = v.backup;
  if (typeof v === 'string') v = JSON.parse(v);
  return v;
};

/** Linhas de uma tabela do arquivo (cada linha vem como texto exato do banco). */
export const linhasDe = (b, t) => (b?.dados?.[t] ?? []).map((x) => (typeof x === 'string' ? JSON.parse(x) : x));

/** Problemas que impedem usar o arquivo. Lista vazia = completo. */
export const conferirBackup = (b) => {
  const p = [];
  if (!b || b.formato !== 'monitoria-backup-v1') return ['formato desconhecido (esperado monitoria-backup-v1)'];
  const m = b.meta ?? {}, d = b.dados ?? {};
  for (const t of ['app.versoes_esquema', ...TABELAS]) {
    if (!Array.isArray(d[t])) p.push(`tabela ausente no arquivo: ${t}`);
    else if (m.contagens?.[t] !== d[t].length) p.push(`${t}: ${d[t].length} linhas no arquivo, ${m.contagens?.[t]} no banco (arquivo cortado?)`);
  }
  if ((m.tabelas_fora_do_backup ?? []).length) p.push(`tabelas do banco fora do backup: ${m.tabelas_fora_do_backup.join(', ')}`);
  if (Number(m.auditoria?.quebras) !== 0) p.push(`a auditoria já tinha ${m.auditoria?.quebras} quebra(s) no banco`);
  if (Object.values(d).some((v) => Array.isArray(v) && v.some((x) => typeof x !== 'string'))) p.push('linhas fora do formato de texto exato (arquivo alterado por outro programa?)');
  const aud = linhasDe(b, 'public.auditoria');
  if (aud.length && (aud.at(-1).seq !== m.auditoria?.ultimo_seq || aud.at(-1).hash !== m.auditoria?.ultimo_hash)) p.push('o último elo da auditoria no arquivo não é o do banco');
  for (let i = 1; i < aud.length; i++) if (aud[i].hash_anterior !== aud[i - 1].hash) { p.push(`elo quebrado na auditoria do arquivo (seq ${aud[i].seq})`); break; }
  return p;
};

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

export const gerarRestauracao = (b, { responsavel, motivo, origem = 'backup' }) => {
  const prob = conferirBackup(b);
  if (prob.length) throw new Error(`Backup recusado: ${prob.join('; ')}`);
  if (!responsavel || !/^[a-z0-9-]+$/i.test(responsavel)) throw new Error('Informe --responsavel com o id do perfil ADMIN.');
  if (!motivo || motivo.trim().length < 10) throw new Error('Informe --motivo com ao menos 10 caracteres.');
  const json = (v) => JSON.stringify(v);
  let tag; do tag = `bk${randomBytes(4).toString('hex')}`; while (json(b.dados).includes(`$${tag}$`));
  const dol = (v) => `$${tag}$${json(v)}$${tag}$::jsonb`;
  // cada linha é texto exato: o Postgres a relê sem perder casas decimais nem a ordem do JSON
  const recs = (v) => `(select coalesce(jsonb_agg(x::jsonb), '[]') from jsonb_array_elements_text(${dol(v)}) x)`;
  const m = b.meta;
  const L = [];
  L.push(`-- MonitorIA · RESTAURAÇÃO do backup de ${m.gerado_em} (${origem})`);
  L.push('-- ATENÇÃO: este arquivo contém os dados do backup. Guardar como o backup; apagar depois do uso.');
  L.push('-- Uma transação: qualquer diferença na conferência final desfaz tudo.');
  L.push('begin;');
  L.push(`set local app.responsavel = ${lit(responsavel)};`);
  L.push(`set local app.manutencao = 'restauracao';`);
  L.push(`set local app.manutencao_motivo = ${lit(motivo.trim())};`);
  L.push('');
  const estrutura = m.versoes.filter((v) => !SO_DE_DADOS.includes(v));
  L.push('-- 1. o banco de destino precisa ter exatamente os scripts de ESTRUTURA do backup');
  L.push(`do $pre$ begin
  if (select coalesce(jsonb_agg(versao order by versao), '[]') from app.versoes_esquema
       where versao <> all (array[${SO_DE_DADOS.map(lit).join(', ')}])) is distinct from ${lit(json(estrutura))}::jsonb then
    raise exception 'RESTAURAÇÃO RECUSADA: os scripts de estrutura do banco (%) diferem dos do backup (${estrutura.join(', ')}).',
      (select string_agg(versao, ', ' order by versao) from app.versoes_esquema where versao <> all (array[${SO_DE_DADOS.map(lit).join(', ')}]));
  end if;
end $pre$;`);
  L.push('');
  L.push('-- 2. gatilhos desligados só nesta transação (a auditoria volta com a numeração original)');
  for (const t of ['app.versoes_esquema', ...TABELAS]) L.push(`alter table ${t} disable trigger user;`);
  L.push('');
  L.push('-- 3. o banco volta ao momento do backup');
  for (const t of [...TABELAS].reverse()) L.push(`delete from ${t};`);
  // o registro dos scripts volta como estava (inclui os só de dados, como 09 e 12a)
  L.push('delete from app.versoes_esquema;');
  L.push(`insert into app.versoes_esquema select * from jsonb_populate_recordset(null::app.versoes_esquema, ${recs(b.dados['app.versoes_esquema'])});`);
  for (const t of TABELAS) {
    const linhas = b.dados[t];
    if (!linhas.length) continue;
    if (t === 'public.perfis') {
      // vínculo com o login só se esse login existir neste banco
      L.push(`insert into public.perfis select (jsonb_populate_record(null::public.perfis, e - 'auth_user_id'
  || jsonb_build_object('auth_user_id', case when exists (select 1 from auth.users u where u.id::text = e ->> 'auth_user_id') then e -> 'auth_user_id' end))).*
  from jsonb_array_elements(${recs(linhas)}) e;`);
    } else {
      L.push(`insert into ${t}${COM_IDENTIDADE[t] ? ' overriding system value' : ''} select * from jsonb_populate_recordset(null::${t}, ${recs(linhas)});`);
    }
  }
  L.push('');
  L.push('-- 4. numerações automáticas');
  L.push(`select setval('app.auditoria_seq', greatest(coalesce((select max(seq) from public.auditoria), 0), ${Number(m.sequencias?.['app.auditoria_seq'] ?? 0)}, 1));`);
  for (const [t, c] of Object.entries(COM_IDENTIDADE)) {
    L.push(`select setval(pg_get_serial_sequence('${t}', '${c}'), coalesce((select max(${c}) from ${t}), 1), (select max(${c}) from ${t}) is not null);`);
  }
  for (const t of ['app.versoes_esquema', ...TABELAS]) L.push(`alter table ${t} enable trigger user;`);
  L.push('');
  L.push('-- 5. conferência: contagens, impressões digitais e cadeia da auditoria iguais às do backup');
  const cont = TABELAS.map((t) => `('${t}', (select count(*) from ${t}), ${b.dados[t].length})`).join(',\n    ');
  L.push(`do $conf$
declare r record;
begin
  for r in select * from (values
    ${cont}) x(tabela, atual, esperado) loop
    if r.atual <> r.esperado then
      raise exception 'RESTAURAÇÃO DESFEITA: % tem % linhas (backup: %).', r.tabela, r.atual, r.esperado;
    end if;
  end loop;
  if (select md5(coalesce(string_agg((to_jsonb(t) - 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em')::text, '|' order by t.id), '')) from public.monitorias t) <> ${lit(m.impressoes.monitorias)}
     or (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.monitoria_id, t.criterio_id), '')) from public.monitoria_respostas t) <> ${lit(m.impressoes.respostas)}
     or (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text), '')) from public.monitoria_evidencias t) <> ${lit(m.impressoes.evidencias)}
     or (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')) from public.monitoria_eventos t) <> ${lit(m.impressoes.eventos)} then
    raise exception 'RESTAURAÇÃO DESFEITA: as impressões digitais não conferem com as do backup.';
  end if;
  if (select count(*) from (select a.hash <> app.auditoria_hash(a)
        or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q) <> 0
     or (select hash from public.auditoria order by seq desc limit 1) is distinct from ${m.auditoria.ultimo_hash ? lit(m.auditoria.ultimo_hash) : 'null'} then
    raise exception 'RESTAURAÇÃO DESFEITA: a cadeia da auditoria não confere com a do backup.';
  end if;
end $conf$;`);
  L.push('');
  L.push('-- 6. a própria restauração vira o próximo elo da auditoria');
  L.push(`insert into public.acessos_log (id, tipo_evento, detalhes, momento)
  values ('restauracao-' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MISS'), 'RESTAURACAO_BACKUP',
          ${lit(`Backup de ${m.gerado_em} restaurado. Motivo: ${motivo.trim()}`)}, now());`);
  L.push('');
  L.push('commit;');
  return L.join('\n') + '\n';
};

// ---- linha de comando ----------------------------------------------------------------------
const [, script, acao, arq, saida, ...resto] = process.argv;
if (script && import.meta.url.endsWith(script.replace(/\\/g, '/').split('/').pop())) {
  const opc = (n) => { const i = resto.indexOf(`--${n}`); return i >= 0 ? resto[i + 1] : undefined; };
  try {
    if (!arq || !existsSync(arq)) throw new Error('Arquivo de backup não encontrado.');
    const b = lerBackup(readFileSync(arq, 'utf8'));
    if (acao === 'conferir') {
      const p = conferirBackup(b);
      console.log(`Backup de ${b?.meta?.gerado_em ?? '?'} · scripts ${(b?.meta?.versoes ?? []).join(', ')}`);
      for (const t of TABELAS) console.log(`  ${t.padEnd(30)} ${String(b?.dados?.[t]?.length ?? '—').padStart(6)} linhas`);
      console.log(`  auditoria: último elo ${b?.meta?.auditoria?.ultimo_seq}, quebras ${b?.meta?.auditoria?.quebras}`);
      console.log(p.length ? `\nINCOMPLETO:\n  - ${p.join('\n  - ')}` : '\nCOMPLETO: todas as tabelas e contagens conferem.');
      process.exit(p.length ? 1 : 0);
    } else if (acao === 'gerar') {
      writeFileSync(saida, gerarRestauracao(b, { responsavel: opc('responsavel'), motivo: opc('motivo'), origem: arq.split(/[\\/]/).pop() }));
      console.log(`SQL de restauração gravado em ${saida}. Contém os dados do backup — guardar com cuidado e apagar depois do uso.`);
    } else {
      console.log('Uso: node restauracao.mjs conferir <backup.json> | gerar <backup.json> <saida.sql> --responsavel <ADMIN> --motivo "<texto>"');
      process.exit(2);
    }
  } catch (e) {
    console.error(`ERRO: ${e.message}`);
    process.exit(1);
  }
}
