import React from 'react';

interface SettingsModalProps {
  theme: string;
  setTheme: (val: string) => void;
  deferredPrompt: any;
  setDeferredPrompt: (val: any) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ theme, setTheme, deferredPrompt, setDeferredPrompt, onClose }) => {
  return (
    <div className="tag-edit-overlay fade-in" onClick={onClose}>
      <div className="tag-edit-modal settings-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ color: 'var(--accent)', marginBottom: '20px' }}>Nastavení</h2>
        <div className="settings-content">
          <label className="field-label">Vzhled aplikace</label>
          <select className="custom-input" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ marginBottom: '20px' }}>
            <option value="dark">Tmavý</option>
            <option value="light">Světlý</option>
          </select>
          {deferredPrompt && (
            <button className="btn accent-btn small-btn" onClick={() => { deferredPrompt.prompt(); setDeferredPrompt(null); onClose(); }}>
              INSTALOVAT DO MOBILU
            </button>
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: '30px' }}>
          <button className="btn success-btn" onClick={onClose}>ZAVŘÍT</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;