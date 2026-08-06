import React, { useState, useRef } from 'react';
import { Upload, Lock } from 'lucide-react';
import logoSvg from '../data forge.svg';

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
        onShowNotification("Tipo de archivo no reconocido", "error");
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)', justifyContent: 'center', alignItems: 'center', padding: '40px 24px' }}>
      <div style={{ maxWidth: '800px', width: '100%' }}>

        {/* Main Hero Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <img src={logoSvg} alt="Data Forge Logo" style={{ width: '110px', height: '110px', objectFit: 'contain', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#000000', marginBottom: '14px' }}>
            Data Forge
          </h1>
          <p style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: '#1a1c1d', maxWidth: '640px', margin: '0 auto', lineHeight: 1.3 }}>
            Donde la evidencia se forja dato a dato.
          </p>
        </div>

        {/* Central Drag & Drop Container */}
        <div
          className={`dropzone-container ${dragActive ? 'active' : ''}`}
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

          <div style={{ width: '52px', height: '52px', backgroundColor: '#000000', color: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Upload size={24} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: '#000000', marginBottom: '6px' }}>
            Arrastra y suelta tu archivo CSV o XLSX aquí
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Soporte para formatos .csv y .xlsx
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ backgroundColor: '#000000', color: '#ffffff', padding: '10px 24px', fontSize: '13px', borderRadius: 'var(--radius-pill)', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current && fileInputRef.current.click();
              }}
            >
              <Upload size={14} />
              <span>Seleccionar archivo</span>
            </button>
          </div>
        </div>

        {/* Mensaje de privacidad y seguridad local */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '12px', 
          marginTop: '32px', 
          color: 'var(--text-muted)', 
          fontSize: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          padding: '12px 18px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          maxWidth: '520px',
          margin: '32px auto 0'
        }}>
          <Lock size={15} style={{ color: 'var(--status-active)', flexShrink: 0 }} />
          <span style={{ textAlign: 'left', lineHeight: 1.4 }}>
            <strong>Seguridad y Privacidad Local:</strong> Tus archivos nunca se suben a ningún servidor. Todo el análisis, saneamiento y tratamiento de tus datos se procesa de forma 100% privada directamente en tu navegador.
          </span>
        </div>
      </div>
    </div>
  );
}
