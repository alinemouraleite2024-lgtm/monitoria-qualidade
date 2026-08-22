// Container da rota /monitorings.
//
// Única camada que fala com os serviços de domínio; os componentes abaixo dela só recebem
// dados prontos. É aqui que o contrato da 2B se sustenta: nenhuma regra de negócio vive nos
// componentes da fila.
//
// A tela responde SEMPRE sobre o mês corrente, por decisão de produto. A pergunta é "o que eu
// preciso fazer agora"; consultar meses anteriores é papel de Relatórios.

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Collaborator, ColaboradorGoal, Monitoring, User, Allocation, Holiday } from '../../types/domain';
import { getCurrentPeriod, periodLabel, todayISO, businessDaysRemainingIn } from '../../domain/period';
import { getCarteiraProgress } from '../../domain/goalService';
import {
  getFilaDaCarteira,
  getPendencias,
  getAguardandoValidacao,
  getForaDaQuota,
  getFilaDeValidacao,
  getRitmoDaEquipe,
  getRiscoDoMes,
  matchesBusca,
} from '../../domain/queueService';
import { PeriodProgress } from './PeriodProgress';
import { MonitorQueue } from './MonitorQueue';
import { ManagerQueue } from './ManagerQueue';

interface MonitoringQueueScreenProps {
  currentUser: User;
  monitorings: Monitoring[];
  colaboradorGoals: ColaboradorGoal[];
  collaborators: Collaborator[];
  allocations: Allocation[];
  holidays: Holiday[];
  users: User[];
  onNovaMonitoria: (colaboradorId?: string, canal?: string | null) => void;
  onAbrir: (m: Monitoring) => void;
  onEditar: (m: Monitoring) => void;
  onValidar: (id: string) => void;
  onVerRelatorios: () => void;
}

export const MonitoringQueueScreen = ({
  currentUser,
  monitorings,
  colaboradorGoals,
  collaborators,
  allocations,
  holidays,
  users,
  onNovaMonitoria,
  onAbrir,
  onEditar,
  onValidar,
  onVerRelatorios,
}: MonitoringQueueScreenProps) => {
  const [busca, setBusca] = useState('');

  // Gestora e administradora veem a mesma fila: as duas aprovam, devolvem e gerenciam os
  // mesmos registros, e divergir aqui criaria um caso especial sem motivo.
  const ehGestao = currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN';

  const periodo = getCurrentPeriod();
  const hoje = todayISO();
  const rotulo = periodLabel(periodo);
  const monitorId = currentUser.id;

  const dados = useMemo(() => {
    const ctx = { monitorings, goals: colaboradorGoals, collaborators, allocations, holidays, users };

    const progresso = getCarteiraProgress(colaboradorGoals, monitorings, monitorId, periodo);
    const diasUteis = businessDaysRemainingIn(periodo, hoje);

    // Decomposição da barra: a cobertura é a parte que fecha meta, e dentro dela distinguimos
    // o que já passou pela gestora. `validated` e `awaiting` do serviço contam sem teto, então
    // são limitados à cobertura para que os três segmentos somem exatamente o alvo.
    const validadasNaCobertura = Math.min(progresso.validated, progresso.cobertura);
    const aguardandoNaCobertura = progresso.cobertura - validadasNaCobertura;

    return {
      progresso,
      diasUteis,
      validadasNaCobertura,
      aguardandoNaCobertura,
      ritmo: diasUteis > 0 ? (progresso.remaining / diasUteis).toFixed(1) : String(progresso.remaining),
      filaValidacao: getFilaDeValidacao(monitorings, periodo, hoje),
      ritmoEquipe: getRitmoDaEquipe(ctx, users.filter((u) => u.role === 'MONITOR'), periodo, hoje),
      risco: getRiscoDoMes(ctx, users.filter((u) => u.role === 'MONITOR'), periodo, hoje),
      fila: getFilaDaCarteira(ctx, monitorId, periodo, hoje),
      pendencias: getPendencias(monitorings, monitorId, periodo),
      aguardando: getAguardandoValidacao(monitorings, monitorId, periodo, hoje),
      foraDaQuota: getForaDaQuota(ctx, monitorId, periodo),
    };
  }, [monitorings, colaboradorGoals, collaborators, allocations, holidays, users, monitorId, hoje]);

  // A busca é discreta e restringe as listas de registros — nunca a lista de quem falta
  // monitorar, que é a resposta da tela e não deve sumir por causa de um termo digitado.
  const nomeDe = (id: string) => collaborators.find((c) => c.id === id)?.name;
  const filtra = (lista: Monitoring[]) =>
    lista.filter((m) => matchesBusca(m, busca, nomeDe(m.colaboradorId)));

  const pendencias = {
    devolvidas: filtra(dados.pendencias.devolvidas),
    rascunhos: filtra(dados.pendencias.rascunhos),
  };
  const aguardando = dados.aguardando.filter((x) =>
    matchesBusca(x.monitoring, busca, nomeDe(x.monitoring.colaboradorId))
  );
  const foraDaQuota = {
    outroTipo: filtra(dados.foraDaQuota.outroTipo),
    semMeta: filtra(dados.foraDaQuota.semMeta),
  };
  const filaValidacao = dados.filaValidacao.filter((x) =>
    matchesBusca(x.monitoring, busca, nomeDe(x.monitoring.colaboradorId))
  );

  return (
    <div className="animate-fade-in" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Monitorias · {rotulo}</h1>
          <p className="page-subtitle">
            {ehGestao
              ? 'O que precisa da sua validação neste mês.'
              : 'O que você precisa monitorar neste mês.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onNovaMonitoria()}>
          <Plus size={16} /> Nova Monitoria
        </button>
      </div>

      {ehGestao ? (
        <ManagerQueue
          fila={filaValidacao}
          ritmo={dados.ritmoEquipe}
          risco={dados.risco}
          colaboradorasPorId={porId(collaborators)}
          monitoresPorId={porId(users)}
          busca={busca}
          onBusca={setBusca}
          onValidar={onValidar}
          onAbrir={onAbrir}
          onVerRelatorios={onVerRelatorios}
        />
      ) : (
        <>
      <PeriodProgress
        periodoLabel={rotulo}
        hasGoal={dados.progresso.hasGoal}
        target={dados.progresso.target}
        cobertura={dados.progresso.cobertura}
        remaining={dados.progresso.remaining}
        validadasNaCobertura={dados.validadasNaCobertura}
        aguardandoNaCobertura={dados.aguardandoNaCobertura}
        entregues={dados.progresso.entregues}
        foraDaQuota={dados.progresso.excedente + dados.progresso.outOfGoal + dados.progresso.outOfCarteira}
        diasUteis={dados.diasUteis}
        ritmo={dados.ritmo}
      />

      <MonitorQueue
        fila={dados.fila}
        pendencias={pendencias}
        aguardando={aguardando}
        foraDaQuota={foraDaQuota}
        busca={busca}
        onBusca={setBusca}
        onMonitorar={(colaboradorId, canal) => onNovaMonitoria(colaboradorId, canal)}
        onAbrir={onAbrir}
        onEditar={onEditar}
        onVerRelatorios={onVerRelatorios}
      />
        </>
      )}
    </div>
  );
};

/** Índice por id, para a tela não varrer a lista a cada linha. */
const porId = <T extends { id: string }>(lista: T[]): Record<string, T | undefined> =>
  Object.fromEntries(lista.map((x) => [x.id, x]));
