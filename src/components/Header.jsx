import React from 'react';
import { Sun, Moon, UploadCloud, Table2, Sliders, FileText, CheckCircle2 } from 'lucide-react';
import Logo from './Logo';

export default function Header({ activeTab, setActiveTab, fileName, rowCount, theme, toggleTheme }) {
  const navItems = [
    { id: 'editor', label: 'Carga', icon: UploadCloud },
    { id: 'table', label: 'Tabla', icon: Table2 },
    { id: 'export', label: 'Limpieza', icon: Sliders }
  ];

  return (
    <header className="app-header">
      <div className="header-content-flex">
        {/* Brand Logo & Name */}
        <div className="brand-logo-container" onClick={() => setActiveTab('table')}>
          <Logo size={32} />
          <span className="brand-title">Data Forge</span>
        </div>

        {/* Floating Segmented Navigation Bar */}
        <nav className="nav-capsule">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-capsule-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Section: Theme Switcher */}
        <div className="header-actions">
          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn" 
            title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
