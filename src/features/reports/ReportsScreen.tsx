import { FileSpreadsheet, Download } from 'lucide-react';

interface ReportsScreenProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export const ReportsScreen = ({ onExportExcel, onExportPDF }: ReportsScreenProps) => (
  <div className="animate-fade-in">
    <div className="page-header" style={{ marginBottom: '1.5rem' }}>
      <div>
        <h1 className="page-title">Relatórios e Exportações de Qualidade</h1>
        <p className="page-subtitle">Gere relatórios formatados em PDF ou exporte planilhas Excel.</p>
      </div>
    </div>

    <div className="tab-row">
      <button className="tab-btn active">Relatórios Rápidos</button>
      <button className="tab-btn" onClick={() => alert('Disponível na V3 do Portal de Monitoria.')}>
        Relatórios Executivos (Futuro)
      </button>
    </div>

    <div className="section-card">
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
        Gerar Documento Consolidado
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        O relatório respeitará os filtros dinâmicos selecionados na aba **Monitorias**.
      </p>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={onExportExcel}>
          <FileSpreadsheet size={16} style={{ color: 'var(--primary)' }} /> Exportar Planilha Excel (CSV)
        </button>
        <button className="btn btn-primary" onClick={onExportPDF}>
          <Download size={16} /> Exportar Relatório em PDF
        </button>
      </div>
    </div>
  </div>
);
