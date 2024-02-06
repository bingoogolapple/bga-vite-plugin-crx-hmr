import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react-swc'
import {
  crxHmrPlugin,
  getCrxBuildConfig,
} from '@bgafe/vite-plugin-crx-hmr'
import { resolve } from 'path'

// https://cn.vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  console.log('process.env.CRX_ENV', mode, process.env.CRX_ENV)
  const isDev = process.env.CRX_ENV === 'development'

  const plugins: PluginOption[] = [react()]
  if (isDev) {
    plugins.push(crxHmrPlugin({ mode }))
  }

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
    plugins,
    build: {
      ...crxBuildConfig,
    },
  }
})
