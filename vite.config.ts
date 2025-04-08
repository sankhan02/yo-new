import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'



// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      buffer: 'buffer/','@': path.resolve(__dirname, './src'),
    }
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag:any) => ['appkit-button', 'appkit-network-button'].includes(tag),
        },
      },
    }),tailwindcss()
  ]
})
