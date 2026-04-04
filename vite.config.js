import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: true,
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: (id) => {
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
          if (id.includes('@tanstack/react-virtual')) return 'virtual';
          if (id.includes('@paper-design/shaders-react')) return 'shaders';
          if (id.includes('jszip')) return 'zip';
          if (id.includes('lucide-react')) return 'icons';
        },
        // Fingerprinted asset names
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
  },
})
