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
// Automatické otevření receptu z URL parametrů
  useEffect(() => {
    if (recipes.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const recipeId = params.get('recipe');
      if (recipeId) {
        const shared = recipes.find(r => r.id === parseInt(recipeId));
        if (shared) {
          setSelectedRecipe(shared);
          setViewHistoryIndex(null);
          setViewServings(shared.baseServings || 1);
          setPrevScene('manage');
          setScene('detail');
        }
      }
    }
  }, [recipes]);

  // --- COMPUTED ---
  const allIngredientNames = useMemo(() => {
    // Pokud nejsou vybrané kategorie, zobrazíme všechny suroviny jako dřív
    let relevantRecipes = recipes;

    // Pokud uživatel vybral kategorie, omezíme suroviny pouze na ty z odpovídajících receptů
    if (selectedFilterCats.length > 0) {
      relevantRecipes = recipes.filter(r => {
        return categoryLogic === 'OR' 
          ? r.categories?.some(cat => selectedFilterCats.includes(cat))
          : selectedFilterCats.every(cat => r.categories?.includes(cat));
      });
    }

    const names = relevantRecipes.flatMap(r => r.ingredients.map(i => i.name));
    return [...new Set(names)].sort();
  }, [recipes, selectedFilterCats, categoryLogic]);
  const allCategories = useMemo(() => [...new Set(recipes.flatMap(r => r.categories || []))].sort(), [recipes]);

  const matchedRecipes = useMemo(() => {
    return recipes.map(r => {
      // 1. Logika kategorií (zůstává stejná)
      let catMatch = true;
      if (selectedFilterCats.length > 0) {
        catMatch = categoryLogic === 'OR' 
          ? r.categories?.some(cat => selectedFilterCats.includes(cat))
          : selectedFilterCats.every(cat => r.categories?.includes(cat));
      }
      
      if (!catMatch) return { ...r, score: 0, matchedCount: 0 };

      // --- NOVÁ LOGIKA: Sběr všech surovin včetně podreceptů ---
      const allRequiredIngs = new Map<string, number>();

      const collectIngs = (recipe: Recipe) => {
        // Přidat suroviny z podreceptů (rekurzivně)
        (recipe.subRecipeIds || []).forEach(subId => {
          const sub = recipes.find(x => x.id === subId);
          if (sub) collectIngs(sub);
        });

        // Přidat suroviny z aktuálního receptu
        recipe.ingredients.forEach(ing => {
          const key = ing.name.toLowerCase().trim();
          const amount = parseFloat(ing.amount.replace(',', '.'));
          if (!isNaN(amount)) {
            allRequiredIngs.set(key, (allRequiredIngs.get(key) || 0) + amount);
          } else {
            // Pokud je množství text (např. "dle chuti"), započítáme aspoň existenci
            if (!allRequiredIngs.has(key)) allRequiredIngs.set(key, 0);
          }
        });
      };

      collectIngs(r);

      // 2. Výpočet shody z agregovaného seznamu
      const requiredNames = Array.from(allRequiredIngs.keys());
      if (requiredNames.length === 0) return { ...r, score: 100, matchedCount: 0 };

      let matchedCount = 0;
      requiredNames.forEach(name => {
        const myVal = myIngredients[name];
        if (myVal === undefined) return; // Nemám v lednici
        if (myVal === "") { matchedCount++; return; } // Mám bez omezení množství

        const myAmount = parseFloat(myVal.replace(',', '.'));
        const reqAmount = allRequiredIngs.get(name) || 0;

        if (!isNaN(myAmount) && myAmount >= reqAmount) {
          matchedCount++;
        }
      });

      // Výpočet procent na základě TOTALITY všech surovin
      const score = Math.round((matchedCount / requiredNames.length) * 100);

      return { ...r, score, matchedCount };
    })
    .sort((a, b) => b.score - a.score); 
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
  // Kontroluje:
  // 1. Jméno receptu není prázdné
  // 2. Časy přípravy a vaření nejsou prázdné
  // 3. Všechny přidané suroviny mají vyplněný název (množství a jednotku teď ignorujeme)
  return (
    editName.trim() !== "" && 
    editPrep !== "" && 
    editCook !== "" && 
    editIngs.every(i => i.name.trim() !== "")
  );
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
    // --- NOVÁ LOGIKA: Výpočet celkového množství surovin z textu kroků ---
    const extractedIngredients: Ingredient[] = [];
    const ingredientTotals = new Map<string, { amount: number, unit: string }>();

    // Projdeme všechny kroky a hledáme tagy {{název|množství|jednotka}}
    editSteps.forEach(step => {
const regex = /\{\{(?:RECIPE:\d+:|)(.*?)\|(.*?)\|(.*?)\}\}/g;
      let match;
      while ((match = regex.exec(step)) !== null) {
        const name = match[1].trim();
        const amount = parseFloat(match[2].replace(',', '.'));
        const unit = match[3].trim();

        if (!isNaN(amount)) {
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

    // Převedeme Mapu na pole objektů Ingredient
    // Prioritně bereme ty, co jsou v textu, zbytek (pokud uživatel přidal surovinu a nepoužil ji v textu) přidáme s nulou
    editIngs.forEach(ing => {
      const key = ing.name.toLowerCase();
      const total = ingredientTotals.get(key);
      if (total) {
        extractedIngredients.push({
          name: ing.name,
          amount: (Math.round(total.amount * 10) / 10).toString(),
          unit: total.unit
        });
      } else if (ing.name.trim() !== "") {
        extractedIngredients.push({ name: ing.name, amount: "0", unit: "" });
      }
    });

    const newData: RecipeData = {
      name: editName.trim(),
      categories: editCategoryList.map(c => c.trim().toLowerCase()).filter(c => c !== ""),
      prepTime: editPrep,
      cookTime: editCook,
      baseServings: editServings,
      ingredients: extractedIngredients, // Ukládáme vypočtené suroviny
      subRecipeIds: editSelectedSubIds,
      steps: editSteps.filter(s => s.trim() !== ""),
      updatedAt: Date.now()
    };

    let updatedRecipes: Recipe[];

    if (editId) {
      updatedRecipes = recipes.map(r => {
        if (r.id === editId) {
          const currentVersionNum = (r.history?.length || 0) + 1;
          return {
            ...newData,
            id: editId,
            history: [
              { ...r, versionLabel: currentVersionNum },
              ...(r.history || [])
            ]
          };
        }
        return r;
      });
    } else {
      updatedRecipes = [...recipes, { ...newData, id: Date.now(), history: [] }];
    }

    setRecipes(updatedRecipes);
    saveData(updatedRecipes);
    setScene('manage');
  };
  

  const handleShare = (e: React.MouseEvent, recipeId: number) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?recipe=${recipeId}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Odkaz na recept byl zkopírován!');
    }).catch(err => {
      console.error('Chyba při kopírování:', err);
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Smazat tento recept?')) {
      const updated = recipes.filter(x => x.id !== id);
      setRecipes(updated);
      saveData(updated);
      setScene('manage');
    }
  };

const renderStepWithIngredients = (stepText: string) => {
  const parts = stepText.split(/(\{\{.*?\}\})/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      const rawContent = part.slice(2, -2).trim();
      const [idPart, customVal, customUnit] = rawContent.split('|').map(s => s?.trim());

      // POKUD JE TO PODRECEPT
      if (idPart.startsWith("RECIPE:")) {
        const [, recipeId, recipeName] = idPart.split(':');
        return (
          <strong 
            key={index} 
            style={{ color: '#4caf50', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => {
              const target = recipes.find(r => r.id === Number(recipeId));
              if (target) {
                setSelectedRecipe(target);
                setViewHistoryIndex(null);
                setScene('detail');
              }
            }}
          >
            {customVal} {customUnit} {recipeName}
          </strong>
        );
      }

      // POKUD JE TO KLASICKÁ SUROVINA
    // Najdi ve funkci tento blok a nahraď ho:
const found = effectiveData?.ingredients.find(i => i.name.toLowerCase() === idPart.toLowerCase());

if (found || idPart.startsWith("RECIPE:")) {
  const baseAmount = parseFloat(customVal || "0");
  const unit = customUnit || (found ? found.unit : "");
  const name = idPart.startsWith("RECIPE:") ? idPart.split(':')[2] : (found ? found.name : idPart);

  // Výpočet škálování: (Zadané množství / základní porce) * aktuální porce
  const scaled = (baseAmount / (selectedRecipe?.baseServings || 1)) * viewServings;
  const finalAmount = Math.round(scaled * 10) / 10;

  return (
    <strong key={index} style={{ color: idPart.startsWith("RECIPE:") ? '#4caf50' : 'var(--accent)', cursor: idPart.startsWith("RECIPE:") ? 'pointer' : 'default' }}>
      {finalAmount} {unit} {name}
    </strong>
  );
}
      return <span key={index} style={{ color: 'red' }}>{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
};
     

  const insertIngredientToStep = (stepIdx: number, ing: Ingredient) => {
    const tag = `{{${ing.name}}}`;
    const newSteps = [...editSteps];
    const currentText = newSteps[stepIdx];
    
    // Vloží tag na konec textu (nebo by se dalo vylepšit o pozici kurzoru)
    newSteps[stepIdx] = currentText + (currentText.length > 0 && !currentText.endsWith(' ') ? ' ' : '') + tag;
    setEditSteps(newSteps);
  };

  const insertCustomValueToStep = (stepIdx: number, ing: Ingredient) => {
    const val = prompt(`Zadejte množství pro ${ing.name} (vztaženo na ${editServings} porce):`, ing.amount);
    if (val === null || val === "") return; // Storno

    // Formát: {{název_suroviny|vlastní_číslo}}
    const tag = `{{${ing.name}|${val}}}`;
    const n = [...editSteps];
    n[stepIdx] = n[stepIdx] + (n[stepIdx].length > 0 && !n[stepIdx].endsWith(' ') ? ' ' : '') + tag;
    setEditSteps(n);
  };

  return (
    <IonApp>
      <div id="app-container">
        {/* --- LEDNICE --- */}
{/* --- LEDNICE --- */}
        {scene === 'fridge' && (
          <div className="fade-in">
            <h2>Lednice</h2>
            <div className="category-logic-bar">
                <input className="custom-input" placeholder="Hledat kategorii" value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} />
                <div className="logic-toggle" style={{marginTop:'10px'}}>
                    <button className={`logic-btn ${categoryLogic === 'OR' ? 'active' : ''}`} onClick={() => setCategoryLogic('OR')}>JÍDLA OBSAHUJÍCÍ ALESPOŇ JEDNU Z TĚCHTO KATEGORIÍ</button>
                       </div>
                <div className="logic-toggle" style={{marginTop:'10px'}}>
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

            {/* SEZAM SUROVIN FILTROVANÝ PODLE KATEGORIÍ */}
            <div style={{ marginTop: '30px', borderTop: '2px solid var(--border)', paddingTop: '20px' }}> 
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
                              <input className="small-amount-input" type="number" placeholder="Množství" value={myIngredients[ing.toLowerCase()]} onChange={(e) => {
                                  const next = { ...myIngredients };
                                  next[ing.toLowerCase()] = e.target.value;
                                  setMyIngredients(next);
                              }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <button className="btn success-btn" style={{marginTop:'30px', width: '100%'}} onClick={() => setScene('results')}>
              NAJÍT RECEPTY
            </button>
          </div>
        )}

        {/* --- VÝSLEDKY / KUCHAŘKA --- */}
        {(scene === 'results' || scene === 'manage') && (
          <div className="fade-in">
            <h2>{scene === 'results' ? 'Výsledky' : 'Kuchařka'}</h2>
            {scene === 'manage' && (
                <div className="search-wrapper">
                    <input className="custom-input search-input" placeholder=" Vyhledat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            )}
            <div className="recipe-grid">
                {(scene === 'results' ? matchedRecipes : recipes.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))).map((r: any) => (
                  <div key={r.id} className="recipe-card"
                  style={{ opacity: r.score === 0 ? 0.6 : 1 }}
                  onClick={() => {
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
    {/* Horní lišta s navigací a úpravou */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      {/* <button className="back-link" onClick={() => setScene(prevScene)}>← Zpět</button> */}
      {/* {viewHistoryIndex === null && (
        <button className="back-link" onClick={() => openEditor(selectedRecipe)}>Upravit recept</button>
      )} */}
    </div>

    {/* Výběr verzí z historie */}

{selectedRecipe.history && selectedRecipe.history.length > 0 && (
  <div className="version-bar" style={{ marginBottom: '20px', padding: '15px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
    <label className="field-label" style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>Zvolit verzi:</label>
    <select 
      className="custom-input" 
      style={{ marginTop: '8px', height: '40px' }}
      value={viewHistoryIndex === null ? "current" : viewHistoryIndex} 
      onChange={(e) => setViewHistoryIndex(e.target.value === "current" ? null : parseInt(e.target.value))}
    >
      {/* Aktuální verze je vždy ta nejvyšší */}
      <option value="current">{selectedRecipe.history.length + 1} (Aktuální)</option>
      
      {/* Historie se vypisuje od nejnovější po nejstarší */}
      {selectedRecipe.history.map((h: any, idx) => (
        <option key={idx} value={idx}>
          Verze {h.versionLabel || (selectedRecipe.history.length - idx)}
        </option>
      ))}
    </select>
  </div>
)}

    <h2>
      {effectiveData.name} 
      {viewHistoryIndex !== null && <span style={{ color: 'var(--accent)', marginLeft: '10px', fontSize: '0.6em' }}>(ARCHIVNÍ VERZE)</span>}
    </h2>

    <div className="detail-grid">
      {/* Levý sloupec: Porce a Suroviny */}
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
            // Kontrola dostupnosti suroviny v lednici
            const myVal = myIngredients[i.name.toLowerCase()];
            let statusClass = 'tag-miss';
            if (myVal !== undefined) {
              if (myVal === "") statusClass = 'tag-have'; // Mám "dost"
              else if (parseFloat(myVal) >= parseFloat(i.amount)) statusClass = 'tag-have'; // Mám dostatečné množství
            }

            return (
              <span key={idx} className={`tag ${statusClass}`}>
                {i.name} ({i.amount} {i.unit})
              </span>
            );
          })}
        </div>
      </div>

{/* --- DETAIL: Pravý sloupec --- */}
<div className="detail-right">
  <label className="field-label">Postup:</label>
  {effectiveData.sections.map((section, sIdx) => (
    <div key={sIdx} className="recipe-section" style={{ marginBottom: '25px' }}>
      <h4 className="section-title" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '5px' }}>
        {section.title}
      </h4>
      {section.content.map((step, idx) => (
        <div key={idx} className="step-item" style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'flex-start' }}>
          {/* MODRÝ KROUŽEK S ČÍSLEM */}
          <div className="step-num" style={{ 
            backgroundColor: '#3880ff', 
            color: 'white',
            minWidth: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0,
            marginTop: '2px'
          }}>
            {idx + 1}
          </div>
          <div className="step-txt" style={{ lineHeight: '1.5' }}>
            {/* TADY JE OPRAVA: Používáme renderStepWithIngredients i pro podrecepty */}
            {renderStepWithIngredients(step)}
          </div>
        </div>
      ))}
    </div>
  ))}
</div>
    </div>

    {/* Spodní Akce: Smazání nebo Práce s historií */}
<div className="card-actions" style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
  {viewHistoryIndex === null ? (
    // JSEM V AKTUÁLNÍ VERZI
    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
      <button className="btn danger-btn" style={{ flex: 1 }} onClick={() => handleDelete(selectedRecipe.id)}>
        Smazat
      </button>
      <button className="btn accent-btn" style={{ flex: 1 }} onClick={() => openEditor(selectedRecipe)}>
        Upravit recept
      </button>
      <button className="btn share-btn" style={{ flex: 1 }} onClick={(e) => handleShare(e, selectedRecipe.id)}>
        Sdílet
      </button>
    </div>
  ) : (
    // JSEM V HISTORII (ARCHIVU)
    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
      <button className="btn secondary-btn" style={{ flex: 1 }} onClick={() => setViewHistoryIndex(null)}>
        Zpět
      </button>
    </div>
  )}
</div>
  </div>
)}


        {/* --- CELOOBRAZOVKOVÝ EDITOR --- */}
        {scene === 'editor' && (
          <div className="fade-in">
            {modalStep === 1 ? (
              /* KROK 1: ZÁKLADNÍ INFO A SUROVINY */
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
                <input className="custom-input" style={{ marginBottom: '10px' }} placeholder="Hledat..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
                <div className="sub-recipe-selector" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {filteredSubRecipes.map(r => (
                    <button key={r.id} className={`sub-btn ${editSelectedSubIds.includes(r.id) ? 'active' : ''}`} onClick={() => setEditSelectedSubIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}>{r.name}</button>
                  ))}
                </div>

   <label className="field-label">Seznam použitých surovin</label>
{editIngs.map((ing, idx) => (
  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
    <input 
      className="custom-input" 
      style={{ flex: 1, color: '#fff' }}
      value={ing.name} 
      onChange={e => { 
        const oldName = ing.name.trim();
        const newName = e.target.value;
        const nIngs = [...editIngs]; 
        nIngs[idx].name = newName; 
        
        if (oldName !== "" && oldName !== newName) {
          const nSteps = editSteps.map(step => {
            const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\{\\{${escapedOldName}(\\||\\}\\})`, 'gi');
            return step.replace(regex, (match, suffix) => `{{${newName}${suffix}`);
          });
          setEditSteps(nSteps);
        }
        setEditIngs(nIngs); 
      }} 
      placeholder="" 
      list="modal-ing-names" 
    />
    <button className="remove-row-btn" onClick={() => setEditIngs(editIngs.filter((_, i) => i !== idx))}>-</button>
  </div>
))}
{/* PŘIDÁNO: Našeptávač surovin */}
<datalist id="modal-ing-names">{allIngredientNames.map(i => <option key={i} value={i} />)}</datalist>

{/* <button className="btn secondary-btn small-btn" onClick={() => setEditIngs([...editIngs, {name:'', amount:'', unit:''}])}>+ DALŠÍ SUROVINA</button> */}

                <button className="btn secondary-btn small-btn" onClick={() => setEditIngs([...editIngs, {name:'', amount:'', unit:''}])}>+ DALŠÍ SUROVINA</button>
                <button className="btn accent-btn" style={{marginTop:'20px', opacity: isStep1Valid ? 1 : 0.4}} onClick={() => isStep1Valid ? setModalStep(2) : alert("Vyplňte všechna pole surovin (jméno, množství, jednotka)")}>DALŠÍ KROK →</button>
              </div>
            ) : (
              /* KROK 2: KATEGORIE A POSTUP */
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
                  <div key={idx} style={{ marginBottom: '25px', padding: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                    
                    {/* HORNÍ ČÁST: ČÍSLO, TEXTAREA A MAZÁNÍ KROKU */}
                    <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ 
                        backgroundColor: '#3880ff', color: 'white', minWidth: '24px', height: '24px', borderRadius: '50%', 
                        display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px', fontWeight: 'bold', 
                        marginTop: '8px', flexShrink: 0 
                      }}>
                        {idx + 1}
                      </div>
                      <textarea 
                        className="custom-textarea" 
                        value={s} 
                        onChange={e => { const n = [...editSteps]; n[idx] = e.target.value; setEditSteps(n); }} 
                        placeholder="Popište tento krok..."
                      />
                      <button className="remove-row-btn" onClick={() => setEditSteps(editSteps.filter((_, i) => i !== idx))}>-</button>
                    </div>

                    {/* SPODNÍ ČÁST: PANEL PRO VLOŽENÍ (SUROVINY I VYBRANÉ RECEPTY) */}
                    {/* SPODNÍ ČÁST: PANEL PRO VLOŽENÍ (SUROVINY I VYBRANÉ RECEPTY) */}
                    <div className="ing-row-triple" style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                      <select id={`ing-name-select-${idx}`} className="custom-input flex-2" style={{ color: '#fff' }}>
                        <option value="" style={{background: '#1a1d21'}}>Surovina nebo Podrecept...</option>
                        
                        <optgroup label="SUROVINY" style={{background: '#1a1d21', color: '#aaa'}}>
                          {editIngs.filter(i => i.name.trim() !== "").map((ing, iIdx) => (
                            <option key={`ing-${iIdx}`} value={ing.name} style={{background: '#1a1d21', color: '#fff'}}>{ing.name}</option>
                          ))}
                        </optgroup>

                        <optgroup label="PODRECEPTY" style={{background: '#1a1d21', color: '#aaa'}}>
                          {recipes
                            .filter(r => editSelectedSubIds.includes(r.id))
                            .map(r => (
                              <option key={`rec-${r.id}`} value={`RECIPE:${r.id}:${r.name}`} style={{background: '#1a1d21', color: '#fff'}}>
                                {r.name}
                              </option>
                            ))
                          }
                        </optgroup>
                      </select>

                      <input id={`ing-val-input-${idx}`} type="number" className="custom-input flex-1" placeholder="Mn." style={{ textAlign: 'center', color: '#fff' }} />
                      
                      {/* NOVÉ: Vstup pro jednotku s našeptávačem (umožňuje psát vlastní) */}
                      <input 
                        id={`ing-unit-select-${idx}`} 
                        className="custom-input flex-1" 
                        placeholder="Jedn." 
                        style={{ color: '#fff', textAlign: 'center' }} 
                        list={`common-units-list-${idx}`}
                      />
                      <datalist id={`common-units-list-${idx}`}>
                        {commonUnits.map(u => ( <option key={u} value={u} /> ))}
                      </datalist>

                      <button 
                        className="btn" 
                        style={{ height: '38px', width: '80px', flex: 'none', backgroundColor: '#3880ff', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '4px' }}
                        onClick={() => {
                          const selectEl = document.getElementById(`ing-name-select-${idx}`) as HTMLSelectElement;
                          const valInput = document.getElementById(`ing-val-input-${idx}`) as HTMLInputElement;
                          // Změněno na HTMLInputElement pro podporu vlastního textu
                          const unitInput = document.getElementById(`ing-unit-select-${idx}`) as HTMLInputElement;
                          
                          if (!selectEl.value || !valInput.value) { alert("Vyberte položku a zadejte množství."); return; }

                          let tag = "";
                          if (selectEl.value.startsWith("RECIPE:")) {
                            const parts = selectEl.value.split(':');
                            tag = `{{RECIPE:${parts[1]}:${parts[2]}|${valInput.value}|${unitInput.value}}}`;
                          } else {
                            tag = `{{${selectEl.value}|${valInput.value}|${unitInput.value}}}`;
                          }

                          const n = [...editSteps];
                          n[idx] = n[idx] + (n[idx].length > 0 && !n[idx].endsWith(' ') ? ' ' : '') + tag;
                          setEditSteps(n);
                          valInput.value = ""; 
                          // unitInput.value = ""; // Jednotku můžete nechat vyplněnou pro další surovinu
                        }}
                      >VLOŽIT</button>
                    </div>
                  </div>
                ))}

                <button className="btn secondary-btn small-btn" onClick={() => setEditSteps([...editSteps, ''])}>+ PŘIDAT KROK</button>

                <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                  <button className="btn secondary-btn" style={{flex:1}} onClick={() => setModalStep(1)}>ZPĚT</button>
                  <button className="btn success-btn" style={{flex:2, opacity: isStep2Valid ? 1 : 0.4}} onClick={handleSave}>ULOŽIT RECEPT</button>
                </div>
              </div>
            )}
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