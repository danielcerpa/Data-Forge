import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Detecta si el dataset está predominantemente en inglés basándose EXCLUSIVAMENTE en el contenido de las celdas (ignorando encabezados).
 */
export function isDatasetEnglishPredominant(data, headers) {
  if (!data || !Array.isArray(data) || data.length === 0 || !headers || !Array.isArray(headers)) return false;
  
  let englishScore = 0;
  let spanishScore = 0;

  const englishKeywords = new Set([
    'yes', 'male', 'female', 'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'true', 'false', 'active', 'inactive'
  ]);

  const spanishKeywords = new Set([
    'si', 'sí', 'masculino', 'femenino', 'enero', 'febrero', 'marzo', 'abril', 'mayo',
    'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado',
    'domingo', 'verdadero', 'falso', 'activo', 'inactivo'
  ]);

  // Scan cell contents from up to 200 rows of data
  const sampleRows = data.slice(0, 200);
  sampleRows.forEach(row => {
    if (!row) return;
    headers.forEach(h => {
      const val = String(row[h] ?? '').toLowerCase().trim();
      if (!val) return;
      
      if (englishKeywords.has(val)) englishScore++;
      if (spanishKeywords.has(val)) spanishScore++;
    });
  });

  const total = englishScore + spanishScore;
  if (total === 0) return false;
  
  return (englishScore / total) >= 0.90;
}

/**
 * Detecta formatos de fecha presentes en una columna específica.
 */
export function detectDateFormatsForColumn(data, col, isEnglish = false) {
  const formatsFound = new Set();
  if (!data || !Array.isArray(data)) return [];
  
  data.forEach(row => {
    if (!row) return;
    const val = String(row[col] ?? '').trim();
    if (!val) return;
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      formatsFound.add('YYYY-MM-DD');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const parts = val.split('/');
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (p0 > 12) {
        formatsFound.add('DD/MM/YYYY');
      } else if (p1 > 12) {
        formatsFound.add('MM/DD/YYYY');
      } else {
        if (isEnglish) {
          formatsFound.add('MM/DD/YYYY');
        } else {
          formatsFound.add('DD/MM/YYYY');
        }
      }
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const parts = val.split('-');
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (p0 > 12) {
        formatsFound.add('DD-MM-YYYY');
      } else if (p1 > 12) {
        formatsFound.add('MM-DD-YYYY');
      } else {
        if (isEnglish) {
          formatsFound.add('MM-DD-YYYY');
        } else {
          formatsFound.add('DD-MM-YYYY');
        }
      }
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(val)) {
      formatsFound.add('YYYY/MM/DD');
    }
  });
  
  return Array.from(formatsFound);
}

const ROMAN_MONTHS = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6,
  vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12
};

function parseRomanMonth(str) {
  if (!str) return null;
  const key = String(str).trim().toLowerCase();
  return ROMAN_MONTHS[key] || null;
}

function normalizeYear(yearStr) {
  let y = parseInt(yearStr, 10);
  if (isNaN(y)) return '2000';
  if (y < 100) {
    y = y <= 30 ? 2000 + y : 1900 + y;
  }
  return String(y);
}

/**
 * Estandariza un valor de fecha al formato seleccionado. Soporta números romanos (ej. 12/vii/03) y años cortos.
 */
