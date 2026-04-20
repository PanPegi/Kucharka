import React from 'react';

interface FridgeProps {
  allCategories: string[];
  selectedFilterCats: string[];
  setSelectedFilterCats: React.Dispatch<React.SetStateAction<string[]>>;
  categoryLogic: 'AND' | 'OR';
  setCategoryLogic: (val: 'AND' | 'OR') => void;
  categorySearchTerm: string;
  setCategorySearchTerm: (val: string) => void;
  allIngredientNames: string[];
  myIngredients: {[key: string]: string};
  setMyIngredients: React.Dispatch<React.SetStateAction<{[key: string]: string}>>;
  onFindRecipes: () => void;
}

const Fridge: React.FC<FridgeProps> = ({
  allCategories, selectedFilterCats, setSelectedFilterCats, categoryLogic,
  setCategoryLogic, categorySearchTerm, setCategorySearchTerm, allIngredientNames,
  myIngredients, setMyIngredients, onFindRecipes
}) => {
  return (
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
      <button className="btn success-btn main-action-btn" onClick={onFindRecipes}>NAJÍT RECEPTY</button>
    </div>
  );
};

export default Fridge;