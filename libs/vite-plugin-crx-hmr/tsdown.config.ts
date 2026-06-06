import { builtinModules } from 'node:module'
import { defineConfig } from 'tsdown'
import WebSocket from 'ws'
import { DEFAULT_CRX_HMR_PORT } from './src/constants'

// 第三方依赖（不打包进产物）
const externalDeps = ['ws', 'vite']

export default defineConfig({
  entry: 'src/index.ts',
  format: 'esm',
  dts: true,
  outDir: 'dist',
  clean: true,
  minify: false,
  platform: 'node',
  // 排除 Node.js 内置模块和第三方依赖
  inputOptions: {
    external: [
      // 匹配 node: 前缀的内置模块（如 node:fs、node:path）
      /^node:/,
      // 动态获取所有 Node.js 内置模块名（不带前缀），避免手工维护列表遗漏
      ...builtinModules,
      // 第三方依赖
      ...externalDeps,
    ],
  },
  hooks: {
    // 等价于 Vite 的 writeBundle 钩子
    // 开发模式下构建完成后，通知 vite 插件的 WebSocket 服务端触发扩展重载
    'build:done': async (ctx) => {
      // watch 模式即开发模式，构建完成后通知 HMR 服务端触发扩展重载
      const isWatch = !!ctx.options.watch
      if (!isWatch) return

      try {
        const hmrWebSocketClient = new WebSocket(
          `ws://127.0.0.1:${DEFAULT_CRX_HMR_PORT}?mode=hmrPlugin`,
        )

        // 5s 超时保护：防止连接建立后长时间悬空（HMR 服务端可能不可达）
        const timeoutId = setTimeout(() => {
          console.log('通知 vite 插件更新超时，强制关闭连接')
          hmrWebSocketClient.terminate()
        }, 5000)

        hmrWebSocketClient.onopen = () => {
          console.log('通知 vite 插件更新 onopen')
          hmrWebSocketClient.send('BACKGROUND_CHANGED', (err) => {
            if (err) {
              console.log('通知 vite 插件更新 send BACKGROUND_CHANGED 失败:', err)
            } else {
              console.log('通知 vite 插件更新 send BACKGROUND_CHANGED 成功')
            }
            // 发送完毕后关闭连接，由 onclose 统一负责清除 timeoutId
            hmrWebSocketClient.close()
          })
        }
        hmrWebSocketClient.onerror = (err) => {
          console.log('通知 vite 插件更新 onerror（HMR 服务端可能未启动）', err.message)
          // onerror 后 ws 会触发 onclose，由 onclose 统一清除 timeoutId
        }
        hmrWebSocketClient.onclose = () => {
          // onclose 是连接生命周期的最终事件（成功发送、onerror、超时 terminate 均会触发），
          // 统一在此处清除超时保护 timer，避免多处 clearTimeout 造成逻辑分散
          clearTimeout(timeoutId)
          console.log('通知 vite 插件更新 onclose')
        }
      } catch (err) {
        console.log('通知 vite 插件更新失败:', err)
      }
    },
  },
})
