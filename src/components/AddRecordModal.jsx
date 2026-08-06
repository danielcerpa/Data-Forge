import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';

export default function AddRecordModal({ headers, columnTypes, onAddRecord, onClose }) {
  const [formData, setFormData] = useState(() => {
    const initial = {};
    headers.forEach(h => {
      initial[h] = '';
    });
    return initial;
  });

  const handleChange = (header, val) => {
    setFormData(prev => ({
      ...prev,
      [header]: val
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddRecord(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} color="#000000" />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Agregar nueva fila</h3>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ border: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {headers.map(header => {
              const type = columnTypes[header] || 'string';
              return (
                <div key={header} className="form-group-sm">
                  <label>{header} <span style={{ textTransform: 'lowercase', opacity: 0.6 }}>({type})</span></label>
                  {type === 'boolean' ? (
                    <select
                      className="form-select-sm"
                      value={formData[header]}
                      onChange={e => handleChange(header, e.target.value)}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="true">True / Sí</option>
                      <option value="false">False / No</option>
                    </select>
                  ) : type === 'number' ? (
                    <input
                      type="number"
                      step="any"
                      className="form-select-sm"
                      value={formData[header]}
                      onChange={e => handleChange(header, e.target.value)}
                      placeholder={`Ingrese valor numérico`}
                    />
                  ) : type === 'date' ? (
                    <input
                      type="date"
                      className="form-select-sm"
                      value={formData[header]}
                      onChange={e => handleChange(header, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      className="form-select-sm"
                      value={formData[header]}
                      onChange={e => handleChange(header, e.target.value)}
                      placeholder={`Ingrese ${header}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-surface-subtle)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">
              <PlusCircle size={14} />
              <span>Agregar Registro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
