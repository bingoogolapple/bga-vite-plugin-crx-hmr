import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import crxHmrPlugin from '@bgafe/vite-plugin-crx-hmr'

// https://cn.vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  console.log('process.env.NODE_ENV', process.env.NODE_ENV, mode)
  const isDev = process.env.NODE_ENV === 'development'

  return {
    plugins: [vue(), crxHmrPlugin({ mode, isDev })],
  }
})