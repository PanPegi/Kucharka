import React, { useState, useRef } from 'react';
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

  const [modalStep, setModalStep] = useState(1);
  const [editName, setEditName] = useState(existingRecipe?.name || '');
  const [editCategoryList, setEditCategoryList] = useState<string[]>(existingRecipe?.categories || ['']);
  const [editPrep, setEditPrep] = useState(existingRecipe?.prepTime || '');
  const [editCook, setEditCook] = useState(existingRecipe?.cookTime || '');
  const [editServings, setEditServings] = useState<number>(existingRecipe?.baseServings || 1);
  const [editIngs, setEditIngs] = useState<Ingredient[]>(existingRecipe?.ingredients || [{ name: '', amount: '', unit: '' }]);
  const [editSelectedSubIds, setEditSelectedSubIds] = useState<number[]>(existingRecipe?.subRecipeIds || []);
  const [editSteps, setEditSteps] = useState<string[]>(existingRecipe?.steps || ['']);
  const [subSearch, setSubSearch] = useState('');
  const [editingTag, setEditingTag] = useState<{ stepIdx: number, tagRaw: string, name: string, amount: string, unit: string } | null>(null);

  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const visualRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cursorPositions, setCursorPositions] = useState<Record<number, { top: number, left: number } | null>>({});

  const updateCursor = (idx: number) => {
    const textarea = textareaRefs.current[idx];
    const visual = visualRefs.current[idx];
    if (!textarea || !visual) return;

    const pos = textarea.selectionStart;
    const textBefore = textarea.value.slice(0, pos);
    const computed = window.getComputedStyle(visual);

    const mirror = document.createElement('div');
    mirror.style.position = 'fixed';
    mirror.style.visibility = 'hidden';
    mirror.style.zIndex = '-1';
    mirror.style.top = '0px';
    mirror.style.left = '0px';
    mirror.style.width = visual.offsetWidth + 'px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.paddingTop = computed.paddingTop;
    mirror.style.paddingBottom = computed.paddingBottom;
    mirror.style.paddingLeft = computed.paddingLeft;
    mirror.style.paddingRight = computed.paddingRight;
    mirror.style.boxSizing = computed.boxSizing;

    const tagRegex = /\{\{.*?\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(textBefore)) !== null) {
      mirror.appendChild(document.createTextNode(textBefore.slice(lastIndex, match.index)));

      const realSpan = Array.from(visual.querySelectorAll('[data-raw]')).find(
        el => el.getAttribute('data-raw') === match![0]
      ) as HTMLElement;

      const fakeSpan = document.createElement('span');
      fakeSpan.style.display = 'inline-block';
      fakeSpan.style.width = realSpan ? realSpan.offsetWidth + 'px' : '0px';
      fakeSpan.style.height = realSpan ? realSpan.offsetHeight + 'px' : '1em';
      fakeSpan.style.verticalAlign = 'bottom';
      fakeSpan.textContent = '\u200b';
      mirror.appendChild(fakeSpan);

      lastIndex = match.index + match[0].length;
    }

    mirror.appendChild(document.createTextNode(textBefore.slice(lastIndex)));

    const cursorSpan = document.createElement('span');
    cursorSpan.textContent = '\u200b';
    mirror.appendChild(cursorSpan);

    document.body.appendChild(mirror);

    const mirrorRect = mirror.getBoundingClientRect();
    const spanRect = cursorSpan.getBoundingClientRect();

    document.body.removeChild(mirror);

    const allTags = /\{\{.*?\}\}/g;
    let tagMatch;
    let adjustedPos = pos;
    while ((tagMatch = allTags.exec(textarea.value)) !== null) {
      const start = tagMatch.index;
      const end = tagMatch.index + tagMatch[0].length;
      if (adjustedPos > start && adjustedPos < end) {
        adjustedPos = end;
        requestAnimationFrame(() => {
          textarea.selectionStart = end;
          textarea.selectionEnd = end;
        });
        break;
      }
    }

    setCursorPositions(prev => ({
      ...prev,
      [idx]: {
        top: spanRect.top - mirrorRect.top + visual.scrollTop,
        left: spanRect.left - mirrorRect.left
      }
    }));
  };

  const handleNumericInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
    if (allowed.includes(e.key)) return;
    if (e.key === '.' && !(e.currentTarget.value.includes('.'))) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  const isStep1Valid =
    editName.trim() !== "" &&
    editPrep !== "" &&
    editCook !== "" &&
    editCategoryList.every(c => c.trim() !== "") &&
    editIngs.every(i => i.name.trim() !== "");

  const isStep2Valid = editSteps.every(s => s.trim() !== "");

  const handleLocalSave = () => {
    const ingredientTotals = new Map<string, { amount: number, unit: string }>();

    editSteps.forEach(step => {
      const regex = /\{\{(?!RECIPE:)(.*?)\|(.*?)\|(.*?)\}\}/g;
      let match;
      while ((match = regex.exec(step)) !== null) {
        const name = match[1].trim();
        const amount = parseFloat(match[2].replace(',', '.'));
        const unit = match[3].trim();
        if (name && !isNaN(amount)) {
          const key = name.toLowerCase();
          const existing = ingredientTotals.get(key);
          if (existing) existing.amount += amount;
          else ingredientTotals.set(key, { amount, unit });
        }
      }
    });

    const extractedIngredients: Ingredient[] = editIngs
      .filter(ing => ing.name.trim() !== '')
      .map(ing => {
        const key = ing.name.toLowerCase();
        const total = ingredientTotals.get(key);
        return {
          name: ing.name,
          amount: total ? (Math.round(total.amount * 10) / 10).toString() : '0',
          unit: total ? total.unit : ing.unit
        };
      })
      .filter(ing => parseFloat(ing.amount) > 0);

    onSave({
      name: editName.trim(),
      categories: editCategoryList.map(c => c.trim().toLowerCase()).filter(c => c !== ""),
      prepTime: editPrep,
      cookTime: editCook,
      baseServings: editServings,
      ingredients: extractedIngredients,
      subRecipeIds: editSelectedSubIds,
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
              <input className="custom-input" value={cat} list="modal-cat-list" onChange={e => { const newList = [...editCategoryList]; newList[idx] = e.target.value; setEditCategoryList(newList); }} />
              {idx !== 0 && (
                <button className="remove-row-btn" onClick={() => setEditCategoryList(editCategoryList.filter((_, i) => i !== idx))}>-</button>
              )}
            </div>
          ))}
          <datalist id="modal-cat-list">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
          <button className="btn secondary-btn small-btn" style={{ marginBottom: '15px' }} onClick={() => setEditCategoryList([...editCategoryList, ''])}>+ KATEGORIE</button>

          <div className="editor-row">
            <div className="flex-1">
              <label className="field-label">Základní porce</label>
              <input className="custom-input" type="text" value={editServings} onChange={e => setEditServings(parseInt(e.target.value) || 1)} onKeyDown={handleNumericInput} />
            </div>
            <div className="flex-1">
              <label className="field-label">Příprava (min)</label>
              <input className="custom-input" type="text" value={editPrep} onChange={e => setEditPrep(e.target.value)} onKeyDown={handleNumericInput} />
            </div>
            <div className="flex-1">
              <label className="field-label">Vaření (min)</label>
              <input className="custom-input" type="text" value={editCook} onChange={e => setEditCook(e.target.value)} onKeyDown={handleNumericInput} />
            </div>
          </div>

          <label className="field-label">Podrecepty:</label>
          <input className="custom-input sub-search" placeholder="Hledat podrecept..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
          <div className="sub-recipe-selector">
            {recipes.filter(r => r.id !== editId && r.name.toLowerCase().includes(subSearch.toLowerCase())).map(r => (
              <button key={r.id} className={`sub-btn ${editSelectedSubIds.includes(r.id) ? 'active' : ''}`} onClick={() => setEditSelectedSubIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}>
                {r.name}
              </button>
            ))}
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
            <button className="btn secondary-btn small-btn" onClick={() => setEditIngs([...editIngs, { name: '', amount: '', unit: '' }])}>+ DALŠÍ SUROVINA</button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn secondary-btn" onClick={onCancel}>ZRUŠIT</button>
              <button className={`btn accent-btn next-step-btn ${!isStep1Valid ? 'disabled' : ''}`} onClick={() => isStep1Valid && setModalStep(2)}>DALŠÍ KROK →</button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h2>Postup</h2>

          <label className="field-label editor-steps-label">Kroky postupu</label>
          {editSteps.map((s, idx) => (
            <div key={idx} className="editor-step-card">
              <div className="step-header">
                <div className="step-num-small">{idx + 1}</div>
                <div className="textarea-container">
                  <textarea

                    ref={el => { textareaRefs.current[idx] = el; }}
                    className="textarea-common textarea-real"
                    value={s}
                    onChange={e => { const n = [...editSteps]; n[idx] = e.target.value; setEditSteps(n); updateCursor(idx); }}
                    onKeyUp={() => updateCursor(idx)}
                    onMouseUp={() => requestAnimationFrame(() => updateCursor(idx))}
                    onFocus={() => updateCursor(idx)}
                    onBlur={() => setCursorPositions(prev => ({ ...prev, [idx]: null }))}
                    onScroll={e => { (e.target as any).nextElementSibling.scrollTop = (e.target as any).scrollTop; updateCursor(idx); }}
                    onKeyDown={e => {
                      const textarea = e.currentTarget;
                      const pos = textarea.selectionStart;
                      const visual = visualRefs.current[idx];
                      const val = textarea.value;
                      const tagRegex = /\{\{.*?\}\}/g;
                      let match;

                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();

                        const lineHeight = parseFloat(window.getComputedStyle(visual!).lineHeight) || 20;

                        // Zjisti aktuální pozici kurzoru přes mirror
                        const computed = window.getComputedStyle(visual!);
                        const buildMirror = (upTo: number) => {
                          const m = document.createElement('div');
                          // přidej border aby rozměry seděly s visual divem
                          const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
                          const borderRight = parseFloat(computed.borderRightWidth) || 0;
                          m.style.cssText = `position:fixed;visibility:hidden;z-index:-1;top:0;left:0;
    width:${visual!.clientWidth}px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;overflow:hidden;
    font-family:${computed.fontFamily};font-size:${computed.fontSize};
    line-height:${computed.lineHeight};padding-top:${computed.paddingTop};
    padding-bottom:${computed.paddingBottom};padding-left:${computed.paddingLeft};
    padding-right:${computed.paddingRight};box-sizing:content-box;`;
                          m.textContent = val.slice(0, upTo);
                          const s = document.createElement('span');
                          s.textContent = '\u200b';
                          m.appendChild(s);
                          document.body.appendChild(m);
                          const mr = m.getBoundingClientRect();
                          const sr = s.getBoundingClientRect();
                          document.body.removeChild(m);
                          return { top: sr.top - mr.top, left: sr.left - mr.left };
                        };

                        const current = buildMirror(pos);
                        const targetTop = e.key === 'ArrowUp' ? current.top - lineHeight : current.top + lineHeight;

                        let bestPos = pos;
                        let bestDist = Infinity;
                        const step = 1;

                        for (let i = 0; i <= val.length; i += step) {
                          const { top, left } = buildMirror(i);
                          const dist = Math.abs(top - targetTop) * 10 + Math.abs(left - current.left);
                          if (dist < bestDist) {
                            bestDist = dist;
                            bestPos = i;
                          }
                        }

                        requestAnimationFrame(() => {
                          textarea.selectionStart = bestPos;
                          textarea.selectionEnd = bestPos;
                          updateCursor(idx);
                        });
                        return;
                      }

                      while ((match = tagRegex.exec(val)) !== null) {
                        const start = match.index;
                        const end = match.index + match[0].length;
                        const justAfter = e.key === 'Backspace' && pos === end;
                        const justBefore = e.key === 'Delete' && pos === start;
                        if (justAfter || justBefore) {
                          e.preventDefault();
                          handleTagClick(idx, match[0]);
                          return;
                        }
                        if (e.key === 'ArrowLeft' && pos === end) {
                          e.preventDefault();
                          requestAnimationFrame(() => {
                            textarea.selectionStart = start;
                            textarea.selectionEnd = start;
                            updateCursor(idx);
                          });
                          return;
                        }
                        if (e.key === 'ArrowRight' && pos === start) {
                          e.preventDefault();
                          requestAnimationFrame(() => {
                            textarea.selectionStart = end;
                            textarea.selectionEnd = end;
                            updateCursor(idx);
                          });
                          return;
                        }
                      }
                    }}

                    onMouseDown={e => {
                      const textarea = e.currentTarget;
                      const visual = textarea.nextElementSibling as HTMLDivElement;
                      if (!visual) return;
                      const spans = visual.querySelectorAll('.editor-tag');
                      const x = e.clientX;
                      const y = e.clientY;
                      for (const span of Array.from(spans)) {
                        const rect = span.getBoundingClientRect();
                        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                          e.preventDefault();
                          const tagRaw = span.getAttribute('data-raw');
                          if (tagRaw) handleTagClick(idx, tagRaw);
                          return;
                        }
                      }
                    }}
                  />
                  <div
                    ref={el => { visualRefs.current[idx] = el; }}
                    className="textarea-common textarea-visual"
                    style={{ position: 'relative' }}
                  >
                    {s.split(/(\{\{.*?\}\})/g).map((part, i) => part.startsWith('{{') ? (
                      <span
                        key={i}
                        data-raw={part}
                        className={`editor-tag ${part.includes('RECIPE:') ? 'editor-tag-recipe' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleTagClick(idx, part); }}
                      >
                        {part.slice(2, -2).split('|')[1]} {part.slice(2, -2).split('|')[2]} {part.includes('RECIPE:') ? part.slice(2, -2).split('|')[0].split(':')[2] : part.slice(2, -2).split('|')[0]}
                      </span>
                    ) : part)}
                    {cursorPositions[idx] && (
                      <span style={{
                        position: 'absolute',
                        top: cursorPositions[idx]!.top,
                        left: cursorPositions[idx]!.left,
                        width: '2px',
                        height: '1.2em',
                        background: 'var(--accent)',
                        display: 'inline-block',
                        animation: 'blink 1s step-end infinite',
                        pointerEvents: 'none',
                        verticalAlign: 'text-bottom'
                      }} />
                    )}
                  </div>
                </div>
                {idx !== 0 && (
                  <button className="remove-row-btn" onClick={() => setEditSteps(editSteps.filter((_, i) => i !== idx))}>-</button>
                )}
              </div>
              <div className="step-insert-panel">
                <select id={`ing-name-select-${idx}`} className="custom-input flex-2" onChange={(e) => {
                  const unitInput = document.getElementById(`ing-unit-select-${idx}`) as HTMLInputElement;
                  if (e.target.value.startsWith('RECIPE:')) unitInput.value = 'porce';
                  else unitInput.value = '';
                }}>
                  <optgroup label="SUROVINY">{editIngs.filter(i => i.name.trim() !== "").map((ing, iIdx) => <option key={iIdx} value={ing.name}>{ing.name}</option>)}</optgroup>
                  <optgroup label="PODRECEPTY">{recipes.filter(r => editSelectedSubIds.includes(r.id)).map(r => <option key={r.id} value={`RECIPE:${r.id}:${r.name}`}>{r.name}</option>)}</optgroup>
                </select>
                <input id={`ing-val-input-${idx}`} type="text" className="custom-input flex-1" placeholder="Mn." onKeyDown={handleNumericInput} />
                <input id={`ing-unit-select-${idx}`} className="custom-input flex-1" placeholder="Jedn." list={`units-${idx}`} onChange={(e) => {
                  const sel = document.getElementById(`ing-name-select-${idx}`) as HTMLSelectElement;
                  if (sel?.value.startsWith('RECIPE:')) e.currentTarget.value = 'porce';
                }} />
                <datalist id={`units-${idx}`}>{commonUnits.map(u => <option key={u} value={u} />)}</datalist>
                <button className="btn insert-btn" onClick={() => {
                  const sel = document.getElementById(`ing-name-select-${idx}`) as HTMLSelectElement;
                  const val = document.getElementById(`ing-val-input-${idx}`) as HTMLInputElement;
                  const unit = document.getElementById(`ing-unit-select-${idx}`) as HTMLInputElement;
                  if (!sel.value || !val.value) return alert("Vyberte položku a zadejte množství.");
                  const isRecipe = sel.value.startsWith('RECIPE:');
                  const finalUnit = isRecipe ? 'porce' : unit.value;
                  const tag = `{{${sel.value}|${val.value}|${finalUnit}}}`;

                  const textarea = textareaRefs.current[idx];
                  const n = [...editSteps];

                  if (textarea) {
                    const start = textarea.selectionStart ?? n[idx].length;
                    const end = textarea.selectionEnd ?? n[idx].length;
                    const before = n[idx].slice(0, start);
                    const after = n[idx].slice(end);
                    const prefix = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
                    const suffix = after.length > 0 && !after.startsWith(' ') ? ' ' : '';
                    n[idx] = before + prefix + tag + suffix + after;
                    setEditSteps(n);

                    // Obnov pozici kurzoru za vloženým tagem
                    requestAnimationFrame(() => {
                      const newPos = start + prefix.length + tag.length + suffix.length;
                      textarea.selectionStart = newPos;
                      textarea.selectionEnd = newPos;
                      textarea.focus();
                      updateCursor(idx);
                    });
                  } else {
                    n[idx] = n[idx] + (n[idx].length > 0 && !n[idx].endsWith(' ') ? ' ' : '') + tag;
                    setEditSteps(n);
                  }

                  val.value = "";
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
            <label className="field-label">Položka</label>
            <select className="custom-input" value={editingTag.name} onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}>
              <optgroup label="SUROVINY">{editIngs.map((ing, iIdx) => <option key={iIdx} value={ing.name}>{ing.name}</option>)}</optgroup>
              <optgroup label="PODRECEPTY">{recipes.filter(r => editSelectedSubIds.includes(r.id)).map(r => <option key={r.id} value={`RECIPE:${r.id}:${r.name}`}>{r.name}</option>)}</optgroup>
            </select>
            <div className="editor-row">
              <div className="flex-1"><label className="field-label">Množství</label><input className="custom-input" type="text" value={editingTag.amount} onChange={e => setEditingTag({ ...editingTag, amount: e.target.value })} onKeyDown={handleNumericInput} /></div>
              <div className="flex-1"><label className="field-label">Jednotka</label><input className="custom-input" type="text" value={editingTag.name.startsWith('RECIPE:') ? 'porce' : editingTag.unit} onChange={e => { if (!editingTag.name.startsWith('RECIPE:')) setEditingTag({ ...editingTag, unit: e.target.value }); }} readOnly={editingTag.name.startsWith('RECIPE:')} /></div>
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