import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'] 
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
       
        inlineDynamicImports: false
      }
    }
  },
  server: {
    fs: {
      strict: false 
    }
  }
})