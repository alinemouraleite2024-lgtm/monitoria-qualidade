// Histórico de calibração no modo local (Etapa B, 26/10/2026): as mesmas regras do gatilho do
// script 14 — envio/reenvio da monitora, decisões do gestor, nota de cada rodada, observação.
//   node --import ./tests/registrar-ts.mjs --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoriaDoEvento, contagemConsideracoes, eventosDaTransicao, novaObservacao, variacoesDeNota, eliminatoriosOcorridos,
  LIMITE_CONSIDERACOES,
} from '../src/domain/historicoCalibracao';
import type { Monitoring } from '../src/types/domain';

const base = { id: 'MON-1', status: 'Rascunho', finalScore: 0, scores: [], monitorId: 'usr-1' } as unknown as Monitoring;
const t = (n: number) => `2026-10-26T1${n}:00:00.000Z`;
const aplica = (antes: Monitoring | undefined, depois: Monitoring, quem: string, n: number, extra: { consideracoes?: string } = {}): Monitoring => ({
  ...depois, historico: [...(antes?.historico ?? []), ...eventosDaTransicao(antes, depois, { responsavelId: quem, agora: t(n), ...extra })],
});

test('rascunho não gera evento; envio, devolução, reenvio e validação formam as rodadas com a nota de cada uma', () => {
  const r0 = aplica(undefined, base, 'usr-1', 0);
  assert.equal(r0.historico!.length, 0);
  const r1 = aplica(r0, { ...r0, status: 'Pendente', finalScore: 97.12 }, 'usr-1', 1);
  const r2 = aplica(r1, { ...r1, status: 'Rascunho', adjustmentReason: 'rever o 12' }, 'usr-erivan', 2);
  const r3 = aplica(r2, { ...r2, status: 'Pendente', finalScore: 100 }, 'usr-1', 3);
  const r4 = aplica(r3, { ...r3, status: 'Validada' }, 'usr-erivan', 4, { consideracoes: '  boa condução  ' });
  const h = r4.historico!;
  assert.deepEqual(h.map((e) => `${e.tipo}/r${e.rodada}/${e.nota}`), ['ENVIO/r1/97.12', 'DEVOLUCAO/r1/97.12', 'REENVIO/r2/100', 'VALIDACAO/r2/100']);
  assert.equal(h[1].consideracoes, 'rever o 12');
  assert.equal(h[3].consideracoes, 'boa condução');
  assert.deepEqual(h.map((e) => autoriaDoEvento(e.tipo)), ['monitora', 'gestor', 'monitora', 'gestor']);
  const v = variacoesDeNota(h);
  assert.equal(v.get(h[0].id), null);
  assert.equal(v.get(h[2].id), 2.88);
});

test('validação sem considerações fica sem texto; reprovação leva o motivo', () => {
  const p = { ...base, status: 'Pendente', finalScore: 80, historico: [] } as Monitoring;
  const v = eventosDaTransicao(p, { ...p, status: 'Validada' }, { responsavelId: 'g', agora: t(1), consideracoes: '   ' });
  assert.equal(v[0].tipo, 'VALIDACAO');
  assert.equal(v[0].consideracoes, null);
  const r = eventosDaTransicao(p, { ...p, status: 'Reprovada', motivoReprovacao: 'fraude' }, { responsavelId: 'g', agora: t(1) });
  assert.equal(r[0].tipo, 'REPROVACAO');
  assert.equal(r[0].consideracoes, 'fraude');
});

test('monitoria enviada antes do histórico: a decisão fica na rodada 1 e o reenvio abre a rodada 2', () => {
  const antiga = { ...base, status: 'Pendente', finalScore: 90 } as Monitoring;   // sem historico
  const dev = aplica(antiga, { ...antiga, status: 'Rascunho', adjustmentReason: 'x' }, 'g', 1);
  assert.equal(dev.historico![0].rodada, 1);
  const re = aplica(dev, { ...dev, status: 'Pendente', finalScore: 95 }, 'usr-1', 2);
  assert.equal(re.historico![1].tipo, 'REENVIO');
  assert.equal(re.historico![1].rodada, 2);
});

test('zeramento: evento próprio com os critérios; observação não muda a monitoria', () => {
  const crit = [{ id: 'crit-26', numero: 26, name: 'Faltou com respeito', eliminatorio: true }, { id: 'crit-06', numero: 6, name: 'Empatia' }];
  const p = { ...base, status: 'Pendente', finalScore: 88, historico: [], scores: [{ criterionId: 'crit-26', score: 0, lowScoreReason: 'x' }, { criterionId: 'crit-06', score: 0, lowScoreReason: 'y' }] } as unknown as Monitoring;
  const criterios = eliminatoriosOcorridos(p, crit);
  assert.deepEqual(criterios, [{ id: 'crit-26', numero: 26, nome: 'Faltou com respeito' }]);
  const z = eventosDaTransicao(p, { ...p, zerada: true, finalScore: 0, eliminatoryPending: false }, { responsavelId: 'g', agora: t(1), criterios });
  assert.equal(z.length, 1);
  assert.equal(z[0].tipo, 'ZERAMENTO_CONFIRMADO');
  assert.equal(z[0].nota, 0);
  const o = novaObservacao(p, '  nota de calibração  ', 'g', t(2));
  assert.equal(o.tipo, 'OBSERVACAO');
  assert.equal(o.consideracoes, 'nota de calibração');
  assert.equal(o.statusResultante, 'Pendente');
  assert.equal(o.nota, 88);
  assert.equal(autoriaDoEvento('OBSERVACAO'), 'observacao');
});

test('contador de 2.000 caracteres: conta sem as bordas e acusa o excesso', () => {
  assert.equal(contagemConsideracoes('  abc  ').rotulo, `3/${LIMITE_CONSIDERACOES}`);
  assert.equal(contagemConsideracoes('x'.repeat(2000)).excedeu, false);
  assert.equal(contagemConsideracoes('x'.repeat(2001)).excedeu, true);
});
