import React from 'react';
import { Recipe } from '../types';

interface RecipeDetailProps {
  selectedRecipe: Recipe;
  effectiveData: any;
  viewHistoryIndex: number | null;
  setViewHistoryIndex: (val: number | null) => void;
  viewServings: number;
  setViewServings: (val: number) => void;
  myIngredients: {[key: string]: string};
  onDelete: (id: number) => void;
  onEdit: (recipe: Recipe) => void;
  onShare: (e: React.MouseEvent, id: number) => void;
  onBackToCurrent: () => void;
  renderStepWithIngredients: (text: string) => React.ReactNode;
}

const RecipeDetail: React.FC<RecipeDetailProps> = ({
  selectedRecipe, effectiveData, viewHistoryIndex, setViewHistoryIndex,
  viewServings, setViewServings, myIngredients, onDelete, onEdit, onShare,
  onBackToCurrent, renderStepWithIngredients
}) => {
  return (
    <div className="fade-in detail-view">
      {selectedRecipe.history && selectedRecipe.history.length > 0 && (
        <div className="version-bar">
          <label className="field-label">Zvolit verzi:</label>
          <select className="custom-input" value={viewHistoryIndex === null ? "current" : viewHistoryIndex} onChange={(e) => setViewHistoryIndex(e.target.value === "current" ? null : parseInt(e.target.value))}>
            <option value="current">{selectedRecipe.history.length + 1} (Aktuální)</option>
            {selectedRecipe.history.map((h, idx) => (
              <option key={idx} value={idx}>Verze {h.versionLabel || (selectedRecipe.history.length - idx)}</option>
            ))}
          </select>
        </div>
      )}

      <h2>
        {effectiveData.name} 
        {viewHistoryIndex !== null && <span className="archive-label">(ARCHIVNÍ VERZE)</span>}
      </h2>

      <div className="detail-grid">
        <div className="detail-left">
          <div className="servings-control">
            <label className="field-label">Porce:</label>
            <div className="counter-row">
              <button className="counter-btn" onClick={() => setViewServings(Math.max(1, viewServings - 1))}>−</button>
              <span className="counter-value">{viewServings}</span>
              <button className="counter-btn" onClick={() => setViewServings(viewServings + 1)}>+</button>
            </div>
          </div>

          <label className="field-label">Suroviny:</label>
          <div className="tag-container">
            {effectiveData.ingredients.map((i: any, idx: number) => {
              const myVal = myIngredients[i.name.toLowerCase()];
              let statusClass = 'tag-miss';
              if (myVal !== undefined) {
                if (myVal === "" || parseFloat(myVal) >= parseFloat(i.amount)) statusClass = 'tag-have';
              }
              return (
                <span key={idx} className={`tag ${statusClass}`}>
                  {i.name} ({i.amount} {i.unit})
                </span>
              );
            })}
          </div>
        </div>

        <div className="detail-right">
          <label className="field-label">Postup:</label>
          {effectiveData.sections.map((section: any, sIdx: number) => (
            <div key={sIdx} className="recipe-section">
              <h4 className="section-title">{section.title}</h4>
              {section.content.map((step: string, idx: number) => (
                <div key={idx} className="step-item">
                  <div className="step-num">{idx + 1}</div>
                  <div className="step-txt">{renderStepWithIngredients(step)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card-actions-row">
        {viewHistoryIndex === null ? (
          <>
            <button className="btn danger-btn" onClick={() => onDelete(selectedRecipe.id)}>Smazat</button>
            <button className="btn accent-btn" onClick={() => onEdit(selectedRecipe)}>Upravit</button>
            <button className="btn share-btn" onClick={(e) => onShare(e, selectedRecipe.id)}>Sdílet</button>
          </>
        ) : (
          <button className="btn secondary-btn" onClick={onBackToCurrent}>Zpět na aktuální</button>
        )}
      </div>
    </div>
  );
};

export default RecipeDetail;