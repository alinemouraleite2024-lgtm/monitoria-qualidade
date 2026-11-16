// Painel da Equipe (16/11/2026): competência inicial por perfil e aviso de validação com dois números.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { competenciaCurta, competenciaInicialDoPainel, type Period } from '../src/domain/period';
import { resumoDoAvisoDeValidacao } from '../src/domain/validacaoService';
import type { Area, Monitoring, SystemSettings } from '../src/types/domain';

const p = (year: number, month: number): Period => ({ year, month });   // mês base zero

test('gestor abre na competência da Validação (mês atual − defasagem 1)', () => {
  assert.deepEqual(competenciaInicialDoPainel('GESTOR', p(2026, 10), 1), p(2026, 9));    // nov/2026 → out/2026
  assert.deepEqual(competenciaInicialDoPainel('GESTOR', p(2026, 11), 1), p(2026, 10));   // dez/2026 → nov/2026
});

test('virada do ano: janeiro/2027 abre em dezembro/2026', () => {
  assert.deepEqual(competenciaInicialDoPainel('GESTOR', p(2027, 0), 1), p(2026, 11));
  assert.equal(competenciaCurta(competenciaInicialDoPainel('GESTOR', p(2027, 0), 1)), 'dezembro/2026');
});

test('segue a configuração de defasagem; administrador e outros perfis abrem no mês vigente', () => {
  assert.deepEqual(competenciaInicialDoPainel('GESTOR', p(2026, 10), 0), p(2026, 10));
  assert.deepEqual(competenciaInicialDoPainel('GESTOR', p(2027, 1), 2), p(2026, 11));
  assert.deepEqual(competenciaInicialDoPainel('ADMIN', p(2026, 10), 1), p(2026, 10));
  assert.deepEqual(competenciaInicialDoPainel(null, p(2027, 0), 1), p(2027, 0));
});

// Supervisor fictício com validações a partir de 2026-10 (como a configuração da homologação).
const areas = [{ id: 'a-1', name: 'Área', gestorId: 'gestor-1', monitorIds: ['usr-1'], active: true }] as Area[];
const cfg = { requireGestorValidation: true, validacaoDesdePorGestor: { 'gestor-1': '2026-10' } } as SystemSettings;
const m = (id: string, competencia: string, status: Monitoring['status'] = 'Pendente'): Monitoring => ({
  id, competencia, date: `${competencia}-10T12:00:00Z`, monitorId: 'usr-1', colaboradorId: 'c-1', canal: 'Telefone', tipo: 'Regular', status, finalScore: 90, scores: [],
} as Monitoring);
const lista = [m('A', '2026-08'), m('B', '2026-10'), m('C', '2026-10'), m('D', '2026-11'), m('E', '2026-10', 'Validada'), m('F', '2026-10', 'Em reavaliação'), m('G', '2026-10', 'Rascunho')];

test('aviso: total da fila respeita a competência inicial; o segundo número acompanha o Painel', () => {
  assert.deepEqual(resumoDoAvisoDeValidacao(lista, areas, cfg, p(2026, 9)), { naFila: 3, daCompetencia: 2 });   // outubro
  assert.deepEqual(resumoDoAvisoDeValidacao(lista, areas, cfg, p(2026, 10)), { naFila: 3, daCompetencia: 1 });  // novembro
  // agosto: pendente anterior ao início do supervisor não está na fila — nem no total, nem na competência
  assert.deepEqual(resumoDoAvisoDeValidacao(lista, areas, cfg, p(2026, 7)), { naFila: 3, daCompetencia: 0 });
});

test('aviso: sem competência inicial configurada, todas as pendentes entram', () => {
  const semInicio = { requireGestorValidation: true } as SystemSettings;
  assert.deepEqual(resumoDoAvisoDeValidacao(lista, areas, semInicio, p(2026, 7)), { naFila: 4, daCompetencia: 1 });
});
