// Zona 1 da fila: o número do mês.
//
// Só apresentação. Todos os valores chegam prontos de goalService — este componente não
// soma, não conta e não decide o que conta.
//
// A barra tem três segmentos porque "feito" tem dois estados: validado pela gestora e
// enviado, aguardando validação. Os dois contam para a meta (decisão de produto: feito conta
// no envio), mas a monitora precisa distinguir — senão fica sem saber por que o número não
// fecha do lado da gestora.

interface PeriodProgressProps {
  periodoLabel: string;
  hasGoal: boolean;
  target: number;
  cobertura: number;
  remaining: number;
  validadasNaCobertura: number;
  aguardandoNaCobertura: number;
  entregues: number;
  foraDaQuota: number;
  diasUteis: number;
  ritmo: string;
}

const pct = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : 0);

export const PeriodProgress = ({
  periodoLabel,
  hasGoal,
  target,
  cobertura,
  remaining,
  validadasNaCobertura,
  aguardandoNaCobertura,
  entregues,
  foraDaQuota,
  diasUteis,
  ritmo,
}: PeriodProgressProps) => {
  if (!hasGoal) {
    return (
      <div className="section-card" style={{ borderLeft: '3px solid var(--warning)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', margin: 0 }}>
          Sem meta definida para {periodoLabel}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.4rem 0 0' }}>
          Enquanto a gestora não definir as metas do mês, esta tela não tem o que cobrar.
          {entregues > 0 && ` Você já registrou ${entregues} monitoria(s) neste período.`}
        </p>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Meta da carteira · {periodoLabel}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '2.4rem', lineHeight: 1.1, color: 'var(--text-main)' }}>
            {cobertura} <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>de {target}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Indicador valor={String(remaining)} rotulo="faltam" alerta={remaining > 0} />
          <Indicador valor={String(diasUteis)} rotulo="dias úteis restantes" />
          <Indicador valor={ritmo} rotulo="por dia para fechar" />
        </div>
      </div>

      <div
        role="img"
        aria-label={`${validadasNaCobertura} validadas, ${aguardandoNaCobertura} aguardando validação, ${remaining} a fazer, de ${target}`}
        style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', margin: '1.1rem 0 0.75rem' }}
      >
        <div style={{ width: `${pct(validadasNaCobertura, target)}%`, backgroundColor: 'var(--primary)' }} />
        <div style={{
          width: `${pct(aguardandoNaCobertura, target)}%`,
          backgroundColor: 'var(--primary-light)',
          backgroundImage: 'repeating-linear-gradient(135deg, var(--primary) 0 3px, transparent 3px 7px)',
        }} />
      </div>

      <div style={{ display: 'flex', gap: '1.35rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Legenda cor="var(--primary)" texto={`${validadasNaCobertura} validadas pela gestora`} />
        <Legenda hachurada texto={`${aguardandoNaCobertura} enviadas, aguardando validação`} />
        <Legenda cor="var(--bg-app)" texto={`${remaining} a fazer`} />
        {foraDaQuota > 0 && (
          <span style={{ color: 'var(--text-muted)' }}>
            · {entregues} entregues no total, {foraDaQuota} fora da quota
          </span>
        )}
      </div>
    </div>
  );
};

const Indicador = ({ valor, rotulo, alerta = false }: { valor: string; rotulo: string; alerta?: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span style={{
      fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.1,
      color: alerta ? 'var(--danger)' : 'var(--text-main)',
    }}>
      {valor}
    </span>
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{rotulo}</span>
  </div>
);

const Legenda = ({ cor, texto, hachurada = false }: { cor?: string; texto: string; hachurada?: boolean }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
    <i style={{
      width: '13px', height: '13px', borderRadius: '4px', flex: 'none',
      border: '1px solid var(--border-color)',
      backgroundColor: hachurada ? 'var(--primary-light)' : cor,
      backgroundImage: hachurada ? 'repeating-linear-gradient(135deg, var(--primary) 0 3px, transparent 3px 6px)' : undefined,
    }} />
    {texto}
  </span>
);
