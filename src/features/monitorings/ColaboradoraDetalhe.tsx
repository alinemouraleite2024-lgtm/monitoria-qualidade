// O conteúdo da linha expandida — a agenda de uma colaboradora no mês.
//
// A meta aparece como VAGAS, não como contador: uma meta de 5 são cinco linhas, cada uma
// preenchida ou aberta. É o que responde "o que compõe o 2 de 5" em vez de só dizer que
// faltam três.
//
// Devolvida, rascunho e reprovada não ocupam vaga — elas explicam por que a vaga está aberta,
// e por isso aparecem logo abaixo em vez de sumirem.
//
// Só apresentação: as vagas e a classificação vêm prontas de queueService.

import { PlusCircle, RotateCcw, Pencil, Check, Clock, Circle } from 'lucide-react';
import type { Monitoring } from '../../types/domain';
import type { DetalheDaColaboradora, EscopoDetalhado, VagaDaMeta } from '../../domain/queueService';
import { canalLabel } from '../../constants/canais';

interface ColaboradoraDetalheProps {
  detalhe: DetalheDaColaboradora;
  semMeta: boolean;
  nome: string;
  onMonitorar: (canal: string | null) => void;
  onAbrir: (m: Monitoring) => void;
  onEditar: (m: Monitoring) => void;
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const ColaboradoraDetalhe = ({
  detalhe,
  semMeta,
  nome,
  onMonitorar,
  onAbrir,
  onEditar,
}: ColaboradoraDetalheProps) => (
  <div style={{
    padding: '1rem 1.15rem 1.15rem 2.5rem',
    backgroundColor: 'var(--bg-app)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  }}>

    {semMeta && (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--warning)', fontStyle: 'italic' }}>
        Sem meta definida para o período. A gestora precisa cadastrar em Planejamento.
      </p>
    )}

    {detalhe.escopos.map((escopo) => (
      <BlocoDoEscopo
        key={escopo.progresso.canal ?? 'geral'}
        escopo={escopo}
        onAbrir={onAbrir}
        onEditar={onEditar}
        onMonitorar={onMonitorar}
      />
    ))}

    {detalhe.foraDeMeta.length > 0 && (
      <Secao titulo="Fora da meta" nota="Canal sem meta cadastrada">
        {detalhe.foraDeMeta.map((m) => (
          <Registro key={m.id} m={m} rotulo={canalLabel(m.canal)} onAbrir={onAbrir} />
        ))}
      </Secao>
    )}

    {detalhe.outroTipo.length > 0 && (
      <Secao titulo="Fora da quota" nota="Não abatem meta de ninguém">
        {detalhe.outroTipo.map((m) => (
          <Registro key={m.id} m={m} rotulo={m.tipo} onAbrir={onAbrir} />
        ))}
      </Secao>
    )}

    <div>
      <button className="btn btn-primary btn-sm" onClick={() => onMonitorar(null)}>
        <PlusCircle size={14} /> Nova monitoria de {nome.split(' ')[0]}
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------

const BlocoDoEscopo = ({ escopo, onAbrir, onEditar, onMonitorar }: {
  escopo: EscopoDetalhado;
  onAbrir: (m: Monitoring) => void;
  onEditar: (m: Monitoring) => void;
  onMonitorar: (canal: string | null) => void;
}) => {
  const { progresso, vagas } = escopo;
  const rotulo = progresso.canal ? canalLabel(progresso.canal) : 'Meta geral';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap',
        marginBottom: '0.5rem',
      }}>
        <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{rotulo}</strong>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--primary)' }}>
          {progresso.cobertura}/{progresso.alvo}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {progresso.falta > 0 ? `faltam ${progresso.falta}` : 'completo'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {vagas.map((vaga) => (
          <LinhaDaVaga
            key={vaga.posicao}
            vaga={vaga}
            canal={progresso.canal}
            onAbrir={onAbrir}
            onMonitorar={onMonitorar}
          />
        ))}
      </div>

      {escopo.excedentes.length > 0 && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          + {escopo.excedentes.length} além da meta:{' '}
          {escopo.excedentes.map((m) => m.id).join(', ')}
        </div>
      )}

