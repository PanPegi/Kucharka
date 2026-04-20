export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface RecipeData {
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

export interface Recipe extends RecipeData {
  id: number;
  history: RecipeData[];
}