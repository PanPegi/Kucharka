import React from 'react';

interface HelpModalProps {
  scene: string;
  helpTexts: { [key: string]: string };
  onClose: () => void;
  onOpenSettings: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ scene, helpTexts, onClose, onOpenSettings }) => {
  return (
    <div className="tag-edit-overlay fade-in" onClick={onClose}>
      <div className="tag-edit-modal help-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ color: 'var(--accent)' }}>Nápověda</h2>
        <div style={{ 
          whiteSpace: 'pre-line', 
          lineHeight: '1.6', 
          fontSize: '0.95rem', 
          color: '#ccc' 
        }}>
          {helpTexts[scene] || "K této sekci momentálně není nápověda k dispozici."}
        </div>
        <div className="modal-actions-row" style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
          <button className="btn success-btn flex-2" onClick={onClose}>ROZUMÍM</button>
          <button className="btn secondary-btn flex-1" onClick={() => { onClose(); onOpenSettings(); }}>⚙️</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;