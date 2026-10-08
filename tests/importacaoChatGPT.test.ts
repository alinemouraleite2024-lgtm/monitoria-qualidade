// Testes do importador `monitoria-chatgpt/1`.
//
// Rodar a partir da raiz do projeto:
//   node --import ./tests/registrar-ts.mjs --test tests/
//
// O caso-base é a AGO-001 (docs/exemplos), avaliação real já revisada, cuja nota aprovada é
// 78,57. Cada teste parte dela e altera uma coisa só.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIAL_CRITERIA } from '../src/mockData';
import { OFFICIAL_COLLABORATORS, OFFICIAL_USERS } from '../src/teamData';
import { OFFICIAL_CATEGORIAS } from '../src/constants/catalogData';
import { validarImportacao, calcularNotaPrevia, type ContextoImportacao } from '../src/domain/importacaoChatGPT';
import type { Monitoring } from '../src/types/domain';

const AGO001 = readFileSync(new URL('../docs/exemplos/AGO-001.monitoria-chatgpt.json', import.meta.url), 'utf8');
const base = () => JSON.parse(AGO001);
const aline = OFFICIAL_USERS.find((u) => u.id === 'usr-1')!;

const contexto = (extra: Partial<ContextoImportacao> = {}): ContextoImportacao => ({
  criteria: INITIAL_CRITERIA,
  collaborators: OFFICIAL_COLLABORATORS,
  currentUser: aline,
  catalogCategorias: OFFICIAL_CATEGORIAS,
  monitorings: [],
  ...extra,
});

const validar = (json: unknown, extra?: Partial<ContextoImportacao>) =>
  validarImportacao(typeof json === 'string' ? json : JSON.stringify(json), contexto(extra));

const criterio = (j: { criterios: { criterionId: string }[] }, id: string) => j.criterios.find((c) => c.criterionId === id)!;
const temErro = (r: { erros: string[] }, trecho: string) => r.erros.some((e) => e.includes(trecho));

// ---------------------------------------------------------------------------
// Caso-base
// ---------------------------------------------------------------------------

test('AGO-001 válida: nenhum erro e nota 78,57 calculada pelo MonitorIA', () => {
  const r = validar(AGO001);
  assert.deepEqual(r.erros, []);
  assert.equal(r.notaCalculada, 78.57);
  assert.equal(r.notaEsperada, 78.57);
});

test('AGO-001: os 28 critérios ativos do canal, 2 checklists e 6 blocos do relatório', () => {
  const r = validar(AGO001);
  assert.equal(r.itens.length, 28);
  assert.equal(Object.keys(r.respostas!).length, 28);
  assert.equal(r.itens.filter((i) => i.tipoResposta === 'CHECKLIST_SIM_NAO').length, 2);
  assert.equal(Object.values(r.relatorio!).filter(Boolean).length, 6);
  assert.equal(r.respostas!['crit-03'], undefined, 'crit-03 está inativo e não entra');
});

test('AGO-001: dados do atendimento resolvidos para o modelo do formulário', () => {
  const d = validar(AGO001).dados!;
  assert.equal(d.colaboradorId, 'usr-4');
  assert.equal(d.monitorId, 'usr-1');
  assert.equal(d.canal, 'Telefone');
  assert.equal(d.categoriaAtendimento, 'TRANSFERÊNCIA DE TITULARIDADE');
  assert.equal(d.numeroAtendimento, '00999', 'zero à esquerda preservado');
  assert.equal(d.date, '2026-08-31');
  assert.equal(d.competencia, '2026-08');
});

test('AGO-001: checklists calculados como no formulário (crit-04 = 2, crit-24 = 2)', () => {
  const r = validar(AGO001).respostas!;
  assert.equal(r['crit-04'].score, 2);
  assert.equal(r['crit-24'].score, 2);
  assert.deepEqual(r['crit-24'].subRespostas, { 'sub-24-1': 'SIM', 'sub-24-2': 'SIM' });
});

test('AGO-001 (telefone, crit-29 = Não): crit-25 é avaliado, sem portão, e a nota segue 78,57', () => {
  const r = validar(AGO001);
  assert.equal(r.respostas!['crit-29'].score, 'Não');
  assert.equal(r.respostas!['crit-25'].score, 2);
  assert.equal(r.itens.find((i) => i.criterionId === 'crit-25')!.bloqueadoPor, undefined);
  assert.equal(r.itens.filter((i) => i.score === 'N/A').length, 5);
  assert.equal(r.notaCalculada, 78.57, 'crit-25 e crit-29 têm peso 0');
});

