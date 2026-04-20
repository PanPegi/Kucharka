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

  const toggleIngredient = (ing: string) => {
    const key = ing.toLowerCase();
    const next = { ...myIngredients };
    if (next[key] !== undefined) {
      delete next[key];
    } else {
      next[key] = "";
    }
    setMyIngredients(next);
  };

  const updateAmount = (ing: string, val: string) => {
    const next = { ...myIngredients };
    next[ing.toLowerCase()] = val;
    setMyIngredients(next);
  };

  return (
    <div className="fade-in">
      <h2>Lednice</h2>
      <div className="category-logic-bar">
        <div className="logic-toggle-group">
          <button 
            className={`logic-btn ${categoryLogic === 'OR' ? 'active' : ''}`} 
            onClick={() => setCategoryLogic('OR')}
          >
            JÍDLA OBSAHUJÍCÍ ALESPOŇ JEDNU Z TĚCHTO KATEGORIÍ
          </button>
          <button 
            className={`logic-btn ${categoryLogic === 'AND' ? 'active' : ''}`} 
            onClick={() => setCategoryLogic('AND')}
          >
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
          <input 
            className="custom-input" 
            placeholder="Hledat kategorii" 
            value={categorySearchTerm} 
            onChange={(e) => setCategorySearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="category-selection-grid">
        {allCategories.filter(c => c.toLowerCase().includes(categorySearchTerm.toLowerCase())).map(cat => (
          <button 
            key={cat} 
            className={`cat-select-btn ${selectedFilterCats.includes(cat) ? 'selected' : ''}`} 
            onClick={() => setSelectedFilterCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="ingredients-section">
        <div className="responsive-grid">
          {allIngredientNames.map(ing => {
            const isSelected = myIngredients[ing.toLowerCase()] !== undefined;
            return (
              <div 
                key={ing} 
                className={`ing-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleIngredient(ing)}
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #4CAF50' : '1px solid #ddd',
                  padding: '10px',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  backgroundColor: isSelected ? '#f0f9f0' : '#fff',
                  transition: 'all 0.2s ease'
                }}
              >
                <div className="ing-main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="ing-name" style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>{ing}</span>
                  {/* {isSelected && <span className="check-icon">✓</span>} */}
                </div>
                
                {isSelected && (
                  <input 
                    className="small-amount-input" 
                    type="number" 
                    placeholder="Množství" 
                    value={myIngredients[ing.toLowerCase()]} 
                    onClick={(e) => e.stopPropagation()} // Zabrání odškrtnutí při kliku do pole
                    onChange={(e) => updateAmount(ing, e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <br />
      <button className="btn success-btn main-action-btn" onClick={onFindRecipes}>NAJÍT RECEPTY</button>
    </div>
  );
};

export default Fridge;