      {(escopo.devolvidas.length > 0 || escopo.rascunhos.length > 0 || escopo.reprovadas.length > 0) && (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {escopo.devolvidas.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
              fontSize: '0.8rem', padding: '0.45rem 0.6rem',
              backgroundColor: 'var(--danger-light)', borderRadius: 'var(--border-radius-sm)',
              borderLeft: '2px solid var(--danger)',
            }}>
              <span className="badge-pill badge-danger">Devolvida</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.id}</span>
              <span style={{ color: 'var(--text-muted)', flex: '1 1 200px' }}>
                “{m.adjustmentReason}”
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => onEditar(m)}>
                <RotateCcw size={13} /> Corrigir
              </button>
            </div>
          ))}
          {escopo.rascunhos.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}>
              <span className="badge-pill badge-info">Rascunho</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.id}</span>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>iniciado em {dataCurta(m.date)}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onEditar(m)}>
                <Pencil size={13} /> Retomar
              </button>
            </div>
          ))}
          {escopo.reprovadas.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}>
              <span className="badge-pill badge-danger">Reprovada</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.id}</span>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                {dataCurta(m.date)} · não conta, a vaga segue aberta
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => onAbrir(m)}>Ver</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LinhaDaVaga = ({ vaga, canal, onAbrir, onMonitorar }: {
  vaga: VagaDaMeta;
  canal: string | null;
  onAbrir: (m: Monitoring) => void;
  onMonitorar: (canal: string | null) => void;
}) => {
  const m = vaga.monitoring;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap',
      padding: '0.4rem 0.6rem', fontSize: '0.82rem',
      borderBottom: '1px solid var(--border-color)',
      opacity: vaga.estado === 'aberta' ? 0.75 : 1,
    }}>
      <span style={{
        width: '20px', textAlign: 'right', color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums', flex: 'none',
      }}>
        {vaga.posicao}
      </span>

      {vaga.estado === 'validada' && <Check size={14} style={{ color: 'var(--primary)', flex: 'none' }} />}
      {vaga.estado === 'em-validacao' && <Clock size={14} style={{ color: 'var(--warning)', flex: 'none' }} />}
      {vaga.estado === 'aberta' && <Circle size={14} style={{ color: 'var(--text-muted)', opacity: 0.5, flex: 'none' }} />}

      {m ? (
        <>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.id}</span>
          <span style={{ color: 'var(--text-muted)' }}>{dataCurta(m.date)}</span>
          {!canal && <span style={{ color: 'var(--text-muted)' }}>{canalLabel(m.canal)}</span>}
          <span className={`badge-pill ${vaga.estado === 'validada' ? 'badge-success' : 'badge-warning'}`}>
            {vaga.estado === 'validada' ? 'Validada' : 'Em validação'}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => onAbrir(m)}>Ver</button>
        </>
      ) : (
        <>
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>não realizada</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => onMonitorar(canal)}>
            <PlusCircle size={13} /> Monitorar
          </button>
        </>
      )}
    </div>
  );
};

const Secao = ({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) => (
  <div>
    <div style={{
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem',
    }}>
      {titulo}
      {nota && <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}> · {nota}</span>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>{children}</div>
  </div>
);

const Registro = ({ m, rotulo, onAbrir }: { m: Monitoring; rotulo: string; onAbrir: (m: Monitoring) => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
    <span className="badge-pill badge-info">{rotulo}</span>
    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.id}</span>
    <span style={{ color: 'var(--text-muted)', flex: 1 }}>{dataCurta(m.date)}</span>
    <button className="btn btn-secondary btn-sm" onClick={() => onAbrir(m)}>Ver</button>
  </div>
);
