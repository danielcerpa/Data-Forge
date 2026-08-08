import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  AlertCircle, 
  Upload, 
  Trash2, 
  GitCompare, 
  Combine, 
  X,
  Eye,
  HelpCircle
} from 'lucide-react';
import { 
  isDatasetEnglishPredominant, 
  joinDatasets, 
  concatenateDatasets 
} from '../utils/dataSanitizer';
import { parseFileOrContent } from '../utils/csvEngine';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function DataGrid({ 
  data, 
  headers, 
  columnTypes, 
  onTypeChange, 
  fileName, 
  onUpdateData, 
  onOpenAddRecordModal, 
  onRenameColumn,
  secData,
  secHeaders,
  secColumnTypes,
  secFileName,
  onUpdateSecData,
  onSetSecFileDetails,
  onClearSecFile,
  onShowNotification,
  sheetNames = [],
  currentSheet = '',
  onSwitchSheet,
  onCompareWithSheet
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Filter state for quality issues
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);
  
  // Inline editing states
  const [editingCell, setEditingCell] = useState({ rowId: null, header: null });
  const [editValue, setEditValue] = useState('');

  // Secondary Table States
  const [secSearchTerm, setSecSearchTerm] = useState('');
  const [secSortCol, setSecSortCol] = useState(null);
  const [secSortDir, setSecSortDir] = useState('asc');
  const [secPage, setSecPage] = useState(1);
  const [secPageSize, setSecPageSize] = useState(10);

  const handleStartTableTour = () => {
    const driverObj = driver({
      showProgress: true,
      popoverClass: 'driverjs-theme',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      steps: [
        { 
          element: '.summary-grid', 
          popover: { 
            title: 'Resumen Diagnóstico', 
            description: 'Estas tarjetas te muestran la salud y volumen de tu dataset en tiempo real: el porcentaje de integridad de los datos, el total de anomalías o valores faltantes, el conteo total de filas cargadas y el peso de memoria ocupado.' 
          } 
        },
        { 
          element: '.search-input-wrapper', 
          popover: { 
            title: 'Búsqueda Global', 
            description: 'Escribe cualquier valor, ID o texto aquí. La tabla se filtrará dinámicamente en tiempo real para mostrar únicamente las filas que coincidan.' 
          } 
        },
        { 
          element: '.btn-filter-anomalies', 
          popover: { 
            title: 'Depuración y Calidad', 
            description: 'Haz clic aquí para filtrar y aislar únicamente los registros con problemas: valores faltantes (nulos), inconsistencias de formato o errores de calidad detectados por el motor.' 
          } 
        },
        { 
          element: '.btn-add-record', 
          popover: { 
            title: 'Inserción de Datos', 
            description: 'Presiona este botón para abrir un formulario inteligente. Podrás ingresar un nuevo registro completando los campos con validaciones de tipo en tiempo real.' 
          } 
        },
        { 
          element: '.table-responsive thead th:nth-child(2)', 
          popover: { 
            title: 'Parametrización de Columnas', 
            description: 'El motor detecta tipos automáticamente. Haz clic aquí para forzar un tipo de parámetro específico: Texto (string), Número (number), Fecha (date), Booleano (boolean) o Categoría (category). También puedes renombrar la columna aquí.' 
          } 
        },
        { 
          element: '.table-responsive tbody tr:first-child', 
          popover: { 
            title: 'Edición en Celdas (Inline)', 
            description: 'Haz **doble clic** sobre cualquier celda de la tabla para editar su valor directamente. Presiona Enter para confirmar el cambio o Escape para cancelar.' 
          } 
        }
      ]
    });
    driverObj.drive();
  };
  
  // Merge Panel states
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [multiFileMode, setMultiFileMode] = useState('join');
  const [primaryJoinKey, setPrimaryJoinKey] = useState('');
  const [secondaryJoinKey, setSecondaryJoinKey] = useState('');
  const [joinType, setJoinType] = useState('left');
  const [highlightDiffs, setHighlightDiffs] = useState(false);

  // Inline header editing states
  const [editingHeader, setEditingHeader] = useState(null);
  const [editHeaderValue, setEditHeaderValue] = useState('');

  const handleStartEditHeader = (header) => {
    setEditingHeader(header);
    setEditHeaderValue(header);
  };

  const handleSaveHeader = (oldHeader) => {
    const newVal = editHeaderValue.trim();
    if (newVal && newVal !== oldHeader && onRenameColumn) {
      onRenameColumn(oldHeader, newVal);
    }
    setEditingHeader(null);
  };

  const handleStartEdit = (rowId, header, value) => {
    setEditingCell({ rowId, header });
    setEditValue(value === null || value === undefined ? '' : String(value));
  };

  const handleSaveCell = (rowId, header) => {
    if (!onUpdateData) return;
    const updatedData = data.map(row => {
      if (row._id === rowId) {
        return { ...row, [header]: editValue };
      }
      return row;
    });
    onUpdateData(updatedData);
    setEditingCell({ rowId: null, header: null });
  };

  const handleUploadSecFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await parseFileOrContent(file, file.name);
      onSetSecFileDetails(parsed.fileName, parsed.headers, parsed.normalizedData, parsed.columnTypes);
      
      if (parsed.headers.length > 0) setSecondaryJoinKey(parsed.headers[0]);
      if (headers.length > 0) setPrimaryJoinKey(headers[0]);
      
      onShowNotification("Segundo archivo cargado para comparación", "success");
    } catch (err) {
      console.error(err);
      onShowNotification("Error al cargar el segundo archivo", "error");
    }
  };

  const runMerge = () => {
    if (multiFileMode === 'join') {
      if (!primaryJoinKey || !secondaryJoinKey) {
        onShowNotification("Selecciona las columnas clave para la fusión", "error");
        return;
      }
      const result = joinDatasets(data, primaryJoinKey, secData, secondaryJoinKey, joinType);
      onUpdateData(result.data, result.headers);
      onShowNotification("Datasets fusionados correctamente", "success");
    } else {
      const result = concatenateDatasets(data, headers, secData, secHeaders);
      onUpdateData(result.data, result.headers);
      onShowNotification("Datasets concatenados correctamente", "success");
    }
    onClearSecFile();
    setShowMergePanel(false);
  };

  const hasDiffValue = (header, rowId) => {
    if (!highlightDiffs || !secData || secData.length === 0) return false;
    
    // Buscar la posición de la columna en la tabla principal
    const colIndex = headers.indexOf(header);
    if (colIndex === -1) return false;
    
    // Obtener la columna correspondiente en la tabla secundaria por su mismo índice
    const secHeader = secHeaders[colIndex];
    if (!secHeader) return false;
    
    // Comparar los identificadores convirtiéndolos a string para evitar fallos por tipo de dato (número vs string)
    const primaryRow = data.find(r => String(r._id) === String(rowId));
    const secondaryRow = secData.find(r => String(r._id) === String(rowId));
    
    if (!primaryRow || !secondaryRow) return false;
    
    // Comparar recortando espacios en blanco
    const valA = String(primaryRow[header] ?? '').trim();
    const valB = String(secondaryRow[secHeader] ?? '').trim();
    
    return valA !== valB;
  };

  const availableTypes = ['string', 'number', 'date', 'boolean', 'category'];

  // Detect duplicate row IDs in the entire dataset
  const duplicateRowIds = useMemo(() => {
    const seen = new Set();
    const dups = new Set();
    data.forEach(row => {
      if (!row) return;
      const fingerprint = headers.map(col => String(row[col] ?? '')).join('|||');
      if (seen.has(fingerprint)) {
        dups.add(row._id);
      } else {
        seen.add(fingerprint);
      }
    });
    return dups;
  }, [data, headers]);

  // Detect if the dataset is predominantly English
  const isEnglish = useMemo(() => isDatasetEnglishPredominant(data, headers), [data, headers]);

  // Helper to validate calendar date logic without US-centric Date.parse bias, aware of language
  const isValidCalendarDate = (str, isEnglish) => {
    let match = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (match) {
      const m = parseInt(match[2], 10);
      const d = parseInt(match[3], 10);
      return m >= 1 && m <= 12 && d >= 1 && d <= 31;
    }
    
    match = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      
      if (p1 > 12) {
        return p2 >= 1 && p2 <= 12; // p1 is day, p2 is month -> DD/MM/YYYY
      }
      if (p2 > 12) {
        return p1 >= 1 && p1 <= 12; // p2 is day, p1 is month -> MM/DD/YYYY
      }
      
      // If both are <= 12, it is calendar-valid in both structures
      return p1 >= 1 && p1 <= 12 && p2 >= 1 && p2 <= 31;
    }
    
    return !isNaN(Date.parse(str));
  };

  // Identify specific anomaly type for any cell value
  const getCellAnomaly = (val, header) => {
    if (val === null || val === undefined || String(val).trim() === '') {
      return { type: 'null', msg: 'Valor nulo o vacío' };
    }
    
    const name = header.toLowerCase();
    const isDateCol = columnTypes[header] === 'date' || name.includes('fecha') || name.includes('date') || name.includes('creado') || name.includes('created');
    const isTimeCol = (name.includes('hora') || name.includes('time')) && !isDateCol;

    if (isDateCol) {
      const strVal = String(val).trim();
      // Extract the date portion to support both pure dates and date-times (split by space or T)
      const datePart = strVal.split(/[\sT]/)[0];
      const isIso = /^\d{4}-\d{2}-\d{2}$/.test(datePart);
      const isSlashDDMM = /^\d{2}\/\d{2}\/\d{4}$/.test(datePart);
      const isDashDDMM = /^\d{2}-\d{2}-\d{4}$/.test(datePart);
      const isSlashYYYYMM = /^\d{4}\/\d{2}\/\d{2}$/.test(datePart);
      
      const isValidFormat = isIso || isSlashDDMM || isDashDDMM || isSlashYYYYMM;
      if (!isValidFormat || !isValidCalendarDate(datePart, isEnglish)) {
        return { type: 'date-format', msg: 'Formato de fecha inconsistente o inválido' };
      }
    }

    if (isTimeCol) {
      const strVal = String(val).trim();
      // Accepts HH:mm:ss, HH:mm, hh:mm:ss A, hh:mm A, and dot-regional a. m. / p. m.
      const isValidTime = /^\d{1,2}:\d{2}(?::\d{2})?\s*([ap]\.?\s*m\.?)?$/i.test(strVal);
      if (!isValidTime) {
        return { type: 'time-format', msg: 'Formato de hora inválido o regional mixto' };
      }
    }

    return null;
  };

  // Handle column sorting
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Filter & Sort rows
  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    // 1. Text Search Filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        headers.some(header => {
          const val = row[header];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
        })
      );
    }

    // 2. Anomalies filter
    if (showOnlyAnomalies) {
      result = result.filter(row => {
        const isDup = duplicateRowIds.has(row._id);
        const hasCellAnomaly = headers.some(header => getCellAnomaly(row[header], header) !== null);
        return isDup || hasCellAnomaly;
      });
    }

    // 3. Sorting
    if (sortCol) {
      result.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }

        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [data, headers, searchTerm, sortCol, sortDir, showOnlyAnomalies, duplicateRowIds]);

  // Paginated rows
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  // Handle secondary column sorting
  const handleSecSort = (col) => {
    if (secSortCol === col) {
      setSecSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSecSortCol(col);
      setSecSortDir('asc');
    }
  };

  // Filter & Sort secondary rows
  const filteredSecData = useMemo(() => {
    if (!secData) return [];
    let result = [...secData];

    // 1. Text Search Filter
    if (secSearchTerm.trim() !== '') {
      const term = secSearchTerm.toLowerCase();
      result = result.filter(row =>
        secHeaders.some(header => {
          const val = row[header];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
        })
      );
    }

    // 2. Sorting
    if (secSortCol) {
      result.sort((a, b) => {
        const valA = a[secSortCol];
        const valB = b[secSortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return secSortDir === 'asc' ? valA - valB : valB - valA;
        }

        return secSortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [secData, secHeaders, secSearchTerm, secSortCol, secSortDir]);

  // Paginated secondary rows
  const totalSecPages = Math.ceil(filteredSecData.length / secPageSize) || 1;
  const paginatedSecData = useMemo(() => {
    const start = (secPage - 1) * secPageSize;
    return filteredSecData.slice(start, start + secPageSize);
  }, [filteredSecData, secPage, secPageSize]);

  // Dynamic cell content rendering with validation badges
  const renderCellContent = (val, header, row) => {
    const isDup = duplicateRowIds.has(row._id);
    const anomaly = getCellAnomaly(val, header);
    
    if (anomaly) {
      if (anomaly.type === 'null') {
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '1.4' }}>
              nulo
            </span>
          </div>
        );
      }
      
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
          <span style={{ color: 'var(--text-primary)' }}>{String(val)}</span>
          <span 
            title={anomaly.msg} 
            style={{ 
              color: '#d97706', 
              fontSize: '10.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
          >
            ⚠️ Inconsistente
          </span>
        </div>
      );
    }
    
    // Highlight duplicates on the first column
    if (isDup && header === headers[0]) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
          <span>{String(val)}</span>
          <span 
            title="Esta fila entera tiene valores idénticos a otra fila." 
            style={{ 
              color: '#ef4444', 
              fontSize: '10.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
          >
            Duplicado
          </span>
        </div>
      );
    }
    return String(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Selector de Hojas Excel */}
      {sheetNames && sheetNames.length > 1 && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          backgroundColor: 'var(--bg-surface)', 
          padding: '12px 24px', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Hojas del Libro:</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {sheetNames.map(sheet => (
              <button
                key={sheet}
                type="button"
                onClick={() => onSwitchSheet(sheet)}
                className={`sheet-tab-btn ${currentSheet === sheet ? 'active' : ''}`}
              >
                {sheet}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Comparación header */}
      <div className="table-panel" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Comparación en Paralelo
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {secData && secData.length > 0 
                ? `Comparando dataset principal (${fileName || 'dataset.csv'}) con ${secFileName} (${secData.length} registros)`
                : 'Carga un segundo dataset para comparar ambos en paralelo e identificar diferencias.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn-guide-trigger"
              style={{ padding: '6px 12.5px', fontSize: '12.5px', height: '38px', borderRadius: 'var(--radius-md)' }}
              onClick={handleStartTableTour}
              type="button"
            >
              <HelpCircle size={14} />
              <span>Guía</span>
            </button>

            {(!secData || secData.length === 0) ? (
              <>
                <label 
                  className="btn-secondary" 
                  style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '12.5px', 
                    height: '38px',
                    fontWeight: 600,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 16px'
                  }}
                >
                  <Upload size={14} />
                  <span>Cargar Segunda Tabla</span>
                  <input 
                    type="file" 
                    accept=".csv,.xlsx,.xls" 
                    onChange={handleUploadSecFile} 
                    style={{ display: 'none' }} 
                  />
                </label>

                {sheetNames && sheetNames.length > 1 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        onCompareWithSheet(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    style={{
                      height: '38px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      padding: '0 12px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Comparar con otra hoja del libro...</option>
                    {sheetNames.map(sheet => (
                      sheet !== currentSheet && <option key={sheet} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setHighlightDiffs(!highlightDiffs)}
                  style={{ 
                    height: '38px', 
                    fontSize: '12.5px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: highlightDiffs ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    color: highlightDiffs ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    borderColor: highlightDiffs ? 'var(--brand-primary)' : 'var(--border-color)',
                  }}
                >
                  <Eye size={14} />
                  <span>{highlightDiffs ? 'Ocultar Diferencias' : 'Buscar Diferencias'}</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClearSecFile}
                  style={{ 
                    height: '38px', 
                    fontSize: '12.5px', 
                    fontWeight: 600,
                    color: '#ef4444',
                    borderColor: '#fca5a5',
                    backgroundColor: '#fff1f2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Quitar Comparación</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: (secData && secData.length > 0) ? '1fr 1fr' : '1fr',
        gap: '24px',
        width: '100%',
        alignItems: 'start'
      }}>
        {/* TABLA PRINCIPAL */}
        <div className="table-panel" style={{ width: '100%', minWidth: 0 }}>
          {/* Header Controls */}
          <div className="table-header-bar">
            <div className="table-title-group">
              <h2 style={{ fontSize: '15px', fontWeight: 800 }}>{fileName || 'active_dataset.csv'} (Principal)</h2>
            </div>

            <div className="table-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn-secondary btn-filter-anomalies"
                onClick={() => { setShowOnlyAnomalies(!showOnlyAnomalies); setPage(1); }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: showOnlyAnomalies ? 'var(--status-critical-bg)' : 'var(--bg-surface)',
                  color: showOnlyAnomalies ? 'var(--status-critical)' : 'var(--text-secondary)',
                  borderColor: showOnlyAnomalies ? 'var(--status-critical)' : 'var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  height: '36px'
                }}
              >
                <AlertCircle size={14} color={showOnlyAnomalies ? '#ef4444' : 'var(--text-muted)'} />
                <span>{showOnlyAnomalies ? 'Ver todos' : 'Filtrar anomalías'}</span>
              </button>

              <div className="search-input-wrapper">
                <Search size={13} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                  style={{ height: '36px', fontSize: '12.5px' }}
                />
              </div>
              
              <button
                className="btn-primary btn-add-record"
                style={{ padding: '6px 12px', fontSize: '12px', height: '36px' }}
                onClick={onOpenAddRecordModal}
              >
                <Plus size={12} />
                <span>Agregar Fila</span>
              </button>
            </div>
          </div>



          <div className="table-responsive">
            <table className="precision-table">
              <thead>
                <tr>
                  {headers.map(header => {
                    const isEditingHeader = editingHeader === header;
                    return (
                      <th 
                        key={header} 
                        onDoubleClick={() => !isEditingHeader && handleStartEditHeader(header)}
                        onClick={() => !isEditingHeader && handleSort(header)}
                        style={{ cursor: 'pointer' }}
                      >
                        {isEditingHeader ? (
                          <input
                            type="text"
                            value={editHeaderValue}
                            onChange={e => setEditHeaderValue(e.target.value)}
                            onBlur={() => handleSaveHeader(header)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveHeader(header);
                              if (e.key === 'Escape') setEditingHeader(null);
                            }}
                            autoFocus
                            style={{
                              padding: '2px 6px',
                              border: '1px solid var(--border-focus)',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontFamily: 'inherit',
                              fontWeight: 700,
                              outline: 'none',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              width: '100%'
                            }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{header}</span>
                            {sortCol === header && (sortDir === 'asc' ? '▲' : '▼')}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No se encontraron registros.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row) => {
                    const isDup = duplicateRowIds.has(row._id);
                    const hasAnomaly = headers.some(header => getCellAnomaly(row[header], header) !== null);
                    
                    let rowBg = '';
                    if (isDup) {
                      rowBg = 'rgba(239, 68, 68, 0.02)';
                    } else if (hasAnomaly) {
                      rowBg = 'rgba(245, 158, 11, 0.015)';
                    }

                    return (
                      <tr 
                        key={row._id} 
                        style={{ 
                          backgroundColor: rowBg,
                          borderLeft: isDup ? '3px solid var(--status-critical)' : hasAnomaly ? '3px solid var(--status-pending)' : ''
                        }}
                      >
                        {headers.map(header => {
                          const isEditing = editingCell.rowId === row._id && editingCell.header === header;
                          const isDiff = hasDiffValue(header, row._id);
                          return (
                            <td
                              key={header}
                              onDoubleClick={() => !isEditing && handleStartEdit(row._id, header, row[header])}
                              style={{ 
                                cursor: 'cell',
                                color: isDiff ? '#dc2626' : 'inherit',
                                fontWeight: isDiff ? '700' : 'normal',
                                backgroundColor: isDiff ? 'rgba(239, 68, 68, 0.05)' : ''
                              }}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => handleSaveCell(row._id, header)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveCell(row._id, header);
                                    if (e.key === 'Escape') setEditingCell({ rowId: null, header: null });
                                  }}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: '2px 6px',
                                    border: '1px solid var(--border-focus)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    backgroundColor: 'var(--bg-surface)',
                                    color: 'var(--text-primary)'
                                  }}
                                />
                              ) : (
                                renderCellContent(row[header], header, row)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="table-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span>
                Mostrando {paginatedData.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, filteredData.length)} de {filteredData.length}
              </span>
              <select
                className="pagination-select"
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
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
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '12px' }}>{page} / {totalPages}</span>
              <button
                className="pagination-btn"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* SEGUNDA TABLA */}
        {secData && secData.length > 0 && (
          <div className="table-panel" style={{ width: '100%', minWidth: 0 }}>
            {/* Header Controls */}
            <div className="table-header-bar">
              <div className="table-title-group">
                <h2 style={{ fontSize: '15px', fontWeight: 800 }}>{secFileName} (Comparativo)</h2>
              </div>

              <div className="table-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="search-input-wrapper">
                  <Search size={13} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={secSearchTerm}
                    onChange={e => { setSecSearchTerm(e.target.value); setSecPage(1); }}
                    style={{ height: '36px', fontSize: '12.5px' }}
                  />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="precision-table">
                <thead>
                  <tr>
                    {secHeaders.map(header => (
                      <th 
                        key={header} 
                        onClick={() => handleSecSort(header)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{header}</span>
                          {secSortCol === header && (secSortDir === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSecData.length === 0 ? (
                    <tr>
                      <td colSpan={secHeaders.length} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No se encontraron registros.
                      </td>
                    </tr>
                  ) : (
                    paginatedSecData.map((row) => (
                      <tr key={row._id}>
                        {secHeaders.map(header => {
                          const isDiff = hasDiffValue(header, row._id);
                          return (
                            <td 
                              key={header}
                              style={{
                                color: isDiff ? '#dc2626' : 'inherit',
                                fontWeight: isDiff ? '700' : 'normal',
                                backgroundColor: isDiff ? 'rgba(239, 68, 68, 0.05)' : ''
                              }}
                            >
                              {row[header] === null || row[header] === undefined || String(row[header]).trim() === '' ? (
                                <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '11.5px' }}>vacío</span>
                              ) : (
                                String(row[header])
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="table-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span>
                  Mostrando {paginatedSecData.length > 0 ? (secPage - 1) * secPageSize + 1 : 0} - {Math.min(secPage * secPageSize, filteredSecData.length)} de {filteredSecData.length}
                </span>
                <select
                  className="pagination-select"
                  value={secPageSize}
                  onChange={e => {
                    setSecPageSize(Number(e.target.value));
                    setSecPage(1);
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
                  disabled={secPage === 1}
                  onClick={() => setSecPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: '12px' }}>{secPage} / {totalSecPages}</span>
                <button
                  className="pagination-btn"
                  disabled={secPage === totalSecPages}
                  onClick={() => setSecPage(p => Math.min(totalSecPages, p + 1))}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
