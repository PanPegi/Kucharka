import React, { useState, useEffect, useMemo } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import './App.css';

import { Recipe, Ingredient, RecipeData } from './types';
import Fridge from './components/Fridge';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import RecipeEditor from './components/RecipeEditor';
import HelpModal from './components/HelpModal';

setupIonicReact();

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'dark');
  const [editId, setEditId] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const helpTexts: { [key: string]: string } = {
    fridge: "LEDNICE\n\n• Zaklikávání kategorií filtruje zobrazované recepty a suroviny.\n• Po kliknutí tlačítka suroviny se budou prioritizovat recepty obsahující touto surovinou(pokud jí máte dostatek).\n• Po zakliknutí se zobrazí možnost zadat přesné množství.\n• Pokud se tam nedá nic, aplikace bude počítat s tím, že máte vždy dostatek suroviny, jinak bude brát v potaz zadané množství.\n• Tlačítka vybrat/zrušit vše změní stav všech surovin.",
    results: "VÝSLEDKY\n\n• Recepty seřazené podle shody kategorie a ingrediencí.",
    manage: "KUCHAŘKA\n\n• Seznam všech receptů.\n• Pomocí hledání najdete jídlo podle názvu.",
    detail: "POPIS RECEPTU\n\n• Porce - podle zadaného čísla se škálují ingredience v receptu na potřebné hodnoty.\n• Kliknutím na podrecept v textu na něj přejdete.\n• Barevné tagy ukazují, co máte v lednici (červená = nedostatek / zelená = dostatek).\n•Popřípadě se dá recept smazat/sdílet/upravit",
    editor: "EDITOR\n\n• KROK 1: Základní info a suroviny - uživatel musí zadat název,kategorie,základní počet porcí,časy,suroviny(doporučují se suroviny obsahující zadané podslovo) a podrecepty,které se budou poté dát použít ve druhé fázi tvoření receptu.\n\n• KROK 2: Postup. musí se zadat kroky postupu\n•Do postupu se píše postup do ,kterého se dají vkládat suroviny a podrecepty pomocí tlačítka vložit(v případě ,že je zadaná surovina,množství a jednotka) \n•po zmáčknutí se do textu vloží blok s ingrediencí a její hodnotou ,pro úpravu se klikne na bublinu => otevře se upravovací okno\n•až bude uživatel s receptem spokojený může ho tlačítkem uložit"
  };

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
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW ERR', err));
      });
    }
    loadData();
  }, []);

  useEffect(() => { localStorage.setItem('my_fridge', JSON.stringify(myIngredients)); }, [myIngredients]);

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
    localStorage.setItem('app-theme', theme);
  }, [theme]);

