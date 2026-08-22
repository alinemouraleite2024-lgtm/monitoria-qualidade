import type { ReactNode } from 'react';
import { FileSpreadsheet, Download, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

// Tela de Relatórios.
//
// 2A.5: o período consultado estava fixo em 01/06/2026–30/06/2026, num estado cujo setter
// estava comentado — não havia como alterá-lo por nenhum caminho da interface. Os dois botões
// exportavam sempre junho e, em agosto, devolviam um arquivo vazio sem dizer nada. A tela
// ainda prometia respeitar "os filtros dinâmicos selecionados na aba Monitorias", filtros que
// não existem mais e que ninguém conseguia ajustar.
//
// Agora o período é navegável e a contagem fica ao lado dos botões: exportar deixou de ser um
// ato de fé. O botão diz quantos registros vai levar, e esse número é o mesmo que a tela
// exibe, porque ambos saem da mesma consulta.

interface ReportsScreenProps {
  periodoLabel: string;
  periodoAnteriorLabel: string;
  periodoSeguinteLabel: string;
  onPeriodoAnterior: () => void;
  onPeriodoSeguinte: () => void;
  /** Registros da competência, antes dos filtros. Distingue 'mês vazio' de 'filtro sem resultado'. */
  totalNoPeriodo: number;
  /** Registros após os filtros — o que a tabela exibe e o que será exportado. */
  totalRegistros: number;
  onExportExcel: () => void;
  onExportPDF: () => void;
  /**
   * O histórico do período: a tabela, a busca e os cinco filtros que vieram de /monitorings
   * na 2B.2. Entra por composição para que Relatórios não precise conhecer a forma do
   * registro de monitoria.
   */
  historico?: ReactNode;
}

export const ReportsScreen = ({
  periodoLabel,
  periodoAnteriorLabel,
  periodoSeguinteLabel,
  onPeriodoAnterior,
  onPeriodoSeguinte,
  totalNoPeriodo,
  totalRegistros,
  onExportExcel,
  onExportPDF,
  historico,
}: ReportsScreenProps) => {
  // Duas ausências diferentes: a competência não tem registro nenhum, ou os filtros do usuário
  // não acharam nada. A segunda não pode esconder a tabela, senão ele perde os controles e
  // fica sem como desfazer o próprio filtro.
  const periodoVazio = totalNoPeriodo === 0;
  const semResultado = !periodoVazio && totalRegistros === 0;

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Relatórios e Histórico de Qualidade</h1>
          <p className="page-subtitle">
            Consulte, filtre e exporte as monitorias de uma competência.
          </p>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Competência
            </span>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.35rem',
                fontWeight: 'bold',
                color: 'var(--text-main)',
                lineHeight: 1.2,
              }}
            >
              {periodoLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onPeriodoAnterior}
              title={`Ir para ${periodoAnteriorLabel}`}
            >
              <ChevronLeft size={16} /> {periodoAnteriorLabel}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onPeriodoSeguinte}
              title={`Ir para ${periodoSeguinteLabel}`}
            >
              {periodoSeguinteLabel} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1rem',
            marginBottom: '1rem',
            fontWeight: 'bold',
          }}
        >
          Gerar Documento Consolidado
        </h3>

        {periodoVazio ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '2.5rem 1rem',
              textAlign: 'center',
              border: '1px dashed var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            <Inbox size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
            <strong style={{ color: 'var(--text-main)' }}>
              Nenhuma monitoria registrada em {periodoLabel}
            </strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '440px' }}>
              Não há o que exportar nesta competência. Use as setas acima para consultar outro
              período.
            </span>
          </div>
        ) : semResultado ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Nenhum registro corresponde aos filtros aplicados, entre as{' '}
            <strong style={{ color: 'var(--text-main)' }}>{totalNoPeriodo}</strong> monitorias de{' '}
            {periodoLabel}. Ajuste ou limpe os filtros abaixo para exportar.
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginBottom: '1.5rem',
              }}
            >
              <strong style={{ color: 'var(--text-main)' }}>
                {totalRegistros} {totalRegistros === 1 ? 'monitoria' : 'monitorias'}
              </strong>
              {totalRegistros < totalNoPeriodo
                ? ` de ${totalNoPeriodo} em ${periodoLabel}, após os filtros.`
                : ` em ${periodoLabel}.`}{' '}
              Os dois formatos exportam exatamente estes registros.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={onExportExcel}>
                <FileSpreadsheet size={16} style={{ color: 'var(--primary)' }} /> Exportar{' '}
                {totalRegistros} {totalRegistros === 1 ? 'registro' : 'registros'} (CSV)
              </button>
              <button className="btn btn-primary" onClick={onExportPDF}>
                <Download size={16} /> Gerar PDF de {periodoLabel}
              </button>
            </div>
          </>
        )}
      </div>

      {/* A tabela some só quando a competência está vazia. Se foram os filtros que zeraram o
          resultado, ela precisa continuar visível — é onde os controles vivem, e sem eles o
          usuário não consegue desfazer o próprio filtro. */}
      {!periodoVazio && historico}
    </div>
  );
};