test('crit-29 = Sim em telefone ou presencial bloqueia (regra de autenticação)', () => {
  for (const canal of ['Telefone', 'Presencial']) {
    const j = base();
    j.atendimento.canal = canal;
    criterio(j, 'crit-29').resposta = 'Sim';
    assert.ok(temErro(validar(j), 'não vale no canal ' + canal), canal);
  }
});

test('crit-29 = Sim no WhatsApp converte crit-25 em N/A pelo portão, com aviso', () => {
  const j = base();
  j.atendimento.canal = 'WhatsApp';
  criterio(j, 'crit-29').resposta = 'Sim';
  const r = validar(j);
  assert.deepEqual(r.erros, []);
  assert.equal(r.respostas!['crit-25'].score, 'N/A');
  assert.equal(r.itens.find((i) => i.criterionId === 'crit-25')!.bloqueadoPor, 'crit-29');
  assert.ok(r.avisos.some((a) => a.startsWith('crit-25 passa a N/A')));
});

test('crit-25 ausente com crit-29 = Não bloqueia', () => {
  const j = base();
  j.criterios = j.criterios.filter((c: { criterionId: string }) => c.criterionId !== 'crit-25');
  assert.ok(temErro(validar(j), 'crit-25'));
});

test('AGO-001: evidência é anexada à justificativa', () => {
  const r = validar(AGO001).respostas!;
  assert.equal(
    r['crit-09'].lowScoreReason,
    'A explicação foi compreensível, mas poderia ser organizada em uma sequência mais clara das etapas da cessão.\n\nEvidência: Orientações foram fornecidas, porém sem recapitulação estruturada do fluxo.',
  );
});

test('AGO-001: os quatro eliminatórios exigem revisão individual', () => {
  const r = validar(AGO001);
  assert.deepEqual(r.revisoes.map((x) => x.criterionId), ['crit-25', 'crit-26', 'crit-27', 'crit-28']);
  assert.ok(r.revisoes.every((x) => !x.grave));
});

test('não altera as entradas: critérios e monitorias existentes ficam intactos', () => {
  const criteria = structuredClone(INITIAL_CRITERIA);
  const monitorings = [{ id: 'MON-10001', numeroAtendimento: '00999', numeroTitulo: 'TESTE-01', status: 'Validada' }] as Monitoring[];
  const antes = JSON.stringify({ criteria, monitorings });
  validar(AGO001, { criteria, monitorings });
  assert.equal(JSON.stringify({ criteria, monitorings }), antes);
});

// ---------------------------------------------------------------------------
// Bloqueios
// ---------------------------------------------------------------------------

test('régua antiga: sub-24-3 é recusada com mensagem própria', () => {
  const j = base();
  criterio(j, 'crit-24').subRespostas['sub-24-3'] = 'NÃO';
  const r = validar(j);
  assert.ok(temErro(r, 'régua antiga'));
  assert.equal(r.dados, undefined, 'nada aplicável quando há erro');
});

test('criterionId inexistente é recusado nomeando o id', () => {
  const j = base();
  j.criterios.push({ criterionId: 'crit-99', resposta: 2 });
  assert.ok(temErro(validar(j), 'crit-99'));
});

test('critério inativo (crit-03) é recusado', () => {
  const j = base();
  j.criterios.push({ criterionId: 'crit-03', resposta: 'Telefone' });
  assert.ok(temErro(validar(j), 'inativo'));
});

test('critério fora do canal é recusado', () => {
  const criteria = INITIAL_CRITERIA.map((c) => (c.id === 'crit-05' ? { ...c, channels: ['WhatsApp' as const] } : c));
  assert.ok(temErro(validar(AGO001, { criteria }), 'não se aplica ao canal Telefone'));
});

test('criterionId repetido é recusado', () => {
  const j = base();
  j.criterios.push({ criterionId: 'crit-06', resposta: 1, justificativa: 'x' });
  assert.ok(temErro(validar(j), 'mais de uma vez'));
});

test('critério ativo ausente bloqueia e lista o id', () => {
  const j = base();
  j.criterios = j.criterios.filter((c: { criterionId: string }) => c.criterionId !== 'crit-17');
  assert.ok(temErro(validar(j), 'crit-17'));
});

test('crit-29 = Sim com crit-25 ocorrido é contradição e bloqueia', () => {
  const j = base();
  j.atendimento.canal = 'WhatsApp';
  criterio(j, 'crit-29').resposta = 'Sim';
  Object.assign(criterio(j, 'crit-25'), { resposta: 0, justificativa: 'Repassou dado sem confirmar.' });
  assert.ok(temErro(validar(j), 'Contradição'));
});

test('N/A onde a metodologia diz "Nunca é N/A" é recusado', () => {
  const j = base();
  Object.assign(criterio(j, 'crit-06'), { resposta: 'N/A', justificativa: 'x' });
  assert.ok(temErro(validar(j), 'não admite N/A'));
});

