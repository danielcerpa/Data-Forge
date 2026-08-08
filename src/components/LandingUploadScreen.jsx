import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Lock, 
  Database, 
  FileText, 
  BarChart2, 
  LineChart, 
  Table, 
  Terminal, 
  Cpu, 
  Settings, 
  Folder, 
  Code 
} from 'lucide-react';
import Logo from './Logo';

// Combined SVGIcons: user's custom check/plus/shield SVGs + additional data-related technical icons
const SVGIcons = [
  // grid-2x2-check (user's SVG)
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
      <path d="M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3"/>
      <path d="m16 19 2 2 4-4"/>
    </svg>
  ),
  // grid-2x2-plus (user's SVG)
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
      <path d="M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3"/>
      <path d="M16 19h6"/>
      <path d="M19 22v-6"/>
    </svg>
  ),
  // shield-check (user's SVG)
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  // Additional technical data icons
  () => <Database size="100%" strokeWidth={1.5} />,
  () => <FileText size="100%" strokeWidth={1.5} />,
  () => <BarChart2 size="100%" strokeWidth={1.5} />,
  () => <LineChart size="100%" strokeWidth={1.5} />,
  () => <Table size="100%" strokeWidth={1.5} />,
  () => <Terminal size="100%" strokeWidth={1.5} />,
  () => <Cpu size="100%" strokeWidth={1.5} />,
  () => <Settings size="100%" strokeWidth={1.5} />,
  () => <Folder size="100%" strokeWidth={1.5} />,
  () => <Code size="100%" strokeWidth={1.5} />
];

export default function LandingUploadScreen({ onFileLoaded, onShowNotification }) {
  const [dragActive, setDragActive] = useState(false);
  const [encoding, setEncoding] = useState('utf-8');
  const fileInputRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    const handleGlobalMouseMove = (e) => {
      setMousePos({
        x: e.clientX,
        y: e.clientY
      });
    };

    const handleGlobalMouseLeave = () => {
      setMousePos({ x: -1000, y: -1000 });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
    };
  }, []);

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
    <div 
      style={{ position: 'relative', width: '100%', minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', overflow: 'hidden' }}
    >
      
      {/* Tapestry background pattern - Diagonal Staggered Layout */}
      {(() => {
        let cols = 20;
        let rows = 14;
        if (windowSize.width < 600) {
          cols = 6;
          rows = 10;
        } else if (windowSize.width < 1000) {
          cols = 12;
          rows = 12;
        }
        const totalCells = cols * rows;

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: '40px',
            padding: '0px',
            opacity: 0.8,
            pointerEvents: 'none',
            zIndex: 0,
            userSelect: 'none',
            justifyItems: 'center',
            alignItems: 'center'
          }}>
            {Array.from({ length: totalCells }).map((_, idx) => {
              const row = Math.floor(idx / cols);
              const col = idx % cols;
              // Checkerboard pattern (row + col is even) to create perfect diagonals
              const isShow = (row + col) % 2 === 0;
              if (!isShow) return <div key={idx} style={{ width: '28px', height: '28px' }} />;

              // Calculate center coordinates of the grid cell in pixels with 0px padding
              const colWidth = windowSize.width / cols;
              const rowHeight = windowSize.height / rows;
              const iconX = colWidth * col + colWidth / 2;
              const iconY = rowHeight * row + rowHeight / 2;

          // Distance to mouse
          const dx = mousePos.x - iconX;
          const dy = mousePos.y - iconY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Radial glow radius (200px)
          const glowRadius = 200;
          const glow = Math.max(0, 1 - distance / glowRadius);

          const IconComponent = SVGIcons[idx % SVGIcons.length];
          return (
            <div 
              key={idx} 
              className="tapestry-icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: glow > 0 ? 'var(--brand-primary)' : 'var(--text-muted)',
                opacity: `calc(var(--tapestry-opacity) + ${glow * 0.8})`,
                transition: 'color 0.15s ease, opacity 0.15s ease, transform 0.15s ease',
                transform: `scale(${1 + glow * 0.25})`,
                width: '28px',
                height: '28px'
              }}
            >
              <IconComponent />
            </div>
          );
        })}
          </div>
        );
      })()}

      <div style={{ maxWidth: '800px', width: '100%', zIndex: 1 }}>
        {/* Main Hero Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <Logo size={110} style={{ marginBottom: '20px' }} />
          <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: '14px' }}>
            Data Forge
          </h1>
          <p style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.3 }}>
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

          <div style={{ width: '52px', height: '52px', backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Upload size={24} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Arrastra y suelta tu archivo CSV o XLSX aquí
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            o <span style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'underline' }}>selecciona uno de tus archivos locales</span>
          </p>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Soporta formatos .csv, .xls y .xlsx
          </span>
        </div>

        {/* Mensaje de privacidad y seguridad local */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '12px', 
          marginTop: '32px', 
          color: 'var(--text-secondary)', 
          fontSize: '12px',
          backgroundColor: 'var(--bg-surface-subtle)',
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
