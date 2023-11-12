import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import TsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config
export default defineConfig({
  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
  plugins: [react(), TsconfigPaths()],
  resolve: {
    alias: {
      'next/link': path.resolve(__dirname, './wrappers/next-link.tsx'),
      'next/dynamic': path.resolve(__dirname, './wrappers/next-dynamic.tsx'),
      '@auth0/nextjs-auth0/client': path.resolve(__dirname, './wrappers/next-auth0-client.tsx'),
    },
  },
})
