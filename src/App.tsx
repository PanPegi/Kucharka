import React, { useState, useEffect, useMemo } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import './App.css';

setupIonicReact();

interface Ingredient {
  name: string;
  amount: string;
}

interface Recipe {
  id: number;
  name: string;
  categories: string[];
  ingredients: Ingredient[];
  steps: string[]; 
  prepTime: string;
  cookTime: string;
  baseServings: number;
}

const AddRecipeModal: React.FC<{ 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (recipe: Omit<Recipe, 'id'>, id?: number) => void, 
  availableCategories: string[],
  availableIngredients: string[], // NOVÉ: Seznam všech existujících surovin
  editData?: Recipe | null 
}> = ({ isOpen, onClose, onSave, availableCategories, availableIngredients, editData }) => {
  const [modalStep, setModalStep] = useState(1);
  const [name, setName] = useState('');
  const [categoryList, setCategoryList] = useState<string[]>(['']);
  const [prep, setPrep] = useState('');
  const [cook, setCook] = useState('');
  const [servings, setServings] = useState<number>(1);
  const [ings, setIngs] = useState<Ingredient[]>([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState<string[]>(['']);

  useEffect(() => {
    if (isOpen) {
      setModalStep(1);
      if (editData) {
        setName(editData.name || ''); 
        setCategoryList(editData.categories?.length ? editData.categories : ['']);
        setPrep(editData.prepTime || ''); 
        setCook(editData.cookTime || '');
        setServings(editData.baseServings || 1);
        setIngs(editData.ingredients || [{ name: '', amount: '' }]);
        setSteps(editData.steps || ['']);
      } else {
        setName(''); setCategoryList(['']); setPrep(''); setCook(''); setServings(1);
        setIngs([{ name: '', amount: '' }]); setSteps(['']);
      }
    }
  }, [editData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {modalStep === 1 ? (
          <div className="fade-in">
            <h2>1. Základ a Suroviny</h2>
            <label className="field-label">Název pokrmu</label>
            <input className="custom-input" value={name} onChange={e => setName(e.target.value)} placeholder="např. Svíčková" />
            
            <div className="vertical-inputs">
                <label className="field-label">Základní porce</label>
                <input className="custom-input" type="number" min="1" value={servings} onChange={e => setServings(parseInt(e.target.value) || 1)} />
                <label className="field-label">Příprava (min)</label>
                <input className="custom-input" value={prep} onChange={e => setPrep(e.target.value)} type="number" />
                <label className="field-label">Vaření (min)</label>
                <input className="custom-input" value={cook} onChange={e => setCook(e.target.value)} type="number" />
            </div>
            
            <label className="field-label">Kategorie</label>
            <div className="scroll-area-mini">
                {categoryList.map((cat, idx) => (
                    <div key={idx} className="ing-row">
                        <input className="custom-input" value={cat} onChange={e => {
                            const newList = [...categoryList];
                            newList[idx] = e.target.value;
                            setCategoryList(newList);
                        }} placeholder="např. Oběd" list="modal-cat-list" />
                        {categoryList.length > 1 && <button className="remove-row-btn" onClick={() => setCategoryList(categoryList.filter((_, i) => i !== idx))}>×</button>}
                    </div>
                ))}
            </div>
            <datalist id="modal-cat-list">{availableCategories.map(c => <option key={c} value={c} />)}</datalist>
            <button className="btn secondary-btn small-btn" onClick={() => setCategoryList([...categoryList, ''])}>+ PŘIDAT KATEGORII</button>

            <label className="field-label" style={{marginTop:'15px'}}>Suroviny & Gramáž</label>
            <div className="scroll-area">
                {ings.map((ing, idx) => (
                    <div key={idx} className="ing-row">
                        <input 
                            className="custom-input" 
                            style={{flex:2}} 
                            value={ing.name} 
                            onChange={e => { const n = [...ings]; n[idx].name = e.target.value; setIngs(n); }} 
                            placeholder="Surovina" 
                            list="modal-ing-names" // PŘIPOJENÍ NASEPTÁVAČE
                        />
                        <input className="custom-input" style={{flex:1}} value={ing.amount} onChange={e => { const n = [...ings]; n[idx].amount = e.target.value; setIngs(n); }} placeholder="číslo" type="number" />
                        {ings.length > 1 && <button className="remove-row-btn" onClick={() => setIngs(ings.filter((_, i) => i !== idx))}>×</button>}
                    </div>
                ))}
            </div>
            <datalist id="modal-ing-names">{availableIngredients.map(i => <option key={i} value={i} />)}</datalist>
            <button className="btn secondary-btn small-btn" onClick={() => setIngs([...ings, {name:'', amount:''}])}>+ DALŠÍ SUROVINA</button>
            <button className="btn accent-btn" style={{marginTop:'20px'}} onClick={() => setModalStep(2)}>POSTUP PŘÍPRAVY →</button>
          </div>
        ) : (
          <div className="fade-in">
            <h2>2. Postup</h2>
            <div className="scroll-area">
                {steps.map((s, idx) => (
                    <div key={idx} style={{marginBottom:'15px'}}>
                        <label className="field-label">Odstavec {idx + 1}</label>
                        <textarea className="custom-textarea" value={s} onChange={e => { const n = [...steps]; n[idx] = e.target.value; setSteps(n); }} placeholder="..." />
                        {steps.length > 1 && <button className="remove-row-btn" style={{marginTop: '5px', borderRadius: '8px', width: 'auto', padding: '0 10px'}} onClick={() => setSteps(steps.filter((_, i) => i !== idx))}>Odstranit krok</button>}
                    </div>
                ))}
            </div>
            <button className="btn secondary-btn small-btn" onClick={() => setSteps([...steps, ''])}>+ PŘIDAT ODSTAVEC</button>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button className="btn secondary-btn" style={{flex:1}} onClick={() => setModalStep(1)}>ZPĚT</button>
                <button className="btn success-btn" style={{flex:2}} onClick={() => {
                  const cleanedCats = categoryList.map(c => c.trim().toLowerCase()).filter(c => c !== "");
                  onSave({ name, categories: cleanedCats.length > 0 ? cleanedCats : ['ostatní'], prepTime: prep, cookTime: cook, baseServings: servings, ingredients: ings.filter(i => i.name.trim()), steps: steps.filter(s => s.trim()) }, editData?.id);
                  onClose();
                }}>ULOŽIT RECEPT</button>
            </div>
          </div>
        )}
        <button className="btn danger-btn" style={{marginTop:'15px', opacity:0.5, height: '45px'}} onClick={onClose}>ZRUŠIT</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [scene, setScene] = useState<'fridge' | 'results' | 'manage' | 'detail'>('fridge');
  const [prevScene, setPrevScene] = useState<'results' | 'manage'>('results');
  const [recipes, setRecipes] = useState<Recipe[]>(() => JSON.parse(localStorage.getItem('my_recipes') || '[]'));
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Recipe | null>(null);
  const [myIngredients, setMyIngredients] = useState<{[key: string]: string}>(() => JSON.parse(localStorage.getItem('my_fridge') || '{}'));
  const [selectedFilterCats, setSelectedFilterCats] = useState<string[]>([]);
  const [categoryLogic, setCategoryLogic] = useState<'AND' | 'OR'>('OR');
  const [viewServings, setViewServings] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { localStorage.setItem('my_recipes', JSON.stringify(recipes)); }, [recipes]);
  useEffect(() => { localStorage.setItem('my_fridge', JSON.stringify(myIngredients)); }, [myIngredients]);

  // Všechny unikátní kategorie
  const allCategories = useMemo(() => {
    const cats = recipes.flatMap(r => r.categories || []);
    return [...new Set(cats)].sort();
  }, [recipes]);

  // NOVÉ: Všechny unikátní názvy surovin pro našeptávač v modalu
  const allIngredientNames = useMemo(() => {
    const ings = recipes.flatMap(r => (r.ingredients || []).map(i => i.name));
    return [...new Set(ings)].sort();
  }, [recipes]);

  const availableIngs = useMemo(() => {
    let filteredRecipes = recipes;
    if (selectedFilterCats.length > 0) {
      filteredRecipes = recipes.filter(r => {
        if (categoryLogic === 'OR') return r.categories?.some(cat => selectedFilterCats.includes(cat));
        return selectedFilterCats.every(cat => r.categories?.includes(cat));
      });
    }
    const names = filteredRecipes.flatMap(r => (r.ingredients || []).map(i => i.name.toLowerCase()));
    return [...new Set(names)].sort();
  }, [recipes, selectedFilterCats, categoryLogic]);

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
        const name = ing.name.toLowerCase();
        if (myIngredients[name] === undefined) return false;
        const myAmt = parseFloat(myIngredients[name]);
        const reqAmt = parseFloat(ing.amount);
        return (!isNaN(myAmt) && !isNaN(reqAmt)) ? myAmt >= reqAmt : true;
      });
      const score = r.ingredients.length > 0 ? Math.round((matched.length / r.ingredients.length) * 100) : 0;
      return { ...r, score, matchedCount: matched.length };
    }).filter(r => r.matchedCount > 0).sort((a, b) => b.score - a.score);
  }, [recipes, myIngredients, selectedFilterCats, categoryLogic]);

  return (
    <IonApp>
      <div id="app-container">
        {scene === 'fridge' && (
          <div className="fade-in">
            <h2>Lednice</h2>
            <div className="category-logic-bar">
                <label className="field-label">Filtrovat kategorie:</label>
                <div className="logic-toggle">
                    <button className={`logic-btn ${categoryLogic === 'OR' ? 'active' : ''}`} onClick={() => setCategoryLogic('OR')}>OR</button>
                    <button className={`logic-btn ${categoryLogic === 'AND' ? 'active' : ''}`} onClick={() => setCategoryLogic('AND')}>AND</button>
                </div>
            </div>
            <div className="category-selection-grid">
                {allCategories.map(cat => (
                    <button key={cat} className={`cat-select-btn ${selectedFilterCats.includes(cat) ? 'selected' : ''}`} onClick={() => setSelectedFilterCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>
                        {cat}
                    </button>
                ))}
            </div>
            <div className="responsive-grid">
                {availableIngs.map(ing => (
                    <div key={ing} className="toggle-row-complex">
                        <div className="ing-main">
                            <span className="ing-name">{ing}</span>
                            <label className="switch">
                                <input type="checkbox" checked={myIngredients[ing] !== undefined} onChange={() => {
                                    const next = { ...myIngredients };
                                    if (next[ing] !== undefined) delete next[ing]; else next[ing] = "";
                                    setMyIngredients(next);
                                }} />
                                <span className="slider"></span>
                            </label>
                        </div>
                        {myIngredients[ing] !== undefined && (
                            <input className="small-amount-input" type="number" placeholder="množství" value={myIngredients[ing]} onChange={(e) => setMyIngredients({...myIngredients, [ing]: e.target.value})} />
                        )}
                    </div>
                ))}
            </div>
            {Object.keys(myIngredients).length > 0 && <button className="btn success-btn" style={{marginTop:'20px', maxWidth: '350px', marginInline: 'auto'}} onClick={() => setScene('results')}>UKÁZAT RECEPTY</button>}
          </div>
        )}

        {(scene === 'results' || scene === 'manage') && (
          <div className="fade-in">
            <h2>{scene === 'results' ? 'Výsledky' : 'Kuchařka'}</h2>
            {scene === 'manage' && (
                <div className="search-wrapper">
                    <input className="custom-input search-input" placeholder="🔍 Hledat jídlo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            )}
            <div className="recipe-grid">
                {(scene === 'results' ? matchedRecipes : recipes.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((r: any) => (
                  <div key={r.id} className="recipe-card" onClick={() => {
                      setPrevScene(scene as 'results' | 'manage');
                      setSelectedRecipe(r);
                      setViewServings(r.baseServings || 1);
                      setScene('detail');
                  }}>
                    <div className="recipe-header">
                        <span className="recipe-name">{r.name}</span>
                        {scene === 'results' && <span className={`score ${r.score === 100 ? 'full' : ''}`}>{r.score}%</span>}
                    </div>
                    <div className="time-info">🕒 {r.prepTime}m | 🔥 {r.cookTime}m</div>
                    <div className="category-rows">
                        {r.categories?.map((c: string) => <div key={c} className="tag cat-tag">{c}</div>)}
                    </div>
                  </div>
                ))}
            </div>
            <button className="btn secondary-btn" style={{marginTop: '40px', maxWidth: '350px', marginInline: 'auto'}} onClick={() => {setScene('fridge'); setSearchTerm('');}}>ZPĚT</button>
          </div>
        )}

        {scene === 'detail' && selectedRecipe && (
          <div className="fade-in detail-view">
            <button className="back-link" onClick={() => setScene(prevScene)}>← Zpět</button>
            <h2>{selectedRecipe.name}</h2>
            <div className="category-rows" style={{marginBottom: '20px'}}>
                {selectedRecipe.categories?.map(c => <div key={c} className="tag cat-tag">{c}</div>)}
            </div>
            <div className="detail-grid">
                <div className="detail-left">
                    <div className="servings-control">
                        <label className="field-label">Počet porcí:</label>
                        <div className="counter-row">
                            <button className="counter-btn" onClick={() => setViewServings(Math.max(1, viewServings - 1))}>−</button>
                            <span className="counter-value">{viewServings}</span>
                            <button className="counter-btn" onClick={() => setViewServings(viewServings + 1)}>+</button>
                        </div>
                    </div>
                    <label className="field-label">Suroviny:</label>
                    <div className="tag-container">
                        {selectedRecipe.ingredients.map((i, idx) => (
                            <span key={idx} className={`tag ${myIngredients[i.name.toLowerCase()] !== undefined ? 'tag-have' : 'tag-miss'}`}>
                                {i.name} ({Math.round((parseFloat(i.amount) / selectedRecipe.baseServings * viewServings) * 10) / 10})
                            </span>
                        ))}
                    </div>
                </div>
                <div className="detail-right">
                    <label className="field-label">Postup:</label>
                    {selectedRecipe.steps.map((s, idx) => (
                        <div key={idx} className="step-item">
                            <div className="step-num">{idx+1}</div>
                            <div className="step-txt">{s}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="card-actions" style={{marginTop: '40px'}}>
                <button className="btn accent-btn small-btn" onClick={() => { setEditData(selectedRecipe); setIsModalOpen(true); }}>Upravit</button>
                <button className="btn danger-btn small-btn" onClick={() => { if(confirm('Smazat?')) { setRecipes(recipes.filter(x => x.id !== selectedRecipe.id)); setScene('manage'); }}}>Smazat</button>
            </div>
          </div>
        )}
      </div>

      <nav className="nav-bar">
        <button className={`nav-btn ${scene === 'fridge' || (scene === 'detail' && prevScene === 'results') ? 'active' : ''}`} onClick={() => {setScene('fridge'); setSearchTerm('');}}>LEDNICE</button>
        <button className={`nav-btn ${scene === 'manage' || (scene === 'detail' && prevScene === 'manage') ? 'active' : ''}`} onClick={() => setScene('manage')}>RECEPTY</button>
        <button className="nav-btn" onClick={() => { setEditData(null); setIsModalOpen(true); }}>PŘIDAT</button>
      </nav>

      <AddRecipeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={(d, id) => {
          const updated = id ? recipes.map(r => r.id === id ? { ...d, id } : r) : [...recipes, { ...d, id: Date.now() }];
          setRecipes(updated);
          if (id) setSelectedRecipe({...d, id} as Recipe);
          setScene('manage');
        }} 
        availableCategories={allCategories} 
        availableIngredients={allIngredientNames} // PŘEDÁNÍ SUROVIN DO MODALU
        editData={editData} 
      />
    </IonApp>
  );
};

export default App;