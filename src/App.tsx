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

// --- MODAL COMPONENT (ADD / EDIT) ---

const AddRecipeModal: React.FC<{ 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (recipe: Omit<Recipe, 'id' | 'history'>, id?: number) => void, 
  availableCategories: string[],
  availableIngredients: string[],
  allRecipes: Recipe[],
  editData?: Recipe | null 
}> = ({ isOpen, onClose, onSave, availableCategories, availableIngredients, allRecipes, editData }) => {
  const [modalStep, setModalStep] = useState(1);
  const [name, setName] = useState('');
  const [categoryList, setCategoryList] = useState<string[]>(['']);
  const [prep, setPrep] = useState('');
  const [cook, setCook] = useState('');
  const [servings, setServings] = useState<number>(1);
  const [ings, setIngs] = useState<Ingredient[]>([{ name: '', amount: '', unit: '' }]);
  const [selectedSubIds, setSelectedSubIds] = useState<number[]>([]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [subSearch, setSubSearch] = useState('');

  const commonUnits = ['g', 'kg', 'ml', 'l', 'ks', 'lžíce', 'lžička', 'hrst', 'špetka', 'balení'];

  const filteredSubRecipes = useMemo(() => {
    return allRecipes.filter(r => 
      r.id !== editData?.id && 
      r.name.toLowerCase().includes(subSearch.toLowerCase())
    );
  }, [allRecipes, subSearch, editData]);

  const isStep1Valid = useMemo(() => {
    const basicInfo = name.trim() !== "" && prep.toString().trim() !== "" && cook.toString().trim() !== "" && servings > 0;
    const ingredientsValid = ings.length > 0 && ings.every(i => 
      i.name.trim() !== "" && i.amount.toString().trim() !== "" && i.unit.trim() !== ""
    );
    return basicInfo && ingredientsValid;
  }, [name, prep, cook, servings, ings]);

  const isStep2Valid = useMemo(() => {
    const categoriesValid = categoryList.length > 0 && categoryList.every(c => c.trim() !== "");
    const stepsValid = steps.length > 0 && steps.every(s => s.trim() !== "");
    return categoriesValid && stepsValid;
  }, [categoryList, steps]);

  useEffect(() => {
    if (isOpen) {
      setModalStep(1);
      setSubSearch('');
      if (editData) {
        setName(editData.name || ''); 
        setCategoryList(editData.categories?.length ? editData.categories : ['']);
        setPrep(editData.prepTime || ''); 
        setCook(editData.cookTime || '');
        setServings(editData.baseServings || 1);
        setIngs(editData.ingredients || [{ name: '', amount: '', unit: '' }]);
        setSelectedSubIds(editData.subRecipeIds || []);
        setSteps(editData.steps || ['']);
      } else {
        setName(''); setCategoryList(['']); setPrep(''); setCook(''); setServings(1);
        setIngs([{ name: '', amount: '', unit: '' }]); setSelectedSubIds([]); setSteps(['']);
      }
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  const handleFinalSave = () => {
    if (!isStep2Valid) {
      alert("Vyplňte všechna pole.");
      return;
    }
    const cleanedCats = categoryList.map(c => c.trim().toLowerCase()).filter(c => c !== "");
    onSave({ 
      name, 
      categories: cleanedCats, 
      prepTime: prep, 
      cookTime: cook, 
      baseServings: servings, 
      ingredients: ings.filter(i => i.name.trim()), 
      subRecipeIds: selectedSubIds,
      steps: steps.filter(s => s.trim()),
      updatedAt: Date.now()
    }, editData?.id);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {modalStep === 1 ? (
          <div className="fade-in">
            <h2>{editData ? 'Upravit recept' : 'Nový recept'}</h2>
            <label className="field-label">Jméno jídla</label>
            <input className="custom-input" value={name} onChange={e => setName(e.target.value)} />
            
            <div className="vertical-inputs">
                <label className="field-label">Základní porce</label>
                <input className="custom-input" type="number" value={servings} onChange={e => setServings(parseInt(e.target.value) || 1)} />
                <div style={{display:'flex', gap:'10px'}}>
                  <div style={{flex:1}}><label className="field-label">Příprava (min)</label><input className="custom-input" value={prep} onChange={e => setPrep(e.target.value)} type="number" /></div>
                  <div style={{flex:1}}><label className="field-label">Vaření (min)</label><input className="custom-input" value={cook} onChange={e => setCook(e.target.value)} type="number" /></div>
                </div>
            </div>
            
            <label className="field-label">Podrecepty:</label>
            <input 
              className="custom-input" 
              style={{ marginBottom: '10px', height: '40px', fontSize: '14px' }}
              placeholder="🔍 Hledat v receptech..." 
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
            />

            <div className="sub-recipe-selector" style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', padding: '5px' }}>
                {filteredSubRecipes.length > 0 ? (
                  filteredSubRecipes.map(r => (
                    <button 
                      key={r.id} 
                      className={`sub-btn ${selectedSubIds.includes(r.id) ? 'active' : ''}`} 
                      onClick={() => setSelectedSubIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                    >
                        {r.name}
                    </button>
                  ))
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '10px' }}>Nenalezeno</div>
                )}
            </div>

            <label className="field-label">Suroviny</label>
            <div className="scroll-area">
                {ings.map((ing, idx) => (
                    <div key={idx} className="ing-row-triple">
                        <input className="custom-input flex-2" value={ing.name} onChange={e => { const n = [...ings]; n[idx].name = e.target.value; setIngs(n); }} placeholder="Surovina" list="modal-ing-names" />
                        <input className="custom-input flex-1" value={ing.amount} onChange={e => { const n = [...ings]; n[idx].amount = e.target.value; setIngs(n); }} placeholder="Mn." type="number" />
                        <input className="custom-input flex-1" value={ing.unit} onChange={e => { const n = [...ings]; n[idx].unit = e.target.value; setIngs(n); }} placeholder="jedn." list="unit-list" />
                        <button className="remove-row-btn" onClick={() => setIngs(ings.filter((_, i) => i !== idx))}>-</button>
                    </div>
                ))}
            </div>
            <datalist id="unit-list">{commonUnits.map(u => <option key={u} value={u} />)}</datalist>
            <datalist id="modal-ing-names">{availableIngredients.map(i => <option key={i} value={i} />)}</datalist>
            <button className="btn secondary-btn small-btn" onClick={() => setIngs([...ings, {name:'', amount:'', unit:''}])}>+ DALŠÍ SUROVINA</button>

            <button 
              className="btn accent-btn" 
              style={{marginTop:'20px', opacity: isStep1Valid ? 1 : 0.4}} 
              onClick={() => isStep1Valid ? setModalStep(2) : alert("Vyplňte všechna pole.")}
            >
              DALŠÍ KROK →
            </button>
          </div>
        ) : (
          <div className="fade-in">
            <h2>Kategorie a Postup</h2>
            <label className="field-label">Kategorie</label>
            <div className="scroll-area-mini">
                {categoryList.map((cat, idx) => (
                    <div key={idx} className="ing-row-triple" style={{marginBottom:'5px'}}>
                        <input className="custom-input" style={{flex:1}} value={cat} onChange={e => {
                            const newList = [...categoryList];
                            newList[idx] = e.target.value;
                            setCategoryList(newList);
                        }} placeholder="Kategorie" list="modal-cat-list" />
                        <button className="remove-row-btn" onClick={() => setCategoryList(categoryList.filter((_, i) => i !== idx))}>-</button>
                    </div>
                ))}
            </div>
            <datalist id="modal-cat-list">{availableCategories.map(c => <option key={c} value={c} />)}</datalist>
            <button className="btn secondary-btn small-btn" onClick={() => setCategoryList([...categoryList, ''])}>+ KATEGORIE</button>

            <label className="field-label" style={{marginTop:'20px'}}>Kroky postupu</label>
            <div className="scroll-area">
                {steps.map((s, idx) => (
                    <div key={idx} style={{marginBottom:'10px', display:'flex', gap:'8px', alignItems:'flex-start'}}>
                        <textarea className="custom-textarea" value={s} onChange={e => { const n = [...steps]; n[idx] = e.target.value; setSteps(n); }} placeholder={`Krok ${idx+1}...`} />
                        <button className="remove-row-btn" onClick={() => setSteps(steps.filter((_, i) => i !== idx))}>-</button>
                    </div>
                ))}
            </div>
            <button className="btn secondary-btn small-btn" onClick={() => setSteps([...steps, ''])}>+ PŘIDAT KROK</button>
            
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button className="btn secondary-btn" style={{flex:1}} onClick={() => setModalStep(1)}>ZPĚT</button>
                <button 
                  className="btn success-btn" 
                  style={{flex:2, opacity: isStep2Valid ? 1 : 0.4}} 
                  onClick={handleFinalSave}
                >
                  ULOŽIT RECEPT
                </button>
            </div>
          </div>
        )}
        <button className="btn danger-btn" style={{marginTop:'15px', height: '45px', opacity: 1}} onClick={onClose}>ZRUŠIT</button>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [scene, setScene] = useState<'fridge' | 'results' | 'manage' | 'detail'>('fridge');
  const [prevScene, setPrevScene] = useState<'results' | 'manage'>('results');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [viewHistoryIndex, setViewHistoryIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Recipe | null>(null);
  
  // Opravené typování pro myIngredients
  const [myIngredients, setMyIngredients] = useState<{[key: string]: string}>(() => 
    JSON.parse(localStorage.getItem('my_fridge') || '{}')
  );
  
  const [selectedFilterCats, setSelectedFilterCats] = useState<string[]>([]);
  const [categoryLogic, setCategoryLogic] = useState<'AND' | 'OR'>('OR');
  const [viewServings, setViewServings] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  const loadData = async () => {
    try {
      const resp = await fetch('load_kucharka.php');
      const data = await resp.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Chyba load:", e);
    }
  };

  const saveData = async (updatedRecipes: Recipe[]) => {
    try {
      await fetch('save_kucharka.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecipes)
      });
    } catch (e) {
      console.error("Chyba save:", e);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    localStorage.setItem('my_fridge', JSON.stringify(myIngredients));
  }, [myIngredients]);

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

  const handleSave = (newData: Omit<Recipe, 'id' | 'history'>, id?: number) => {
    let updated: Recipe[];
    if (id) {
      updated = recipes.map(r => r.id === id ? { ...newData, id, history: [r as RecipeData, ...r.history] } : r);
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
        {scene === 'fridge' && (
          <div className="fade-in">
            <h2>Lednice</h2>
            <div className="category-logic-bar">
                <input className="custom-input" placeholder="Hledat kategorii" value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} />
                <div className="logic-toggle" style={{marginTop:'10px'}}>
                    <button className={`logic-btn ${categoryLogic === 'OR' ? 'active' : ''}`} onClick={() => setCategoryLogic('OR')}>OR</button>
                    <button className={`logic-btn ${categoryLogic === 'AND' ? 'active' : ''}`} onClick={() => setCategoryLogic('AND')}>AND</button>
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
                                    if (next[ing.toLowerCase()] !== undefined) delete next[ing.toLowerCase()]; 
                                    else next[ing.toLowerCase()] = "";
                                    setMyIngredients(next);
                                }} />
                                <span className="slider"></span>
                            </label>
                        </div>
                        {myIngredients[ing.toLowerCase()] !== undefined && (
                          <input 
                            className="small-amount-input" 
                            type="number" 
                            placeholder="Kolik máš? (volné = dost)" 
                            value={myIngredients[ing.toLowerCase()]} 
                            onChange={(e) => {
                              const next = { ...myIngredients };
                              next[ing.toLowerCase()] = e.target.value;
                              setMyIngredients(next);
                            }}
                          />
                        )}
                    </div>
                ))}
            </div>
            <button className="btn success-btn" style={{marginTop:'20px'}} onClick={() => setScene('results')}>NAJÍT RECEPTY</button>
          </div>
        )}

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
                    <div className="time-info">🕒 {r.prepTime}m | 🔥 {r.cookTime}m | Shoda: {r.score}%</div>
                    <div className="category-rows">
                        {r.categories?.map((c: string) => <div key={c} className="tag cat-tag">{c}</div>)}
                    </div>
                  </div>
                ))}
            </div>
            <button className="btn secondary-btn" style={{marginTop: '40px'}} onClick={() => setScene('fridge')}>ZPĚT</button>
          </div>
        )}

        {scene === 'detail' && selectedRecipe && effectiveData && (
          <div className="fade-in detail-view">
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <button className="back-link" onClick={() => setScene(prevScene)}>← Zpět</button>
                <button className="back-link" onClick={() => { setEditData(selectedRecipe); setIsModalOpen(true); }}>Upravit recept</button>
             </div>
            {selectedRecipe.history.length > 0 && (
                <div className="version-selector">
                    <label className="field-label">Verze:</label>
                    <select className="custom-input" value={viewHistoryIndex === null ? "current" : viewHistoryIndex} onChange={(e) => setViewHistoryIndex(e.target.value === "current" ? null : parseInt(e.target.value))}>
                        <option value="current">Verze {selectedRecipe.history.length + 1} (Nyní)</option>
                        {selectedRecipe.history.map((_, idx) => <option key={idx} value={idx}>Verze {selectedRecipe.history.length - idx}</option>)}
                    </select>
                </div>
            )}
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
                        {effectiveData.ingredients.map((i, idx) => {
                             // Logika barvy tagu podle množství
                             const myVal = myIngredients[i.name.toLowerCase()];
                             let statusClass = 'tag-miss';
                             if (myVal !== undefined) {
                               if (myVal === "") statusClass = 'tag-have';
                               else if (parseFloat(myVal) >= parseFloat(i.amount)) statusClass = 'tag-have';
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
                    <button className="btn danger-btn small-btn" onClick={() => handleDelete(selectedRecipe.id)}>Smazat</button>
                </div>
            )}
          </div>
        )}
      </div>

      <nav className="nav-bar">
        <button className={`nav-btn ${scene === 'fridge' || (scene === 'detail' && prevScene === 'results') ? 'active' : ''}`} onClick={() => setScene('fridge')}>LEDNICE</button>
        <button className={`nav-btn ${scene === 'manage' || (scene === 'detail' && prevScene === 'manage') ? 'active' : ''}`} onClick={() => setScene('manage')}>KUCHAŘKA</button>
        <button className="nav-btn" onClick={() => { setEditData(null); setIsModalOpen(true); }}>PŘIDAT</button>
      </nav>

      <AddRecipeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} availableCategories={allCategories} availableIngredients={allIngredientNames} allRecipes={recipes} editData={editData} />
    </IonApp>
  );
};

export default App;