test('N/A em eliminatório sem o portão é recusado', () => {
  const j = base();
  criterio(j, 'crit-26').resposta = 'N/A';
  assert.ok(temErro(validar(j), 'eliminatório e não aceita N/A'));
});

test('checklist incompleto é recusado', () => {
  const j = base();
  delete criterio(j, 'crit-04').subRespostas['sub-04-4'];
  assert.ok(temErro(validar(j), 'faltam sub-perguntas'));
});

test('justificativa ausente em nota abaixo da máxima é recusada — sem erro duplicado em cascata', () => {
  const j = base();
  delete criterio(j, 'crit-09').justificativa;
  const r = validar(j);
  assert.ok(temErro(r, 'justificativa obrigatória'));
  assert.equal(r.erros.length, 1);
});

test('eliminatório ocorrido sem justificativa é recusado, como no formulário', () => {
  const j = base();
  criterio(j, 'crit-26').resposta = 0;
  assert.ok(temErro(validar(j), 'justificativa obrigatória'));
});

test('valor fora da escala é recusado', () => {
  const j = base();
  criterio(j, 'crit-06').resposta = 1.5;
  assert.ok(temErro(validar(j), 'Valores aceitos'));
});

test('opção de classificação inexistente é recusada', () => {
  const j = base();
  criterio(j, 'crit-01').resposta = 'Dúvida';
  assert.ok(temErro(validar(j), 'não é opção válida'));
});

test('colaborador: id e nome divergentes bloqueiam', () => {
  const j = base();
  j.atendimento.colaboradorId = 'usr-3';
  assert.ok(temErro(validar(j), 'Colaborador divergente'));
});

test('colaborador: id inexistente bloqueia', () => {
  const j = base();
  j.atendimento.colaboradorId = 'usr-999';
  assert.ok(temErro(validar(j), 'não existe no cadastro'));
});

test('colaborador: só o nome, sem acento, é aceito', () => {
  const j = base();
  delete j.atendimento.colaboradorId;
  j.atendimento.colaborador = 'allanis maquea silva';
  assert.equal(validar(j).dados?.colaboradorId, 'usr-4');
});

test('monitora diferente da usuária logada bloqueia', () => {
  const j = base();
  j.atendimento.monitora = 'Outra Pessoa';
  assert.ok(temErro(validar(j), 'sessão é de Aline'));
});

test('categoria fora do catálogo bloqueia e sugere a oficial (Cessão de Direitos)', () => {
  const j = base();
  j.atendimento.categoria = 'CESSÃO DE DIREITOS';
  const r = validar(j);
  assert.ok(temErro(r, 'TRANSFERÊNCIA DE TITULARIDADE'));
});

test('nota esperada divergente bloqueia (ex.: agente com a régua de 76,18)', () => {
  const j = base();
  j.conferencia.notaEsperada = 76.18;
  assert.ok(temErro(validar(j), 'Divergência de nota'));
});

test('data do atendimento divergente do início bloqueia', () => {
  const j = base();
  j.atendimento.dataAtendimento = '2026-08-30';
  assert.ok(temErro(validar(j), 'Divergência de datas'));
});

test('encerramento anterior ao início bloqueia', () => {
  const j = base();
  j.atendimento.fimAtendimento = '2026-08-31T15:00:00';
  assert.ok(temErro(validar(j), 'anterior ao início'));
});

test('nº do atendimento como número bloqueia (perderia o zero à esquerda)', () => {
  const j = base();
  j.atendimento.numeroAtendimento = 1150;
  assert.ok(temErro(validar(j), 'entre aspas'));
});

test('campo obrigatório ausente bloqueia', () => {
  const j = base();
  delete j.atendimento.numeroTitulo;
  assert.ok(temErro(validar(j), 'Nº do título não foi informado'));
});

test('bloco do relatório ausente bloqueia', () => {
  const j = base();
  delete j.relatorio.leituraTecnica;
  assert.ok(temErro(validar(j), 'leituraTecnica'));
});

test('schema ausente ou de outra versão bloqueia', () => {
  const j = base();
  delete j.schema;
  assert.ok(temErro(validar(j), '"schema" está ausente'));
  j.schema = 'monitoria-chatgpt/2';
  assert.ok(temErro(validar(j), 'não suportada'));
});

test('texto que não é JSON gera mensagem compreensível', () => {
  const r = validar('Segue a avaliação: { isto não é json }');
  assert.ok(temErro(r, 'não é um JSON válido'));
});

// ---------------------------------------------------------------------------
// Tolerâncias, avisos e confirmações
// ---------------------------------------------------------------------------

