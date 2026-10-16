import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths work for both a root site and /repository-name/ on GitHub Pages.
  base: './',
})
