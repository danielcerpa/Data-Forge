import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Zap, 
  ShieldCheck, 
  Sparkles
} from 'lucide-react';
import Logo from './Logo';

export default function LandingUploadScreen({ onFileLoaded, onShowNotification }) {
  const [dragActive, setDragActive] = useState(false);
  const [encoding, setEncoding] = useState('utf-8');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'xls') {
      if (onShowNotification) {
        onShowNotification("Tipo de archivo no reconocido. Usa .csv o .xlsx", "error");
      }
      return;
    }
    // Protección contra agotamiento de memoria / Client DoS (> 150 MB)
    const MAX_SAFE_FILE_SIZE = 150 * 1024 * 1024;
    if (file.size > MAX_SAFE_FILE_SIZE) {
      if (onShowNotification) {
        onShowNotification("El archivo supera el tamaño máximo seguro (150 MB).", "error");
      }
      return;
    }
    onFileLoaded(file, encoding);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="landing-studio-container">
      <div className="landing-studio-card">
        {/* Header Hero */}
        <div className="landing-hero-header">
          <div className="landing-logo-badge">
            <Logo size={84} />
          </div>
          <h1 className="landing-hero-title">
            Data Forge
          </h1>
          <p className="landing-hero-subtitle">
            Organiza, arregla y deja listos tus archivos de Excel o CSV en segundos.
          </p>
        </div>

        {/* Central Frosted Dropzone */}
        <div
          className={`studio-dropzone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={e => processFile(e.target.files[0])}
          />

          <div className="dropzone-icon-glow">
            <UploadCloud size={30} />
          </div>

          <div className="dropzone-text-group">
            <h2 className="dropzone-main-text">
              Suelta tu archivo aquí
            </h2>
            <p className="dropzone-sub-text">
              o haz clic en cualquier parte para buscarlo en tu computadora
            </p>
          </div>

          <div className="dropzone-badges-row">
            <span className="file-format-badge">.CSV</span>
            <span className="file-format-badge">.XLSX</span>
            <span className="file-format-badge">.XLS</span>
          </div>
        </div>

        {/* Studio Pillars Strip */}
        <div className="studio-pillars-grid">
          <div className="studio-pillar-item">
            <div className="pillar-icon-box">
              <Zap size={16} />
            </div>
            <div>
              <h4 className="pillar-title">Instantáneo</h4>
              <p className="pillar-desc">Abre archivos pesados al instante sin que se congele tu pantalla.</p>
            </div>
          </div>

          <div className="studio-pillar-item">
            <div className="pillar-icon-box" style={{ color: 'var(--status-active)' }}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <h4 className="pillar-title">Totalmente Privado</h4>
              <p className="pillar-desc">Tus datos no van a ningún servidor; todo se procesa seguro en tu equipo.</p>
            </div>
          </div>

          <div className="studio-pillar-item">
            <div className="pillar-icon-box" style={{ color: 'var(--brand-primary)' }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="pillar-title">Corrige Errores Fácil</h4>
              <p className="pillar-desc">Elimina filas repetidas, alinea columnas y arregla fechas con un clic.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
