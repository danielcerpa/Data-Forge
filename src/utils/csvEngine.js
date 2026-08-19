import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Infiere el tipo de dato de un valor string o crudo.
 */
export function inferValueType(val) {
  if (val === null || val === undefined || val === '') return 'null';
  const trimmed = String(val).trim();
  if (trimmed === '') return 'null';

  // Check boolean
  if (/^(true|false|si|no|yes|no)$/i.test(trimmed)) return 'boolean';

  // Check numeric (e.g. $12,450.00 or -123.45 or 42)
  const cleanNum = trimmed.replace(/[\$,]/g, '');
  if (!isNaN(Number(cleanNum)) && cleanNum !== '') return 'number';

  // Check date (YYYY-MM-DD or ISO dates)
  if (!isNaN(Date.parse(trimmed)) && trimmed.length >= 8 && /\d{2,4}[-/\.]\d{1,2}[-/\.]\d{1,2}/.test(trimmed)) {
    return 'date';
  }

  return 'string';
}

/**
 * Infiere los tipos de dato predominantes para cada columna en la dataset.
 */
export function inferColumnTypes(data, headers) {
  const columnTypes = {};

  headers.forEach(header => {
    const sampleValues = data.slice(0, 100).map(row => row[header]).filter(val => val !== null && val !== undefined && String(val).trim() !== '');
    
    if (sampleValues.length === 0) {
      columnTypes[header] = 'string';
      return;
    }

    const typeCounts = { number: 0, date: 0, boolean: 0, string: 0 };
    sampleValues.forEach(val => {
      const type = inferValueType(val);
      if (typeCounts[type] !== undefined) {
        typeCounts[type]++;
      } else {
        typeCounts.string++;
      }
    });

    // Majority voting for type
    let maxType = 'string';
    let maxCount = 0;
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    });

    // If string has low unique count compared to total, tag as category
    if (maxType === 'string') {
      const uniqueVals = new Set(sampleValues.map(v => String(v).trim().toLowerCase()));
      if (uniqueVals.size <= 10 && sampleValues.length >= 5) {
        maxType = 'category';
      }
    }

    columnTypes[header] = maxType;
  });

  return columnTypes;
}

/**
 * Normaliza los valores de la dataset en base a los tipos de columna asignados/parametrizados.
 */
export function normalizeDataset(data, headers, columnTypes) {
  return data.map((row, rowIndex) => {
    const normalizedRow = { _id: rowIndex + 1 };
    headers.forEach(col => {
      const rawVal = row[col];
      const type = columnTypes[col] || 'string';

      if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
        normalizedRow[col] = null;
        return;
      }

      const strVal = String(rawVal).trim();

      switch (type) {
        case 'number': {
          const num = Number(strVal.replace(/[\$,]/g, ''));
          normalizedRow[col] = isNaN(num) ? null : num;
          break;
        }
        case 'boolean': {
          normalizedRow[col] = /^(true|si|yes|1)$/i.test(strVal);
          break;
        }
        case 'date': {
          const d = new Date(strVal);
          normalizedRow[col] = isNaN(d.getTime()) ? strVal : d.toISOString().split('T')[0];
          break;
        }
        case 'category':
        case 'string':
        default:
          normalizedRow[col] = strVal;
          break;
      }
    });
    return normalizedRow;
  });
}

/**
 * Calcula métricas generales de salud e integridad del dataset.
 */
export function calculateDatasetMetrics(data, headers) {
  if (!data || data.length === 0) {
    return { integrityPct: 100, totalRows: 0, totalCols: 0, missingCells: 0, memoryKB: 0, anomalyCount: 0 };
  }

  const totalRows = data.length;
  const totalCols = headers.length;
  const totalCells = totalRows * totalCols;
  let missingCells = 0;
  let totalChars = headers.join(',').length + totalRows;

  for (let i = 0; i < totalRows; i++) {
    const row = data[i];
    for (let j = 0; j < totalCols; j++) {
      const val = row[headers[j]];
      if (val === null || val === undefined || val === '') {
        missingCells++;
      } else {
        totalChars += String(val).length + 1;
      }
    }
  }

  const integrityPct = Math.max(0, Math.round(((totalCells - missingCells) / totalCells) * 1000) / 10);
  const memoryKB = Math.round(totalChars / 1024) || 1;

  return {
    integrityPct,
    totalRows,
    totalCols,
    missingCells,
    anomalyCount: missingCells,
    memoryKB
  };
}

/**
 * Repara secuencias Mojibake y codificaciones garbled comunes en español (ej. Ã± -> ñ, Ã¡ -> á).
 */
export function fixSpanishGarbledEncoding(str) {
  if (typeof str !== 'string' || !str) return str;

  return str
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Â¿/g, '¿')
    .replace(/Â¡/g, '¡')
    .replace(/Â°/g, '°');
}

/**
 * Parsea una cadena o archivo CSV usando PapaParse.
 */
export function parseCSVContent(csvString, options = {}) {
  return new Promise((resolve, reject) => {
    const sanitizedString = fixSpanishGarbledEncoding(csvString);
    Papa.parse(sanitizedString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: options.delimiter || '',
      complete: (results) => {
        const rawHeaders = results.meta.fields || [];
        const headers = rawHeaders.map(h => fixSpanishGarbledEncoding(h));
        
        const rawData = (results.data || []).map(row => {
          const cleanedRow = {};
          Object.entries(row).forEach(([k, v]) => {
            const cleanKey = fixSpanishGarbledEncoding(k);
            const cleanVal = typeof v === 'string' ? fixSpanishGarbledEncoding(v) : v;
            cleanedRow[cleanKey] = cleanVal;
          });
          return cleanedRow;
        });

        const columnTypes = inferColumnTypes(rawData, headers);
        const normalizedData = normalizeDataset(rawData, headers, columnTypes);
        const metrics = calculateDatasetMetrics(normalizedData, headers);

        resolve({
          headers,
          rawData,
          normalizedData,
          columnTypes,
          metrics,
          errors: results.errors
        });
      },
      error: (err) => reject(err)
    });
  });
}

/**
 * Parsea un archivo File (CSV o XLSX) o string de contenido.
 */
export async function parseFileOrContent(fileOrContent, fileName = 'dataset.csv', delimiter = '', encoding = 'utf-8', sheetName = '') {
  let csvString = '';
  let name = fileName;

  if (fileOrContent instanceof File) {
    name = fileOrContent.name;
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');

    if (isXlsx) {
      const buffer = await fileOrContent.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const targetSheetName = sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[targetSheetName];
      csvString = XLSX.utils.sheet_to_csv(worksheet);
    } else {
      const buffer = await fileOrContent.arrayBuffer();
      
      let decoded = '';
      try {
        // Step 1: Strict UTF-8 decoding (throws immediately on non-UTF8 bytes like Windows-1252 0xF1 'ñ')
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        decoded = utf8Decoder.decode(buffer);
      } catch (e) {
        // Step 2: Fallback to Windows-1252 / ISO-8859-1 (standard Spanish Windows/Excel ANSI encoding)
        try {
          const winDecoder = new TextDecoder('windows-1252');
          decoded = winDecoder.decode(buffer);
        } catch (err) {
          const latinDecoder = new TextDecoder('iso-8859-1');
          decoded = latinDecoder.decode(buffer);
        }
      }

      csvString = fixSpanishGarbledEncoding(decoded);
    }
  } else {
    csvString = fixSpanishGarbledEncoding(String(fileOrContent));
  }

  const parsed = await parseCSVContent(csvString, { delimiter });
  return { ...parsed, fileName: name };
}

export async function getWorkbookSheetNames(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}

