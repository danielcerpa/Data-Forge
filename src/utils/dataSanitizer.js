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

/**
 * Estandariza un valor de fecha al formato seleccionado.
 */
export function standardizeDateValue(val, targetFormat, isEnglish = false) {
  if (val === null || val === undefined || String(val).trim() === '') return '';
  const cleanVal = String(val).trim();
  
  let dateObj = null;
  
  // Try YYYY-MM-DD or YYYY/MM/DD
  let match = cleanVal.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (match) {
    dateObj = { year: match[1], month: match[2], day: match[3] };
  } else {
    // Try DD/MM/YYYY or MM/DD/YYYY
    match = cleanVal.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      
      if (p1 > 12) {
        dateObj = { year: match[3], month: match[2], day: match[1] }; // DD/MM/YYYY
      } else if (p2 > 12) {
        dateObj = { year: match[3], month: match[1], day: match[2] }; // MM/DD/YYYY
      } else {
        if (isEnglish) {
          dateObj = { year: match[3], month: match[1], day: match[2] }; // MM/DD/YYYY
        } else {
          dateObj = { year: match[3], month: match[2], day: match[1] }; // DD/MM/YYYY
        }
      }
    }
  }
  
  if (!dateObj) {
    const parsed = Date.parse(cleanVal);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      const pad = (n) => String(n).padStart(2, '0');
      dateObj = {
        year: String(d.getFullYear()),
        month: pad(d.getMonth() + 1),
        day: pad(d.getDate())
      };
    }
  }
  
  if (!dateObj) return val;
  
  const { year, month, day } = dateObj;
  
  switch (targetFormat) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
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
export function sanitizeDataset(data, headers, options = {}) {
  const {
    removeDuplicates = true,
    trimWhitespace = true,
    fillNulls = false,
    nullFillValue = 'N/A',
    standardizeDates = false,
    columnDateFormats = {}, // { "FechaCol": "YYYY-MM-DD" }
    standardizeTimes = false,
    columnTimeFormats = {}, // { "HoraCol": "HH:mm:ss" }
    standardizeTextCase = false,
    textCaseOption = 'none' // 'title', 'upper', 'lower', 'none'
  } = options;

  let cleaned = [...data];
  const isEnglish = isDatasetEnglishPredominant(data, headers);

  // 1. Trim whitespace & Fill nulls & Text case standardization
  cleaned = cleaned.map(row => {
    const newRow = { ...row };
    headers.forEach(col => {
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
            val = val.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.substring(1)).join(' ');
          }
        }
      }

      if (val === null || val === undefined || String(val).trim() === '') {
        if (fillNulls) {
          val = nullFillValue;
        }
      }

      newRow[col] = val;
    });
    return newRow;
  });

  // 2. Standardize dates per column
  if (standardizeDates) {
    cleaned = cleaned.map(row => {
      const newRow = { ...row };
      Object.entries(columnDateFormats).forEach(([col, format]) => {
        if (format && headers.includes(col)) {
          newRow[col] = standardizeDateValue(newRow[col], format, isEnglish);
        }
      });
      return newRow;
    });
  }

  // 2.5. Standardize times per column
  if (standardizeTimes) {
    cleaned = cleaned.map(row => {
      const newRow = { ...row };
      Object.entries(columnTimeFormats).forEach(([col, format]) => {
        if (format && headers.includes(col)) {
          newRow[col] = standardizeTimeValue(newRow[col], format);
        }
      });
      return newRow;
    });
  }

  // 3. Remove duplicates
  if (removeDuplicates) {
    const seen = new Set();
    cleaned = cleaned.filter(row => {
      const fingerprint = headers.map(col => String(row[col] ?? '')).join('|||');
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  }

  return cleaned.map((row, index) => ({
    ...row,
    _id: index + 1
  }));
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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
