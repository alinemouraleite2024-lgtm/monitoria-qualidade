// A fila operacional da monitora — as zonas 2, 3 e 4.
//
// A pergunta que esta tela responde é "o que eu preciso monitorar agora", e não "quais
// monitorias existem". Por isso não há filtros: a ordem das linhas já é a resposta, e ela vem
// pronta de queueService.getFilaDaCarteira.
//
// Só apresentação. Nenhuma comparação de status, nenhuma aritmética de data, nenhuma soma de
// meta e nenhuma ordenação acontecem aqui.

import { useState } from 'react';
import { Search, PlusCircle, RotateCcw, Pencil, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { ColaboradoraDetalhe } from './ColaboradoraDetalhe';
import type { Monitoring } from '../../types/domain';
import type { LinhaDaFila, NaFilaDeValidacao, Pendencias, ForaDaQuota } from '../../domain/queueService';
import { canalLabel } from '../../constants/canais';

interface MonitorQueueProps {
  fila: LinhaDaFila[];
  pendencias: Pendencias;
  aguardando: NaFilaDeValidacao[];
  foraDaQuota: ForaDaQuota;
  busca: string;
  onBusca: (termo: string) => void;
  onMonitorar: (colaboradorId: string, canal: string | null) => void;
  onAbrir: (m: Monitoring) => void;
  onEditar: (m: Monitoring) => void;
  onVerRelatorios: () => void;
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const MonitorQueue = ({
  fila,
  pendencias,
  aguardando,
  foraDaQuota,
  busca,
  onBusca,
  onMonitorar,
  onAbrir,
  onEditar,
  onVerRelatorios,
}: MonitorQueueProps) => {
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setExpandidas((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
    return proximo;
  });

  const precisamDeAcao = pendencias.devolvidas.length + pendencias.rascunhos.length;
  const nadaFora = foraDaQuota.outroTipo.length + foraDaQuota.semMeta.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ---------------- Zona 2: quem falta monitorar ---------------- */}
      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Cabecalho titulo="Quem falta monitorar" nota="Em ordem de urgência" />

        {fila.length === 0 && (
          <Vazio texto="Nenhuma colaboradora vinculada à sua carteira neste mês." />
        )}

        {fila.map((linha) => {
          const aberta = expandidas.has(linha.colaborador.id);
          return (
          <div key={linha.colaborador.id}>
          <div
            onClick={() => alternar(linha.colaborador.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
              padding: '0.9rem 1.15rem', cursor: 'pointer',
              borderTop: '1px solid var(--border-color)',
              borderLeft: `3px solid ${linha.cobertura === 0 && !linha.emDia ? 'var(--danger)' : 'transparent'}`,
              backgroundColor: linha.cobertura === 0 && !linha.emDia ? 'var(--danger-light)' : undefined,
              opacity: linha.emDia ? 0.72 : 1,
            }}
          >
            <button
              type="button"
              aria-expanded={aberta}
              aria-label={aberta ? `Recolher ${linha.colaborador.name}` : `Expandir ${linha.colaborador.name}`}
              onClick={(e) => { e.stopPropagation(); alternar(linha.colaborador.id); }}
              style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--text-muted)', padding: 0, flex: 'none' }}
            >
              {aberta ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>

            <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{linha.colaborador.name}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{linha.colaborador.cargo}</div>
            </div>

            <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {linha.meta.tipo === 'nenhuma' ? (
                <span style={{ fontSize: '0.82rem', color: 'var(--warning)', fontStyle: 'italic' }}>
                  Sem meta definida para o período
                </span>
              ) : (
                linha.escopos.map((e) => (
                  <Escopo
                    key={e.canal ?? 'geral'}
                    rotulo={e.canal ? canalLabel(e.canal) : 'Geral'}
                    cobertura={e.cobertura}
                    alvo={e.alvo}
                    falta={e.falta}
                    excedente={e.excedente}
                  />
                ))
              )}
              {linha.ultimaEm && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  última em {dataCurta(linha.ultimaEm)}
                </span>
              )}
            </div>

            <div style={{ flex: '0 0 auto' }} onClick={(e) => e.stopPropagation()}>
              {linha.emDia ? (
                <span className="badge-pill badge-success">Em dia</span>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onMonitorar(linha.colaborador.id, linha.proximaAcao?.canal ?? null)}
                >
                  <PlusCircle size={14} />
                  {linha.proximaAcao?.canal
                    ? ` Monitorar ${canalLabel(linha.proximaAcao.canal)}`
                    : ' Monitorar'}
                </button>
              )}
            </div>
          </div>

          {aberta && (
            <ColaboradoraDetalhe
              detalhe={linha.detalhe}
              semMeta={linha.meta.tipo === 'nenhuma'}
              nome={linha.colaborador.name}
              onMonitorar={(canal) => onMonitorar(linha.colaborador.id, canal)}
              onAbrir={onAbrir}
              onEditar={onEditar}
            />
          )}
          </div>
          );
        })}
      </div>

      {/* ---------------- Zona 3: precisa da sua ação ---------------- */}
      {precisamDeAcao > 0 && (
        <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Cabecalho titulo="Precisa da sua ação" contador={precisamDeAcao} tom="danger" />

          {pendencias.devolvidas.map((m) => (
            <Linha key={m.id} destaque>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>{m.id}</span>
              <div style={{ flex: '1 1 320px' }}>
                <div style={{ fontSize: '0.82rem' }}>
                  <span className="badge-pill badge-danger">Devolvida</span>{' '}
                  atendimento de {dataCurta(m.date)}
                </div>
                <div style={{
                  fontSize: '0.82rem', color: 'var(--text-muted)',
                  borderLeft: '2px solid var(--danger)', paddingLeft: '0.7rem', marginTop: '0.3rem',
                }}>
                  “{m.adjustmentReason}”
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => onEditar(m)}>
                <RotateCcw size={14} /> Corrigir
              </button>
            </Linha>
          ))}

          {pendencias.rascunhos.map((m) => (
            <Linha key={m.id}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>{m.id}</span>
              <div style={{ flex: '1 1 320px', fontSize: '0.82rem' }}>
                <span className="badge-pill badge-info">Rascunho</span>{' '}
                atendimento de {dataCurta(m.date)}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onEditar(m)}>
                <Pencil size={14} /> Retomar
              </button>
            </Linha>
          ))}
        </div>
      )}

      {/* ---------------- Zona 4: aguardando a gestora ---------------- */}
      {aguardando.length > 0 && (
        <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Cabecalho
            titulo="Aguardando a gestora"
            contador={aguardando.length}
            nota="Já contam como feitas · nada a fazer aqui"
            tom="warning"
          />
          {aguardando.map(({ monitoring: m, dias }) => (
            <Linha key={m.id}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>{m.id}</span>
              <div style={{ flex: '1 1 320px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                atendimento de {dataCurta(m.date)}
                {dias > 0 && <> · na fila há {dias} dia{dias > 1 ? 's' : ''}</>}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onAbrir(m)}>Ver</button>
            </Linha>
          ))}
        </div>
      )}

      {/* ---------------- Fora da quota ---------------- */}
      {!nadaFora && (
        <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Cabecalho
            titulo="Fora da quota"
            contador={foraDaQuota.outroTipo.length + foraDaQuota.semMeta.length}
            nota="Feitas, mas não abatem meta de ninguém"
          />
          {foraDaQuota.outroTipo.map((m) => (
            <Linha key={m.id}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>{m.id}</span>
              <div style={{ flex: '1 1 320px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span className="badge-pill badge-info">{m.tipo}</span> {dataCurta(m.date)}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onAbrir(m)}>Ver</button>
            </Linha>
          ))}
          {foraDaQuota.semMeta.map((m) => (
            <Linha key={m.id}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>{m.id}</span>
              <div style={{ flex: '1 1 320px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span className="badge-pill badge-info">{canalLabel(m.canal)}</span> sem meta neste canal · {dataCurta(m.date)}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onAbrir(m)}>Ver</button>
            </Linha>
          ))}
        </div>
      )}

      {/* ---------------- Rodapé: busca e histórico ---------------- */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap', padding: '0 0.25rem',
      }}>
        <div className="global-search" style={{ minWidth: '280px', padding: '0.45rem 0.9rem' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por atendimento, protocolo, título ou colaboradora..."
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onVerRelatorios}>
          Ver histórico completo em Relatórios →
        </button>
      </div>

    </div>
  );
};

// ---------------------------------------------------------------------------

const Escopo = ({ rotulo, cobertura, alvo, falta, excedente }: {
  rotulo: string; cobertura: number; alvo: number; falta: number; excedente: number;
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.84rem' }}>
    <span style={{ minWidth: '78px', color: 'var(--text-muted)' }}>{rotulo}</span>
    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: falta > 0 ? 'var(--text-main)' : 'var(--primary)' }}>
      {cobertura}/{alvo}
    </span>
    <div className="progress-container" style={{ width: '90px', margin: 0, height: '5px' }}>
      <div className="progress-fill" style={{
        width: `${alvo > 0 ? Math.round((cobertura / alvo) * 100) : 0}%`,
        backgroundColor: falta === 0 ? '#10b981' : 'var(--primary)',
      }} />
    </div>
    {falta > 0
      ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>faltam {falta}</span>
      : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          completo{excedente > 0 ? ` · ${excedente} além` : ''}
        </span>}
  </div>
);

const Cabecalho = ({ titulo, contador, nota, tom }: {
  titulo: string; contador?: number; nota?: string; tom?: 'danger' | 'warning';
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    padding: '0.8rem 1.15rem', backgroundColor: 'var(--bg-app)',
  }}>
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      {titulo}
      {contador !== undefined && (
        <span
          className={`badge-pill ${tom === 'danger' ? 'badge-danger' : tom === 'warning' ? 'badge-warning' : 'badge-info'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {contador}
        </span>
      )}
    </span>
    {nota && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{nota}</span>}
  </div>
);

const Linha = ({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
    padding: '0.8rem 1.15rem', borderTop: '1px solid var(--border-color)',
    borderLeft: `3px solid ${destaque ? 'var(--danger)' : 'transparent'}`,
    backgroundColor: destaque ? 'var(--danger-light)' : undefined,
  }}>
    {children}
  </div>
);

const Vazio = ({ texto }: { texto: string }) => (
  <div style={{
    padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)',
    fontSize: '0.88rem', borderTop: '1px solid var(--border-color)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
  }}>
    <Clock size={28} style={{ opacity: 0.4 }} />
    {texto}
  </div>
);