export function standardizeDateValue(val, targetFormat, isEnglish = false) {
  if (val === null || val === undefined || String(val).trim() === '') return '';
  const cleanVal = String(val).trim();

  let dateObj = null;

  // 1. Try Roman numeral month: e.g. 12/vii/03, 12-VII-2003, 15/iii/98
  let match = cleanVal.match(/^(\d{1,2})[-/\.]([ivxIVX]{1,4})[-/\.](\d{2,4})$/);
  if (match) {
    const rMonth = parseRomanMonth(match[2]);
    if (rMonth) {
      dateObj = {
        year: normalizeYear(match[3]),
        month: rMonth,
        day: parseInt(match[1], 10)
      };
    }
  }

  // 1b. Try Roman numeral month first: e.g. vii/12/03, VII-12-2003
  if (!dateObj) {
    match = cleanVal.match(/^([ivxIVX]{1,4})[-/\.](\d{1,2})[-/\.](\d{2,4})$/);
    if (match) {
      const rMonth = parseRomanMonth(match[1]);
      if (rMonth) {
        dateObj = {
          year: normalizeYear(match[3]),
          month: rMonth,
          day: parseInt(match[2], 10)
        };
      }
    }
  }

  // 2. Try YYYY-MM-DD or YYYY/MM/DD
  if (!dateObj) {
    match = cleanVal.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})$/);
    if (match) {
      dateObj = {
        year: match[1],
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10)
      };
    }
  }

  // 3. Try DD/MM/YYYY or D/M/YY or MM/DD/YYYY
  if (!dateObj) {
    match = cleanVal.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})$/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      const year = normalizeYear(match[3]);

      if (p1 > 12) {
        dateObj = { year, month: p2, day: p1 };
      } else if (p2 > 12) {
        dateObj = { year, month: p1, day: p2 };
      } else {
        if (isEnglish) {
          dateObj = { year, month: p1, day: p2 };
        } else {
          dateObj = { year, month: p2, day: p1 };
        }
      }
    }
  }

  // 4. Try Date.parse fallback
  if (!dateObj) {
    const parsed = Date.parse(cleanVal);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      dateObj = {
        year: String(d.getFullYear()),
        month: d.getMonth() + 1,
        day: d.getDate()
      };
    }
  }

  if (!dateObj) return val;

  const year = String(dateObj.year);
  const mNum = parseInt(dateObj.month, 10);
  const dNum = parseInt(dateObj.day, 10);

  const pad = (n) => String(n).padStart(2, '0');
  const mPadded = pad(mNum);
  const dPadded = pad(dNum);
  const mUnpadded = String(mNum);
  const dUnpadded = String(dNum);

  switch (targetFormat) {
    case 'D/M/YYYY':
      return `${dUnpadded}/${mUnpadded}/${year}`;
    case 'DD/MM/YYYY':
      return `${dPadded}/${mPadded}/${year}`;
    case 'M/D/YYYY':
      return `${mUnpadded}/${dUnpadded}/${year}`;
    case 'MM/DD/YYYY':
      return `${mPadded}/${dPadded}/${year}`;
    case 'DD-MM-YYYY':
      return `${dPadded}-${mPadded}-${year}`;
    case 'YYYY/MM/DD':
      return `${year}/${mPadded}/${dPadded}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${mPadded}-${dPadded}`;
  }
}

/**
 * Detecta formatos de hora presentes en una columna específica.
 */
export function detectTimeFormatsForColumn(data, col) {
  const formatsFound = new Set();
  if (!data || !Array.isArray(data)) return [];
  
  data.forEach(row => {
    if (!row) return;
    const val = String(row[col] ?? '').trim();
    if (!val) return;
    
    if (/^\d{1,2}:\d{2}:\d{2}\s*([ap]\.?\s*m\.?)?$/i.test(val)) {
      if (/[ap]\.?\s*m\.?/i.test(val)) {
        formatsFound.add('hh:mm:ss A (12h)');
      } else {
        formatsFound.add('HH:mm:ss (24h)');
      }
    } else if (/^\d{1,2}:\d{2}\s*([ap]\.?\s*m\.?)?$/i.test(val)) {
      if (/[ap]\.?\s*m\.?/i.test(val)) {
        formatsFound.add('hh:mm A (12h)');
      } else {
        formatsFound.add('HH:mm (24h)');
      }
    }
  });
  
  return Array.from(formatsFound);
}

/**
 * Estandariza un valor de hora al formato seleccionado.
 */
export function standardizeTimeValue(val, targetFormat) {
  if (val === null || val === undefined || String(val).trim() === '') return '';
  const cleanVal = String(val).trim();
  
  let match = cleanVal.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s*m\.?)?$/i);
  if (!match) return val;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const seconds = match[3] || '00';
  const ampmRaw = match[4] ? match[4].toLowerCase() : null;
  
  let ampm = null;
  if (ampmRaw) {
    if (ampmRaw.includes('p')) {
      ampm = 'pm';
    } else if (ampmRaw.includes('a')) {
      ampm = 'am';
    }
  }
  
  if (ampm) {
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }
  
  const pad = (n) => String(n).padStart(2, '0');
  
  switch (targetFormat) {
    case 'HH:mm':
      return `${pad(hours)}:${minutes}`;
    case 'hh:mm A': {
      const h12 = hours % 12 || 12;
      const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
      return `${pad(h12)}:${minutes} ${suffix}`;
    }
    case 'hh:mm:ss A': {
      const h12 = hours % 12 || 12;
      const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
      return `${pad(h12)}:${minutes}:${seconds} ${suffix}`;
    }
    case 'HH:mm:ss':
    default:
      return `${pad(hours)}:${minutes}:${seconds}`;
  }
}

