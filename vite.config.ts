import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy notation renderer into its own long-lived chunk so it
        // caches independently of app code. Tone.js is code-split automatically
        // via its dynamic import() (see utils/tone-loader); the group here only
        // gives its lazy chunk a stable, readable filename.
        codeSplitting: {
          groups: [
            { name: 'abcjs', test: /node_modules[\\/]abcjs[\\/]/ },
            { name: 'tone', test: /node_modules[\\/]tone[\\/]/ },
          ],
        },
      },
    },
  },
})
