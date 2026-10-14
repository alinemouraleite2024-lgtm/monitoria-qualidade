// Extrai a semente de critérios (INITIAL_CRITERIA) de uma versão do repositório, SEM alterar nada.
//
// Uso (da raiz do projeto):
//   node --import ./tests/registrar-ts.mjs supabase/migracao/extrair-regua.mjs <revisão> <saída.json> [pasta temporária]
//   ex.: ... extrair-regua.mjs v0.25.0 regua-1.v0.25.0.json
//
// Como funciona: os arquivos .ts de src daquela versão são lidos com `git show` e copiados para
// uma pasta temporária (o repositório e a pasta de trabalho não são tocados); o mockData.ts dessa cópia é
// importado e a lista INITIAL_CRITERIA é gravada em JSON, com a impressão digital SHA-256 e a
// identificação do commit — é a evidência de origem do retrato da régua.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const [rev, saida, base] = process.argv.slice(2);
if (!rev || !saida) { console.error('uso: extrair-regua.mjs <revisão> <saída.json> [pasta temporária]'); process.exit(2); }

const commit = execFileSync('git', ['rev-parse', `${rev}^{commit}`], { encoding: 'utf8' }).trim();
const data = execFileSync('git', ['show', '-s', '--format=%cI', commit], { encoding: 'utf8' }).trim();
const pasta = mkdtempSync(join(base || tmpdir(), 'regua-'));
try {
  // Cada arquivo .ts de src naquela versão, lido com `git show` (só leitura).
  const arquivos = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'src'], { encoding: 'utf8' })
    .split('\n').filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  for (const f of arquivos) {
    const destino = join(pasta, f);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, execFileSync('git', ['show', `${commit}:${f}`], { maxBuffer: 1 << 26 }));
  }
  const { INITIAL_CRITERIA } = await import(pathToFileURL(join(pasta, 'src', 'mockData.ts')).href);
  const texto = JSON.stringify(INITIAL_CRITERIA);
  const digital = createHash('sha256').update(texto, 'utf8').digest('hex');
  writeFileSync(saida, JSON.stringify({ revisao: rev, commit, data_commit: data, sha256: digital, criterios: INITIAL_CRITERIA }, null, 1));
  console.log(`${rev} (${commit.slice(0, 7)}, ${data}): ${INITIAL_CRITERIA.length} critérios, sha256 ${digital.slice(0, 16)}…`);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
