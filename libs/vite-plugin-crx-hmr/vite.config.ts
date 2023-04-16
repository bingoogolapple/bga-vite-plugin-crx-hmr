import { copyFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, UserConfig, PluginOption } from 'vite'
import dts from 'vite-plugin-dts'

// https://cn.vitejs.dev/config/
// https://cn.vitejs.dev/guide/build.html#library-mode
// https://cn.vitejs.dev/config/build-options.html#build-lib
export default defineConfig((): UserConfig => {
  const copyPlugin = (): PluginOption => {
    return {
      name: '@bgafe/vite-plugin-crx-copy-inject-code',
      enforce: 'pre',
      writeBundle() {
        copyFileSync(resolve(__dirname, 'src/injectBackground.ts'), resolve(__dirname, 'dist/injectBackground.ts'))
        copyFileSync(resolve(__dirname, 'src/injectPage.ts'), resolve(__dirname, 'dist/injectPage.ts'))
      },
    }
  }
  return {
    plugins: [
      dts({
        entryRoot: 'src', // 这里指定下 entryRoot 为 src，避免 monorepo 场景下生成的 .d.ts 目录混乱
      }),
      copyPlugin()
    ],
    build: {
      minify: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es'],
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external: ['fs', 'path', 'http', 'url', 'events', 'ws', 'vite', 'rollup'],
      },
    },
  }
})
