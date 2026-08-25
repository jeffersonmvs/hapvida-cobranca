import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * BASE_PATH existe por causa do GitHub Pages, que serve o site numa subpasta
 * (/hapvida-cobranca/) em vez da raiz. O workflow de deploy define a variavel;
 * dev, preview, aceite e Netlify continuam em '/', que e o padrao.
 */
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
