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
  ChevronLeft,
  ChevronRight,
  Clock, 
  AlertCircle,
  Play,
  Search,
  FileText,
  X,
  HelpCircle
} from 'lucide-react';
import { 
  sanitizeDataset, 
  exportToCSV, 
  exportToJSON, 
  exportToExcel,
  exportToSQL,
  exportToMarkdown,
  detectDateFormatsForColumn, 
  detectTimeFormatsForColumn,
  isDatasetEnglishPredominant,
  standardizeDateValue,
  standardizeTimeValue
} from '../utils/dataSanitizer';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OperationsPanel({ data, headers, onUpdateData, fileName, columnTypes = {}, onShowNotification, isAnalyzed, setIsAnalyzed }) {
  // Local duplicate state to guarantee instant UI rendering transitions
  const [localIsAnalyzed, setLocalIsAnalyzed] = useState(isAnalyzed);

  useEffect(() => {
    setLocalIsAnalyzed(isAnalyzed);
  }, [isAnalyzed]);

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

  // Pagination and change comparison logic
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isEnglish = useMemo(() => {
    return isDatasetEnglishPredominant(data, headers);
  }, [data, headers]);

  const rowsComparison = useMemo(() => {
    if (!data || !Array.isArray(data) || !headers || !Array.isArray(headers)) return [];
    
    const seen = new Set();
    const finalNullFillValue = nullFillValue === 'custom' ? customNullValue : nullFillValue;
    
    return data.map((row) => {
      const fingerprint = headers.map(col => String(row[col] ?? '')).join('|||');
      const isDuplicate = seen.has(fingerprint);
      seen.add(fingerprint);
      
      const isDeleted = isDuplicate && removeDuplicates;
      
      const cellChanges = {};
      headers.forEach(col => {
        let val = row[col];
        
        // 1. Trim whitespace
        if (typeof val === 'string' && trimWhitespace) {
          val = val.trim().replace(/\s+/g, ' ');
        }
        
        // 2. Text case
        if (typeof val === 'string' && isTextCaseOpen && textCaseOption !== 'none') {
          if (textCaseOption === 'upper') val = val.toUpperCase();
          else if (textCaseOption === 'lower') val = val.toLowerCase();
          else if (textCaseOption === 'title') {
            val = val.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.substring(1)).join(' ');
          }
        }
        
        // 3. Impute nulls
        if (val === null || val === undefined || String(val).trim() === '') {
          if (isNullsOpen) {
            val = finalNullFillValue;
          }
        }
        
        // 4. Date standardize
        if (isDatesOpen && columnDateFormats[col] && headers.includes(col)) {
          val = standardizeDateValue(val, columnDateFormats[col], isEnglish);
        }
        
        // 5. Time standardize
        if (isTimesOpen && columnTimeFormats[col] && headers.includes(col)) {
          val = standardizeTimeValue(val, columnTimeFormats[col]);
        }
        
        cellChanges[col] = {
          original: row[col],
          preview: val,
          changed: row[col] !== val
        };
      });
      
      return {
        rowId: row._id,
        isDeleted,
        isDuplicate,
        cellChanges
      };
    });
  }, [
    data,
    headers,
    removeDuplicates,
    trimWhitespace,
    isNullsOpen,
    nullFillValue,
    customNullValue,
    isDatesOpen,
    columnDateFormats,
    isTimesOpen,
    columnTimeFormats,
    isTextCaseOpen,
    textCaseOption,
    isEnglish
  ]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return rowsComparison.slice(start, start + rowsPerPage);
  }, [rowsComparison, currentPage, rowsPerPage]);

  // Reset page to 1 when options change
  useEffect(() => {
    setCurrentPage(1);
  }, [rowsComparison]);

  // Reset analysis session local states if file changes
  useEffect(() => {
    setShowSummary(false);
    setIsScanning(false);
  }, [fileName]);

  const handleStartCleanTour = () => {
    const driverObj = driver({
      showProgress: true,
      popoverClass: 'driverjs-theme',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      steps: [
        { 
          element: '.cleaning-config-panel', 
          popover: { 
            title: 'Ajustes de Sanitización', 
            description: 'Este es tu centro de configuración. Aquí parametrizarás todas las reglas automáticas de depuración y limpieza para tu conjunto de datos.' 
          } 
        },
        { 
          element: '.cleaning-config-panel div:nth-of-type(2)', 
          popover: { 
            title: '1. Imputación de Nulos y Vacíos', 
            description: 'Activa las casillas para eliminar automáticamente registros duplicados idénticos en todas sus celdas, y recortar espacios en blanco innecesarios o dobles espacios internos.' 
          } 
        },
        { 
          element: '.cleaning-config-panel div:nth-of-type(3)', 
          popover: { 
            title: '2. Estandarización de Fechas y Horas', 
            description: 'Despliega esta sección para definir cómo rellenar las celdas vacías. Puedes elegir valores predefinidos como "nulo", "N/A" o ingresar un término personalizado.' 
          } 
        },
        { 
          element: '.cleaning-config-panel div:nth-of-type(5)', 
          popover: { 
            title: '3. Incoherencias en Palabras', 
            description: 'Despliega esta opción para estandarizar la escritura de campos de texto. Puedes convertirlos de golpe a tipo Título (Juan Pérez), MAYÚSCULAS o minúsculas.' 
          } 
        },
        { 
          element: '.btn-apply-clean-settings', 
          popover: { 
            title: '4. Aplicar y Guardar Ajustes', 
            description: 'Una vez configuradas tus reglas, haz clic en "Aplicar Ajustes" para consolidar los cambios en el dataset y actualizar el archivo principal de forma definitiva.' 
          } 
        },
        { 
          element: '.preview-changes-panel', 
          popover: { 
            title: '5. Vista Previa de Cambios', 
            description: 'Muestra el impacto exacto en tiempo real: celdas modificadas se iluminan mostrando el valor anterior tachado y el nuevo, y las filas duplicadas se colorean en rojo para borrado.' 
          } 
        },
        { 
          element: '.download-files-panel', 
          popover: { 
            title: '6. Descargar y Exportar', 
            description: 'Una vez limpio, exporta tu trabajo finalizado descargando el archivo en el formato que requieras: CSV, Excel (.xlsx), JSON, SQL INSERTs o tablas Markdown.' 
          } 
        }
      ]
    });
    driverObj.drive();
  };

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
    setLocalIsAnalyzed(true);
    if (setIsAnalyzed) {
      setIsAnalyzed(true);
    }
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
  if (!localIsAnalyzed) {
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
            boxShadow: 'var(--shadow-sm)',
            maxWidth: '100%',
            margin: '0 auto'
          }}
        >
          <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--brand-primary)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={30} />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Diagnóstico & Calidad del Archivo</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '520px', margin: '6px auto 0' }}>
              Escanea tu archivo para detectar anomalías, registros duplicados e inconsistencias críticas en formatos de fechas y horas antes de continuar.
            </p>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleStartScan}
            style={{ 
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
                  <Search size={18} className="scanning-icon" style={{ color: 'var(--brand-primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                    {!showSummary ? 'Escaneando archivo...' : 'Diagnóstico del Dataset Finalizado'}
                  </h3>
                </div>
                {showSummary && (
                  <button 
                    className="btn-icon" 
                    onClick={handleConfirmSummary} 
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                    title="Cerrar y continuar a limpieza"
                  >
                    <X size={18} />
                  </button>
                )}
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
  const totalPages = Math.ceil(rowsComparison.length / rowsPerPage) || 1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 7fr) minmax(0, 3fr)', gap: '20px', width: '100%' }}>
      {/* Columna 1: Panel de Configuración de Limpieza */}
      <div 
        className="cleaning-config-panel"
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '24px',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px',
          height: '100%'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--text-primary)" />
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Ajustes de Sanitización</h3>
          </div>
          <button
            className="btn-guide-trigger"
            onClick={handleStartCleanTour}
            style={{ padding: '6px 12px', fontSize: '12px', height: '32px', borderRadius: 'var(--radius-md)' }}
            title="Iniciar guía de limpieza"
          >
            <HelpCircle size={13} />
            <span>Guía</span>
          </button>
        </div>

        {/* Duplicados y Limpieza Básica */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Duplicados & Limpieza Básica
          </h4>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13.5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={removeDuplicates}
              onChange={e => setRemoveDuplicates(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <div>
              <strong style={{ fontSize: '14px' }}>Eliminar registros duplicados</strong>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Elimina filas idénticas evaluando todos los campos del registro.
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13.5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={trimWhitespace}
              onChange={e => setTrimWhitespace(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <div>
              <strong style={{ fontSize: '14px' }}>Recortar espacios en blanco y textos</strong>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Limpia espacios al inicio/final y reduce espacios dobles internos.
              </div>
            </div>
          </label>
        </div>

        {/* Imputación de Nulos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsNullsOpen(!isNullsOpen)}
            >
              <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Imputación de Nulos / Vacíos
              </h4>
              {isNullsOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isNullsOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
              <div className="form-group-sm">
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Relleno Predefinido</label>
                <select
                  className="form-select-sm"
                  style={{ padding: '6px 10px', fontSize: '13px', marginTop: '6px', height: '34px', width: '100%' }}
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
                  <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Valor Personalizado</label>
                  <input
                    type="text"
                    className="form-select-sm"
                    placeholder="Ej: Desconocido"
                    style={{ padding: '6px 10px', fontSize: '13px', marginTop: '6px', border: '1px solid var(--border-color)', height: '34px', width: '100%' }}
                    value={customNullValue}
                    onChange={e => setCustomNullValue(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Estandarización de Fechas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setDatesOpen(!isDatesOpen)}
            >
              <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Estandarización de Fechas
              </h4>
              {isDatesOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isDatesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
              {dateColumnDetails.length === 0 ? (
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>No se detectaron columnas de fecha.</span>
              ) : (
                dateColumnDetails.map(({ col, formats, isMixed }) => (
                  <div key={col} style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Columna: {col}</span>
                       {isMixed && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-pending)', fontSize: '10.5px', fontWeight: 600 }}>
                           <AlertCircle size={13} />
                           <span>Formatos mezclados</span>
                         </div>
                       )}
                     </div>
                     
                     <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                       <strong>Formatos actuales:</strong>{' '}
                       {formats.length > 0 ? (
                         <code style={{ fontSize: '11px', backgroundColor: '#e5e7eb', padding: '1px 5px', borderRadius: '4px', color: '#1f2937' }}>
                           {formats.join(', ')}
                         </code>
                       ) : (
                         'Ningún formato conocido'
                       )}
                     </div>

                     <div className="form-group-sm">
                       <label style={{ fontSize: '10.5px', fontWeight: 700 }}>Convertir al formato:</label>
                       <select
                         className="form-select-sm"
                         style={{ padding: '6px 10px', fontSize: '12.5px', marginTop: '4px', width: '100%', height: '32px' }}
                         value={columnDateFormats[col] || ''}
                         onChange={e => handleDateChange(col, e.target.value)}
                       >
                         <option value="">No estandarizar</option>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setTimesOpen(!isTimesOpen)}
            >
              <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Estandarización de Horas
              </h4>
              {isTimesOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isTimesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
              {timeColumnDetails.length === 0 ? (
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>No se detectaron columnas de hora.</span>
              ) : (
                timeColumnDetails.map(({ col, formats, isMixed }) => (
                  <div key={col} style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Columna: {col}</span>
                       {isMixed && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-pending)', fontSize: '10.5px', fontWeight: 600 }}>
                           <AlertCircle size={13} />
                           <span>Formatos mezclados</span>
                         </div>
                       )}
                     </div>
                     
                     <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                       <strong>Formatos actuales:</strong>{' '}
                       {formats.length > 0 ? (
                         <code style={{ fontSize: '11px', backgroundColor: '#e5e7eb', padding: '1px 5px', borderRadius: '4px', color: '#1f2937' }}>
                           {formats.join(', ')}
                         </code>
                       ) : (
                         'Ningún formato conocido'
                       )}
                     </div>

                     <div className="form-group-sm">
                       <label style={{ fontSize: '10.5px', fontWeight: 700 }}>Convertir al formato:</label>
                       <select
                         className="form-select-sm"
                         style={{ padding: '6px 10px', fontSize: '12.5px', marginTop: '4px', width: '100%', height: '32px' }}
                         value={columnTimeFormats[col] || ''}
                         onChange={e => handleTimeChange(col, e.target.value)}
                       >
                         <option value="">No estandarizar</option>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <div 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setTextCaseOpen(!isTextCaseOpen)}
            >
              <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                Incoherencias en Palabras
              </h4>
              {isTextCaseOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
            </div>
          </div>

          {isTextCaseOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-surface-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700 }}>Estandarizar escritura a:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'title', label: 'Título', desc: 'Juan P.' },
                  { id: 'upper', label: 'MAYÚS', desc: 'JUAN P.' },
                  { id: 'lower', label: 'minús', desc: 'juan p.' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    style={{
                      padding: '8px 4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: textCaseOption === item.id ? 'var(--text-primary)' : 'var(--bg-surface)',
                      color: textCaseOption === item.id ? 'var(--bg-surface)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                    onClick={() => setTextCaseOption(item.id)}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7, fontWeight: 400 }}>{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Botón Aplicar Ajustes (en la izquierda como se solicitó) */}
        <button 
          className="btn-primary btn-apply-clean-settings" 
          onClick={handleApplyClean}
          style={{ 
            width: '100%', 
            padding: '12px 20px', 
            fontSize: '14.5px', 
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            marginTop: '8px'
          }}
        >
          <Check size={18} />
          <span>Aplicar Ajustes</span>
        </button>
      </div>

      {/* Columna 2: Tabla de Vista Previa Central */}
      <div 
        className="preview-changes-panel"
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '24px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          minWidth: 0
        }}
      >
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Vista Previa de Cambios</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Las celdas modificadas por las reglas activas se resaltan en amarillo mostrando <span style={{ textDecoration: 'line-through' }}>antes</span> → <strong>después</strong>. Las filas duplicadas a eliminar se sombrean en rojo.
          </p>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', minHeight: '380px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)', width: '140px', minWidth: '140px' }}>Estado</th>
                {headers.map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-secondary)', width: '160px', minWidth: '160px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((item) => {
                const isDel = item.isDeleted;
                return (
                  <tr 
                    key={item.rowId} 
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: isDel ? 'var(--status-critical-bg)' : undefined,
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', width: '140px', minWidth: '140px' }}>
                      {isDel ? (
                        <span style={{ fontSize: '10px', backgroundColor: 'var(--status-critical)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          Se eliminará (duplicado)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Fila #{item.rowId}</span>
                      )}
                    </td>
                    {headers.map(col => {
                      const cell = item.cellChanges[col];
                      if (isDel) {
                        return (
                          <td key={col} style={{ padding: '10px 12px', color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.6, width: '160px', minWidth: '160px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(cell.original ?? '')}
                          </td>
                        );
                      }
                      if (cell.changed) {
                        return (
                          <td key={col} style={{ padding: '8px 12px', backgroundColor: 'var(--status-pending-bg)', width: '160px', minWidth: '160px', maxWidth: '220px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textDecoration: 'line-through', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {String(cell.original === null || cell.original === undefined || String(cell.original).trim() === '' ? 'vacío' : cell.original)}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--brand-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {String(cell.preview)}
                              </span>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={col} style={{ padding: '10px 12px', color: 'var(--text-primary)', width: '160px', minWidth: '160px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {String(cell.preview ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginación */}
        <div className="table-footer" style={{ margin: '16px -24px -24px', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span>
              Mostrando {Math.min((currentPage - 1) * rowsPerPage + 1, rowsComparison.length)} - {Math.min(currentPage * rowsPerPage, rowsComparison.length)} de {rowsComparison.length}
            </span>
            <select
              className="pagination-select"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="pagination-btns">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '12px' }}>{currentPage} / {totalPages}</span>
            <button
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Columna 3: Exportación de Archivos */}
      <div 
        className="download-files-panel"
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '24px',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px',
          height: '100%'
        }}
      >
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
            Descargar Archivos
          </h4>
        </div>

        {/* Export Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Export CSV Card */}
          <div
            className="export-card"
            style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToCSV(data, headers, fileName ? `limpio_${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.csv` : 'dataset.csv')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileSpreadsheet size={20} color="var(--status-active)" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700 }}>Exportar CSV</h4>
            </div>
          </div>

          {/* Export Excel Card */}
          <div
            className="export-card"
            style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToExcel(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.xlsx` : 'dataset.xlsx')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileSpreadsheet size={20} color="#107c41" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700 }}>Exportar Excel (.xlsx)</h4>
            </div>
          </div>

          {/* Export JSON Card */}
          <div
            className="export-card"
            style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToJSON(data, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.json` : 'dataset.json')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileJson size={20} color="var(--status-pending)" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700 }}>Exportar JSON</h4>
            </div>
          </div>

          {/* Export SQL Card */}
          <div
            className="export-card"
            style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToSQL(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.sql` : 'dataset.sql', fileName ? fileName.replace(/\.[a-zA-Z0-9]+$/, '') : 'dataset')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileText size={20} color="#3f51b5" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700 }}>Exportar SQL INSERTs</h4>
            </div>
          </div>

          {/* Export Markdown Card */}
          <div
            className="export-card"
            style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={() => exportToMarkdown(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.md` : 'dataset.md')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FileText size={20} color="#009688" />
              <Download size={14} color="var(--text-muted)" />
            </div>
            <div>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700 }}>Exportar Tabla MD (.md)</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