useEffect(() => {
  if (recipes.length === 0) return; 

  const params = new URLSearchParams(window.location.search);
  const recipeId = params.get('recipe');
  const versionIndex = params.get('v');

  if (recipeId) {
    const target = recipes.find(r => r.id === Number(recipeId));
    if (target) {
      setSelectedRecipe(target);
      setViewHistoryIndex(versionIndex !== null ? Number(versionIndex) : null);
      setViewServings(target.baseServings || 1);
      setScene('detail');
      setPrevScene('manage');
    }
  }
}, [recipes]);

  const allIngredientNames = useMemo(() => {
    let relevantRecipes = recipes;
    if (selectedFilterCats.length > 0) {
      relevantRecipes = recipes.filter(r => 
        categoryLogic === 'OR' 
          ? r.categories?.some(cat => selectedFilterCats.includes(cat))
          : selectedFilterCats.every(cat => r.categories?.includes(cat))
      );
    }
    const names = relevantRecipes.flatMap(r => r.ingredients.map(i => i.name));
    return [...new Set(names)].sort();
  }, [recipes, selectedFilterCats, categoryLogic]);

  const allCategories = useMemo(() => [...new Set(recipes.flatMap(r => r.categories || []))].sort(), [recipes]);

  const matchedRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (selectedFilterCats.length === 0) return true;
      return categoryLogic === 'OR' 
        ? r.categories?.some(cat => selectedFilterCats.includes(cat))
        : selectedFilterCats.every(cat => r.categories?.includes(cat));
    }).map(r => {
      const allRequiredIngs = new Map<string, number>();
      const collectIngs = (recipe: Recipe) => {
        (recipe.subRecipeIds || []).forEach(subId => {
          const sub = recipes.find(x => x.id === subId);
          if (sub) collectIngs(sub);
        });
        recipe.ingredients.forEach(ing => {
          const key = ing.name.toLowerCase().trim();
          const amount = parseFloat(ing.amount.replace(',', '.'));
          if (!isNaN(amount)) allRequiredIngs.set(key, (allRequiredIngs.get(key) || 0) + amount);
          else if (!allRequiredIngs.has(key)) allRequiredIngs.set(key, 0);
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
        if (!isNaN(myAmount) && myAmount >= reqAmount) matchedCount++;
      });
      return { ...r, score: Math.round((matchedCount / requiredNames.length) * 100) };
    }).sort((a, b) => (b as any).score - (a as any).score); 
  }, [recipes, myIngredients, selectedFilterCats, categoryLogic]);

  const effectiveData = useMemo(() => {
    if (!selectedRecipe) return null;
    const base = viewHistoryIndex === null ? selectedRecipe : selectedRecipe.history[viewHistoryIndex];
    const subRecipes = (base.subRecipeIds || []).map(id => recipes.find(r => r.id === id)).filter((r): r is Recipe => !!r);
    const ingredientMap = new Map<string, number>();
    
    const processIngs = (ings: Ingredient[], sourceBaseServings: number) => {
      ings.forEach(ing => {
        const key = `${ing.name.toLowerCase().trim()}|${ing.unit.toLowerCase().trim()}`;
        const amount = parseFloat(ing.amount);
        if (!isNaN(amount)) {
          const scaled = (amount / sourceBaseServings) * viewServings;
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

    return { 
      ...base, 
      ingredients: mergedIngredients, 
      sections: [
        ...subRecipes.map(sub => ({ title: `PŘÍPRAVA: ${sub.name.toUpperCase()}`, content: sub.steps })),
        { title: `DOKONČENÍ: ${base.name.toUpperCase()}`, content: base.steps }
      ]
    };
  }, [selectedRecipe, viewHistoryIndex, recipes, viewServings]);

  const handleSaveRecipe = (newData: RecipeData) => {
    let updated = editId 
      ? recipes.map(r => r.id === editId ? { 
          ...newData, 
          id: editId, 
          history: [{ ...r, versionLabel: (r.history?.length || 0) + 1 }, ...(r.history || [])] 
        } : r)
      : [...recipes, { ...newData, id: Date.now(), history: [] }];

    setRecipes(updated as Recipe[]);
    saveData(updated as Recipe[]);
    setScene('manage');
  };

  const renderStepWithIngredients = (stepText: string) => {
    const parts = stepText.split(/(\{\{.*?\}\})/g);
    return parts.map((part, index) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const rawContent = part.slice(2, -2).trim();
        const [idPart, customVal, customUnit] = rawContent.split('|').map(s => s?.trim());
        if (idPart.startsWith("RECIPE:")) {
          const [, recipeId, recipeName] = idPart.split(':');
          const target = recipes.find(r => r.id === Number(recipeId));
          const scaled = (parseFloat(customVal || "0") / (target?.baseServings || 1)) * viewServings;
          return (
            <strong key={index} className="recipe-link-text" onClick={() => {
              if (target) { setSelectedRecipe(target); setViewHistoryIndex(null); setViewServings(target.baseServings || 1); setScene('detail'); }
            }}>{Math.round(scaled * 10) / 10} {customUnit} {recipeName}</strong>
          );
        }
        const found = effectiveData?.ingredients.find(i => i.name.toLowerCase() === idPart.toLowerCase());
        if (found) {
          const scaled = (parseFloat(customVal || "0") / (selectedRecipe?.baseServings || 1)) * viewServings;
          return <strong key={index} className="ingredient-highlight">{Math.round(scaled * 10) / 10} {customUnit || found.unit} {found.name}</strong>;
        }
        return <span key={index} style={{ color: 'red' }}>{part}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <IonApp>
      <div id="app-container">
        {scene === 'fridge' && <Fridge allCategories={allCategories} selectedFilterCats={selectedFilterCats} setSelectedFilterCats={setSelectedFilterCats} categoryLogic={categoryLogic} setCategoryLogic={setCategoryLogic} categorySearchTerm={categorySearchTerm} setCategorySearchTerm={setCategorySearchTerm} allIngredientNames={allIngredientNames} myIngredients={myIngredients} setMyIngredients={setMyIngredients} onFindRecipes={() => setScene('results')} />}

        {(scene === 'results' || scene === 'manage') && <RecipeList title={scene === 'results' ? 'Výsledky' : 'Kuchařka'} recipes={scene === 'results' ? matchedRecipes : recipes.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))} showScore={scene === 'results'} searchTerm={searchTerm} onSearchChange={scene === 'manage' ? setSearchTerm : undefined} onBack={() => setScene('fridge')} onSelectRecipe={(r) => { setPrevScene(scene as 'results' | 'manage'); setSelectedRecipe(r); setViewHistoryIndex(null); setViewServings(r.baseServings || 1); setScene('detail'); }} />}

        {scene === 'detail' && selectedRecipe && effectiveData && <RecipeDetail selectedRecipe={selectedRecipe} effectiveData={effectiveData} viewHistoryIndex={viewHistoryIndex} setViewHistoryIndex={setViewHistoryIndex} viewServings={viewServings} setViewServings={setViewServings} myIngredients={myIngredients} onDelete={id => { if (window.confirm('Smazat?')) { const u = recipes.filter(x => x.id !== id); setRecipes(u); saveData(u); setScene('manage'); } }} onEdit={(r) => { setEditId(r?.id || null); setScene('editor'); }} onShare={(e, id) => { e.stopPropagation(); const url = `${window.location.origin}${window.location.pathname}?recipe=${id}`; navigator.clipboard.writeText(url).then(() => alert('Zkopírováno!')); }} onBackToCurrent={() => setViewHistoryIndex(null)} renderStepWithIngredients={renderStepWithIngredients} />}

        {scene === 'editor' && (
          <RecipeEditor 
            editId={editId} 
            recipes={recipes} 
            allIngredientNames={allIngredientNames} 
            allCategories={allCategories} 
            onSave={handleSaveRecipe} 
            onCancel={() => setScene('manage')}
            viewServings={viewServings}
          />
        )}
      </div>

      {showHelpModal && (
        <HelpModal 
          scene={scene} 
          helpTexts={helpTexts} 
          onClose={() => setShowHelpModal(false)} 
          onOpenSettings={() => setShowSettingsModal(true)} 
        />
      )}

      {showSettingsModal && (
        <div className="tag-edit-overlay fade-in" onClick={() => setShowSettingsModal(false)}>
          <div className="tag-edit-modal settings-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--accent)', marginBottom: '20px' }}>Nastavení</h2>
            <div className="settings-content">
              <label className="field-label">Vzhled aplikace</label>
              <select className="custom-input" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ marginBottom: '20px' }}>
                <option value="dark">Tmavý</option>
                <option value="light">Světlý</option>
              </select>
              {deferredPrompt && (
                <button className="btn accent-btn small-btn" onClick={() => { deferredPrompt.prompt(); setShowSettingsModal(false); }}>
                  INSTALOVAT DO MOBILU
                </button>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: '30px' }}>
              <button className="btn success-btn" onClick={() => setShowSettingsModal(false)}>ZAVŘÍT</button>
            </div>
          </div>
        </div>
      )}

      <nav className="nav-bar">
        <button className={`nav-btn ${scene === 'fridge' || (scene === 'detail' && prevScene === 'results') ? 'active' : ''}`} onClick={() => setScene('fridge')}>LEDNICE</button>
        <button className={`nav-btn ${scene === 'manage' || (scene === 'editor' && editId !== null) || (scene === 'detail' && prevScene === 'manage') ? 'active' : ''}`} onClick={() => setScene('manage')}>RECEPTY</button>
        <button className={`nav-btn ${scene === 'editor' && editId === null ? 'active' : ''}`} onClick={() => { setEditId(null); setScene('editor'); }}>PŘIDAT</button>
        <button className="nav-btn help-nav-btn" onClick={() => setShowHelpModal(true)}>HELP</button>
      </nav>
    </IonApp>
  );
};

export default App;