/**
 * Sanitiza el dataset eliminando duplicados, recortando textos e imputando celdas nulas.
 */
/**
 * Single-pass helper for a single row to maximize performance.
 */
export function sanitizeRow(row, headers, options = {}, isEnglish = false) {
  const {
    trimWhitespace = true,
    fillNulls = false,
    nullFillValue = 'N/A',
    standardizeDates = false,
    columnDateFormats = {},
    standardizeTimes = false,
    columnTimeFormats = {},
    standardizeTextCase = false,
    textCaseOption = 'none'
  } = options;

  const newRow = { ...row };
  for (let i = 0; i < headers.length; i++) {
    const col = headers[i];
    let val = newRow[col];

    if (typeof val === 'string') {
      if (trimWhitespace) {
        val = val.trim().replace(/\s+/g, ' ');
      }

      if (standardizeTextCase && textCaseOption !== 'none') {
        if (textCaseOption === 'upper') {
          val = val.toUpperCase();
        } else if (textCaseOption === 'lower') {
          val = val.toLowerCase();
        } else if (textCaseOption === 'title') {
          val = val.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
      }
    }

    if (val === null || val === undefined || String(val).trim() === '') {
      if (fillNulls) {
        val = nullFillValue;
      }
    }

    if (standardizeDates && columnDateFormats[col]) {
      val = standardizeDateValue(val, columnDateFormats[col], isEnglish);
    }

    if (standardizeTimes && columnTimeFormats[col]) {
      val = standardizeTimeValue(val, columnTimeFormats[col]);
    }

    newRow[col] = val;
  }
  return newRow;
}

/**
 * Sanitiza el dataset eliminando duplicados, recortando textos e imputando celdas nulas en una sola pasada de alto rendimiento.
 */
export function sanitizeDataset(data, headers, options = {}) {
  if (!data || !Array.isArray(data)) return [];
  const { removeDuplicates = true } = options;
  const isEnglish = isDatasetEnglishPredominant(data, headers);
  const seen = new Set();
  const result = [];

  for (let i = 0; i < data.length; i++) {
    const cleanedRow = sanitizeRow(data[i], headers, options, isEnglish);
    
    if (removeDuplicates) {
      let fp = '';
      for (let j = 0; j < headers.length; j++) {
        fp += String(cleanedRow[headers[j]] ?? '') + '|||';
      }
      if (seen.has(fp)) continue;
      seen.add(fp);
    }

    cleanedRow._id = result.length + 1;
    result.push(cleanedRow);
  }

  return result;
}

/**
 * Sanitiza el dataset de forma asíncrona por lotes (chunked) reportando progreso en vivo para datasets grandes.
 */
export function sanitizeDatasetAsync(data, headers, options = {}, onProgress) {
  return new Promise((resolve) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      resolve([]);
      return;
    }

    const { removeDuplicates = true } = options;
    const isEnglish = isDatasetEnglishPredominant(data, headers);
    const seen = new Set();
    const result = [];
    const total = data.length;
    const chunkSize = 1000;
    let index = 0;

    function processChunk() {
      const end = Math.min(index + chunkSize, total);
      for (let i = index; i < end; i++) {
        const cleanedRow = sanitizeRow(data[i], headers, options, isEnglish);
        
        if (removeDuplicates) {
          let fp = '';
          for (let j = 0; j < headers.length; j++) {
            fp += String(cleanedRow[headers[j]] ?? '') + '|||';
          }
          if (seen.has(fp)) continue;
          seen.add(fp);
        }

        cleanedRow._id = result.length + 1;
        result.push(cleanedRow);
      }

      index = end;
      if (onProgress) {
        onProgress(Math.round((index / total) * 100));
      }

      if (index < total) {
        setTimeout(processChunk, 0);
      } else {
        resolve(result);
      }
    }

    processChunk();
  });
}

/**
 * Exporta el dataset a formato CSV usando PapaParse.
 */
