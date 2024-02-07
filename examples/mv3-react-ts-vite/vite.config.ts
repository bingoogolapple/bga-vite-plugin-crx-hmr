import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import {
  crxHmrPlugin,
  getCrxBuildConfig,
} from '@bgafe/vite-plugin-crx-hmr'
import { resolve } from 'path'

// https://cn.vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  console.log('process.env.NODE_ENV', process.env.NODE_ENV, mode)
  const isDev = process.env.NODE_ENV === 'development'

  const crxBuildConfig = getCrxBuildConfig({
    isDev,
    mode,
  })

  return {
    define: {
      __DEV__: isDev,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [react(), crxHmrPlugin({ mode, isDev })],
    build: {
      ...crxBuildConfig,
    },
  }
})
