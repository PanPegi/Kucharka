import React from 'react';
import { Recipe } from '../types';

interface RecipeListProps {
  title: string;
  recipes: any[];
  showScore?: boolean;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onBack: () => void;
}

const RecipeList: React.FC<RecipeListProps> = ({
  title, recipes, showScore, searchTerm, onSearchChange, onSelectRecipe, onBack
}) => {
  return (
    <div className="fade-in">
      <h2>{title}</h2>
      {onSearchChange !== undefined && (
        <div className="search-wrapper">
          <input className="custom-input search-input" placeholder=" Vyhledat..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      )}
      <div className="recipe-grid">
        {recipes.map((r) => (
          <div key={r.id} className="recipe-card" style={{ opacity: r.score === 0 ? 0.6 : 1 }} onClick={() => onSelectRecipe(r)}>
            <span className="recipe-name">{r.name}</span>
            <div className="time-info">🕒 {r.prepTime}m | 🔥 {r.cookTime}m</div>
            {showScore && <div className={`score-tag ${r.score === 100 ? 'full' : ''}`}>Máš {r.score}% surovin</div>}
            <div className="category-rows">
              {r.categories?.map((c: string) => <div key={c} className="tag cat-tag">{c}</div>)}
            </div>
          </div>
        ))}
      </div>
      {/* <br></br> */}
      {/* <button className="btn secondary-btn back-btn-fridge" onClick={onBack}>ZPĚT</button> */}
    </div>
  );
};

export default RecipeList;