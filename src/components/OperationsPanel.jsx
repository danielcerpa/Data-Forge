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
  HelpCircle,
  Combine,
  ArrowLeft,
  ArrowRight,
  Layers,
  RefreshCw,
  ArrowLeftRight
} from 'lucide-react';
import { 
  sanitizeDataset, 
  sanitizeDatasetAsync,
  sanitizeRow,
  exportToCSV, 
  exportToJSON, 
  exportToExcel,
  exportToSQL,
  exportToMarkdown,
  detectDateFormatsForColumn, 
  detectTimeFormatsForColumn,
  isDatasetEnglishPredominant,
  standardizeDateValue,
  standardizeTimeValue,
  mergeColumns,
  reorderDatasetColumns,
  autoAlignWorkbookSheets,
  swapColumnsData,
  moveColumnData
} from '../utils/dataSanitizer';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OperationsPanel({ 
  data, 
  headers, 
  onUpdateData, 
  fileName, 
  columnTypes = {}, 
  onShowNotification, 
  isAnalyzed, 
  setIsAnalyzed,
  excelFile,
  sheetNames = [],
  currentSheet = '',
  workbookSheets = {},
  onUpdateWorkbook,
  onSwitchSheet
}) {
  const isExcel = sheetNames && sheetNames.length > 1;
  const [scanTarget, setScanTarget] = useState('sheet'); // 'sheet' or 'workbook'
  const [activeScanTarget, setActiveScanTarget] = useState('sheet');
  const [workbookStats, setWorkbookStats] = useState(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  // Set localIsAnalyzed to true so cleaning controls and table load directly
  const [localIsAnalyzed, setLocalIsAnalyzed] = useState(true);

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

  // Async Sanitization progress states
  const [isApplyingClean, setIsApplyingClean] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);

  // Column Reorder & Merge States
  const [mergeColA, setMergeColA] = useState('');
  const [mergeColB, setMergeColB] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState('coalesce'); // 'coalesce' or 'concat'

  const handleMoveColumn = (colIndex, direction) => {
    const toIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    if (toIndex < 0 || toIndex >= headers.length) return;
    
    const newHeadersOrder = reorderDatasetColumns(headers, colIndex, toIndex);
    const newReorderedData = data.map(row => {
      const newRow = { _id: row._id };
      newHeadersOrder.forEach(h => {
        newRow[h] = row[h];
      });
      return newRow;
    });
    
    onUpdateData(newReorderedData);
    if (onShowNotification) {
      onShowNotification(`Columna "${headers[colIndex]}" desplazada a posición ${toIndex + 1}`, "success");
    }
  };

  const handleMergeColumnsAction = () => {
    if (!mergeColA || !mergeColB) {
      if (onShowNotification) onShowNotification("Selecciona ambas columnas para fusionar", "warning");
      return;
    }
    if (mergeColA === mergeColB) {
      if (onShowNotification) onShowNotification("Selecciona dos columnas distintas", "warning");
      return;
    }

    const { data: newData } = mergeColumns(data, headers, mergeColA, mergeColB, mergeStrategy);
    onUpdateData(newData);
    setMergeColA('');
    setMergeColB('');
    if (onShowNotification) {
      onShowNotification(`Columnas "${mergeColA}" y "${mergeColB}" fusionadas con éxito`, "success");
    }
  };

  const handleAlignWorkbookSheetsAction = () => {
    if (!isExcel || !workbookSheets) return;
    const alignedWorkbook = autoAlignWorkbookSheets(workbookSheets, headers);
    onUpdateWorkbook(alignedWorkbook);
    if (onShowNotification) {
      onShowNotification(`Alineadas las columnas de las ${sheetNames.length} hojas del libro al orden estándar`, "success");
    }
  };

  // Column Data Swap States
  const [swapCol1, setSwapCol1] = useState('');
  const [swapCol2, setSwapCol2] = useState('');
  const [swapMode, setSwapMode] = useState('swap'); // 'swap' or 'move'

  const handleSwapColumnsAction = () => {
    if (!swapCol1 || !swapCol2) {
      if (onShowNotification) onShowNotification("Selecciona ambas columnas para operar", "warning");
      return;
    }
    if (swapCol1 === swapCol2) {
      if (onShowNotification) onShowNotification("Selecciona dos columnas distintas", "warning");
      return;
    }

    let newData;
    if (swapMode === 'swap') {
      newData = swapColumnsData(data, swapCol1, swapCol2);
      if (onShowNotification) {
        onShowNotification(`Contenidos de "${swapCol1}" y "${swapCol2}" intercambiados con éxito`, "success");
      }
    } else {
      newData = moveColumnData(data, swapCol1, swapCol2, true);
      if (onShowNotification) {
        onShowNotification(`Contenido de "${swapCol1}" movido a "${swapCol2}" con éxito`, "success");
      }
    }

    onUpdateData(newData);
    setSwapCol1('');
    setSwapCol2('');
  };

  // Pagination and change comparison logic
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isEnglish = useMemo(() => {
    return isDatasetEnglishPredominant(data, headers);
  }, [data, headers]);

  // Fast duplicate detection set (runs in ~2ms for 10,000 rows)
  const duplicateRowIds = useMemo(() => {
    if (!data || !Array.isArray(data) || !removeDuplicates) return new Set();
    const seen = new Set();
    const dups = new Set();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let fp = '';
      for (let j = 0; j < headers.length; j++) {
        fp += String(row[headers[j]] ?? '') + '|||';
      }
      if (seen.has(fp)) {
        dups.add(row._id);
      } else {
        seen.add(fp);
      }
    }
    return dups;
  }, [data, headers, removeDuplicates]);

  const cleanOptions = useMemo(() => {
    const finalNullFillValue = nullFillValue === 'custom' ? customNullValue : nullFillValue;
    return {
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
    };
  }, [
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
    textCaseOption
  ]);

  const rowsComparisonLength = data ? data.length : 0;

  // Paginated Rows comparison: ONLY process the 10 rows on current page! Instant execution (<0.001ms)
  const paginatedRows = useMemo(() => {
    if (!data || !Array.isArray(data) || !headers || !Array.isArray(headers)) return [];
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);
    
    return pageData.map((row) => {
      const isDeleted = duplicateRowIds.has(row._id);
      const cleanedRow = sanitizeRow(row, headers, cleanOptions, isEnglish);
      
      const cellChanges = {};
      for (let j = 0; j < headers.length; j++) {
        const col = headers[j];
        const orig = row[col];
        const prev = cleanedRow[col];
        cellChanges[col] = {
          original: orig,
          preview: prev,
          changed: orig !== prev
        };
      }
      
      return {
        rowId: row._id,
        isDeleted,
        cellChanges
      };
    });
  }, [data, headers, currentPage, rowsPerPage, duplicateRowIds, cleanOptions, isEnglish]);

  // Reset page to 1 when options change
  useEffect(() => {
    setCurrentPage(1);
  }, [cleanOptions, duplicateRowIds]);

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
      doneBtnText: '¡Listo!',
      steps: [
        { 
          element: '.cleaning-config-panel', 
          popover: { 
            title: 'Tus Herramientas de Limpieza', 
            description: 'Aquí tienes todo a la mano para arreglar tu archivo. Elige qué quieres corregir y mira los resultados al instante abajo.' 
          } 
        },
        { 
          element: '#tour-tool-1', 
          popover: { 
            title: '1. Quitar Duplicados y Espacios', 
            description: 'Borra de un solo clic las filas repetidas y quita los espacios de más al inicio o final que suelen arruinar las fórmulas.' 
          } 
        },
        { 
          element: '#tour-tool-2', 
          popover: { 
            title: '2. Rellenar Celdas Vacías', 
            description: 'Si tienes celdas en blanco, elije con qué palabra llenarlas (por ejemplo: "Sin dato", "N/A" o el texto que prefieras).' 
          } 
        },
        { 
          element: '#tour-tool-3', 
          popover: { 
            title: '3. Arreglar Fechas y Números Romanos', 
            description: 'Pone todas tus fechas en el mismo formato. Incluso entiende fechas escritas con números romanos como 12/vii/03 y las pasa a 12/7/2003.' 
          } 
        },
        { 
          element: '#tour-tool-4', 
          popover: { 
            title: '4. Mayúsculas y Minúsculas', 
            description: 'Empareja los nombres y textos para que todos queden ordenados: en Formato Título, TODO MAYÚSCULAS o todo minúsculas.' 
          } 
        },
        { 
          element: '#tour-tool-5', 
          popover: { 
            title: '5. Mover, Cambiar y Fusionar Columnas', 
            description: 'Mueve columnas a los lados con las flechas, intercambia los datos de dos columnas si quedaron al revés, o junta dos columnas cuando los datos estén chuecos.' 
          } 
        },
        { 
          element: '.btn-apply-clean-settings', 
          popover: { 
            title: 'Guardar la Limpieza', 
            description: 'Haz clic aquí para aplicar todos los arreglos a tu tabla. Si tu archivo tiene miles de filas, lo procesará en segundos con una barrita de avance.' 
          } 
        },
        { 
          element: '.preview-changes-panel', 
          popover: { 
            title: 'Ver Cambios y Descargar', 
            description: 'Revisa cómo quedó tu tabla con los cambios resaltados y descarga el resultado final en Excel, CSV o el formato que necesites.' 
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

  const displayStats = activeScanTarget === 'workbook' ? (workbookStats || anomaliesStats) : anomaliesStats;

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
    setActiveScanTarget(scanTarget);

    let progressVal = 0;

    // Calcular estadísticas de todo el libro si es la opción seleccionada
    if (isExcel && scanTarget === 'workbook') {
      let totalDuplicates = 0;
      let totalMissing = 0;
      let totalInconsistentDates = 0;
      let totalInconsistentTimes = 0;

      Object.entries(workbookSheets).forEach(([sName, sInfo]) => {
        const sheetData = sInfo.data;
        const sheetHeaders = sInfo.headers;

        // Calcular duplicados
        const seen = new Set();
        let sheetDuplicates = 0;
        sheetData.forEach(row => {
          if (!row) return;
          const fingerprint = sheetHeaders.map(col => String(row[col] ?? '')).join('|||');
          if (seen.has(fingerprint)) {
            sheetDuplicates++;
          } else {
            seen.add(fingerprint);
          }
        });
        totalDuplicates += sheetDuplicates;

        // Calcular nulos
        let sheetMissing = 0;
        sheetData.forEach(row => {
          if (!row) return;
          sheetHeaders.forEach(col => {
            const val = row[col];
            if (val === null || val === undefined || String(val).trim() === '') {
              sheetMissing++;
            }
          });
        });
        totalMissing += sheetMissing;

        // Columnas de fechas/horas
        const dateCols = sheetHeaders.filter(col => {
          const isDateType = sInfo.columnTypes[col] === 'date';
          const name = col.toLowerCase();
          return isDateType || name.includes('fecha') || name.includes('date') || name.includes('creado') || name.includes('created');
        });

        const timeCols = sheetHeaders.filter(col => {
          const name = col.toLowerCase();
          return name.includes('hora') || name.includes('time');
        });

        // Fechas inconsistentes
        dateCols.forEach(col => {
          const formats = detectDateFormatsForColumn(sheetData, col) || [];
          if (formats.length > 1) totalInconsistentDates++;
        });

        // Horas inconsistentes
        timeCols.forEach(col => {
          const formats = detectTimeFormatsForColumn(sheetData, col) || [];
          if (formats.length > 1) totalInconsistentTimes++;
        });
      });

      setWorkbookStats({
        duplicateCount: totalDuplicates,
        missingCount: totalMissing,
        inconsistentDatesCount: totalInconsistentDates,
        inconsistentTimesCount: totalInconsistentTimes
      });
    }

    const interval = setInterval(() => {
      progressVal += 2;
      
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
    }, 60);
  };

  const handleConfirmSummary = () => {
    setIsScanning(false);
    setLocalIsAnalyzed(true);
    if (setIsAnalyzed) {
      setIsAnalyzed(true);
    }
  };

  const handleApplyClean = async (target = 'sheet') => {
    try {
      const finalNullFillValue = nullFillValue === 'custom' ? customNullValue : nullFillValue;
      const cleanOptions = {
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
      };

      setIsApplyingClean(true);
      setApplyProgress(0);

      if (isExcel && target === 'workbook') {
        const cleanedSheets = {};
        const entries = Object.entries(workbookSheets);
        for (let i = 0; i < entries.length; i++) {
          const [sName, sInfo] = entries[i];
          const cleaned = await sanitizeDatasetAsync(sInfo.data, sInfo.headers, cleanOptions, (pct) => {
            const overallPct = Math.round(((i + pct / 100) / entries.length) * 100);
            setApplyProgress(overallPct);
          });
          cleanedSheets[sName] = cleaned;
        }

        onUpdateWorkbook(cleanedSheets);
        if (onShowNotification) {
          onShowNotification(`Limpieza y estandarización aplicadas con éxito a las ${sheetNames.length} hojas del libro`, "success");
        }
      } else {
        const cleaned = await sanitizeDatasetAsync(data, headers, cleanOptions, (pct) => {
          setApplyProgress(pct);
        });
        onUpdateData(cleaned);
        if (onShowNotification) {
          onShowNotification("Limpieza y estandarización aplicadas con éxito a la hoja actual", "success");
        }
      }

      setIsApplyingClean(false);
      setShowApplyConfirm(false);
    } catch (e) {
      console.error("Error applying cleaning settings:", e);
      setIsApplyingClean(false);
      if (onShowNotification) {
        onShowNotification("Ocurrió un error al procesar el dataset", "error");
      }
    }
  };  const totalPages = Math.ceil(rowsComparisonLength / rowsPerPage) || 1;

  return (
    <div className="operations-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* 1. BARRA SUPERIOR DE HERRAMIENTAS DE SANITIZACIÓN (100% VISIBLES A LA VISTA) */}
      <div 
        className="cleaning-config-panel"
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px', 
          padding: '20px 24px',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
          width: '100%'
        }}
      >
        {/* Header con Título, Métricas Rápidas y Guía */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <Sliders size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16.5px', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Centro de Sanitización & Calidad
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Herramientas activas a la vista. Configura y aplica reglas de limpieza directamente sobre tu tabla.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn-guide-trigger"
              onClick={handleStartCleanTour}
              style={{ padding: '7px 14px', fontSize: '12.5px', height: '36px', borderRadius: '8px' }}
              title="Iniciar guía paso a paso"
            >
              <HelpCircle size={14} />
              <span>Guía de Limpieza</span>
            </button>

            <button 
              className="btn-primary btn-apply-clean-settings" 
              onClick={() => handleApplyClean('sheet')}
              style={{ 
                padding: '8px 24px', 
                fontSize: '13.5px', 
                height: '36px',
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              <Check size={16} />
              <span>Aplicar Sanitización</span>
            </button>
          </div>
        </div>

        {/* Selector de Hojas Excel (si es un archivo multi-hoja .xlsx) */}
        {isExcel && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '12px', 
            padding: '10px 16px', 
            backgroundColor: 'var(--bg-surface-subtle)', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={16} color="var(--status-active)" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Hoja Activa en Limpieza:
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {sheetNames.map(sheet => (
                <button
                  key={sheet}
                  type="button"
                  onClick={() => onSwitchSheet(sheet)}
                  className={`sheet-tab-btn ${currentSheet === sheet ? 'active' : ''}`}
                  style={{ padding: '5px 14px', fontSize: '11.5px', borderRadius: '8px' }}
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* HERRAMIENTAS A LA VISTA (GRID HORIZONTAL 4 COLUMNAS) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', width: '100%' }}>
          
          {/* Herramienta 1: Duplicados y Espacios */}
          <div id="tour-tool-1" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-primary)' }}>
              1. Duplicados & Espacios
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={removeDuplicates}
                onChange={e => setRemoveDuplicates(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
              />
              <span>Eliminar filas duplicadas</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={e => setTrimWhitespace(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
              />
              <span>Recortar espacios sobrantes</span>
            </label>
          </div>

          {/* Herramienta 2: Rellenar Celdas Vacías */}
          <div id="tour-tool-2" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-primary)' }}>
                2. Imputación de Vacíos
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={isNullsOpen}
                  onChange={e => setIsNullsOpen(e.target.checked)}
                  style={{ accentColor: 'var(--brand-primary)' }}
                />
                <span>Activar</span>
              </label>
            </div>

            <select
              className="form-select-sm"
              disabled={!isNullsOpen}
              style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', width: '100%', opacity: isNullsOpen ? 1 : 0.5 }}
              value={nullFillValue}
              onChange={e => setNullFillValue(e.target.value)}
            >
              <option value="null">Rellenar con null (Especial)</option>
              <option value="nulo">Rellenar con nulo</option>
              <option value="vacío">Rellenar con vacío</option>
              <option value="faltante">Rellenar con faltante</option>
              <option value="N/A">Rellenar con N/A</option>
              <option value="custom">Personalizado...</option>
            </select>

            {isNullsOpen && nullFillValue === 'custom' && (
              <input
                type="text"
                placeholder="Escribe texto..."
                style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none' }}
                value={customNullValue}
                onChange={e => setCustomNullValue(e.target.value)}
              />
            )}
          </div>

          {/* Herramienta 3: Formato de Fechas & Horas */}
          <div id="tour-tool-3" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-primary)' }}>
                3. Fechas & Horas
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={isDatesOpen || isTimesOpen}
                  onChange={e => { setDatesOpen(e.target.checked); setTimesOpen(e.target.checked); }}
                  style={{ accentColor: 'var(--brand-primary)' }}
                />
                <span>Activar</span>
              </label>
            </div>

            {headers && headers.length > 0 ? (
              (dateColumnDetails.length > 0 ? dateColumnDetails : headers.slice(0, 2).map(col => ({ col }))).slice(0, 2).map(({ col }) => (
                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}:</span>
                  <select
                    className="form-select-sm"
                    disabled={!isDatesOpen}
                    style={{ padding: '4px 6px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', width: '100%', opacity: isDatesOpen ? 1 : 0.5 }}
                    value={columnDateFormats[col] || ''}
                    onChange={e => handleDateChange(col, e.target.value)}
                  >
                    <option value="">Sin estandarizar</option>
                    <option value="D/M/YYYY">D/M/YYYY (ej. 12/7/2003)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (ej. 12/07/2003)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ej. 2003-07-12)</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY (ej. 12-07-2003)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (ej. 07/12/2003)</option>
                  </select>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Carga un dataset para configurar fechas.</span>
            )}
          </div>

          {/* Herramienta 4: Capitalización de Textos */}
          <div id="tour-tool-4" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-primary)' }}>
                4. Capitalización
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={isTextCaseOpen}
                  onChange={e => setTextCaseOpen(e.target.checked)}
                  style={{ accentColor: 'var(--brand-primary)' }}
                />
                <span>Activar</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', opacity: isTextCaseOpen ? 1 : 0.5, pointerEvents: isTextCaseOpen ? 'auto' : 'none' }}>
              {[
                { id: 'title', label: 'Título' },
                { id: 'upper', label: 'MAYÚS' },
                { id: 'lower', label: 'minús' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  style={{
                    padding: '6px 2px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    backgroundColor: textCaseOption === item.id ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    color: textCaseOption === item.id ? 'var(--brand-on-primary)' : 'var(--text-secondary)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onClick={() => setTextCaseOption(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Herramienta 5: Reordenamiento & Fusión de Columnas Desplazadas */}
        <div id="tour-tool-5" style={{ backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Combine size={18} color="var(--brand-primary)" />
              <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                5. Alineación & Fusión de Columnas Desplazadas
              </span>
            </div>

            {isExcel && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAlignWorkbookSheetsAction}
                style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Alinear todas las hojas del libro según la estructura de encabezados de la hoja actual"
              >
                <Layers size={14} color="var(--status-active)" />
                <span>Alinear Hojas del Libro ({sheetNames.length} Hojas)</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'start' }}>
            
            {/* Sub-panel 1: Fusión Inteligente de Columnas Desplazadas / Nulos */}
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Fusionar 2 Columnas (Rellenar nulos de datos desplazados):
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Columna A (Principal):</label>
                  <select
                    className="form-select-sm"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    value={mergeColA}
                    onChange={e => setMergeColA(e.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Columna B (Secundaria):</label>
                  <select
                    className="form-select-sm"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    value={mergeColB}
                    onChange={e => setMergeColB(e.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '2px' }}>
                <select
                  className="form-select-sm"
                  style={{ padding: '6px 8px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                  value={mergeStrategy}
                  onChange={e => setMergeStrategy(e.target.value)}
                >
                  <option value="coalesce">Modo: Rellenar Vacíos (Si A es nulo, tomar B)</option>
                  <option value="concat">Modo: Concatenar Texto (A + B)</option>
                </select>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleMergeColumnsAction}
                  disabled={!mergeColA || !mergeColB}
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px', opacity: mergeColA && mergeColB ? 1 : 0.5 }}
                >
                  <span>Fusionar</span>
                </button>
              </div>
            </div>

            {/* Sub-panel 2: Intercambiar / Mover Contenido Completo de Columnas */}
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Intercambiar / Mover Celdas de Columnas (Ej. Localidad ↔ Fechas):
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Columna A:</label>
                  <select
                    className="form-select-sm"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    value={swapCol1}
                    onChange={e => setSwapCol1(e.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Columna B:</label>
                  <select
                    className="form-select-sm"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    value={swapCol2}
                    onChange={e => setSwapCol2(e.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '2px' }}>
                <select
                  className="form-select-sm"
                  style={{ padding: '6px 8px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                  value={swapMode}
                  onChange={e => setSwapMode(e.target.value)}
                >
                  <option value="swap">Acción: Intercambiar (A ↔ B)</option>
                  <option value="move">Acción: Mover Contenido (A → B)</option>
                </select>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSwapColumnsAction}
                  disabled={!swapCol1 || !swapCol2}
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', opacity: swapCol1 && swapCol2 ? 1 : 0.5 }}
                >
                  <RefreshCw size={13} />
                  <span>Ejecutar</span>
                </button>
              </div>
            </div>

            {/* Sub-panel 2: Reordenar Posición de Columnas en Secuencia */}
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Reordenar Posición de Columnas (Mover izquierda / derecha):
              </span>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '95px', overflowY: 'auto', padding: '4px 0' }}>
                {headers.map((col, idx) => (
                  <div 
                    key={col} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      backgroundColor: 'var(--bg-surface-subtle)', 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border-color)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <span>{col}</span>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveColumn(idx, 'left')}
                      style={{ border: 'none', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 0.8, padding: '2px', display: 'flex', color: 'var(--text-primary)' }}
                      title="Mover a la izquierda"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === headers.length - 1}
                      onClick={() => handleMoveColumn(idx, 'right')}
                      style={{ border: 'none', background: 'transparent', cursor: idx === headers.length - 1 ? 'default' : 'pointer', opacity: idx === headers.length - 1 ? 0.3 : 0.8, padding: '2px', display: 'flex', color: 'var(--text-primary)' }}
                      title="Mover a la derecha"
                    >
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. TABLA PRINCIPAL Y ACCIONES DE EXPORTACIÓN (100% ANCHO DE PANTALLA) */}
      <div 
        className="preview-changes-panel"
        style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px', 
          padding: '20px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
          width: '100%'
        }}
      >
        {/* Header de la Tabla y Botonera de Exportación Horizontal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Tabla de Resultados & Vista Previa en Tiempo Real
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Celdas modificadas resaltadas en amarillo (<span style={{ textDecoration: 'line-through' }}>antes</span> → <strong>después</strong>). Filas duplicadas a borrar en rojo.
            </p>
          </div>

          {/* Botonera Horizontal de Exportación */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exportar:</span>
            
            <button
              className="export-btn-pill"
              onClick={() => exportToCSV(data, headers, fileName ? `limpio_${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.csv` : 'dataset.csv')}
              title="Descargar conjunto de datos en formato CSV"
            >
              <FileSpreadsheet size={15} color="var(--status-active)" />
              <span>CSV</span>
            </button>

            <button
              className="export-btn-pill"
              onClick={() => exportToExcel(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.xlsx` : 'dataset.xlsx', isExcel ? workbookSheets : null)}
              title="Descargar libro de cálculo Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} color="var(--status-active)" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              className="export-btn-pill"
              onClick={() => exportToJSON(data, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.json` : 'dataset.json')}
              title="Exportar objetos estructurados en formato JSON"
            >
              <FileJson size={15} color="var(--status-pending)" />
              <span>JSON</span>
            </button>

            <button
              className="export-btn-pill"
              onClick={() => exportToSQL(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.sql` : 'dataset.sql', fileName ? fileName.replace(/\.[a-zA-Z0-9]+$/, '') : 'dataset')}
              title="Generar sentencias CREATE e INSERT en SQL"
            >
              <FileText size={15} color="var(--brand-primary)" />
              <span>SQL</span>
            </button>

            <button
              className="export-btn-pill"
              onClick={() => exportToMarkdown(data, headers, fileName ? `${fileName.replace(/\.[a-zA-Z0-9]+$/, '')}.md` : 'dataset.md')}
              title="Generar tabla formateada en Markdown (.md)"
            >
              <FileText size={15} color="var(--status-syncing)" />
              <span>Markdown</span>
            </button>
          </div>
        </div>

        {/* Pestañas de Hojas Excel (si aplica) */}
        {isExcel && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 12px', 
            backgroundColor: 'var(--bg-surface-subtle)', 
            borderRadius: '10px', 
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hojas del Libro:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {sheetNames.map(sheet => (
                <button
                  key={sheet}
                  type="button"
                  onClick={() => onSwitchSheet(sheet)}
                  className={`sheet-tab-btn ${currentSheet === sheet ? 'active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: '11.5px', height: '28px' }}
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TABLA PRINCIPAL ANCHA (100% DE ANCHO) */}
        <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', height: '480px' }}>
          <table className="precision-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1.5px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)', width: '150px', minWidth: '150px' }}>Estado</th>
                {headers.map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '180px' }}>{h}</th>
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
                      backgroundColor: isDel ? 'var(--status-critical-bg)' : undefined
                    }}
                  >
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', width: '150px', minWidth: '150px' }}>
                      {isDel ? (
                        <span style={{ fontSize: '10.5px', backgroundColor: 'var(--status-critical)', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          Se eliminará
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>Fila #{item.rowId}</span>
                      )}
                    </td>
                    {headers.map(col => {
                      const cell = item.cellChanges[col];
                      if (isDel) {
                        return (
                          <td key={col} style={{ padding: '10px 16px', color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.6, minWidth: '180px' }}>
                            {String(cell.original ?? '')}
                          </td>
                        );
                      }
                      if (cell.changed) {
                        return (
                          <td key={col} style={{ padding: '8px 16px', backgroundColor: 'var(--status-pending-bg)', minWidth: '180px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through', lineHeight: 1.2 }}>
                                {String(cell.original === null || cell.original === undefined || String(cell.original).trim() === '' ? 'vacío' : cell.original)}
                              </span>
                              <span style={{ fontWeight: 700, color: 'var(--brand-primary)', lineHeight: 1.2 }}>
                                {String(cell.preview)}
                              </span>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={col} style={{ padding: '10px 16px', color: 'var(--text-primary)', minWidth: '180px' }}>
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

        {/* Pie de Paginación */}
        <div className="table-footer" style={{ margin: '8px -24px -20px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span>
              Mostrando {Math.min((currentPage - 1) * rowsPerPage + 1, rowsComparisonLength)} - {Math.min(currentPage * rowsPerPage, rowsComparisonLength)} de {rowsComparisonLength} registros
            </span>
            <select
              className="pagination-select"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 filas</option>
              <option value={25}>25 filas</option>
              <option value={50}>50 filas</option>
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



      {/* Modal de Progreso de Sanitización Asíncrona */}
      {isApplyingClean && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px', width: '100%', padding: '28px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'var(--status-active-bg)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sliders size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Sanitizando Dataset...
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Procesando y aplicando reglas de calidad en segundo plano.
                </p>
              </div>

              <div style={{ width: '100%', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '8px', height: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                <div style={{ width: `${applyProgress}%`, height: '100%', backgroundColor: 'var(--brand-primary)', transition: 'width 0.15s ease' }} />
              </div>

              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                {applyProgress}% Completado
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
