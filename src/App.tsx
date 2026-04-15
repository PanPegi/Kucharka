import React, { useState, useEffect, useMemo } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import './App.css';

setupIonicReact();

// --- INTERFACES ---

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface RecipeData {
  name: string;
  categories: string[];
  ingredients: Ingredient[];
  subRecipeIds: number[];
  steps: string[]; 
  prepTime: string;
  cookTime: string;
  baseServings: number;
  updatedAt: number;
}

interface Recipe extends RecipeData {
  id: number;
  history: RecipeData[];
}

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  // Rozšíření scén o 'editor'
  const [scene, setScene] = useState<'fridge' | 'results' | 'manage' | 'detail' | 'editor'>('fridge');
  const [prevScene, setPrevScene] = useState<'results' | 'manage' | 'fridge'>('results');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [viewHistoryIndex, setViewHistoryIndex] = useState<number | null>(null);
  const [myIngredients, setMyIngredients] = useState<{[key: string]: string}>(() => 
    JSON.parse(localStorage.getItem('my_fridge') || '{}')
  );
  const [selectedFilterCats, setSelectedFilterCats] = useState<string[]>([]);
  const [categoryLogic, setCategoryLogic] = useState<'AND' | 'OR'>('OR');
  const [viewServings, setViewServings] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  // --- EDITOR STATES (Původně v Modalu) ---
  const [editId, setEditId] = useState<number | null>(null);
  const [modalStep, setModalStep] = useState(1);
  const [editName, setEditName] = useState('');
  const [editCategoryList, setEditCategoryList] = useState<string[]>(['']);
  const [editPrep, setEditPrep] = useState('');
  const [editCook, setEditCook] = useState('');
  const [editServings, setEditServings] = useState<number>(1);
  const [editIngs, setEditIngs] = useState<Ingredient[]>([{ name: '', amount: '', unit: '' }]);
  const [editSelectedSubIds, setEditSelectedSubIds] = useState<number[]>([]);
  const [editSteps, setEditSteps] = useState<string[]>(['']);
  const [subSearch, setSubSearch] = useState('');

  const commonUnits = ['g', 'kg', 'ml', 'l', 'ks', 'lžíce', 'lžička', 'hrst', 'špetka', 'balení'];

  // --- SYNC DATA ---
  const loadData = async () => {
    try {
      const resp = await fetch('load_kucharka.php');
      const data = await resp.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Chyba load:", e); }
  };

  const saveData = async (updatedRecipes: Recipe[]) => {
    try {
      await fetch('save_kucharka.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecipes)
      });
    } catch (e) { console.error("Chyba save:", e); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { localStorage.setItem('my_fridge', JSON.stringify(myIngredients)); }, [myIngredients]);

  // --- COMPUTED ---
  const allIngredientNames = useMemo(() => [...new Set(recipes.flatMap(r => r.ingredients.map(i => i.name)))].sort(), [recipes]);
  const allCategories = useMemo(() => [...new Set(recipes.flatMap(r => r.categories || []))].sort(), [recipes]);

  const matchedRecipes = useMemo(() => {
    return recipes.map(r => {
      let catMatch = true;
      if (selectedFilterCats.length > 0) {
        catMatch = categoryLogic === 'OR' 
          ? r.categories?.some(cat => selectedFilterCats.includes(cat))
          : selectedFilterCats.every(cat => r.categories?.includes(cat));
      }
      if (!catMatch) return { ...r, score: 0, matchedCount: 0 };
      const matched = r.ingredients.filter(ing => {
        const myVal = myIngredients[ing.name.toLowerCase()];
        if (myVal === undefined) return false;
        if (myVal === "") return true;
        const myAmount = parseFloat(myVal);
        const reqAmount = parseFloat(ing.amount);
        return !isNaN(myAmount) && myAmount >= reqAmount;
      });
      const score = r.ingredients.length > 0 ? Math.round((matched.length / r.ingredients.length) * 100) : 0;
      return { ...r, score, matchedCount: matched.length };
    }).filter(r => r.matchedCount > 0).sort((a, b) => b.score - a.score);
  }, [recipes, myIngredients, selectedFilterCats, categoryLogic]);

  const effectiveData = useMemo(() => {
    if (!selectedRecipe) return null;
    const base = viewHistoryIndex === null ? selectedRecipe : selectedRecipe.history[viewHistoryIndex];
    const subRecipes = (base.subRecipeIds || []).map(id => recipes.find(r => r.id === id)).filter((r): r is Recipe => !!r);
    const ingredientMap = new Map<string, number>();
    const processIngs = (ings: Ingredient[], bServings: number) => {
      ings.forEach(ing => {
        const key = `${ing.name.toLowerCase().trim()}|${ing.unit.toLowerCase().trim()}`;
        const amount = parseFloat(ing.amount);
        if (!isNaN(amount)) {
          const scaled = (amount / bServings) * viewServings;
          ingredientMap.set(key, (ingredientMap.get(key) || 0) + scaled);
        }
      });
    };
    subRecipes.forEach(sub => processIngs(sub.ingredients, sub.baseServings));
    processIngs(base.ingredients, base.baseServings);
    const mergedIngredients: Ingredient[] = Array.from(ingredientMap.entries()).map(([key, amount]) => {
      const [name, unit] = key.split('|');
      return { name, amount: (Math.round(amount * 10) / 10).toString(), unit };
    });
    const mergedSections = [
      ...subRecipes.map(sub => ({ title: `PŘÍPRAVA: ${sub.name.toUpperCase()}`, content: sub.steps })),
      { title: `DOKONČENÍ: ${base.name.toUpperCase()}`, content: base.steps }
    ];
    return { ...base, ingredients: mergedIngredients, sections: mergedSections };
  }, [selectedRecipe, viewHistoryIndex, recipes, viewServings]);

  const filteredSubRecipes = useMemo(() => {
    return recipes.filter(r => r.id !== editId && r.name.toLowerCase().includes(subSearch.toLowerCase()));
  }, [recipes, subSearch, editId]);

  const isStep1Valid = useMemo(() => {
    return editName.trim() !== "" && editPrep !== "" && editCook !== "" && editIngs.every(i => i.name.trim() !== "" && i.amount !== "" && i.unit !== "");
  }, [editName, editPrep, editCook, editIngs]);

  const isStep2Valid = useMemo(() => {
    return editCategoryList.every(c => c.trim() !== "") && editSteps.every(s => s.trim() !== "");
  }, [editCategoryList, editSteps]);

  // --- ACTIONS ---
  const openEditor = (recipe: Recipe | null = null) => {
    if (recipe) {
      setEditId(recipe.id);
      setEditName(recipe.name);
      setEditCategoryList(recipe.categories);
      setEditPrep(recipe.prepTime);
      setEditCook(recipe.cookTime);
      setEditServings(recipe.baseServings);
      setEditIngs(recipe.ingredients);
      setEditSelectedSubIds(recipe.subRecipeIds);
      setEditSteps(recipe.steps);
    } else {
      setEditId(null);
      setEditName('');
      setEditCategoryList(['']);
      setEditPrep('');
      setEditCook('');
      setEditServings(1);
      setEditIngs([{ name: '', amount: '', unit: '' }]);
      setEditSelectedSubIds([]);
      setEditSteps(['']);
    }
    setModalStep(1);
    setSubSearch('');
    setScene('editor');
  };

  const handleSave = () => {
    const newData: RecipeData = {
      name: editName,
      categories: editCategoryList.map(c => c.trim().toLowerCase()),
      prepTime: editPrep,
      cookTime: editCook,
      baseServings: editServings,
      ingredients: editIngs,
      subRecipeIds: editSelectedSubIds,
      steps: editSteps,
      updatedAt: Date.now()
    };

    let updated: Recipe[];
    if (editId) {
      updated = recipes.map(r => r.id === editId ? { ...newData, id: editId, history: [r as RecipeData, ...r.history] } : r);
    } else {
      updated = [...recipes, { ...newData, id: Date.now(), history: [] }];
    }
    setRecipes(updated);
    saveData(updated);
    setScene('manage');
  };

  const handleDelete = (id: number) => {
    if (confirm('Smazat tento recept?')) {
      const updated = recipes.filter(x => x.id !== id);
      setRecipes(updated);
      saveData(updated);
      setScene('manage');
    }
  };

  return (
    <IonApp>
      <div id="app-container">
        {/* --- LEDNICE --- */}
        {scene === 'fridge' && (
          <div className="fade-in">
            <h2>Lednice</h2>
            <div className="category-logic-bar">
                <input className="custom-input" placeholder="Hledat kategorii" value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} />
                <div className="logic-toggle" style={{marginTop:'10px'}}>
                    <button className={`logic-btn ${categoryLogic === 'OR' ? 'active' : ''}`} onClick={() => setCategoryLogic('OR')}>JÍDLA OBSAHUJÍCÍ ALESPOŇ JEDNU Z TĚCHTO KATEGORIÍ</button>
                    <button className={`logic-btn ${categoryLogic === 'AND' ? 'active' : ''}`} onClick={() => setCategoryLogic('AND')}>JÍDLA OBSAHUJÍCÍ VŠECHNY TYTO KATEGORIE</button>
                </div>
                <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                  <button className="btn secondary-btn small-btn" onClick={() => {
                    const next: {[key: string]: string} = {};
                    allIngredientNames.forEach(ing => next[ing.toLowerCase()] = "");
                    setMyIngredients(next);
                  }}>VYBRAT VŠE</button>
                  <button className="btn secondary-btn small-btn" onClick={() => setMyIngredients({})}>ZRUŠIT VŠE</button>
                </div>
            </div>
            <div className="category-selection-grid">
                {allCategories.filter(c => c.includes(categorySearchTerm.toLowerCase())).map(cat => (
                    <button key={cat} className={`cat-select-btn ${selectedFilterCats.includes(cat) ? 'selected' : ''}`} onClick={() => setSelectedFilterCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>
                        {cat}
                    </button>
                ))}
            </div>
            <div className="responsive-grid">
                {allIngredientNames.map(ing => (
                    <div key={ing} className="toggle-row-complex">
                        <div className="ing-main">
                            <span className="ing-name">{ing}</span>
                            <label className="switch">
                                <input type="checkbox" checked={myIngredients[ing.toLowerCase()] !== undefined} onChange={() => {
                                    const next = { ...myIngredients };
                                    if (next[ing.toLowerCase()] !== undefined) delete next[ing.toLowerCase()]; else next[ing.toLowerCase()] = "";
                                    setMyIngredients(next);
                                }} />
                                <span className="slider"></span>
                            </label>
                        </div>
                        {myIngredients[ing.toLowerCase()] !== undefined && (
                          <input className="small-amount-input" type="number" placeholder="Množství" value={myIngredients[ing.toLowerCase()]} onChange={(e) => {
                              const next = { ...myIngredients };
                              next[ing.toLowerCase()] = e.target.value;
                              setMyIngredients(next);
                          }} />
                        )}
                    </div>
                ))}
            </div>
            <button className="btn success-btn" style={{marginTop:'20px'}} onClick={() => setScene('results')}>NAJÍT RECEPTY</button>
          </div>
        )}

        {/* --- VÝSLEDKY / KUCHAŘKA --- */}
        {(scene === 'results' || scene === 'manage') && (
          <div className="fade-in">
            <h2>{scene === 'results' ? 'Výsledky' : 'Kuchařka'}</h2>
            {scene === 'manage' && (
                <div className="search-wrapper">
                    <input className="custom-input search-input" placeholder="🔍 Vyhledat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            )}
            <div className="recipe-grid">
                {(scene === 'results' ? matchedRecipes : recipes.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((r: any) => (
                  <div key={r.id} className="recipe-card" onClick={() => {
                      setPrevScene(scene as 'results' | 'manage');
                      setSelectedRecipe(r);
                      setViewHistoryIndex(null);
                      setViewServings(r.baseServings || 1);
                      setScene('detail');
                  }}>
                    <span className="recipe-name">{r.name}</span>
                    <div className="time-info">🕒 {r.prepTime}m | 🔥 {r.cookTime}m</div>
                    {scene === 'results' && <div style={{marginTop: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: r.score === 100 ? 'var(--success)' : 'var(--accent)'}}>Máš {r.score}% surovin</div>}
                    <div className="category-rows">
                        {r.categories?.map((c: string) => <div key={c} className="tag cat-tag">{c}</div>)}
                    </div>
                  </div>
                ))}
            </div>
            <button className="btn secondary-btn" style={{marginTop: '40px'}} onClick={() => setScene('fridge')}>ZPĚT</button>
          </div>
        )}

        {/* --- DETAIL RECEPTU --- */}
        {scene === 'detail' && selectedRecipe && effectiveData && (
          <div className="fade-in detail-view">
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <button className="back-link" onClick={() => openEditor(selectedRecipe)}>Upravit</button>
             </div>
            <h2>{effectiveData.name}</h2>
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
                        {effectiveData.ingredients.map((i, idx) => (
                            <span key={idx} className={`tag ${myIngredients[i.name.toLowerCase()] !== undefined ? 'tag-have' : 'tag-miss'}`}>
                                {i.name} ({i.amount} {i.unit})
                            </span>
                        ))}
                    </div>
                </div>
                <div className="detail-right">
                    <label className="field-label">Postup:</label>
                    {effectiveData.sections.map((section, sIdx) => (
                        <div key={sIdx} className="recipe-section">
                            <h4 className="section-title">{section.title}</h4>
                            {section.content.map((s, idx) => (
                                <div key={idx} className="step-item">
                                    <div className="step-num">{idx+1}</div>
                                    <div className="step-txt">{s}</div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {viewHistoryIndex === null && (
                <div className="card-actions">
                    <button className="btn accent-btn small-btn" onClick={() => setScene(prevScene)}>Zpět</button>
                    <button className="btn danger-btn small-btn" onClick={() => handleDelete(selectedRecipe.id)}>Smazat</button>
                </div>
            )}
          </div>
        )}

        {/* --- CELOOBRAZOVKOVÝ EDITOR (Původně modal) --- */}
        {scene === 'editor' && (
          <div className="fade-in">
            {modalStep === 1 ? (
              <div>
                <h2>{editId ? 'Upravit recept' : 'Nový recept'}</h2>
                <label className="field-label">Jméno jídla</label>
                <input className="custom-input" value={editName} onChange={e => setEditName(e.target.value)} />
                <div className="vertical-inputs">
                  <label className="field-label">Základní porce</label>
                  <input className="custom-input" type="number" value={editServings} onChange={e => setEditServings(parseInt(e.target.value) || 1)} />
                  <div style={{display:'flex', gap:'10px'}}>
                    <div style={{flex:1}}><label className="field-label">Příprava (min)</label><input className="custom-input" value={editPrep} onChange={e => setEditPrep(e.target.value)} type="number" /></div>
                    <div style={{flex:1}}><label className="field-label">Vaření (min)</label><input className="custom-input" value={editCook} onChange={e => setEditCook(e.target.value)} type="number" /></div>
                  </div>
                </div>
                <label className="field-label">Podrecepty:</label>
                <input className="custom-input" style={{ marginBottom: '10px' }} placeholder="🔍 Hledat..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
                <div className="sub-recipe-selector" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {filteredSubRecipes.map(r => (
                    <button key={r.id} className={`sub-btn ${editSelectedSubIds.includes(r.id) ? 'active' : ''}`} onClick={() => setEditSelectedSubIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}>{r.name}</button>
                  ))}
                </div>
                <label className="field-label">Suroviny</label>
                {editIngs.map((ing, idx) => (
                  <div key={idx} className="ing-row-triple">
                    <input className="custom-input flex-2" value={ing.name} onChange={e => { const n = [...editIngs]; n[idx].name = e.target.value; setEditIngs(n); }} placeholder="Surovina" list="modal-ing-names" />
                    <input className="custom-input flex-1" value={ing.amount} onChange={e => { const n = [...editIngs]; n[idx].amount = e.target.value; setEditIngs(n); }} placeholder="Mn." type="number" />
                    <input className="custom-input flex-1" value={ing.unit} onChange={e => { const n = [...editIngs]; n[idx].unit = e.target.value; setEditIngs(n); }} placeholder="jedn." list="unit-list" />
                    <button className="remove-row-btn" onClick={() => setEditIngs(editIngs.filter((_, i) => i !== idx))}>-</button>
                  </div>
                ))}
                <datalist id="unit-list">{commonUnits.map(u => <option key={u} value={u} />)}</datalist>
                <datalist id="modal-ing-names">{allIngredientNames.map(i => <option key={i} value={i} />)}</datalist>
                <button className="btn secondary-btn small-btn" onClick={() => setEditIngs([...editIngs, {name:'', amount:'', unit:''}])}>+ DALŠÍ SUROVINA</button>
                <button className="btn accent-btn" style={{marginTop:'20px', opacity: isStep1Valid ? 1 : 0.4}} onClick={() => isStep1Valid ? setModalStep(2) : alert("Vyplňte pole")}>DALŠÍ KROK →</button>
              </div>
            ) : (
              <div>
                <h2>Kategorie a Postup</h2>
                <label className="field-label">Kategorie</label>
                {editCategoryList.map((cat, idx) => (
                  <div key={idx} className="ing-row-triple">
                    <input className="custom-input" value={cat} onChange={e => { const newList = [...editCategoryList]; newList[idx] = e.target.value; setEditCategoryList(newList); }} list="modal-cat-list" />
                    <button className="remove-row-btn" onClick={() => setEditCategoryList(editCategoryList.filter((_, i) => i !== idx))}>-</button>
                  </div>
                ))}
                <datalist id="modal-cat-list">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                <button className="btn secondary-btn small-btn" onClick={() => setEditCategoryList([...editCategoryList, ''])}>+ KATEGORIE</button>
                <label className="field-label" style={{marginTop:'20px'}}>Kroky postupu</label>
                {editSteps.map((s, idx) => (
                  <div key={idx} style={{marginBottom:'10px', display:'flex', gap:'8px'}}>
                    <textarea className="custom-textarea" value={s} onChange={e => { const n = [...editSteps]; n[idx] = e.target.value; setEditSteps(n); }} />
                    <button className="remove-row-btn" onClick={() => setEditSteps(editSteps.filter((_, i) => i !== idx))}>-</button>
                  </div>
                ))}
                <button className="btn secondary-btn small-btn" onClick={() => setEditSteps([...editSteps, ''])}>+ PŘIDAT KROK</button>
                <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                  <button className="btn secondary-btn" style={{flex:1}} onClick={() => setModalStep(1)}>ZPĚT</button>
                  <button className="btn success-btn" style={{flex:2, opacity: isStep2Valid ? 1 : 0.4}} onClick={handleSave}>ULOŽIT RECEPT</button>
                </div>
              </div>
            )}
            <button className="btn danger-btn" style={{marginTop:'15px'}} onClick={() => setScene('manage')}>ZRUŠIT</button>
          </div>
        )}
      </div>

     <nav className="nav-bar">
  <button 
    className={`nav-btn ${scene === 'fridge' || (scene === 'detail' && prevScene === 'results') ? 'active' : ''}`} 
    onClick={() => setScene('fridge')}
  >
    LEDNICE
  </button>
  <button 
    className={`nav-btn ${scene === 'manage' || (scene === 'editor' && editId !== null) || (scene === 'detail' && prevScene === 'manage') ? 'active' : ''}`} 
    onClick={() => setScene('manage')}
  >
    RECEPTY
  </button>
  <button 
    className={`nav-btn ${scene === 'editor' && editId === null ? 'active' : ''}`} 
    onClick={() => openEditor()}
  >
    PŘIDAT
  </button>
</nav>
    </IonApp>
  );
};

export default App;