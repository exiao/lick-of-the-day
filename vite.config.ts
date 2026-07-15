import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    process.env.ANALYZE === 'true'
      ? visualizer({
          filename: 'bundle-stats.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
        }) as PluginOption
      : undefined,
  ],
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
