// Detalhamento da meta (16/11/2026): cada monitoria que ocupa a cobertura é classificada pela situação
// real (validada, em reavaliação, aguardando validação), sem deduzir pela diferença. E competências
// iniciais de Relatórios / Meu Histórico por perfil.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classificarCobertura, getCarteiraProgress } from '../src/domain/goalService';
import { getDetalheDaColaboradora } from '../src/domain/queueService';
import { resumirNotas } from '../src/domain/resultadosService';
import { competenciaInicialDosRelatorios, type Period } from '../src/domain/period';
import type { ColaboradorGoal, Monitoring } from '../src/types/domain';

const AGO: Period = { year: 2026, month: 7 };   // mês base zero: agosto
let n = 0;
const m = (status: Monitoring['status'], p: Partial<Monitoring> = {}): Monitoring => ({
  id: `MON-${++n}`, competencia: '2026-08', date: `2026-08-${String(10 + n).padStart(2, '0')}T12:00:00Z`, monitorId: 'usr-1',
  colaboradorId: 'c-1', canal: 'Telefone', tipo: 'Regular', status, finalScore: 90, scores: [], ...p,
} as Monitoring);
const meta = (colaboradorId: string, alvo: number, canal?: ColaboradorGoal['canal']): ColaboradorGoal =>
  ({ id: `g-${colaboradorId}-${canal ?? 'geral'}`, monitorId: 'usr-1', colaboradorId, year: 2026, month: 7, targetQty: alvo, canal } as ColaboradorGoal);

test('cada monitoria da cobertura em uma única classe; a soma é a cobertura', () => {
  const lista = [m('Validada'), m('Pendente'), m('Em reavaliação', { id: 'MON-10001' }), m('Pendente'), m('Rascunho'), m('Reprovada'), m('Cancelada')];
  const p = getCarteiraProgress([meta('c-1', 10)], lista, 'usr-1', AGO);
  assert.equal(p.cobertura, 4);
  assert.deepEqual(p.coberturaPorSituacao, { validadas: 1, emReavaliacao: 1, aguardando: 2 });
  const c = p.coberturaPorSituacao;
  assert.equal(c.validadas + c.emReavaliacao + c.aguardando, p.cobertura);
  assert.equal(p.emReavaliacao, 1);
});

test('MON-10001 só em "em reavaliação"; Pendentes só em "aguardando validação"', () => {
  const reav = m('Em reavaliação', { id: 'MON-10001' });
  const pend = [m('Pendente'), m('Pendente')];
  const c = classificarCobertura([meta('c-1', 5)], [reav, ...pend], AGO);
  assert.deepEqual(c, { validadas: 0, emReavaliacao: 1, aguardando: 2 });
  assert.deepEqual(classificarCobertura([meta('c-1', 5)], pend, AGO), { validadas: 0, emReavaliacao: 0, aguardando: 2 });
});

test('acima do alvo: só as que ocupam vaga entram, na mesma ordem das vagas (data)', () => {
  // alvo 2; ordem por data: Validada(1), Em reavaliação(2), Pendente(3) → a Pendente é excedente
  const lista = [m('Pendente', { date: '2026-08-25T12:00:00Z' }), m('Validada', { date: '2026-08-01T12:00:00Z' }), m('Em reavaliação', { date: '2026-08-05T12:00:00Z' })];
  const p = getCarteiraProgress([meta('c-1', 2)], lista, 'usr-1', AGO);
  assert.equal(p.cobertura, 2);
  assert.deepEqual(p.coberturaPorSituacao, { validadas: 1, emReavaliacao: 1, aguardando: 0 });
  // e bate com as vagas da colaboradora
  const vagas = getDetalheDaColaboradora({ monitorings: lista, goals: [meta('c-1', 2)], collaborators: [] }, 'usr-1', 'c-1', AGO).escopos[0].vagas;
  assert.deepEqual(vagas.map((v) => v.estado), ['validada', 'em-reavaliacao']);
});

test('várias colaboradoras e metas por canal somam corretamente', () => {
  const lista = [
    m('Validada', { colaboradorId: 'c-1', canal: 'WhatsApp' }), m('Pendente', { colaboradorId: 'c-1', canal: 'Telefone' }),
    m('Em reavaliação', { colaboradorId: 'c-2' }), m('Pendente', { colaboradorId: 'c-2' }), m('Pendente', { colaboradorId: 'c-2' }),
  ];
  const metas = [meta('c-1', 1, 'WhatsApp'), meta('c-1', 1, 'Telefone'), meta('c-2', 2)];
  const p = getCarteiraProgress(metas, lista, 'usr-1', AGO);
  assert.equal(p.cobertura, 4);
  const c = p.coberturaPorSituacao;
  assert.equal(c.validadas + c.emReavaliacao + c.aguardando, p.cobertura);
  assert.deepEqual(c, { validadas: 1, emReavaliacao: 1, aguardando: 2 });
});

test('cálculos preservados: entregues, cobertura, faltam e média não mudam', () => {
  const lista = [m('Validada', { finalScore: 100 }), m('Em reavaliação', { finalScore: 50 }), m('Pendente', { finalScore: 80 })];
  const p = getCarteiraProgress([meta('c-1', 5)], lista, 'usr-1', AGO);
  assert.equal(p.entregues, 3);
  assert.equal(p.cobertura, 3);
  assert.equal(p.remaining, 2);
  assert.equal(p.validated, 1);
  assert.equal(p.awaiting, 1);
  assert.equal(resumirNotas(lista).media, 90);   // a em reavaliação fica fora da média
});

test('Relatórios / Meu Histórico: monitora e gestor no mês da rotina; administrador no vigente', () => {
  const nov: Period = { year: 2026, month: 10 };
  assert.deepEqual(competenciaInicialDosRelatorios('MONITOR', nov, 1), { year: 2026, month: 9 });
  assert.deepEqual(competenciaInicialDosRelatorios('GESTOR', nov, 1), { year: 2026, month: 9 });
  assert.deepEqual(competenciaInicialDosRelatorios('ADMIN', nov, 1), nov);
  assert.deepEqual(competenciaInicialDosRelatorios('MONITOR', nov, 0), nov);
});

test('Relatórios: virada do ano — janeiro/2027 abre em dezembro/2026', () => {
  assert.deepEqual(competenciaInicialDosRelatorios('MONITOR', { year: 2027, month: 0 }, 1), { year: 2026, month: 11 });
  assert.deepEqual(competenciaInicialDosRelatorios('GESTOR', { year: 2027, month: 0 }, 1), { year: 2026, month: 11 });
  assert.deepEqual(competenciaInicialDosRelatorios('ADMIN', { year: 2027, month: 0 }, 1), { year: 2027, month: 0 });
});
