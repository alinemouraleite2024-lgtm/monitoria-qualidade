// Roda todas as suítes de integração do banco num Postgres LOCAL (PGlite). Nada sai deste
// computador e nada toca o Supabase.
//
// Uso (a partir desta pasta, depois de `npm install` aqui):
//   node rodar-todos.mjs                 relógio de hoje
//   node rodar-todos.mjs --dias 80       relógio deslocado 80 dias (prova que não dependem da data)
//
// Suítes que dependem de arquivos LOCAIS e git-ignorados (migração real, decisões reais, backup)
// aparecem como PULADA quando o arquivo não existe — nunca como aprovadas.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const sql = join(raiz, 'supabase', 'sql');
const fx = join(aqui, 'fixtures');
const i = process.argv.indexOf('--dias');
const dias = i > 0 ? Number(process.argv[i + 1]) : 0;
const backup = process.env.MONITORIA_BACKUP || join(raiz, '..', 'backup', 'monitoria-backup-2026-10-08-15-16-53.json');
const saida = join(raiz, 'supabase', 'migracao', 'saida');
const tmp = mkdtempSync(join(tmpdir(), 'monitoria-testes-'));

if (!existsSync(join(aqui, 'node_modules', '@electric-sql', 'pglite'))) {
  console.log('Falta o PGlite: rode `npm install` nesta pasta (supabase/testes).');
  process.exit(2);
}

const SUITES = [
  { nome: 'e1 (scripts 00–08)', arq: 'testes-e1.mjs', args: [sql, join(fx, 'criterios-semente.json')], requer: [backup], env: { MONITORIA_BACKUP: backup } },
  { nome: 'r5 (implantação sem ADMIN)', arq: 'testes-r5.mjs', args: [sql, join(fx, '06_auditoria.versao-aplicada.sql')] },
  { nome: 'padrões do Supabase', arq: 'testes-padroes.mjs', args: [sql] },
  { nome: '09 (migração, sintético)', arq: 'testes-09.mjs', args: [sql, join(raiz, 'supabase', 'migracao', 'gerar-09.mjs'), join(fx, 'reguas'), join(fx, 'catalogos-semente.json')] },
  { nome: '10 (P1 reprovar × M1)', arq: 'testes-10.mjs', args: [raiz], requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: 'exportação do navegador', arq: 'testes-exportacao.mjs', args: [raiz, join(fx, 'reguas'), join(tmp, 'exportacao')] },
  { nome: 'decisões reais', arq: 'testes-decisoes-reais.mjs', args: [raiz], requer: [join(raiz, 'supabase', 'migracao', 'decisoes.json')] },
  { nome: 'ensaio da migração real', arq: 'ensaio-real.mjs', args: [raiz], requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: 'portal compartilhado', arq: 'testes-compartilhado.mjs', args: [raiz, join(fx, 'reguas')], ts: true },
  { nome: '12 (MFA do ADMIN)', arq: 'testes-12-mfa.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '12a (primeiro ADMIN)', arq: 'testes-12a-admin.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '11 (homologação ponta a ponta)', arq: 'testes-11-homologacao.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '13 (metas: banco e portal)', arq: 'testes-13-metas.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '14 (histórico de calibração)', arq: 'testes-14-historico.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: 'backup e restauração', arq: 'testes-backup.mjs', args: [raiz, join(fx, 'reguas')], ts: true },
  { nome: '15 (duplicidade na criação)', arq: 'testes-15-duplicidade.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '15 e 15b (ensaio da implantação)', arq: 'testes-15-implantacao.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '15r (ensaio da reversão)', arq: 'testes-15-reversao.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '15c e 11b (encerramento dos testes)', arq: 'testes-15c-encerramento.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
  { nome: '16 (colaboradora inativa)', arq: 'testes-16-colaboradora-inativa.mjs', args: [raiz], ts: true, requer: [join(saida, '09b_migracao_dados.sql'), join(saida, 'manifesto.json')] },
];

console.log(`Suítes de integração · relógio ${dias ? `+${dias} dias` : 'de hoje'}\n`);
let falhou = false;
for (const s of SUITES) {
  const falta = (s.requer || []).filter((f) => !existsSync(f));
  if (falta.length) { console.log(`  PULADA    ${s.nome} — falta arquivo local (git-ignorado): ${falta.map((f) => f.slice(raiz.length + 1) || f).join(', ')}`); continue; }
  const imports = ['--import', pathToFileURL(join(aqui, 'relogio-deslocado.mjs')).href];
  if (s.ts) imports.push('--import', pathToFileURL(join(raiz, 'tests', 'registrar-ts.mjs')).href);
  const r = spawnSync(process.execPath, [...imports, join(aqui, s.arq), ...s.args],
    { cwd: aqui, encoding: 'utf8', env: { ...process.env, ...(s.env || {}), DIAS_DESLOCADOS: String(dias) }, maxBuffer: 64 * 1024 * 1024 });
  const linhas = `${r.stdout}\n${r.stderr}`.split('\n');
  const resumo = linhas.filter((l) => /testes ·|verificações ·|INTERROMPIDO/.test(l)).pop() || '(sem resumo)';
  // o código de saída não basta: há suíte que termina com 0 mesmo com falha — vale o resumo
  const ok = r.status === 0 && !/INTERROMPIDO/.test(resumo) && /· 0 falhas/.test(resumo);
  if (!ok) falhou = true;
  console.log(`  ${ok ? 'APROVADA' : 'FALHOU  '}  ${s.nome.padEnd(30)} ${resumo.trim()}`);
  if (!ok) for (const l of linhas.filter((x) => x.startsWith('✖')).slice(0, 10)) console.log(`            ${l}`);
}
rmSync(tmp, { recursive: true, force: true });
process.exit(falhou ? 1 : 0);