test('JSON entre crases e com texto em volta é lido', () => {
  const r = validar('Aqui está o resultado:\n```json\n' + AGO001 + '\n```\nQualquer dúvida, avise.');
  assert.deepEqual(r.erros, []);
});

test('nota final enviada pelo ChatGPT é ignorada, com aviso', () => {
  const j = base();
  j.notaFinal = 99;
  const r = validar(j);
  assert.deepEqual(r.erros, []);
  assert.equal(r.notaCalculada, 78.57);
  assert.ok(r.avisos.some((a) => a.includes('notaFinal')));
});

test('"2" e "1,33" em texto são convertidos com aviso', () => {
  const j = base();
  criterio(j, 'crit-06').resposta = '2';
  Object.assign(criterio(j, 'crit-05'), { resposta: '1,33', justificativa: 'Atendeu entre 5 e 15 minutos.' });
  delete j.conferencia;
  const r = validar(j);
  assert.deepEqual(r.erros, []);
  assert.equal(r.respostas!['crit-06'].score, 2);
  assert.equal(r.respostas!['crit-05'].score, 1.33);
  assert.ok(r.avisos.some((a) => a.startsWith('crit-05')));
});

test('"Ligação" é lido como canal Telefone', () => {
  const j = base();
  j.atendimento.canal = 'Ligação';
  const r = validar(j);
  assert.equal(r.dados?.canal, 'Telefone');
});

test('"NÃO", "Não" e "NAO" valem o mesmo nas sub-perguntas', () => {
  const j = base();
  Object.assign(criterio(j, 'crit-04'), {
    subRespostas: { 'sub-04-1': 'SIM', 'sub-04-2': 'Não', 'sub-04-3': 'NAO', 'sub-04-4': 'NÃO' },
    justificativa: 'Abertura incompleta.',
  });
  delete j.conferencia;
  const r = validar(j).respostas!;
  assert.equal(r['crit-04'].score, 0.5);
  assert.equal(r['crit-04'].subRespostas['sub-04-2'], 'NAO');
});

test('eliminatório ocorrido não bloqueia, mas vira revisão grave', () => {
  const j = base();
  Object.assign(criterio(j, 'crit-26'), { resposta: 0, justificativa: 'Ironizou a dúvida do cliente.' });
  const r = validar(j);
  assert.deepEqual(r.erros, []);
  assert.equal(r.respostas!['crit-26'].score, 0, 'zero estrito: é a marcação "ocorreu"');
  assert.equal(r.revisoes.find((x) => x.criterionId === 'crit-26')!.grave, true);
  assert.equal(r.notaCalculada, 78.57, 'a importação não zera a nota — quem zera é a gestão');
});

test('confiança BAIXA e revisão pedida pelo agente entram na revisão obrigatória', () => {
  const j = base();
  criterio(j, 'crit-13').confianca = 'BAIXA';
  criterio(j, 'crit-14').revisaoHumana = true;
  const ids = validar(j).revisoes.map((x) => x.criterionId);
  assert.ok(ids.includes('crit-13'));
  assert.ok(ids.includes('crit-14'));
});

test('mesmo atendimento já monitorado: não bloqueia, mas é devolvido para confirmação', () => {
  const monitorings = [
    { id: 'MON-10001', protocolo: 'MON-2026-0001', numeroAtendimento: '00999', numeroTitulo: 'TESTE-01', status: 'Validada' },
    { id: 'MON-10002', numeroAtendimento: '00999', numeroTitulo: 'TESTE-01', status: 'Cancelada' },
    { id: 'MON-10003', numeroAtendimento: '09999', numeroTitulo: 'TESTE-01', status: 'Validada' },
  ] as Monitoring[];
  const r = validar(AGO001, { monitorings });
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.duplicidades.map((m) => m.id), ['MON-10001']);
});

test('nome do critério divergente é só aviso: vale o id', () => {
  const j = base();
  criterio(j, 'crit-10').criterioNome = 'Argumentação';
  const r = validar(j);
  assert.deepEqual(r.erros, []);
  assert.ok(r.avisos.some((a) => a.startsWith('crit-10')));
});

test('calcularNotaPrevia segue a regra do formulário (peso 0 e N/A fora do denominador)', () => {
  const c = INITIAL_CRITERIA.filter((x) => ['crit-01', 'crit-06', 'crit-07', 'crit-25'].includes(x.id));
  const nota = calcularNotaPrevia(c, {
    'crit-01': { score: 'Solicitação' },
    'crit-06': { score: 1 },
    'crit-07': { score: 'N/A' },
    'crit-25': { score: 0 },
  });
  assert.equal(nota, 50);
});
