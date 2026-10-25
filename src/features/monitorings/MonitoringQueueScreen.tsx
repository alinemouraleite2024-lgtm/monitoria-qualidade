// Container da rota /monitorings.
//
// Única camada que fala com os serviços de domínio; os componentes abaixo dela só recebem
// dados prontos. É aqui que o contrato da 2B se sustenta: nenhuma regra de negócio vive nos
// componentes da fila.
//
// DOIS PERÍODOS, e confundi-los é o erro que esta tela já cometeu duas vezes (0.24.0).
//
//   competência   o mês AUDITADO — de quando são os atendimentos. É o eixo da meta, da fila,
//                 da cobertura e das pendências.
//   mês de trabalho   o mês CORRENTE, em que a monitoria está sendo feita. É o único eixo
//                 de dias úteis restantes e de ritmo diário.
//
// A operação avalia o mês anterior: em setembro se monitora agosto. Até a 0.23.0 a tela usava
// o mês corrente para as duas coisas e montava, em setembro, a agenda de setembro — que só
// será trabalhada em outubro. A distância entre os dois é `settings.defasagemCompetencia`.
//
// Medir o ritmo pela competência auditada seria o mesmo engano da 0.22.1 ao contrário: agosto
// está encerrado, não tem dias úteis restantes, e o ritmo cairia a zero justamente no mês em
// que há trabalho a fazer.
//
// A tela deixou de responder só sobre o mês corrente (decisão revista na 0.24.0): atraso,
// reavaliação e auditoria retroativa são rotina, e mandá-las para Relatórios era mandar a
// monitora para uma tela que não tem o botão de monitorar.

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Area, Collaborator, ColaboradorGoal, Monitoring, User, Allocation, Holiday, Role, SystemSettings } from '../../types/domain';
import type { Period } from '../../domain/period';
import { getCurrentPeriod, periodLabel, todayISO, businessDaysRemainingIn, competenciaDaAgenda, periodRange, monthLabel, situacaoDaCompetencia } from '../../domain/period';
import { SeletorCompetencia } from '../../shared/components/SeletorCompetencia';
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
  /** Só por `defasagemCompetencia`: quantos meses a monitoria fica atrás do atendimento. */
  settings: SystemSettings;
  /** Competência auditada. Mora no App, como a do Painel e a de Metas, porque é ela que
      decide quais metas resolver — e a resolução acontece lá. */
  periodo: Period;
  onPeriodo: (p: Period) => void;
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
  settings,
  periodo,
  onPeriodo,
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

  const hoje = todayISO();
  const monitorId = currentUser.id;

  // O mês em que se trabalha. Não navega: é sempre hoje.
  const mesDeTrabalho = getCurrentPeriod();
  const competenciaPadrao = competenciaDaAgenda(mesDeTrabalho, settings.defasagemCompetencia);

  const rotulo = periodLabel(periodo);
  const ehPadrao = periodo.year === competenciaPadrao.year && periodo.month === competenciaPadrao.month;

  // A carteira é resolvida por uma data DENTRO da competência, e não por hoje. Uma alocação
  // encerrada em julho não pode desaparecer da agenda de julho só porque hoje é setembro —
  // a pergunta é de quem a colaboradora era naquele mês. No mês corrente, hoje é essa data.
  const fimDaCompetencia = periodRange(periodo).endDate;
  const dataDaCarteira = hoje < fimDaCompetencia ? hoje : fimDaCompetencia;

  const dados = useMemo(() => {
    const ctx = { monitorings, goals: colaboradorGoals, collaborators, allocations, holidays, users };

    const equipe = getEquipeDoGestor(currentUser, areas, perfilAtivo);
    // Quem realiza monitoria é quem tem o perfil MONITOR — e só isso. Até a 0.19.0 era preciso
    // somar ADMIN aqui, porque a acumulação de papéis não cabia no dado.
    const monitoresNoEscopo = users
      .filter((u) => temPerfil(u, 'MONITOR'))
      .filter((u) => equipe === null || equipe.includes(u.id));

    const progresso = getCarteiraProgress(colaboradorGoals, monitorings, monitorId, periodo);
    // Dias úteis e ritmo vêm do MÊS DE TRABALHO, nunca da competência auditada: agosto está
    // encerrado e não tem dias restantes, mas o trabalho de agosto acontece em setembro.
    const diasUteis = businessDaysRemainingIn(mesDeTrabalho, hoje);

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
      // Ritmo e risco da equipe seguem a mesma competência auditada: é sobre ela que a equipe
      // está trabalhando agora. A fila de validação continua sem recorte de mês (0.22.1).
      ritmoEquipe: getRitmoDaEquipe(ctx, monitoresNoEscopo, periodo, mesDeTrabalho, hoje),
      risco: getRiscoDoMes(ctx, monitoresNoEscopo, periodo, dataDaCarteira),
      fila: getFilaDaCarteira(ctx, monitorId, periodo, dataDaCarteira),
      pendencias: getPendencias(monitorings, monitorId, periodo),
      aguardando: getAguardandoValidacao(monitorings, monitorId, periodo, hoje),
      foraDaQuota: getForaDaQuota(ctx, monitorId, periodo),
    };
  }, [monitorings, colaboradorGoals, collaborators, allocations, holidays, users, areas, currentUser, perfilAtivo, monitorId, hoje, periodo, mesDeTrabalho, dataDaCarteira]);

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

  const { situacao, monitoradaEm } = situacaoDaCompetencia(periodo, mesDeTrabalho, settings.defasagemCompetencia);

  return (
    <div className="animate-fade-in" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">{ehGestao ? 'Validação' : `Monitorias · ${rotulo}`}</h1>
          {/* O mês auditado é o título; a relação entre os dois meses é o subtítulo. Sem essa
              frase, "Monitorias · Agosto" em setembro parece erro de tela. */}
          <p className="page-subtitle">
            {ehGestao
              ? 'Tudo o que está aguardando a sua validação, de qualquer competência.'
              : ehPadrao && settings.defasagemCompetencia > 0
                ? `Competência de ${monthLabel(periodo).toLowerCase()}, monitorada em ${monthLabel(mesDeTrabalho).toLowerCase()}.`
                : ehPadrao
                  ? 'O que você precisa monitorar neste mês.'
                  // 25/10/2026 — antes, toda competência fora da padrão era "encerrada",
                  // inclusive a do mês corrente, ainda em curso (ver situacaoDaCompetencia).
                  : situacao === 'encerrada'
                    ? `Competência encerrada, aberta para consulta e lançamento. Você está em ${periodLabel(mesDeTrabalho)}.`
                    : situacao === 'em-andamento'
                      ? `Competência em andamento: os atendimentos de ${monthLabel(periodo).toLowerCase()} serão monitorados em ${periodLabel(monitoradaEm).toLowerCase()}. Você está em ${periodLabel(mesDeTrabalho)}.`
                      : `Competência futura: será monitorada em ${periodLabel(monitoradaEm).toLowerCase()}. Você está em ${periodLabel(mesDeTrabalho)}.`}
          </p>
        </div>

        {/* Navegar competências deixou de ser papel só de Relatórios (0.24.0): atraso,
            reavaliação e auditoria retroativa são rotina, e é aqui que existe o botão de
            monitorar. Fica fora do perfil de gestão, cuja fila não tem recorte de mês. */}
        {!ehGestao && (
          <SeletorCompetencia periodo={periodo} onChange={onPeriodo} titulo="Competência" />
        )}
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
