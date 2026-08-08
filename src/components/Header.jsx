import React from 'react';
import { Sun, Moon } from 'lucide-react';
import Logo from './Logo';

export default function Header({ activeTab, setActiveTab, theme, toggleTheme }) {
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
          <Logo size={38} />
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

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme} 
          className="btn-icon" 
          style={{ position: 'absolute', right: '32px' }}
          title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
