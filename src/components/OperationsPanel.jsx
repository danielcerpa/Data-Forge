import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sliders, 
  FileSpreadsheet, 
  FileJson, 
  Check, 
  Calendar, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertCircle,
  Play,
  Search,
  FileText
} from 'lucide-react';
import { 
  sanitizeDataset, 
  exportToCSV, 
  exportToJSON, 
  exportToExcel,
  exportToSQL,
  exportToMarkdown,
  detectDateFormatsForColumn, 
  detectTimeFormatsForColumn 
} from '../utils/dataSanitizer';

export default function OperationsPanel({ data, headers, onUpdateData, fileName, columnTypes = {}, onShowNotification, isAnalyzed, setIsAnalyzed }) {
  // Analyze Flow States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Section Expand/Collapse States
  const [isNullsOpen, setIsNullsOpen] = useState(false);
  const [isDatesOpen, setDatesOpen] = useState(false);
  const [isTimesOpen, setTimesOpen] = useState(false);
  const [isTextCaseOpen, setTextCaseOpen] = useState(false);

  // Sanitization Options States
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [nullFillValue, setNullFillValue] = useState('faltante');
  const [customNullValue, setCustomNullValue] = useState('');
  
  const [columnDateFormats, setColumnDateFormats] = useState({});
  const [columnTimeFormats, setColumnTimeFormats] = useState({});
  const [textCaseOption, setTextCaseOption] = useState('title'); // 'title', 'upper', 'lower'

  // Reset analysis session local states if file changes
  useEffect(() => {
    setShowSummary(false);
    setIsScanning(false);
  }, [fileName]);

  // Detect Date Columns
  const dateColumns = useMemo(() => {
    try {
      if (!headers || !Array.isArray(headers)) return [];
      return headers.filter(col => {
        const isDateType = columnTypes[col] === 'date';
        const name = col.toLowerCase();
        const hasDateName = name.includes('fecha') || name.includes('date') || name.includes('creado') || name.includes('created');
        return isDateType || hasDateName;
      });
    } catch (e) {
      console.error("Error in dateColumns memo:", e);
      return [];
    }
  }, [headers, columnTypes]);

  // Detect Time/Hour Columns
  const timeColumns = useMemo(() => {
    try {
      if (!headers || !Array.isArray(headers)) return [];
      return headers.filter(col => {
        const name = col.toLowerCase();
        return name.includes('hora') || name.includes('time');
      });
    } catch (e) {
      console.error("Error in timeColumns memo:", e);
      return [];
    }
  }, [headers]);

  // Compute formats and statistics per column
  const dateColumnDetails = useMemo(() => {
    try {
      if (!dateColumns || !Array.isArray(dateColumns)) return [];
      return dateColumns.map(col => {
        const formats = detectDateFormatsForColumn(data, col) || [];
        const isMixed = formats.length > 1;
        return { col, formats, isMixed };
      });
    } catch (e) {
      console.error("Error in dateColumnDetails memo:", e);
      return [];
    }
  }, [data, dateColumns]);

  const timeColumnDetails = useMemo(() => {
    try {
      if (!timeColumns || !Array.isArray(timeColumns)) return [];
      return timeColumns.map(col => {
        const formats = detectTimeFormatsForColumn(data, col) || [];
        const isMixed = formats.length > 1;
        return { col, formats, isMixed };
      });
    } catch (e) {
      console.error("Error in timeColumnDetails memo:", e);
      return [];
    }
  }, [data, timeColumns]);

  // General anomaly statistics for summary screen
  const anomaliesStats = useMemo(() => {
    try {
      if (!data || !Array.isArray(data) || !headers || !Array.isArray(headers)) {
        return { duplicateCount: 0, missingCount: 0, inconsistentDatesCount: 0, inconsistentTimesCount: 0 };
      }
      
      // 1. Calculate duplicates
      const seen = new Set();
      let duplicateCount = 0;
      data.forEach(row => {
        if (!row) return;
        const fingerprint = headers.map(col => String(row[col] ?? '')).join('|||');
        if (seen.has(fingerprint)) {
          duplicateCount++;
        } else {
          seen.add(fingerprint);
        }
      });

      // 2. Calculate missing cells
      let missingCount = 0;
      data.forEach(row => {
        if (!row) return;
        headers.forEach(col => {
          const val = row[col];
          if (val === null || val === undefined || String(val).trim() === '') {
            missingCount++;
          }
        });
      });

      // 3. Count inconsistent dates/times
      const inconsistentDatesCount = (dateColumnDetails || []).filter(d => d && d.isMixed).length;
      const inconsistentTimesCount = (timeColumnDetails || []).filter(t => t && t.isMixed).length;

      return {
        duplicateCount,
        missingCount,
        inconsistentDatesCount,
        inconsistentTimesCount
      };
    } catch (e) {
      console.error("Error in anomaliesStats memo:", e);
      return {
        duplicateCount: 0,
        missingCount: 0,
        inconsistentDatesCount: 0,
        inconsistentTimesCount: 0
      };
    }
  }, [data, headers, dateColumnDetails, timeColumnDetails]);

  // Set default format selections for columns
  useEffect(() => {
    try {
      if (!dateColumns || !Array.isArray(dateColumns)) return;
      const initialDates = { ...columnDateFormats };
      dateColumns.forEach(col => {
        if (!initialDates[col]) {
          initialDates[col] = 'YYYY-MM-DD';
        }
      });
      setColumnDateFormats(initialDates);
    } catch (e) {
      console.error("Error setting initial date formats:", e);
    }
  }, [dateColumns]);

  useEffect(() => {
    try {
      if (!timeColumns || !Array.isArray(timeColumns)) return;
      const initialTimes = { ...columnTimeFormats };
      timeColumns.forEach(col => {
        if (!initialTimes[col]) {
          initialTimes[col] = 'HH:mm:ss';
        }
      });
      setColumnTimeFormats(initialTimes);
    } catch (e) {
      console.error("Error setting initial time formats:", e);
    }
  }, [timeColumns]);

  const handleDateChange = (col, format) => {
    setColumnDateFormats(prev => ({ ...prev, [col]: format }));
  };

  const handleTimeChange = (col, format) => {
    setColumnTimeFormats(prev => ({ ...prev, [col]: format }));
  };

  // Start Scanning Animation simulation
  const handleStartScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setShowSummary(false);

    let progressVal = 0;
    
    const interval = setInterval(() => {
      progressVal += 4;
      
      if (progressVal >= 100) {
        progressVal = 100;
        clearInterval(interval);
        setScanProgress(100);
        
        setTimeout(() => {
          setShowSummary(true);
        }, 400);
        return;
      }
      
      setScanProgress(progressVal);
    }, 100);
  };

  const handleConfirmSummary = () => {
    setIsScanning(false);
    setIsAnalyzed(true);
  };

  const handleApplyClean = () => {
    try {
      const finalNullFillValue = nullFillValue === 'custom' ? customNullValue : nullFillValue;
      
      const cleaned = sanitizeDataset(data, headers, {
        removeDuplicates,
        trimWhitespace,
        fillNulls: isNullsOpen,
        nullFillValue: finalNullFillValue,
        standardizeDates: isDatesOpen,
        columnDateFormats: isDatesOpen ? columnDateFormats : {},
        standardizeTimes: isTimesOpen,
        columnTimeFormats: isTimesOpen ? columnTimeFormats : {},
        standardizeTextCase: isTextCaseOpen,
        textCaseOption: isTextCaseOpen ? textCaseOption : 'none'
      });

      onUpdateData(cleaned);
      if (onShowNotification) {
        onShowNotification("Limpieza y estandarización aplicadas con éxito", "success");
      }
    } catch (e) {
      console.error("Error applying cleaning settings:", e);
      if (onShowNotification) {
        onShowNotification("Ocurrió un error al procesar el dataset", "error");
      }
    }
  };

  // 1. Initial State: Analyze Hero Screen & Scanning Modal overlay
  if (!isAnalyzed) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: 'var(--bg-surface)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '48px 24px',
            textAlign: 'center',
            gap: '20px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(250, 74, 20, 0.1)', color: '#fa4a14', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={30} />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Diagnóstico & Calidad del Dataset</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '520px', margin: '6px auto 0' }}>
              Escanea tu archivo para detectar anomalías, registros duplicados e inconsistencias críticas en formatos de fechas y horas antes de continuar.
            </p>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleStartScan}
            style={{ 
              backgroundColor: '#fa4a14', 
              borderColor: '#fa4a14', 
              padding: '12px 32px', 
              fontSize: '14.5px', 
              fontWeight: 700, 
              borderRadius: 'var(--radius-pill)',
              marginTop: '10px'
            }}
          >
            <Play size={14} fill="#ffffff" />
            <span>Analizar Documento</span>
          </button>
        </div>

        {/* Scanning Animation & Results Summary Modal Overlay */}
        {isScanning && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '580px', width: '100%' }}>
              
              {/* Modal Header */}
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Search size={18} className="scanning-icon" style={{ color: '#fa4a14' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                    {!showSummary ? 'Escaneando archivo...' : 'Diagnóstico del Dataset Finalizado'}
                  </h3>
                </div>
              </div>

              {/* Modal Body */}
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {!showSummary ? (
                  <>
                    {/* Scanner Graphic */}
                    <div className="scan-box">
                      <div className="scanner-grid-bg" />
                      <div className="scan-line" />
                      <FileText size={48} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', zIndex: 5 }}>
                        Procesando registros... {scanProgress}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="scan-progress-bar-container">
                      <div className="scan-progress-bar-fill" style={{ width: `${scanProgress}%` }} />
                    </div>

                  </>
                ) : (
                  <>
                    {/* Summary of findings */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                        {/* Duplicates Found */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', backgroundColor: 'var(--bg-surface-subtle)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Registros Duplicados</span>
                          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: (anomaliesStats?.duplicateCount || 0) > 0 ? 'var(--status-pending)' : 'var(--text-primary)' }}>
                            {anomaliesStats?.duplicateCount || 0}
                          </div>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {(anomaliesStats?.duplicateCount || 0) > 0 ? 'Registros redundantes que inflan métricas.' : 'No se detectaron redundancias.'}
                          </p>
                        </div>

                        {/* Missing Cells */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', backgroundColor: 'var(--bg-surface-subtle)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Valores Vacíos / Nulos</span>
                          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: (anomaliesStats?.missingCount || 0) > 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}>
                            {anomaliesStats?.missingCount || 0}
                          </div>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {(anomaliesStats?.missingCount || 0) > 0 ? 'Celdas vacías detectadas en tu dataset.' : 'Dataset completamente lleno.'}
                          </p>
                        </div>

                        {/* Date Inconsistencies */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', backgroundColor: 'var(--bg-surface-subtle)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Inconsistencia de Fechas</span>
                          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: (anomaliesStats?.inconsistentDatesCount || 0) > 0 ? 'var(--status-pending)' : 'var(--text-primary)' }}>
                            {anomaliesStats?.inconsistentDatesCount || 0}
                          </div>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {(anomaliesStats?.inconsistentDatesCount || 0) > 0 ? 'Columnas con formatos de fecha mezclados.' : 'Formatos de fecha estables.'}
                          </p>
                        </div>

                        {/* Time Inconsistencies */}
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', backgroundColor: 'var(--bg-surface-subtle)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Inconsistencia de Horas</span>
                          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: (anomaliesStats?.inconsistentTimesCount || 0) > 0 ? 'var(--status-pending)' : 'var(--text-primary)' }}>
                            {anomaliesStats?.inconsistentTimesCount || 0}
                          </div>
                          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {(anomaliesStats?.inconsistentTimesCount || 0) > 0 ? 'Columnas con horas en formatos regionales o mixtos.' : 'Formatos de hora estables.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Modal Footer (only visible when summary complete) */}
              {showSummary && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-surface-subtle)' }}>
                  <button 
                    className="btn-primary" 
                    onClick={handleConfirmSummary}
                    style={{ 
                      backgroundColor: 'var(--brand-primary)', 
                      color: 'var(--brand-on-primary)', 
                      padding: '10px 24px', 
                      borderRadius: 'var(--radius-md)', 
                      fontWeight: 700 
                    }}
                  >
                    <span>Continuar a Limpieza</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Main Cleaning Interface (Visible only after analysis is confirmed)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 3fr)', gap: '24px', width: '100%' }}>
      {/* Columna 1: Panel de Configuración de Limpieza */}
      <div 
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '28px',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '28px' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <Sliders size={20} color="#000000" />
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Ajustes de Sanitización</h3>
        </div>

        {/* Duplicados y Limpieza Básica */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Duplicados & Limpieza Básica
          </h4>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={removeDuplicates}
              onChange={e => setRemoveDuplicates(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <div>
              <strong style={{ fontSize: '14.5px' }}>Eliminar registros duplicados</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Elimina filas idénticas evaluando todos los campos del registro.
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={trimWhitespace}
              onChange={e => setTrimWhitespace(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <div>
              <strong style={{ fontSize: '14.5px' }}>Recortar espacios en blanco y textos</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Limpia espacios al inicio/final y reduce espacios dobles internos.
              </div>
            </div>
          </label>
        </div>

        {/* Imputación de Nulos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsNullsOpen(!isNullsOpen)}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Imputación de Nulos / Vacíos
              </h4>
              {isNullsOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isNullsOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--bg-surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
              <div className="form-group-sm">
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Relleno Predefinido</label>
                <select
                  className="form-select-sm"
                  style={{ padding: '8px 12px', fontSize: '13.5px', marginTop: '6px', height: '38px' }}
                  value={nullFillValue}
                  onChange={e => setNullFillValue(e.target.value)}
                >
                  <option value="null">null (Especial)</option>
                  <option value="nulo">nulo</option>
                  <option value="vacío">vacío</option>
                  <option value="faltante">faltante</option>
                  <option value="N/A">N/A</option>
                  <option value="custom">Personalizado...</option>
                </select>
              </div>

              {nullFillValue === 'custom' && (
                <div className="form-group-sm">
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Valor Personalizado</label>
                  <input
                    type="text"
                    className="form-select-sm"
                    placeholder="Ej: Desconocido"
                    style={{ padding: '8px 12px', fontSize: '13.5px', marginTop: '6px', border: '1px solid var(--border-color)', height: '38px' }}
                    value={customNullValue}
                    onChange={e => setCustomNullValue(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Estandarización de Fechas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setDatesOpen(!isDatesOpen)}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Estandarización de Fechas
              </h4>
              {isDatesOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isDatesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '4px' }}>
              {dateColumnDetails.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No se detectaron columnas de fecha en este dataset.</span>
              ) : (
                dateColumnDetails.map(({ col, formats, isMixed }) => (
                  <div key={col} style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Columna: {col}</span>
                      {isMixed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-pending)', fontSize: '11px', fontWeight: 600 }}>
                          <AlertCircle size={14} />
                          <span>Formatos mezclados / incorrectos</span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      <strong>Formatos actuales detectados:</strong>{' '}
                      {formats.length > 0 ? (
                        <code style={{ fontSize: '11.5px', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', color: '#1f2937' }}>
                          {formats.join(', ')}
                        </code>
                      ) : (
                        'Ningún formato conocido o columna vacía'
                      )}
                    </div>

                    <div className="form-group-sm">
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>Convertir esta columna al formato:</label>
                      <select
                        className="form-select-sm"
                        style={{ padding: '8px 12px', fontSize: '13px', marginTop: '4px', width: '100%', height: '36px' }}
                        value={columnDateFormats[col] || ''}
                        onChange={e => handleDateChange(col, e.target.value)}
                      >
                        <option value="">No estandarizar esta columna</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO - Ej: 2026-08-03)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (Ej: 03/08/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (Ej: 08/03/2026)</option>
                        <option value="YYYY/MM/DD">YYYY/MM/DD (Ej: 2026/08/03)</option>
                        <option value="DD-MM-YYYY">DD-MM-YYYY (Ej: 03-08-2026)</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Estandarización de Horas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setTimesOpen(!isTimesOpen)}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Estandarización de Horas
              </h4>
              {isTimesOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isTimesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '4px' }}>
              {timeColumnDetails.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No se detectaron columnas de hora en este dataset.</span>
              ) : (
                timeColumnDetails.map(({ col, formats, isMixed }) => (
                  <div key={col} style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Columna: {col}</span>
                      {isMixed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-pending)', fontSize: '11px', fontWeight: 600 }}>
                          <AlertCircle size={14} />
                          <span>Formatos mezclados / incorrectos</span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      <strong>Formatos actuales detectados:</strong>{' '}
                      {formats.length > 0 ? (
                        <code style={{ fontSize: '11.5px', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', color: '#1f2937' }}>
                          {formats.join(', ')}
                        </code>
                      ) : (
                        'Ningún formato conocido o columna vacía'
                      )}
                    </div>

                    <div className="form-group-sm">
                      <label style={{ fontSize: '11px', fontWeight: 700 }}>Convertir esta columna al formato:</label>
                      <select
                        className="form-select-sm"
                        style={{ padding: '8px 12px', fontSize: '13px', marginTop: '4px', width: '100%', height: '36px' }}
                        value={columnTimeFormats[col] || ''}
                        onChange={e => handleTimeChange(col, e.target.value)}
                      >
                        <option value="">No estandarizar esta columna</option>
                        <option value="HH:mm:ss">HH:mm:ss (24h - Ej: 14:30:00)</option>
                        <option value="HH:mm">HH:mm (24h - Ej: 14:30)</option>
                        <option value="hh:mm A">hh:mm A (12h - Ej: 02:30 PM)</option>
                        <option value="hh:mm:ss A">hh:mm:ss A (12h - Ej: 02:30:00 PM)</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Normalización de Palabras */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setTextCaseOpen(!isTextCaseOpen)}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Incoherencias en Palabras
              </h4>
              {isTextCaseOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isTextCaseOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Estandarizar formato de escritura a:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { id: 'title', label: 'Tipo Título', desc: 'Ej: Juan Pérez' },
                  { id: 'upper', label: 'MAYÚSCULAS', desc: 'Ej: JUAN PÉREZ' },
                  { id: 'lower', label: 'minúsculas', desc: 'Ej: juan pérez' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    style={{
                      padding: '10px 6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: textCaseOption === item.id ? '#000000' : '#ffffff',
                      color: textCaseOption === item.id ? '#ffffff' : '#4c4546',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onClick={() => setTextCaseOption(item.id)}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.8, fontWeight: 400 }}>{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Columna 2: Acciones & Exportación */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Botón Aplicar */}
        <button 
          className="btn-primary" 
          onClick={handleApplyClean}
          style={{ 
            width: '100%', 
            padding: '16px 24px', 
            fontSize: '16px', 
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700
          }}
        >
          <Check size={18} />
          <span>Aplicar Ajustes</span>
        </button>

        <div style={{ borderBottom: '1px solid var(--border-color)', margin: '10px 0' }} />

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          Descargar Archivos
        </h4>

        {/* Export Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Export CSV Card */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToCSV(data, headers, fileName ? `limpio_${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.csv` : 'dataset.csv')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileSpreadsheet size={20} color="var(--status-active)" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700 }}>Exportar CSV</h4>
            </div>
          </div>

          {/* Export Excel Card */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToExcel(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.xlsx` : 'dataset.xlsx')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileSpreadsheet size={20} color="#107c41" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700 }}>Exportar Excel (.xlsx)</h4>
            </div>
          </div>

          {/* Export JSON Card */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToJSON(data, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.json` : 'dataset.json')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileJson size={20} color="var(--status-pending)" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700 }}>Exportar JSON</h4>
            </div>
          </div>

          {/* Export SQL Card */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToSQL(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.sql` : 'dataset.sql', fileName ? fileName.replace(/\.[a-zA-Z0-9]+$/, '') : 'dataset')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileText size={20} color="#3f51b5" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700 }}>Exportar SQL INSERTs</h4>
            </div>
          </div>

          {/* Export Markdown Card */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToMarkdown(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.md` : 'dataset.md')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileText size={20} color="#009688" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700 }}>Exportar Tabla MD (.md)</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