export function exportToCSV(data, headers, filename = 'exported_dataset.csv') {
  const exportable = data.map(row => {
    const r = { ...row };
    delete r._id;
    return r;
  });

  const csv = Papa.unparse({ fields: headers, data: exportable });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta el dataset a formato JSON.
 */
export function exportToJSON(data, filename = 'exported_dataset.json') {
  const exportable = data.map(row => {
    const r = { ...row };
    delete r._id;
    return r;
  });

  const jsonStr = JSON.stringify(exportable, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(data, headers, filename = 'exported_dataset.xlsx', workbookSheets = null) {
  const workbook = XLSX.utils.book_new();

  if (workbookSheets && Object.keys(workbookSheets).length > 0) {
    Object.entries(workbookSheets).forEach(([sheetName, sheetInfo]) => {
      const exportable = sheetInfo.data.map(row => {
        const r = { ...row };
        delete r._id;
        return r;
      });
      const worksheet = XLSX.utils.json_to_sheet(exportable, { header: sheetInfo.headers });
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
  } else {
    const exportable = data.map(row => {
      const r = { ...row };
      delete r._id;
      return r;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportable, { header: headers });
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dataset");
  }

  XLSX.writeFile(workbook, filename);
}

/**
 * Exporta el dataset a sentencias SQL INSERT INTO
 */
export function exportToSQL(data, headers, filename = 'exported_dataset.sql', tableName = 'dataset') {
  const cleanTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
  const sqlLines = data.map(row => {
    const vals = headers.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      return `'${String(val).replace(/'/g, "''")}'`;
    });
    return `INSERT INTO \`${cleanTableName}\` (${headers.map(h => `\`${h}\``).join(', ')}) VALUES (${vals.join(', ')});`;
  });

  const sqlText = sqlLines.join('\n');
  const blob = new Blob([sqlText], { type: 'text/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta el dataset a una tabla Markdown (.md)
 */
export function exportToMarkdown(data, headers, filename = 'exported_dataset.md') {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = data.map(row => {
    return `| ${headers.map(col => {
      const val = row[col];
      return val !== null && val !== undefined ? String(val).replace(/\|/g, '\\|') : '';
    }).join(' | ')} |`;
  });

  const mdText = [headerRow, separatorRow, ...dataRows].join('\n');
  const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Realiza un Join de dos datasets
 */
export function joinDatasets(primaryData, primaryKey, secondaryData, secondaryKey, joinType = 'left') {
  const secondaryMap = new Map();
  secondaryData.forEach(row => {
    const keyVal = String(row[secondaryKey] ?? '').trim().toLowerCase();
    if (keyVal) {
      secondaryMap.set(keyVal, row);
    }
  });

  const primaryHeaders = Object.keys(primaryData[0] || {}).filter(k => k !== '_id');
  const secondaryHeaders = Object.keys(secondaryData[0] || {}).filter(k => k !== '_id' && k !== secondaryKey);

  const resolvedSecondaryHeaders = secondaryHeaders.map(header => {
    let resolved = header;
    if (primaryHeaders.includes(resolved)) {
      let counter = 1;
      while (primaryHeaders.includes(`${header}_sec${counter > 1 ? `_${counter}` : ''}`)) {
        counter++;
      }
      resolved = `${header}_sec${counter > 1 ? `_${counter}` : ''}`;
    }
    return { original: header, resolved };
  });

  const joinedData = [];

  primaryData.forEach(row => {
    const primaryKeyVal = String(row[primaryKey] ?? '').trim().toLowerCase();
    const match = secondaryMap.get(primaryKeyVal);

    if (joinType === 'inner' && !match) {
      return;
    }

    const newRow = { ...row };
    resolvedSecondaryHeaders.forEach(({ original, resolved }) => {
      newRow[resolved] = match && match[original] !== undefined ? match[original] : '';
    });
    joinedData.push(newRow);
  });

  const finalData = joinedData.map((row, index) => ({
    ...row,
    _id: index + 1
  }));

  const allHeaders = [...primaryHeaders, ...resolvedSecondaryHeaders.map(h => h.resolved)];

  return {
    data: finalData,
    headers: allHeaders
  };
}

/**
 * Fusiona dos columnas (colA y colB) cuando los datos de una columna están desplazados o en nulos.
 * Estrategia 'coalesce': si colA está vacía o nula, toma el valor de colB.
 */
export function mergeColumns(data, headers, colA, colB, strategy = 'coalesce', separator = ' ') {
  if (!data || !Array.isArray(data) || !colA || !colB) return { data, headers };

  const newHeaders = headers.filter(h => h !== colB);

  const newData = data.map(row => {
    const newRow = { ...row };
    const valA = newRow[colA];
    const valB = newRow[colB];

    const isValAEmpty = valA === null || valA === undefined || String(valA).trim() === '';
    const isValBEmpty = valB === null || valB === undefined || String(valB).trim() === '';

    if (strategy === 'coalesce') {
      if (isValAEmpty && !isValBEmpty) {
        newRow[colA] = valB;
      }
    } else if (strategy === 'concat') {
      if (!isValAEmpty && !isValBEmpty) {
        newRow[colA] = `${String(valA).trim()}${separator}${String(valB).trim()}`;
      } else if (isValAEmpty && !isValBEmpty) {
        newRow[colA] = String(valB).trim();
      }
    }

    delete newRow[colB];
    return newRow;
  });

  return {
    data: newData,
    headers: newHeaders
  };
}

/**
 * Reordena las columnas de un dataset moviendo una columna de un índice a otro.
 */
export function reorderDatasetColumns(headers, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= headers.length || toIndex < 0 || toIndex >= headers.length) {
    return headers;
  }
  const result = [...headers];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}

/**
 * Reordena y alinea todas las hojas de un libro de Excel al orden estándar de encabezados.
 */
export function autoAlignWorkbookSheets(workbookSheets, standardHeaders) {
  const alignedWorkbook = {};
  Object.entries(workbookSheets).forEach(([sName, sInfo]) => {
    const sheetHeaders = sInfo.headers || [];
    const extraInSheet = sheetHeaders.filter(h => !standardHeaders.includes(h));
    const finalHeaders = [...standardHeaders, ...extraInSheet];

    const alignedData = sInfo.data.map((row, index) => {
      const newRow = { _id: index + 1 };
      finalHeaders.forEach(col => {
        newRow[col] = row[col] !== undefined ? row[col] : null;
      });
      return newRow;
    });

    alignedWorkbook[sName] = {
      headers: finalHeaders,
      data: alignedData,
      columnTypes: sInfo.columnTypes || {},
      metrics: sInfo.metrics || {}
    };
  });

  return alignedWorkbook;
}

/**
 * Intercambia el contenido completo de dos columnas en todas las filas.
 * Ej. El contenido de la columna Localidad pasa a Fechas y viceversa.
 */
export function swapColumnsData(data, col1, col2) {
  if (!data || !Array.isArray(data) || !col1 || !col2) return data;

  return data.map(row => {
    const newRow = { ...row };
    const temp = newRow[col1];
    newRow[col1] = newRow[col2];
    newRow[col2] = temp;
    return newRow;
  });
}

/**
 * Mueve/Reemplaza el contenido de una columna Origen a una columna Destino.
 */
export function moveColumnData(data, colSource, colTarget, clearSource = true) {
  if (!data || !Array.isArray(data) || !colSource || !colTarget) return data;

  return data.map(row => {
    const newRow = { ...row };
    newRow[colTarget] = newRow[colSource];
    if (clearSource) {
      newRow[colSource] = null;
    }
    return newRow;
  });
}

/**
 * Concatena dos datasets
 */
export function concatenateDatasets(primaryData, primaryHeaders, secondaryData, secondaryHeaders) {
  const allHeadersSet = new Set([...primaryHeaders, ...secondaryHeaders]);
  const allHeaders = Array.from(allHeadersSet).filter(h => h !== '_id');

  const cleanPrimary = primaryData.map(row => {
    const r = { ...row };
    allHeaders.forEach(h => {
      if (r[h] === undefined) r[h] = '';
    });
    return r;
  });

  const cleanSecondary = secondaryData.map(row => {
    const r = { ...row };
    allHeaders.forEach(h => {
      if (r[h] === undefined) r[h] = '';
    });
    return r;
  });

  const concatenated = [...cleanPrimary, ...cleanSecondary].map((row, index) => ({
    ...row,
    _id: index + 1
  }));

  return {
    data: concatenated,
    headers: allHeaders
  };
}
