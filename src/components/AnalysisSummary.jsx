import React from 'react';
import { ShieldCheck, AlertTriangle, Database, Save } from 'lucide-react';

export default function AnalysisSummary({ metrics }) {
  const { integrityPct = 98.4, anomalyCount = 0, memoryKB = 12, totalRows = 0, totalCols = 0 } = metrics || {};

  return (
    <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
      {/* Integrity Card */}
      <div className="metric-card" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="metric-label">Datos completos</span>
          <span className="metric-value" style={{ fontSize: '18px', lineHeight: 1.2 }}>{integrityPct}%</span>
        </div>
        <ShieldCheck size={16} color="var(--status-active)" />
      </div>

      {/* Anomalies / Missing */}
      <div className="metric-card" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="metric-label">Anomalías / Faltantes</span>
          <span className="metric-value" style={{ fontSize: '18px', lineHeight: 1.2 }}>{anomalyCount}</span>
        </div>
        <AlertTriangle size={16} color={anomalyCount > 0 ? "var(--status-pending)" : "var(--status-active)"} />
      </div>

      {/* Total Records */}
      <div className="metric-card" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="metric-label">Total de registros</span>
          <span className="metric-value" style={{ fontSize: '18px', lineHeight: 1.2 }}>{totalRows.toLocaleString()}</span>
        </div>
        <Database size={16} color="var(--text-muted)" />
      </div>

      {/* Engine Process Time / Memory */}
      <div className="metric-card" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="metric-label">Uso de memoria</span>
          <span className="metric-value" style={{ fontSize: '18px', lineHeight: 1.2 }}>{memoryKB} KB</span>
        </div>
        <Save size={16} color="var(--text-muted)" />
      </div>
    </div>
  );
}
