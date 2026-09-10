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
import type { Area, Collaborator, ColaboradorGoal, Monitoring, User, Allocation, Holiday, Role } from '../../types/domain';
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
import { getEquipeDoGestor } from '../../domain/scopeService';
import { temPerfil } from '../../domain/perfis';
import { PeriodProgress } from './PeriodProgress';
import { MonitorQueue } from './MonitorQueue';
import { ManagerQueue } from './ManagerQueue';

interface MonitoringQueueScreenProps {
  currentUser: User;
  /** Perfil ativo: decide se esta rota mostra a carteira ou a fila de validação. */
  perfilAtivo: Role | null;
  monitorings: Monitoring[];
  colaboradorGoals: ColaboradorGoal[];
  collaborators: Collaborator[];
  allocations: Allocation[];
  holidays: Holiday[];
  users: User[];
  /** Necessário para o escopo do gestor: a área é quem declara gestor e monitores. */
  areas: Area[];
  onNovaMonitoria: (colaboradorId?: string, canal?: string | null) => void;
  onAbrir: (m: Monitoring) => void;
  onEditar: (m: Monitoring) => void;
  onValidar: (id: string) => void;
  onVerRelatorios: () => void;
}

export const MonitoringQueueScreen = ({
  currentUser,
  perfilAtivo,
  monitorings,
  colaboradorGoals,
  collaborators,
  allocations,
  holidays,
  users,
  areas,
  onNovaMonitoria,
  onAbrir,
  onEditar,
  onValidar,
  onVerRelatorios,
}: MonitoringQueueScreenProps) => {
  const [busca, setBusca] = useState('');

  // 0.20.0: a fila segue o **perfil ativo**. Até a 0.19.0 a administradora caía aqui junto com
  // a gestora, e quem administrava e monitorava nunca via a própria carteira — via a fila de
  // validação de si mesma. Agora quem monitora monitora, e troca de contexto para validar.
  const ehGestao = perfilAtivo === 'GESTOR';

  const periodo = getCurrentPeriod();
  const hoje = todayISO();
  const rotulo = periodLabel(periodo);
  const monitorId = currentUser.id;

  const dados = useMemo(() => {
    const ctx = { monitorings, goals: colaboradorGoals, collaborators, allocations, holidays, users };

    const equipe = getEquipeDoGestor(currentUser, areas, perfilAtivo);
    // Quem realiza monitoria é quem tem o perfil MONITOR — e só isso. Até a 0.19.0 era preciso
    // somar ADMIN aqui, porque a acumulação de papéis não cabia no dado.
    const monitoresNoEscopo = users
      .filter((u) => temPerfil(u, 'MONITOR'))
      .filter((u) => equipe === null || equipe.includes(u.id));

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
      // Escopo por gestor (0.17.0): a fila de validação e a leitura de equipe eram globais no
      // período. Com uma gestora só isso era simplificação; com várias, é vazamento — um gestor
      // validaria monitorias de equipe que não é dele. `null` = sem restrição (ADMIN).
      // Além do escopo por área, a fila exclui as monitorias do próprio usuário: ninguém
      // valida o que fez, e oferecer o botão para depois recusar a ação seria pior que não
      // oferecer. O registro continua visível em Relatórios.
      // A fila NÃO é recortada por competência (0.22.1): pendente é pendente em qualquer mês.
      filaValidacao: getFilaDeValidacao(monitorings, hoje)
        .filter((f) => equipe === null || equipe.includes(f.monitoring.monitorId))
        .filter((f) => f.monitoring.monitorId !== currentUser.id),
      ritmoEquipe: getRitmoDaEquipe(ctx, monitoresNoEscopo, periodo, hoje),
      risco: getRiscoDoMes(ctx, monitoresNoEscopo, periodo, hoje),
      fila: getFilaDaCarteira(ctx, monitorId, periodo, hoje),
      pendencias: getPendencias(monitorings, monitorId, periodo),
      aguardando: getAguardandoValidacao(monitorings, monitorId, periodo, hoje),
      foraDaQuota: getForaDaQuota(ctx, monitorId, periodo),
    };
  }, [monitorings, colaboradorGoals, collaborators, allocations, holidays, users, areas, currentUser, perfilAtivo, monitorId, hoje, periodo]);

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
          <h1 className="page-title">{ehGestao ? 'Validação' : `Monitorias · ${rotulo}`}</h1>
          <p className="page-subtitle">
            {ehGestao
              ? 'Tudo o que está aguardando a sua validação, de qualquer competência.'
              : 'O que você precisa monitorar neste mês.'}
          </p>
        </div>
        {/* A ação primária pertence a quem monitora. Até a 0.19.0 o botão aparecia também para
            a gestão, contra a decisão da 0.17.0 de que gestor valida e não avalia — e desde a
            0.20.0 o formulário sequer abre nesse perfil, o que deixaria um botão que erra. */}
        {!ehGestao && (
          <button className="btn btn-primary" onClick={() => onNovaMonitoria()}>
            <Plus size={16} /> Nova Monitoria
          </button>
        )}
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
