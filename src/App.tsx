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
  category: string;
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
  categories: string[],
  editData?: Recipe | null 
}> = ({ isOpen, onClose, onSave, categories, editData }) => {
  const [modalStep, setModalStep] = useState(1);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('');
  const [prep, setPrep] = useState('');
  const [cook, setCook] = useState('');
  const [servings, setServings] = useState<number>(1);
  const [ings, setIngs] = useState<Ingredient[]>([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState<string[]>(['']);

  useEffect(() => {
    if (isOpen) {
      setModalStep(1);
      if (editData) {
        setName(editData.name || ''); setCat(editData.category || '');
        setPrep(editData.prepTime || ''); setCook(editData.cookTime || '');
        setServings(editData.baseServings || 1);
        setIngs(editData.ingredients || [{ name: '', amount: '' }]);
        setSteps(editData.steps || ['']);
      } else {
        setName(''); setCat(''); setPrep(''); setCook(''); setServings(1);
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
            <h2>1. Suroviny</h2>
            <label className="field-label">Název pokrmu</label>
            <input className="custom-input" value={name} onChange={e => setName(e.target.value)} placeholder="např. Guláš" />
            <div className="vertical-inputs">
                <label className="field-label">Základní porce</label>
                <input className="custom-input" type="number" min="1" value={servings} onChange={e => setServings(parseInt(e.target.value) || 1)} />
                <label className="field-label">Příprava (min)</label>
                <input className="custom-input" value={prep} onChange={e => setPrep(e.target.value)} type="number" />
                <label className="field-label">Vaření (min)</label>
                <input className="custom-input" value={cook} onChange={e => setCook(e.target.value)} type="number" />
            </div>
            <label className="field-label">Kategorie</label>
            <input className="custom-input" value={cat} onChange={e => setCat(e.target.value)} list="clist" />
            <datalist id="clist">{categories.map(c => <option key={c} value={c} />)}</datalist>
            <label className="field-label">Suroviny & Množství</label>
            <div className="scroll-area">
                {ings.map((ing, idx) => (
                    <div key={idx} className="ing-row">
                        <input className="custom-input" style={{flex:2}} value={ing.name} onChange={e => { const n = [...ings]; n[idx].name = e.target.value; setIngs(n); }} placeholder="Surovina" />
                        <input className="custom-input" style={{flex:1}} value={ing.amount} onChange={e => { const n = [...ings]; n[idx].amount = e.target.value; setIngs(n); }} placeholder="množství" type="number" />
                    </div>
                ))}
            </div>
            <button className="btn secondary-btn small-btn" onClick={() => setIngs([...ings, {name:'', amount:''}])}>+ DALŠÍ SUROVINA</button>
            <button className="btn accent-btn" style={{marginTop:'20px'}} onClick={() => setModalStep(2)}>POSTUP →</button>
          </div>
        ) : (
          <div className="fade-in">
            <h2>2. Postup</h2>
            <div className="scroll-area">
                {steps.map((s, idx) => (
                    <div key={idx} style={{marginBottom:'15px'}}>
                        <label className="field-label">Odstavec {idx + 1}</label>
                        <textarea className="custom-textarea" value={s} onChange={e => { const n = [...steps]; n[idx] = e.target.value; setSteps(n); }} />
                    </div>
                ))}
            </div>
            <button className="btn secondary-btn small-btn" onClick={() => setSteps([...steps, ''])}>+ DALŠÍ ODSTAVEC</button>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button className="btn secondary-btn" style={{flex:1}} onClick={() => setModalStep(1)}>ZPĚT</button>
                <button className="btn success-btn" style={{flex:2}} onClick={() => {
                  onSave({ name, category: cat || 'ostatní', prepTime: prep, cookTime: cook, baseServings: servings, ingredients: ings.filter(i => i.name.trim()), steps: steps.filter(s => s.trim()) }, editData?.id);
                  onClose();
                }}>ULOŽIT</button>
            </div>
          </div>
        )}
        <button className="btn danger-btn" style={{marginTop:'15px', opacity:0.5}} onClick={onClose}>ZRUŠIT</button>
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
  const [filterCat, setFilterCat] = useState('vše');
  const [viewServings, setViewServings] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { localStorage.setItem('my_recipes', JSON.stringify(recipes)); }, [recipes]);
  useEffect(() => { localStorage.setItem('my_fridge', JSON.stringify(myIngredients)); }, [myIngredients]);

  const categories = useMemo(() => ['vše', ...new Set(recipes.map(r => r.category))].filter(Boolean), [recipes]);

  const availableIngs = useMemo(() => {
    const filtered = filterCat === 'vše' ? recipes : recipes.filter(r => r.category === filterCat);
    const names = filtered.flatMap(r => (r.ingredients || []).map(i => i.name.toLowerCase()));
    return [...new Set(names)].sort();
  }, [recipes, filterCat]);

  const openDetail = (recipe: Recipe) => {
    setPrevScene(scene as 'results' | 'manage');
    setSelectedRecipe(recipe);
    setViewServings(recipe.baseServings || 1);
    setScene('detail');
  };

  const getScaledAmount = (ing: Ingredient) => {
    if (!selectedRecipe) return ing.amount;
    const baseAmount = parseFloat(ing.amount);
    if (isNaN(baseAmount)) return ing.amount;
    const scaled = (baseAmount / (selectedRecipe.baseServings || 1)) * viewServings;
    return Math.round(scaled * 10) / 10;
  };

  const filteredManageRecipes = useMemo(() => {
    return recipes.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [recipes, searchTerm]);

  const matchedRecipes = useMemo(() => {
    return recipes.map(r => {
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
  }, [recipes, myIngredients]);

  return (
    <IonApp>
      <div id="app-container">
        {scene === 'fridge' && (
          <div className="fade-in">
            <h2>Lednice</h2>
            <select className="custom-input" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <div className="responsive-grid" style={{marginTop:'20px'}}>
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
            {Object.keys(myIngredients).length > 0 && <button className="btn success-btn" style={{marginTop:'20px', maxWidth: '350px', marginInline: 'auto'}} onClick={() => setScene('results')}>UKÁZAT VÝSLEDKY</button>}
          </div>
        )}

        {(scene === 'results' || scene === 'manage') && (
          <div className="fade-in">
            <h2>{scene === 'results' ? 'Výsledky' : 'Kuchařka'}</h2>
            
            {scene === 'manage' && (
                <div className="search-wrapper">
                    <input className="custom-input search-input" placeholder="🔍 Hledat recept..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            )}

            <div className="recipe-grid">
                {(scene === 'results' ? matchedRecipes : filteredManageRecipes).map((r: any) => (
                  <div key={r.id} className="recipe-card" onClick={() => openDetail(r)}>
                    <div className="recipe-header">
                        <span className="recipe-name">{r.name}</span>
                        {scene === 'results' && <span className={`score ${r.score === 100 ? 'full' : ''}`}>{r.score}%</span>}
                    </div>
                    <div className="time-info">🕒 {r.prepTime}m | 🔥 {r.cookTime}m | 📁 {r.category}</div>
                  </div>
                ))}
            </div>
            
            {(scene === 'manage' && filteredManageRecipes.length === 0) && (
                <p style={{textAlign: 'center', opacity: 0.5, marginTop: '20px'}}>Žádný recept neodpovídá názvu</p>
            )}

            <button className="btn secondary-btn" style={{marginTop: '40px', maxWidth: '350px', marginInline: 'auto'}} onClick={() => {setScene('fridge'); setSearchTerm('');}}>ZPĚT DO LEDNICE</button>
          </div>
        )}

        {scene === 'detail' && selectedRecipe && (
          <div className="fade-in detail-view">
            <button className="back-link" onClick={() => setScene(prevScene)}>← Zpět</button>
            <h2 style={{textAlign: 'left'}}>{selectedRecipe.name}</h2>
            
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
                                {i.name} ({getScaledAmount(i)})
                            </span>
                        ))}
                    </div>
                </div>

                <div className="detail-right">
                    <label className="field-label">Postup přípravy:</label>
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
        <button className={`nav-btn ${scene === 'fridge' || scene === 'results' || (scene === 'detail' && prevScene === 'results') ? 'active' : ''}`} onClick={() => {setScene('fridge'); setSearchTerm('');}}>LEDNICE</button>
        <button className={`nav-btn ${scene === 'manage' || (scene === 'detail' && prevScene === 'manage') ? 'active' : ''}`} onClick={() => setScene('manage')}>RECEPTY</button>
        <button className="nav-btn" onClick={() => { setEditData(null); setIsModalOpen(true); }}>PŘIDAT</button>
      </nav>

      <AddRecipeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(d, id) => {
        const updated = id ? recipes.map(r => r.id === id ? { ...d, id } : r) : [...recipes, { ...d, id: Date.now() }];
        setRecipes(updated);
        if (id) { setSelectedRecipe({...d, id} as Recipe); }
        setScene('manage');
      }} categories={categories.filter(c => c !== 'vše')} editData={editData} />
    </IonApp>
  );
};

export default App;