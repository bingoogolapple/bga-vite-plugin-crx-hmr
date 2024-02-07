import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import crxHmrPlugin from '@bgafe/vite-plugin-crx-hmr'

// https://cn.vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  console.log('process.env.NODE_ENV', process.env.NODE_ENV, mode)
  const isDev = process.env.NODE_ENV === 'development'

  return {
    plugins: [react(), crxHmrPlugin({ mode, isDev })],
  }
})