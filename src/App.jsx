import React, { useState } from 'react';
import Header from './components/Header';
import LandingUploadScreen from './components/LandingUploadScreen';
import AnalysisSummary from './components/AnalysisSummary';
import DataGrid from './components/DataGrid';
import OperationsPanel from './components/OperationsPanel';
import AddRecordModal from './components/AddRecordModal';

import { parseFileOrContent, calculateDatasetMetrics, normalizeDataset, getWorkbookSheetNames } from './utils/csvEngine';

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'analysis', 'table', 'visuals', 'editor', 'export'
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [data, setData] = useState([]);
  const [columnTypes, setColumnTypes] = useState({});
  const [metrics, setMetrics] = useState({});
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);

  // Secondary dataset states
  const [secFileName, setSecFileName] = useState('');
  const [secHeaders, setSecHeaders] = useState([]);
  const [secData, setSecData] = useState([]);
  const [secColumnTypes, setSecColumnTypes] = useState({});

  // Excel Multi-sheet States
  const [excelFile, setExcelFile] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [currentSheet, setCurrentSheet] = useState('');

  // Custom lightweight notification capsule states & handlers
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success', isExiting: false });
  const notificationTimeoutRef = React.useRef(null);

  const showNotification = (message, type = 'success') => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification({ show: true, message, type, isExiting: false });
    
    // Set exit animation active after 2000ms
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(prev => ({ ...prev, isExiting: true }));
      
      // Fully hide after the exit animation completes (250ms)
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification({ show: false, message: '', type: 'success', isExiting: false });
      }, 250);
    }, 2000); 
  };

  const loadCsvString = async (fileOrContent, name = 'dataset.csv', delimiter = '', encoding = 'utf-8', sheetName = '') => {
    try {
      const parsed = await parseFileOrContent(fileOrContent, name, delimiter, encoding, sheetName);
      setHeaders(parsed.headers);
      setData(parsed.normalizedData);
      setColumnTypes(parsed.columnTypes);
      setMetrics(parsed.metrics);
      setFileName(parsed.fileName);
      setIsAnalyzed(false); // Reset only on new file load

      // Detectar nombres de hojas si es carga inicial de Excel
      if (fileOrContent instanceof File) {
        const ext = fileOrContent.name.split('.').pop().toLowerCase();
        if ((ext === 'xlsx' || ext === 'xls') && !sheetName) {
          const sheets = await getWorkbookSheetNames(fileOrContent);
          setExcelFile(fileOrContent);
          setSheetNames(sheets);
          setCurrentSheet(sheets[0]);
        } else if (!sheetName) {
          setExcelFile(null);
          setSheetNames([]);
          setCurrentSheet('');
        }
      }

      setActiveTab('table');
    } catch (err) {
      console.error('Error parseando archivo:', err);
    }
  };

  const handleSwitchSheet = async (sheetName) => {
    if (!excelFile) return;
    try {
      const parsed = await parseFileOrContent(excelFile, excelFile.name, '', 'utf-8', sheetName);
      setHeaders(parsed.headers);
      setData(parsed.normalizedData);
      setColumnTypes(parsed.columnTypes);
      setMetrics(parsed.metrics);
      setCurrentSheet(sheetName);
      
      // Limpiar comparaciones secundarias al cambiar de hoja para evitar confusión
      setSecFileName('');
      setSecHeaders([]);
      setSecData([]);
      setSecColumnTypes({});
      
      showNotification(`Cargada hoja "${sheetName}" con éxito`, "success");
    } catch (err) {
      console.error('Error al cambiar de hoja:', err);
      showNotification("Error al cambiar de hoja", "error");
    }
  };

  const handleCompareWithSheet = async (sheetName) => {
    if (!excelFile) return;
    try {
      const parsed = await parseFileOrContent(excelFile, excelFile.name, '', 'utf-8', sheetName);
      setSecFileName(`${sheetName}`);
      setSecHeaders(parsed.headers);
      setSecData(parsed.normalizedData);
      setSecColumnTypes(parsed.columnTypes);
      
      showNotification(`Cargada hoja "${sheetName}" para comparación`, "success");
    } catch (err) {
      console.error('Error al cargar hoja de comparación:', err);
      showNotification("Error al cargar hoja de comparación", "error");
    }
  };

  // Allow user to manually change parameter type for any column
  const handleTypeChange = (header, newType) => {
    const updatedTypes = { ...columnTypes, [header]: newType };
    setColumnTypes(updatedTypes);

    // Re-normalize data values with updated type
    const reNormalized = normalizeDataset(data, headers, updatedTypes);
    setData(reNormalized);

    // Update metrics
    const updatedMetrics = calculateDatasetMetrics(reNormalized, headers);
    setMetrics(updatedMetrics);
  };

  const handleRenameColumn = (oldName, newName) => {
    if (!newName || newName.trim() === '' || oldName === newName) return;
    const cleanNewName = newName.trim();
    
    // Update headers
    const updatedHeaders = headers.map(h => h === oldName ? cleanNewName : h);
    setHeaders(updatedHeaders);
    
    // Update keys in data rows
    const updatedData = data.map(row => {
      const newRow = { ...row };
      newRow[cleanNewName] = newRow[oldName];
      delete newRow[oldName];
      return newRow;
    });
    setData(updatedData);

    // Update columnTypes key
    if (columnTypes[oldName]) {
      const updatedTypes = { ...columnTypes };
      updatedTypes[cleanNewName] = updatedTypes[oldName];
      delete updatedTypes[oldName];
      setColumnTypes(updatedTypes);
    }
  };

  // Update dataset (e.g. after sanitizing)
  const handleUpdateData = (newData, newHeaders) => {
    setData(newData);
    const activeHeaders = newHeaders || headers;
    if (newHeaders) {
      setHeaders(newHeaders);
    }
    const updatedMetrics = calculateDatasetMetrics(newData, activeHeaders);
    setMetrics(updatedMetrics);
  };

  // Add new record
  const handleAddRecord = (newRowValues) => {
    const newRecord = {
      _id: data.length + 1,
      ...newRowValues
    };
    const updated = [newRecord, ...data];
    handleUpdateData(updated);
  };

  const handleHeaderNav = (tabId) => {
    if (tabId === 'editor') {
      setActiveTab('upload');
    } else if (data.length === 0) {
      setActiveTab('upload');
    } else {
      setActiveTab(tabId);
    }
  };

  const currentNavTab = (activeTab === 'upload' || data.length === 0) ? 'editor' : activeTab;

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        activeTab={currentNavTab}
        setActiveTab={handleHeaderNav}
        onOpenUploadModal={() => setActiveTab('upload')}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="main-workspace" style={{ 
        padding: activeTab === 'upload' || data.length === 0 
          ? 0 
          : (activeTab === 'export' && isAnalyzed ? '28px 64px 60px' : '28px 24px 60px'),
        maxWidth: activeTab === 'export' && isAnalyzed ? '95%' : '90%',
        width: '100%'
      }}>
        {/* Landing Upload Screen (When no data or upload tab selected) */}
        {(activeTab === 'upload' || data.length === 0) ? (
          <LandingUploadScreen
            onFileLoaded={(file, encoding, sheetName) => loadCsvString(file, file.name, '', encoding, sheetName)}
            onShowNotification={showNotification}
          />
        ) : (
          <>
            <AnalysisSummary metrics={metrics} />

            {/* Dynamic Tab Views */}
             {activeTab === 'table' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <DataGrid
                  data={data}
                  headers={headers}
                  columnTypes={columnTypes}
                  onTypeChange={handleTypeChange}
                  fileName={fileName}
                  onUpdateData={handleUpdateData}
                  onOpenAddRecordModal={() => setIsAddRecordModalOpen(true)}
                  onRenameColumn={handleRenameColumn}
                  secData={secData}
                  secHeaders={secHeaders}
                  secColumnTypes={secColumnTypes}
                  secFileName={secFileName}
                  onUpdateSecData={(newData, newHeaders) => {
                    setSecData(newData);
                    if (newHeaders) setSecHeaders(newHeaders);
                  }}
                  onSetSecFileDetails={(name, headers, data, types) => {
                    setSecFileName(name);
                    setSecHeaders(headers);
                    setSecData(data);
                    setSecColumnTypes(types);
                  }}
                  onClearSecFile={() => {
                    setSecFileName('');
                    setSecHeaders([]);
                    setSecData([]);
                    setSecColumnTypes({});
                  }}
                  onShowNotification={showNotification}
                  sheetNames={sheetNames}
                  currentSheet={currentSheet}
                  onSwitchSheet={handleSwitchSheet}
                  onCompareWithSheet={handleCompareWithSheet}
                />
              </div>
            )}



            {activeTab === 'export' && (
              <div className="table-panel" style={{ padding: '24px 8px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', paddingLeft: '8px' }}>Centro de Limpieza & Sanitización</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', paddingLeft: '8px' }}>
                  Limpia, sanitiza y exporta tus conjuntos de datos en formato CSV o JSON.
                </p>
                <OperationsPanel
                  data={data}
                  headers={headers}
                  onUpdateData={handleUpdateData}
                  onOpenAddRecordModal={() => setIsAddRecordModalOpen(true)}
                  fileName={fileName}
                  columnTypes={columnTypes}
                  onShowNotification={showNotification}
                  isAnalyzed={isAnalyzed}
                  setIsAnalyzed={setIsAnalyzed}
                />
              </div>
            )}
          </>
        )}
      </main>



      {/* Add Record Modal */}
      {isAddRecordModalOpen && (
        <AddRecordModal
          headers={headers}
          columnTypes={columnTypes}
          onClose={() => setIsAddRecordModalOpen(false)}
          onAddRecord={handleAddRecord}
        />
      )}

      {/* Custom Clean Notification Capsule - Duración exacta de 2 segundos */}
      {notification.show && (
        <div 
          className={`custom-toast ${notification.isExiting ? 'exit' : ''}`}
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: notification.type === 'error' ? 'var(--status-critical)' : 'var(--status-active)',
            color: '#ffffff',
            padding: '14px 28px',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'max-content',
            maxWidth: '90vw',
            textAlign: 'center'
          }}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
}
