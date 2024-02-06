import { copyFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, UserConfig, PluginOption } from 'vite'
import dts from 'vite-plugin-dts'
import WebSocket from 'ws'

// 用于打包完成后拷贝 injectBackground.ts 和 injectPage.ts 到 dist 目录中的 Vite 插件
const copyInjectCodePlugin = (mode: string): PluginOption => {
  return {
    name: '@bgafe/vite-plugin-crx-copy-inject-code',
    enforce: 'pre',
    writeBundle() {
      copyFileSync(resolve(__dirname, 'src/injectBackground.ts'), resolve(__dirname, 'dist/injectBackground.ts'))
      copyFileSync(resolve(__dirname, 'src/injectPage.ts'), resolve(__dirname, 'dist/injectPage.ts'))

      if (mode === 'development') {
        const crxHmrPort = 54321
        const hmrWebSocketClient = new WebSocket(
          `ws://127.0.0.1:${crxHmrPort}?mode=hmrPlugin`
        )
        hmrWebSocketClient.onopen = (_event) => {
          console.log('通知 vite 插件更新 onopen')
          hmrWebSocketClient.send('BACKGROUND_CHANGED', (err) => {
            console.log('通知 vite 插件更新 send BACKGROUND_CHANGED', err)
            hmrWebSocketClient.close()
          })
        }
        hmrWebSocketClient.onclose = (_event) => {
          console.log('通知 vite 插件更新 onclose')
        }
      }
    },
  }
}

// https://cn.vitejs.dev/config/
// https://cn.vitejs.dev/guide/build.html#library-mode
// https://cn.vitejs.dev/config/build-options.html#build-lib
export default defineConfig(({ mode }): UserConfig => {
  return {
    plugins: [
      dts({
        entryRoot: 'src', // 这里指定下 entryRoot 为 src，避免 monorepo 场景下生成的 .d.ts 目录混乱
      }),
      copyInjectCodePlugin(mode)
    ],
    build: {
      minify: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['es'],
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external: ['fs', 'util', 'child_process', 'path', 'http', 'url', 'events', 'ws', 'vite', 'rollup'],
      },
    },
  }
})
