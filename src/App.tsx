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
  versionLabel?: number;
}

interface Recipe extends RecipeData {
  id: number;
  history: RecipeData[];
}

const App: React.FC = () => {
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
  const [showHelpModal, setShowHelpModal] = useState(false);

  // --- EDITOR STATES ---
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
  const [editingTag, setEditingTag] = useState<{ stepIdx: number, tagRaw: string, name: string, amount: string, unit: string } | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'dark');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const commonUnits = ['g', 'kg', 'ml', 'l', 'ks', 'lžíce', 'lžička', 'hrst', 'špetka', 'balení'];

  const helpTexts: { [key: string]: string } = {
    fridge: "LEDNICE\n\n• Zaklikávání kategorií filtruje zobrazované recepty a suroviny.\n• Po kliknutí tlačítka suroviny se budou zobrazovat více recepty s touto surovinou.\n• Po zakliknutí se zobrazí možnost zadat přesné množství.\n• Pokud se tam nedá nic, aplikace bude počítat s tím, že máte vždy dostatek suroviny, jinak bude brát v potaz zadané množství.\n• Tlačítka vybrat/zrušit vše změní stav všech surovin.",
    results: "VÝSLEDKY\n\n• Recepty seřazené podle shody.",
    manage: "KUCHAŘKA\n\n• Seznam všech receptů.\n• Pomocí hledání najdete jídlo podle názvu.",
    detail: "POPIS RECEPTU\n\n• Porce - podle zadaného čísla se škálují ingredience v receptu.\n• Kliknutím na podrecept v textu na něj přejdete.\n• Barevné tagy ukazují, co máte v lednici.",
    editor: "EDITOR\n\n• KROK 1: Základní info a suroviny - všechny zadané suroviny se poté dají přidat v receptu.\n• KROK 2: Postup. Tlačítkem VLOŽIT vytvoříte v kroku receptu odkaz na ingredienci s její váhou a jednotkou, která se bude moct měnit podle počtu porcí."
  };

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

  useEffect(() => {
  const handler = (e: any) => {
    // Zabráníme prohlížeči v automatickém zobrazení výzvy
    e.preventDefault();
    setDeferredPrompt(e);
    setIsInstallable(true);
  };

  window.addEventListener('beforeinstallprompt', handler);

  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('SW OK', reg.scope))
          .catch(err => console.log('SW ERR', err));
      });
    }
    loadData();
  }, []);

  
  useEffect(() => { 
    localStorage.setItem('my_fridge', JSON.stringify(myIngredients)); 
  }, [myIngredients]);

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

  useEffect(() => {
  // Aplikuje třídu motivu na <html> prvek
  document.documentElement.className = `theme-${theme}`;
  localStorage.setItem('app-theme', theme);
}, [theme]);
  // --- COMPUTED ---
  const allIngredientNames = useMemo(() => {
    let relevantRecipes = recipes;
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

  const handleInstallApp = async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('Uživatel přijal instalaci');
  }
  
  setDeferredPrompt(null);
  setIsInstallable(false);
};

  const matchedRecipes = useMemo(() => {
    // 1. NEJPRVE FILTRUJEME: Ponecháme jen recepty splňující podmínky kategorií
    return recipes.filter(r => {
      if (selectedFilterCats.length === 0) return true;
      
      return categoryLogic === 'OR' 
        ? r.categories?.some(cat => selectedFilterCats.includes(cat))
        : selectedFilterCats.every(cat => r.categories?.includes(cat));
    })
    // 2. PRO POVOLENÉ RECEPTY SPOČÍTÁME SHODU SE SUROVINAMI
    .map(r => {
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
            if (!allRequiredIngs.has(key)) allRequiredIngs.set(key, 0);
          }
        });
      };

      collectIngs(r);

      const requiredNames = Array.from(allRequiredIngs.keys());
      if (requiredNames.length === 0) return { ...r, score: 100, matchedCount: 0 };

      let matchedCount = 0;
      requiredNames.forEach(name => {
        const myVal = myIngredients[name];
        if (myVal === undefined) return; 
        if (myVal === "") { matchedCount++; return; } 

        const myAmount = parseFloat(myVal.replace(',', '.'));
        const reqAmount = allRequiredIngs.get(name) || 0;

        if (!isNaN(myAmount) && myAmount >= reqAmount) {
          matchedCount++;
        }
      });

      const score = Math.round((matchedCount / requiredNames.length) * 100);
      return { ...r, score, matchedCount };
    })
    // 3. SEŘADÍME PODLE PROCENTUÁLNÍ SHODY
    .sort((a, b) => b.score - a.score); 
  }, [recipes, myIngredients, selectedFilterCats, categoryLogic]);

  const effectiveData = useMemo(() => {
    if (!selectedRecipe) return null;
    const base = viewHistoryIndex === null ? selectedRecipe : selectedRecipe.history[viewHistoryIndex];
    const subRecipes = (base.subRecipeIds || []).map(id => recipes.find(r => r.id === id)).filter((r): r is Recipe => !!r);
    const ingredientMap = new Map<string, number>();
    
    // Pomocná funkce pro agregaci a škálování surovin
    const processIngs = (ings: Ingredient[], sourceBaseServings: number) => {
      ings.forEach(ing => {
        const key = `${ing.name.toLowerCase().trim()}|${ing.unit.toLowerCase().trim()}`;
        const amount = parseFloat(ing.amount);
        if (!isNaN(amount)) {
          // KLÍČOVÁ ZMĚNA: Škálujeme podle (množství / základ_zdroje) * aktuálně_zobrazené_porce
          const scaled = (amount / sourceBaseServings) * viewServings;
          ingredientMap.set(key, (ingredientMap.get(key) || 0) + scaled);
        }
      });
    };

    // 1. Zpracujeme suroviny z podreceptů (každý má svůj vlastní baseServings)
    subRecipes.forEach(sub => processIngs(sub.ingredients, sub.baseServings));
    
    // 2. Zpracujeme suroviny z hlavního receptu
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
    return (editName.trim() !== "" && editPrep !== "" && editCook !== "" && editIngs.every(i => i.name.trim() !== ""));
  }, [editName, editPrep, editCook, editIngs]);

  const isStep2Valid = useMemo(() => {
    return editCategoryList.every(c => c.trim() !== "") && editSteps.every(s => s.trim() !== "");
  }, [editCategoryList, editSteps]);

  // --- ACTIONS ---
  const handleTagClick = (stepIdx: number, tagRaw: string) => {
    const content = tagRaw.slice(2, -2).split('|');
    setEditingTag({ stepIdx, tagRaw, name: content[0], amount: content[1] || "", unit: content[2] || "" });
  };

  const updateTag = (newName: string, newAmount: string, newUnit: string) => {
    if (!editingTag) return;
    const newTag = `{{${newName}|${newAmount}|${newUnit}}}`;
    const nSteps = [...editSteps];
    nSteps[editingTag.stepIdx] = nSteps[editingTag.stepIdx].replace(editingTag.tagRaw, newTag);
    setEditSteps(nSteps);
    setEditingTag(null);
  };

  const deleteTag = () => {
    if (!editingTag) return;
    const nSteps = [...editSteps];
    nSteps[editingTag.stepIdx] = nSteps[editingTag.stepIdx].replace(editingTag.tagRaw, "");
    setEditSteps(nSteps);
    setEditingTag(null);
  };

  const openEditor = (recipe: Recipe | null = null) => {
    if (recipe) {
      setEditId(recipe.id); setEditName(recipe.name); setEditCategoryList(recipe.categories);
      setEditPrep(recipe.prepTime); setEditCook(recipe.cookTime); setEditServings(recipe.baseServings);
      setEditIngs(recipe.ingredients); setEditSelectedSubIds(recipe.subRecipeIds); setEditSteps(recipe.steps);
    } else {
      setEditId(null); setEditName(''); setEditCategoryList(['']); setEditPrep(''); setEditCook('');
      setEditServings(1); setEditIngs([{ name: '', amount: '', unit: '' }]); setEditSelectedSubIds([]); setEditSteps(['']);
    }
    setModalStep(1); setSubSearch(''); setScene('editor');
  };

  const handleSave = () => {
    const ingredientTotals = new Map<string, { amount: number, unit: string }>();
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
          if (existing) existing.amount += amount;
          else ingredientTotals.set(key, { amount, unit });
        }
      }
    });

    const extractedIngredients: Ingredient[] = [];
    editIngs.forEach(ing => {
      const key = ing.name.toLowerCase();
      const total = ingredientTotals.get(key);
      if (total) {
        extractedIngredients.push({ name: ing.name, amount: (Math.round(total.amount * 10) / 10).toString(), unit: total.unit });
      } else if (ing.name.trim() !== "") {
        extractedIngredients.push({ name: ing.name, amount: "0", unit: "" });
      }
    });

    const newData: RecipeData = {
      name: editName.trim(),
      categories: editCategoryList.map(c => c.trim().toLowerCase()).filter(c => c !== ""),
      prepTime: editPrep, cookTime: editCook, baseServings: editServings,
      ingredients: extractedIngredients, subRecipeIds: editSelectedSubIds,
      steps: editSteps.filter(s => s.trim() !== ""), updatedAt: Date.now()
    };

    let updatedRecipes: Recipe[];
    if (editId) {
      updatedRecipes = recipes.map(r => {
        if (r.id === editId) {
          return { ...newData, id: editId, history: [{ ...r, versionLabel: (r.history?.length || 0) + 1 }, ...(r.history || [])] };
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
    navigator.clipboard.writeText(shareUrl).then(() => alert('Odkaz na recept byl zkopírován!'));
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Smazat tento recept?')) {
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

        // --- ŠKÁLOVÁNÍ PODRECEPTŮ ---
        if (idPart.startsWith("RECIPE:")) {
          const [, recipeId, recipeName] = idPart.split(':');
          const target = recipes.find(r => r.id === Number(recipeId));
          
          // Výpočet škálování: (původní_množství / základní_porce_podreceptu) * aktuální_porce
          const baseS = target?.baseServings || 1;
          const scaled = (parseFloat(customVal || "0") / baseS) * viewServings;
          
          return (
            <strong key={index} className="recipe-link-text" onClick={() => {
              if (target) { 
                setSelectedRecipe(target); 
                setViewHistoryIndex(null); 
                setViewServings(target.baseServings || 1); // Při prokliku nastavíme základní porce podreceptu
                setScene('detail'); 
              }
            }}>
              {Math.round(scaled * 10) / 10} {customUnit} {recipeName}
            </strong>
          );
        }

        // --- ŠKÁLOVÁNÍ INGREDIENCÍ ---
        const found = effectiveData?.ingredients.find(i => i.name.toLowerCase() === idPart.toLowerCase());
        if (found) {
          // Zde používáme baseServings hlavního (vybraného) receptu
          const baseS = selectedRecipe?.baseServings || 1;
          const scaled = (parseFloat(customVal || "0") / baseS) * viewServings;
          return (
            <strong key={index} className="ingredient-highlight">
              {Math.round(scaled * 10) / 10} {customUnit || found.unit} {found.name}
            </strong>
          );
        }
        return <span key={index} style={{ color: 'red' }}>{part}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <IonApp>
      <div id="app-container">
        {/* --- LEDNICE --- */}
        {scene === 'fridge' && (
          <div className="fade-in">
            <h2>Lednice</h2>
            <div className="category-logic-bar">
              <div className="logic-toggle-group">
                <button className={`logic-btn ${categoryLogic === 'OR' ? 'active' : ''}`} onClick={() => setCategoryLogic('OR')}>
                  JÍDLA OBSAHUJÍCÍ ALESPOŇ JEDNU Z TĚCHTO KATEGORIÍ
                </button>
                <button className={`logic-btn ${categoryLogic === 'AND' ? 'active' : ''}`} onClick={() => setCategoryLogic('AND')}>
                  JÍDLA OBSAHUJÍCÍ VŠECHNY TYTO KATEGORIE
                </button>
              </div>

              <div className="fridge-action-bar">
                <button className="btn secondary-btn small-btn" onClick={() => {
                  const next: {[key: string]: string} = {};
                  allIngredientNames.forEach(ing => next[ing.toLowerCase()] = "");
                  setMyIngredients(next);
                }}>VYBRAT VŠE</button>
                <button className="btn secondary-btn small-btn" onClick={() => setMyIngredients({})}>ZRUŠIT VŠE</button>
              </div>

              <div className="search-wrapper">
                <input className="custom-input" placeholder="Hledat kategorii" value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="category-selection-grid">
              {allCategories.filter(c => c.includes(categorySearchTerm.toLowerCase())).map(cat => (
                <button key={cat} className={`cat-select-btn ${selectedFilterCats.includes(cat) ? 'selected' : ''}`} onClick={() => setSelectedFilterCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="ingredients-section">
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
                        const next = { ...myIngredients }; next[ing.toLowerCase()] = e.target.value; setMyIngredients(next);
                      }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <br></br>
            <button className="btn success-btn main-action-btn" onClick={() => setScene('results')}>NAJÍT RECEPTY</button>
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
                <div key={r.id} className="recipe-card" style={{ opacity: r.score === 0 ? 0.6 : 1 }} onClick={() => {
                  setPrevScene(scene as 'results' | 'manage'); setSelectedRecipe(r); setViewHistoryIndex(null); setViewServings(r.baseServings || 1); setScene('detail');
                }}>
                  <span className="recipe-name">{r.name}</span>
                  <div className="time-info">🕒 {r.prepTime}m | 🔥 {r.cookTime}m</div>
                  {scene === 'results' && <div className={`score-tag ${r.score === 100 ? 'full' : ''}`}>Máš {r.score}% surovin</div>}
                  <div className="category-rows">
                    {r.categories?.map((c: string) => <div key={c} className="tag cat-tag">{c}</div>)}
                  </div>
                </div>
              ))}
            </div>
            <br></br>
            <button className="btn secondary-btn back-btn-fridge" onClick={() => setScene('fridge')}>ZPĚT</button>
          </div>
        )}

        {/* --- DETAIL RECEPTU --- */}
        {scene === 'detail' && selectedRecipe && effectiveData && (
          <div className="fade-in detail-view">
            {selectedRecipe.history && selectedRecipe.history.length > 0 && (
              <div className="version-bar">
                <label className="field-label">Zvolit verzi:</label>
                <select className="custom-input" value={viewHistoryIndex === null ? "current" : viewHistoryIndex} onChange={(e) => setViewHistoryIndex(e.target.value === "current" ? null : parseInt(e.target.value))}>
                  <option value="current">{selectedRecipe.history.length + 1} (Aktuální)</option>
                  {selectedRecipe.history.map((h: any, idx) => (
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
                  {effectiveData.ingredients.map((i, idx) => {
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
                {effectiveData.sections.map((section, sIdx) => (
                  <div key={sIdx} className="recipe-section">
                    <h4 className="section-title">{section.title}</h4>
                    {section.content.map((step, idx) => (
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
                  <button className="btn danger-btn" onClick={() => handleDelete(selectedRecipe.id)}>Smazat</button>
                  <button className="btn accent-btn" onClick={() => openEditor(selectedRecipe)}>Upravit</button>
                  <button className="btn share-btn" onClick={(e) => handleShare(e, selectedRecipe.id)}>Sdílet</button>
                </>
              ) : (
                <button className="btn secondary-btn" onClick={() => setViewHistoryIndex(null)}>Zpět na aktuální</button>
              )}
            </div>
          </div>
        )}

        {/* --- EDITOR --- */}
        {scene === 'editor' && (
          <div className="fade-in">
            {modalStep === 1 ? (
              <div>
                <h2>{editId ? 'Upravit recept' : 'Nový recept'}</h2>
                <label className="field-label">Jméno jídla</label>
                <input className="custom-input" value={editName} onChange={e => setEditName(e.target.value)} />
                
                <div className="editor-row">
                  <div className="flex-1">
                    <label className="field-label">Základní porce</label>
                    <input className="custom-input" type="number" value={editServings} onChange={e => setEditServings(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="flex-1">
                    <label className="field-label">Příprava (min)</label>
                    <input className="custom-input" value={editPrep} onChange={e => setEditPrep(e.target.value)} type="number" />
                  </div>
                  <div className="flex-1">
                    <label className="field-label">Vaření (min)</label>
                    <input className="custom-input" value={editCook} onChange={e => setEditCook(e.target.value)} type="number" />
                  </div>
                </div>

                <label className="field-label">Podrecepty:</label>
                <input className="custom-input sub-search" placeholder="Hledat podrecept..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
                <div className="sub-recipe-selector">
                  {filteredSubRecipes.map(r => (
                    <button key={r.id} className={`sub-btn ${editSelectedSubIds.includes(r.id) ? 'active' : ''}`} onClick={() => setEditSelectedSubIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}>{r.name}</button>
                  ))}
                </div>

                <label className="field-label">Seznam použitých surovin</label>
                {editIngs.map((ing, idx) => (
                  <div key={idx} className="ing-edit-row">
                    <input className="custom-input" value={ing.name} list="modal-ing-names" onChange={e => {
                      const oldName = ing.name.trim(); const newName = e.target.value; const nIngs = [...editIngs]; nIngs[idx].name = newName;
                      if (oldName !== "" && oldName !== newName) {
                        const nSteps = editSteps.map(step => {
                          const regex = new RegExp(`\\{\\{${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\||\\}\\})`, 'gi');
                          return step.replace(regex, (match, suffix) => `{{${newName}${suffix}`);
                        });
                        setEditSteps(nSteps);
                      }
                      setEditIngs(nIngs);
                    }} />
                    <button className="remove-row-btn" onClick={() => setEditIngs(editIngs.filter((_, i) => i !== idx))}>-</button>
                  </div>
                ))}
                <datalist id="modal-ing-names">{allIngredientNames.map(i => <option key={i} value={i} />)}</datalist>
                <div className="editor-step-actions">
  <button className="btn secondary-btn small-btn" onClick={() => setEditIngs([...editIngs, {name:'', amount:'', unit:''}])}>
    + DALŠÍ SUROVINA
  </button>
  <button className={`btn accent-btn next-step-btn ${!isStep1Valid ? 'disabled' : ''}`} onClick={() => isStep1Valid && setModalStep(2)}>
    DALŠÍ KROK →
  </button>
</div>              </div>
            ) : (
              <div>
                <h2>Kategorie a Postup</h2>
                <label className="field-label">Kategorie</label>
                {editCategoryList.map((cat, idx) => (
                  <div key={idx} className="ing-edit-row">
                    <input className="custom-input" value={cat} list="modal-cat-list" onChange={e => { const newList = [...editCategoryList]; newList[idx] = e.target.value; setEditCategoryList(newList); }} />
                    <button className="remove-row-btn" onClick={() => setEditCategoryList(editCategoryList.filter((_, i) => i !== idx))}>-</button>
                  </div>
                ))}
                <datalist id="modal-cat-list">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                <button className="btn secondary-btn small-btn" onClick={() => setEditCategoryList([...editCategoryList, ''])}>+ KATEGORIE</button>

                <label className="field-label editor-steps-label">Kroky postupu</label>
                {editSteps.map((s, idx) => (
                  <div key={idx} className="editor-step-card">
                    <div className="step-header">
                      <div className="step-num-small">{idx + 1}</div>
                      <div className="textarea-container">
                        <textarea className="textarea-common textarea-real" value={s} onChange={e => { const n = [...editSteps]; n[idx] = e.target.value; setEditSteps(n); }} onScroll={e => {
                            const target = e.target as HTMLTextAreaElement;
                            const visual = target.nextElementSibling as HTMLDivElement;
                            if (visual) visual.scrollTop = target.scrollTop;
                        }} />
                        <div className="textarea-common textarea-visual">
                          {s.split(/(\{\{.*?\}\})/g).map((part, i) => part.startsWith('{{') ? (
                            <span key={i} className={`editor-tag ${part.includes('RECIPE:') ? 'editor-tag-recipe' : ''}`} onMouseDown={(e) => { e.preventDefault(); handleTagClick(idx, part); }}>
                              {part.slice(2,-2).split('|')[1]} {part.slice(2,-2).split('|')[2]} {part.includes('RECIPE:') ? part.slice(2,-2).split('|')[0].split(':')[2] : part.slice(2,-2).split('|')[0]}
                            </span>
                          ) : part)}
                        </div>
                      </div>
                      <button className="remove-row-btn" onClick={() => setEditSteps(editSteps.filter((_, i) => i !== idx))}>-</button>
                    </div>

                    <div className="step-insert-panel">
                      <select id={`ing-name-select-${idx}`} className="custom-input flex-2">
                        <optgroup label="SUROVINY">
                          {editIngs.filter(i => i.name.trim() !== "").map((ing, iIdx) => <option key={iIdx} value={ing.name}>{ing.name}</option>)}
                        </optgroup>
                        <optgroup label="PODRECEPTY">
                          {recipes.filter(r => editSelectedSubIds.includes(r.id)).map(r => <option key={r.id} value={`RECIPE:${r.id}:${r.name}`}>{r.name}</option>)}
                        </optgroup>
                      </select>
                      <input id={`ing-val-input-${idx}`} type="number" className="custom-input flex-1" placeholder="Mn." />
                      <input id={`ing-unit-select-${idx}`} className="custom-input flex-1" placeholder="Jedn." list={`units-${idx}`} />
                      <datalist id={`units-${idx}`}>{commonUnits.map(u => <option key={u} value={u} />)}</datalist>
                      <button className="btn insert-btn" onClick={() => {
                        const sel = document.getElementById(`ing-name-select-${idx}`) as HTMLSelectElement;
                        const val = document.getElementById(`ing-val-input-${idx}`) as HTMLInputElement;
                        const unit = document.getElementById(`ing-unit-select-${idx}`) as HTMLInputElement;
                        if (!sel.value || !val.value) return alert("Vyberte položku a zadejte množství.");
                        const tag = `{{${sel.value}|${val.value}|${unit.value}}}`;
                        const n = [...editSteps]; n[idx] = n[idx] + (n[idx].length > 0 && !n[idx].endsWith(' ') ? ' ' : '') + tag;
                        setEditSteps(n); val.value = "";
                      }}>VLOŽIT</button>
                    </div>
                  </div>
                ))}
               <button 
  className="btn secondary-btn small-btn add-step-btn" 
  onClick={() => setEditSteps([...editSteps, ''])}
>
  + PŘIDAT KROK
</button>

<div className="editor-footer-actions">
  <button className="btn secondary-btn flex-1" onClick={() => setModalStep(1)}>
    ZPĚT
  </button>
  <button 
    className={`btn success-btn flex-2 ${!isStep2Valid ? 'disabled' : ''}`} 
    onClick={() => isStep2Valid && handleSave()}
  >
    ULOŽIT RECEPT
  </button>
</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
{showHelpModal && (
  <div className="tag-edit-overlay fade-in" onClick={() => setShowHelpModal(false)}>
    <div className="tag-edit-modal help-modal" onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, color: 'var(--accent)' }}>Nápověda</h2>
      </div>
      
      <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '0.95rem', color: '#ccc' }}>
        {helpTexts[scene] || "Pro tuto sekci zatím není nápověda."}
      </div>

      <div className="modal-actions-row" style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
        <button className="btn success-btn flex-2" onClick={() => setShowHelpModal(false)}>ROZUMÍM</button>
        <button className="btn secondary-btn flex-1" onClick={() => { setShowHelpModal(false); setShowSettingsModal(true); }}>
          ⚙️
        </button>
      </div>
    </div>
  </div>
)}

{/* --- MODÁLNÍ OKNO NASTAVENÍ --- */}
{showSettingsModal && (
  <div className="tag-edit-overlay fade-in" onClick={() => setShowSettingsModal(false)}>
    <div className="tag-edit-modal settings-modal" onClick={e => e.stopPropagation()}>
      <h2 style={{ color: 'var(--accent)', marginBottom: '20px' }}>Nastavení</h2>
      
      <div className="settings-content">
        <label className="field-label">Vzhled aplikace</label>
        <select 
          className="custom-input" 
          value={theme} 
          onChange={(e) => setTheme(e.target.value)}
          style={{ marginBottom: '20px' }}
        >
          <option value="dark">Tmavý</option>
          <option value="light">Světlý</option>
        </select>

<button className="btn accent-btn small-btn" onClick={handleInstallApp}>
              INSTALOVAT DO MOBILU
            </button> 
      </div>

      <div className="modal-actions" style={{ marginTop: '30px' }}>
        <button className="btn success-btn" onClick={() => setShowSettingsModal(false)}>ZAVŘÍT</button>
      </div>
    </div>
  </div>
)}

      {editingTag && (
        <div className="tag-edit-overlay">
          <div className="tag-edit-modal">
            <h3>Upravit položku</h3>
            <label className="field-label">Položka</label>
            <select className="custom-input" value={editingTag.name} onChange={e => setEditingTag({...editingTag, name: e.target.value})}>
              <optgroup label="SUROVINY">
                {editIngs.map((ing, iIdx) => <option key={iIdx} value={ing.name}>{ing.name}</option>)}
              </optgroup>
              <optgroup label="PODRECEPTY">
                {recipes.filter(r => editSelectedSubIds.includes(r.id)).map(r => <option key={r.id} value={`RECIPE:${r.id}:${r.name}`}>{r.name}</option>)}
              </optgroup>
            </select>
            <div className="editor-row">
              <div className="flex-1"><label className="field-label">Množství</label><input className="custom-input" type="number" value={editingTag.amount} onChange={e => setEditingTag({...editingTag, amount: e.target.value})} /></div>
              <div className="flex-1"><label className="field-label">Jednotka</label><input className="custom-input" value={editingTag.unit} onChange={e => setEditingTag({...editingTag, unit: e.target.value})} /></div>
            </div>
            <div className="modal-actions-list">
              <button className="btn success-btn" onClick={() => updateTag(editingTag.name, editingTag.amount, editingTag.unit)}>ULOŽIT</button>
              <button className="btn danger-btn" onClick={deleteTag}>SMAZAT</button>
              <button className="btn secondary-btn" onClick={() => setEditingTag(null)}>ZRUŠIT</button>
            </div>
          </div>
        </div>
      )}

      <nav className="nav-bar">
        <button className={`nav-btn ${scene === 'fridge' || (scene === 'detail' && prevScene === 'results') ? 'active' : ''}`} onClick={() => setScene('fridge')}>LEDNICE</button>
        <button className={`nav-btn ${scene === 'manage' || (scene === 'editor' && editId !== null) || (scene === 'detail' && prevScene === 'manage') ? 'active' : ''}`} onClick={() => setScene('manage')}>RECEPTY</button>
        <button className={`nav-btn ${scene === 'editor' && editId === null ? 'active' : ''}`} onClick={() => openEditor()}>PŘIDAT</button>
        <button className="nav-btn help-nav-btn" onClick={() => setShowHelpModal(true)}>HELP</button>
      </nav>
    </IonApp>
  );
};

export default App;