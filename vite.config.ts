import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // KLÍČOVÝ ŘÁDEK: Nastaví relativní cesty pro build
  // Díky tomu bude index.html hledat soubory v 'assets/...' a ne v '/assets/...'
  base: './',
  
  build: {
    // Zajistí, že se vygeneruje čistý kód do složky dist
    outDir: 'dist',
    assetsDir: 'assets',
  }
})