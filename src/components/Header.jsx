import React from 'react';
import logoSvg from '../data forge.svg';

export default function Header({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'editor', label: 'Carga' },
    { id: 'table', label: 'Tabla' },
    { id: 'export', label: 'Limpieza' }
  ];

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Brand Logo */}
        <div className="brand-logo" onClick={() => setActiveTab('table')}>
          <img src={logoSvg} alt="Data Forge Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
          <span>Data Forge</span>
        </div>

        {/* Minimal Forge Navigation */}
        <nav className="nav-pills">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-pill-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
