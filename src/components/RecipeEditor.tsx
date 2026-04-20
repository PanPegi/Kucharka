import React, { useState } from 'react';
import { Recipe, Ingredient, RecipeData } from '../types';

interface RecipeEditorProps {
  editId: number | null;
  recipes: Recipe[];
  allIngredientNames: string[];
  allCategories: string[];
  onSave: (newData: RecipeData) => void;
  onCancel: () => void;
  viewServings: number;
}

const commonUnits = ['g', 'kg', 'ml', 'l', 'ks', 'lžíce', 'lžička', 'hrst', 'špetka', 'balení'];

const RecipeEditor: React.FC<RecipeEditorProps> = ({ 
  editId, recipes, allIngredientNames, allCategories, onSave, onCancel, viewServings: initialViewServings 
}) => {
  const existingRecipe = recipes.find(r => r.id === editId);

  // --- INTERNÍ STAVY EDITORU ---
  const [modalStep, setModalStep] = useState(1);
  const [editName, setEditName] = useState(existingRecipe?.name || '');
  const [editCategoryList, setEditCategoryList] = useState<string[]>(existingRecipe?.categories || ['']);
  const [editPrep, setEditPrep] = useState(existingRecipe?.prepTime || '');
  const [editCook, setEditCook] = useState(existingRecipe?.cookTime || '');
  const [editServings, setEditServings] = useState<string>(existingRecipe?.baseServings.toString() || '1');
  const [editIngs, setEditIngs] = useState<Ingredient[]>(existingRecipe?.ingredients || [{ name: '', amount: '', unit: '' }]);
  const [editSelectedSubIds, setEditSelectedSubIds] = useState<number[]>(existingRecipe?.subRecipeIds || []);
  const [editSteps, setEditSteps] = useState<string[]>(existingRecipe?.steps || ['']);
  const [subSearch, setSubSearch] = useState('');
  const [editingTag, setEditingTag] = useState<{ stepIdx: number, tagRaw: string, name: string, amount: string, unit: string } | null>(null);

  // --- POMOCNÉ FUNKCE PRO VALIDACI VSTUPŮ ---

  // Povolí jen čísla a maximálně jednu tečku
  const cleanNumericInput = (val: string) => {
    let cleaned = val.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleTextOnlyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/[0-9]/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Validace kroků
  const isStep1Valid = 
    editName.trim() !== "" && 
    editPrep !== "" && 
    editCook !== "" && 
    editCategoryList.every(c => c.trim() !== "") &&
    editIngs.every(i => i.name.trim() !== "");

  const isStep2Valid = editSteps.every(s => s.trim() !== "");

  const handleLocalSave = () => {
    const ingredientTotals = new Map<string, { amount: number, unit: string }>();
    const usedSubRecipeIds = new Set<number>();

    editSteps.forEach(step => {
      const regex = /\{\{(?:RECIPE:(\d+):|)(.*?)\|(.*?)\|(.*?)\}\}/g;
      let match;
      while ((match = regex.exec(step)) !== null) {
        const subRecipeIdStr = match[1];
        const name = match[2].trim();
        const amount = parseFloat(match[3]);
        const unit = match[4].trim();

        if (subRecipeIdStr) {
          usedSubRecipeIds.add(parseInt(subRecipeIdStr));
        } else if (!isNaN(amount)) {
          const key = name.toLowerCase();
          const existing = ingredientTotals.get(key);
          if (existing) {
            existing.amount += amount;
          } else {
            ingredientTotals.set(key, { amount, unit });
          }
        }
      }
    });

    const extractedIngredients: Ingredient[] = [];
    editIngs.forEach(ing => {
      const key = ing.name.toLowerCase();
      if (ingredientTotals.has(key)) {
        const total = ingredientTotals.get(key)!;
        extractedIngredients.push({ 
          name: ing.name, 
          amount: (Math.round(total.amount * 10) / 10).toString(), 
          unit: total.unit 
        });
      }
    });

    onSave({
      name: editName.trim(),
      categories: editCategoryList.map(c => c.trim().toLowerCase()).filter(c => c !== ""),
      prepTime: editPrep,
      cookTime: editCook,
      baseServings: parseFloat(editServings) || 1,
      ingredients: extractedIngredients,
      subRecipeIds: editSelectedSubIds.filter(id => usedSubRecipeIds.has(id)),
      steps: editSteps.filter(s => s.trim() !== ""),
      updatedAt: Date.now()
    });
  };

  const handleTagClick = (stepIdx: number, tagRaw: string) => {
    const content = tagRaw.slice(2, -2).split('|');
    setEditingTag({ stepIdx, tagRaw, name: content[0], amount: content[1] || "", unit: content[2] || "" });
  };

  return (
    <div className="fade-in">
      {modalStep === 1 ? (
        <div>
          <h2>{editId ? 'Upravit recept' : 'Nový recept'}</h2>
          
          <label className="field-label">Jméno jídla</label>
          <input className="custom-input" value={editName} onChange={e => setEditName(e.target.value)} />
          
          <label className="field-label">Kategorie</label>
          {editCategoryList.map((cat, idx) => (
            <div key={idx} className="ing-edit-row">
              <input 
                className="custom-input" 
                value={cat} 
                list="modal-cat-list" 
                onChange={e => { 
                  const newList = [...editCategoryList]; 
                  newList[idx] = e.target.value; 
                  setEditCategoryList(newList); 
                }} 
              />
              {idx !== 0 && (
                <button className="remove-row-btn" onClick={() => setEditCategoryList(editCategoryList.filter((_, i) => i !== idx))}>-</button>
              )}
            </div>
          ))}
          <datalist id="modal-cat-list">
            {allCategories.map(c => <option key={c} value={c} />)}
          </datalist>
          <button className="btn secondary-btn small-btn" style={{ marginBottom: '15px' }} onClick={() => setEditCategoryList([...editCategoryList, ''])}>+ KATEGORIE</button>

          <div className="editor-row">
            <div className="flex-1">
              <label className="field-label">Základní porce</label>
              <input 
                className="custom-input" 
                type="text" 
                inputMode="decimal"
                value={editServings} 
                onKeyDown={handleNumericKeyDown}
                onChange={e => setEditServings(cleanNumericInput(e.target.value))} 
              />
            </div>
            <div className="flex-1">
              <label className="field-label">Příprava (min)</label>
              <input 
                className="custom-input" 
                type="text" 
                inputMode="numeric"
                value={editPrep} 
                onKeyDown={handleNumericKeyDown}
                onChange={e => setEditPrep(cleanNumericInput(e.target.value))} 
              />
            </div>
            <div className="flex-1">
              <label className="field-label">Vaření (min)</label>
              <input 
                className="custom-input" 
                type="text" 
                inputMode="numeric"
                value={editCook} 
                onKeyDown={handleNumericKeyDown}
                onChange={e => setEditCook(cleanNumericInput(e.target.value))} 
              />
            </div>
          </div>

          <label className="field-label">Seznam použitých surovin</label>
          {editIngs.map((ing, idx) => (
            <div key={idx} className="ing-edit-row">
              <input className="custom-input" value={ing.name} list="modal-ing-names" onChange={e => { const n = [...editIngs]; n[idx].name = e.target.value; setEditIngs(n); }} />
              <button className="remove-row-btn" onClick={() => setEditIngs(editIngs.filter((_, i) => i !== idx))}>-</button>
            </div>
          ))}
          <datalist id="modal-ing-names">{allIngredientNames.map(i => <option key={i} value={i} />)}</datalist>
          
          <div className="editor-step-actions">
            <button className="btn secondary-btn small-btn" onClick={() => setEditIngs([...editIngs, {name:'', amount:'', unit:''}])}>+ DALŠÍ SUROVINA</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn secondary-btn" onClick={onCancel}>ZRUŠIT</button>
              <button className={`btn accent-btn next-step-btn ${!isStep1Valid ? 'disabled' : ''}`} onClick={() => isStep1Valid && setModalStep(2)}>DALŠÍ KROK →</button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2>Postup</h2>
          {editSteps.map((s, idx) => (
            <div key={idx} className="editor-step-card">
              <div className="step-header">
                <div className="step-num-small">{idx + 1}</div>
                <div className="textarea-container">
                  <textarea 
                    className="textarea-common textarea-real" 
                    value={s} 
                    onChange={e => { const n = [...editSteps]; n[idx] = e.target.value; setEditSteps(n); }} 
                  />
                  <div className="textarea-common textarea-visual">
                    {s.split(/(\{\{.*?\}\})/g).map((part, i) => part.startsWith('{{') ? (
                      <span key={i} className={`editor-tag ${part.includes('RECIPE:') ? 'editor-tag-recipe' : ''}`} onMouseDown={(e) => { e.preventDefault(); handleTagClick(idx, part); }}>
                        {part.slice(2,-2).split('|')[1]} {part.slice(2,-2).split('|')[2]} {part.includes('RECIPE:') ? part.slice(2,-2).split('|')[0].split(':')[2] : part.slice(2,-2).split('|')[0]}
                      </span>
                    ) : part)}
                  </div>
                </div>
                {idx !== 0 && <button className="remove-row-btn" onClick={() => setEditSteps(editSteps.filter((_, i) => i !== idx))}>-</button>}
              </div>
              <div className="step-insert-panel">
                <select id={`ing-name-select-${idx}`} className="custom-input flex-2">
                  <optgroup label="SUROVINY">{editIngs.filter(i => i.name.trim() !== "").map((ing, iIdx) => <option key={iIdx} value={ing.name}>{ing.name}</option>)}</optgroup>
                  <optgroup label="PODRECEPTY">{recipes.filter(r => editSelectedSubIds.includes(r.id)).map(r => <option key={r.id} value={`RECIPE:${r.id}:${r.name}`}>{r.name}</option>)}</optgroup>
                </select>
                <input 
                  id={`ing-val-input-${idx}`} 
                  type="text" 
                  inputMode="decimal"
                  className="custom-input flex-1" 
                  placeholder="Mn." 
                  onKeyDown={handleNumericKeyDown}
                  onChange={(e) => { e.target.value = cleanNumericInput(e.target.value); }}
                />
                <input 
                  id={`ing-unit-select-${idx}`} 
                  className="custom-input flex-1" 
                  placeholder="Jedn." 
                  list={`units-${idx}`} 
                  onKeyDown={handleTextOnlyKeyDown}
                  onChange={e => { e.target.value = e.target.value.replace(/[0-9]/g, ''); }}
                />
                <datalist id={`units-${idx}`}>{commonUnits.map(u => <option key={u} value={u} />)}</datalist>
                <button className="btn insert-btn" onClick={() => {
                  const sel = document.getElementById(`ing-name-select-${idx}`) as any;
                  const val = document.getElementById(`ing-val-input-${idx}`) as any;
                  const unit = document.getElementById(`ing-unit-select-${idx}`) as any;
                  if (!sel.value || !val.value) return alert("Vyberte položku a zadejte množství.");
                  const n = [...editSteps]; n[idx] = n[idx] + (n[idx].length > 0 && !n[idx].endsWith(' ') ? ' ' : '') + `{{${sel.value}|${val.value}|${unit.value}}}`;
                  setEditSteps(n); val.value = ""; unit.value = "";
                }}>VLOŽIT</button>
              </div>
            </div>
          ))}
          <button className="btn secondary-btn small-btn add-step-btn" onClick={() => setEditSteps([...editSteps, ''])}>+ PŘIDAT KROK</button>
          <div className="editor-footer-actions">
            <button className="btn secondary-btn flex-1" onClick={() => setModalStep(1)}>← ZPĚT</button>
            <button className={`btn success-btn flex-2 ${!isStep2Valid ? 'disabled' : ''}`} onClick={() => isStep2Valid && handleLocalSave()}>ULOŽIT RECEPT</button>
          </div>
        </div>
      )}

      {editingTag && (
        <div className="tag-edit-overlay">
          <div className="tag-edit-modal">
            <h3>Upravit položku</h3>
            <div className="editor-row">
              <div className="flex-1">
                <label className="field-label">Množství</label>
                <input 
                  className="custom-input" 
                  type="text" 
                  inputMode="decimal"
                  value={editingTag.amount} 
                  onKeyDown={handleNumericKeyDown}
                  onChange={e => setEditingTag({...editingTag, amount: cleanNumericInput(e.target.value)})} 
                />
              </div>
              <div className="flex-1">
                <label className="field-label">Jednotka</label>
                <input 
                  className="custom-input" 
                  value={editingTag.unit} 
                  onKeyDown={handleTextOnlyKeyDown}
                  onChange={e => setEditingTag({...editingTag, unit: e.target.value.replace(/[0-9]/g, '')})} 
                />
              </div>
            </div>
            <div className="modal-actions-list">
              <button className="btn success-btn" onClick={() => { 
                const n = [...editSteps]; 
                n[editingTag.stepIdx] = n[editingTag.stepIdx].replace(editingTag.tagRaw, `{{${editingTag.name}|${editingTag.amount}|${editingTag.unit}}}`); 
                setEditSteps(n); setEditingTag(null); 
              }}>ULOŽIT</button>
              <button className="btn danger-btn" onClick={() => { 
                const n = [...editSteps]; 
                n[editingTag.stepIdx] = n[editingTag.stepIdx].replace(editingTag.tagRaw, ""); 
                setEditSteps(n); setEditingTag(null); 
              }}>SMAZAT</button>
              <button className="btn secondary-btn" onClick={() => setEditingTag(null)}>ZRUŠIT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeEditor;