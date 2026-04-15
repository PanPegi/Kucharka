import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  /**
   * base: './' zajistí, že všechny cesty v index.html budou relativní.
   * To je nejlepší řešení pro Homel, protože aplikace pak funguje 
   * v jakékoliv složce (public_html, projekt2 atd.) bez nutnosti 
   * měnit kód.
   */
  base: './',

  plugins: [react()],

  build: {
    // Složka, do které se vygeneruje výsledný web
    outDir: 'dist',
    // Před každým buildem složku vyčistí, aby tam nezůstal starý kód
    emptyOutDir: true,
    // Vypne hashování názvů, pokud bys měl problémy s mezipamětí, 
    // ale pro produkci je lepší nechat výchozí (vypnuto = smazat tento řádek)
  },

  server: {
    // Nastavení pro lokální vývoj (npm run dev)
    port: 3000,
    strictPort: true,
  }
});