import type { PluginOption, ResolvedConfig } from 'vite'
import WebSocket, { WebSocketServer } from 'ws'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { copyFolderRecursive, deleteFolderRecursive, getQueryString, parseMode } from './utils'
import { getCrxBuildConfig } from './getCrxBuildConfig'
import { crxWebPlugin } from './crxWebPlugin'
import { DEFAULT_CRX_HMR_PORT } from './constants'
import { generateBackgroundInjectCode, generatePageInjectCode } from './injectCode'

/**
 * 从 resolvedConfig 中解析最终的构建输出目录
 * 优先使用用户自定义的 outDir，fallback 到 'dist'
 */
const resolveOutDir = (config: ResolvedConfig, viteRoot: string): string =>
  config.build.outDir ? resolve(config.root, config.build.outDir) : resolve(viteRoot, 'dist')

const logServer = (...args: unknown[]) => console.log('WebSocketServer::', ...args)

const logClient = (...args: unknown[]) => console.log('WebSocketServerClient::', ...args)

/**
 * 模块级资源注册表：追踪所有需要在进程退出时清理的资源实例
 * 解决多 port 实例场景下，后续实例资源无法被 exit handler 清理的问题
 */
const activeWatchers = new Set<fs.FSWatcher>()
const activeServers = new Set<WebSocketServer>()

/**
 * 单例标志：确保进程信号处理器只注册一次
 * 避免 Vite dev 模式下插件多次 configResolved 导致匿名函数监听器累积泄漏
 */
let exitHandlerRegistered = false

const registerExitHandlers = () => {
  if (exitHandlerRegistered) return
  exitHandlerRegistered = true

  const onExit = () => {
    // 清理所有 watcher 和 WebSocketServer 实例
    activeWatchers.forEach((w) => {
      try {
        w.close()
      } catch {} // eslint-disable-line no-empty
    })
    activeWatchers.clear()

    activeServers.forEach((srv) => {
      try {
        srv.close()
      } catch {} // eslint-disable-line no-empty
    })
    activeServers.clear()
  }

  process.once('exit', onExit)
  process.once('SIGINT', () => {
    onExit()
    process.exit(0)
  })
  process.once('SIGTERM', () => {
    onExit()
    process.exit(0)
  })
}

/**
 * 初始化开发期间 WebSocket 服务端
 */
const initWebSocketServer = (viteRoot: string, crxHmrPort: number, backgroundTsPath?: string) => {
  let webSocketServer: WebSocketServer | null = null

  // 发送 BACKGROUND_CHANGED 通知注入到 background.ts 的 HMR 客户端代码执行 chrome.runtime.reload()
  const handleServerChanged = () => {
    if (webSocketServer === null) {
      logServer('handleServerChanged => 无 webSocketServer')
      return
    }

    logServer('handleServerChanged => 通过 WebSocket 触发 background 重新加载')
    webSocketServer.clients.forEach((webSocket) => {
      webSocket.send('BACKGROUND_CHANGED')
    })
  }

  /**
   * 使用 Node 24 原生 fs.watch 递归监听 public 目录
   * 监听变更时在 dist 目录中同步更新，然后发送 BACKGROUND_CHANGED
   * 添加 100ms debounce，避免批量文件操作（git checkout、cp -r 等）触发重复构建
   * 使用 Set 收集 debounce 窗口内所有变更文件，确保批量操作不丢失
   */
  const watchPublicDir = (distDir: string) => {
    const publicDir = resolve(viteRoot, 'public')
    logServer('监听 public 目录变更', publicDir)

    if (!fs.existsSync(publicDir)) {
      logServer('public 目录不存在，跳过监听')
      return null
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const pendingChanges = new Set<string>()

    const watcher = fs.watch(publicDir, { recursive: true }, (eventType, filename) => {
      // filename 在 Linux 某些情况下可能为 null，跳过处理
      if (!filename) return

      logServer(`监听到 public 目录变更: ${eventType} ${filename}`)

      // 收集变更文件到 Set 中，debounce 触发时批量处理
      pendingChanges.add(filename)

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null

        // 取出并清空待处理集合
        const filesToProcess = [...pendingChanges]
        pendingChanges.clear()

        for (const file of filesToProcess) {
          const srcPath = resolve(publicDir, file)
          const destPath = resolve(distDir, file)

          try {
            if (fs.existsSync(srcPath)) {
              const stat = fs.statSync(srcPath)
              if (stat.isDirectory()) {
                copyFolderRecursive(srcPath, destPath)
              } else {
                // 确保目标目录存在
                const destDir = dirname(destPath)
                fs.mkdirSync(destDir, { recursive: true })
                fs.copyFileSync(srcPath, destPath)
              }
            } else {
              // 文件/目录被删除
              if (fs.existsSync(destPath)) {
                const stat = fs.lstatSync(destPath)
                if (stat.isDirectory()) {
                  deleteFolderRecursive(destPath)
                } else {
                  fs.unlinkSync(destPath)
                }
              }
            }
          } catch (err) {
            logServer(`同步 public 目录变更失败 [${file}]:`, err)
          }
        }

        handleServerChanged()
      }, 100)
    })

    // 注册到全局资源注册表，确保进程退出时被清理
    activeWatchers.add(watcher)
    watcher.once('close', () => activeWatchers.delete(watcher))

    return watcher
  }

  // 启动开发期间的 WebSocket 服务端
  const startWebSocketServer = (outDir: string) => {
    const publicWatcher = watchPublicDir(outDir)

    logServer('启动 WebSocketServer')

    // EADDRINUSE 由 ws 内部的 net.Server 异步触发，无法用 try/catch 捕获，
    // 必须在实例上监听 'error' 事件，否则会产生未处理异常导致进程崩溃
    webSocketServer = new WebSocketServer({ port: crxHmrPort })

    // 注册到全局资源注册表，确保进程退出时被清理
    activeServers.add(webSocketServer)
    webSocketServer.once('close', () => activeServers.delete(webSocketServer!))

    webSocketServer.on('error', (err) => {
      const nodeErr = err as NodeJS.ErrnoException
      if (nodeErr.code === 'EADDRINUSE') {
        logServer(
          `端口 ${crxHmrPort} 已被占用，HMR 服务启动失败。` +
            `请检查是否有其他 HMR 进程正在运行，或通过 port 选项指定其他端口。`,
        )
        activeServers.delete(webSocketServer!)
        webSocketServer = null
        // 端口失败时同步关闭已创建的 public 目录监听器，避免资源泄漏
        if (publicWatcher) {
          publicWatcher.close()
          activeWatchers.delete(publicWatcher)
        }
        return
      }
      // 其他非预期错误记录日志并优雅降级，避免在 EventEmitter error 回调中 throw 导致进程崩溃
      logServer('WebSocketServer 发生未预期错误:', err)
    })

    // 确保进程退出时通过全局注册表统一清理所有实例（支持多实例）
    registerExitHandlers()

    webSocketServer.on('connection', (webSocket, req) => {
      const mode = getQueryString(req, 'mode')
      logServer('收到新的客户端连接', mode, req.url)

      webSocket.on('message', async (message) => {
        const info = `${message}`
        if (info === 'IIFE_CHANGED') {
          logServer('监听到 iife 代码变化，通知客户端重新加载')
          webSocketServer?.clients.forEach((ws) => {
            ws.send(info)
          })
        } else if (info === 'PAGE_CHANGED') {
          logServer('监听到 page 代码变化，通知客户端重新加载')
          webSocketServer?.clients.forEach((ws) => {
            ws.send(info)
          })
        } else if (info === 'BACKGROUND_CHANGED') {
          logServer('监听到 hmrPlugin 代码变化，通知客户端重新加载')

          // 通过修改 background.ts 的首行注释内容来主动触发 background 构建
          // 优先使用从 resolvedConfig 推导出的路径，fallback 到默认约定路径
          const bgTsPath =
            backgroundTsPath ?? resolve(viteRoot, 'src/entries/background/background.ts')
          try {
            let data = await fsp.readFile(bgTsPath, 'utf8')
            if (data.startsWith('// 该行为热更新自动生成')) {
              data = data.replace(
                /该行为热更新自动生成\d{10,20}请勿修改/g,
                `该行为热更新自动生成${Date.now()}请勿修改`,
              )
            } else {
              data = `// 该行为热更新自动生成${Date.now()}请勿修改\n\n${data}`
            }
            await fsp.writeFile(bgTsPath, data)
          } catch (err) {
            logServer('修改 background.ts 失败:', err)
          }
        }
      })

      webSocket.on('close', () => {
        logServer(`${mode} 断开连接`)
      })
    })
  }

  return {
    startWebSocketServer,
    handleServerChanged,
  }
}

/**
 * 初始化开发期间 WebSocket 客户端
 *
 * onerror 和 onclose 在连接失败时通常会连续触发，cleanup() 内不清除 reconnectTimer，
 * 由 scheduleReconnect() 自身的幂等保护（if reconnectTimer return）防止重复调度，
 * 避免"onerror 设置 timer → onclose 的 cleanup 清除 timer → onclose 再次 scheduleReconnect 多设一个 timer"的竞态
 */
const initWebSocketClient = (mode: string, crxHmrPort: number) => {
  let webSocketClient: WebSocket | null = null
  let isReady = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 重置连接状态，不清除 reconnectTimer
   * onerror 和 onclose 均可安全调用，不会互相干扰重连调度
   */
  const cleanup = () => {
    isReady = false
    webSocketClient = null
    // 注意：不在此处清除 reconnectTimer，由 scheduleReconnect 内的幂等保护处理
    // 避免 onerror+onclose 双重触发时互相取消对方安排的重连
  }

  // 连接到 WebSocket 服务端，连接失败时自动重连（1s 间隔）
  const connectWebSocketServer = () => {
    if (isReady) {
      return
    }

    // 避免重复连接
    if (webSocketClient) {
      webSocketClient.close()
      webSocketClient = null
    }

    try {
      webSocketClient = new WebSocket(`ws://127.0.0.1:${crxHmrPort}?mode=${mode}`)

      webSocketClient.onopen = () => {
        logClient(mode, 'connectWebSocketServer => 成功')
        // 连接成功后取消待重连的 timer（如有），并标记为就绪
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        isReady = true
      }

      webSocketClient.onerror = (err) => {
        logClient(mode, 'connectWebSocketServer => error', err.message)
        cleanup()
        scheduleReconnect()
      }

      webSocketClient.onclose = () => {
        logClient(mode, 'connectWebSocketServer => 连接断开')
        cleanup()
        scheduleReconnect()
      }
    } catch (e) {
      logClient(mode, 'connectWebSocketServer => 创建失败', e)
      cleanup()
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    // 幂等保护：若已有待重连的 timer，则不重复调度
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectWebSocketServer()
    }, 1000)
  }

  // 发送客户端文件变更消息给服务端
  const handleClientChanged = ({ isIife, isPage }: { isIife: boolean; isPage: boolean }) => {
    if (!webSocketClient || !isReady) {
      logClient(mode, 'handleClientChanged => 无 webSocketClient 或未连接到服务端')
      return
    }

    logClient(mode, 'handleClientChanged => 通过 WebSocket 触发 client 重新加载')
    if (isIife) {
      webSocketClient.send('IIFE_CHANGED')
    } else if (isPage) {
      webSocketClient.send('PAGE_CHANGED')
    }
  }

  return {
    connectWebSocketServer,
    handleClientChanged,
  }
}

export interface IProps {
  isDev: boolean
  mode: string
  pageInput?: string[]
  /** WebSocket 端口号，默认 54321 */
  port?: number
}

/**
 * hmr 插件
 * 1、启动文件监听服务
 * 2、打包期间向 background.ts / page 入口注入 HMR 客户端代码
 * 3、打包完成后发消息通知客户端重新加载
 */
const crxHmrPlugin = ({ isDev, mode, pageInput, port }: IProps): PluginOption => {
  if (mode === 'web') {
    // 用于前期不涉及浏览器插件特有 API 时当做普通 Web 项目开发来提升开发效率
    return crxWebPlugin({ isDev, pageInput })
  }

  // Vite 在 preview / 不带 --mode 时默认将 mode 设为 "development" 或 "production"，
  // 这两个都不是扩展构建 mode，直接返回 null 使插件静默跳过，避免抛出无意义的错误
  if (mode === 'development' || mode === 'production') {
    return null
  }

  const { isBackground, isIife, isPage } = parseMode(mode)
  const crxHmrPort = port ?? DEFAULT_CRX_HMR_PORT

  let viteRoot = process.cwd() // 将在 configResolved 中更新为准确值
  let resolvedConfig: ResolvedConfig
  let resolvedOutDir = resolve(process.cwd(), 'dist') // 将在 configResolved 中更新为准确值
  let resolvedInput: string[] = []
  /**
   * background 模式下，唯一的入口路径（去掉扩展名），用于 transform 时精确匹配
   * 只注入 background 的那一个入口文件，避免误注入
   */
  let backgroundEntryWithoutExt: string | null = null

  // 延迟初始化，等待 configResolved 中获取 viteRoot 后再创建
  let wsServer: ReturnType<typeof initWebSocketServer> | null = null
  let wsClient: ReturnType<typeof initWebSocketClient> | null = null

  return {
    name: '@bgafe/vite-plugin-crx-hmr',
    enforce: 'pre',

    config(config, _env) {
      // 在 config 钩子中尽早获取 root（用户可能在 vite.config.ts 中自定义了 root）
      viteRoot = config.root ? resolve(config.root) : process.cwd()

      return {
        resolve: {
          alias: {
            '@': resolve(viteRoot, 'src'),
          },
        },
        css: {
          preprocessorOptions: {
            less: {
              javascriptEnabled: true,
            },
          },
        },
        build: {
          ...getCrxBuildConfig({
            isDev,
            mode,
            pageInput,
            viteRoot,
          }),
        },
      }
    },

    configResolved(config: ResolvedConfig) {
      resolvedConfig = config
      viteRoot = config.root
      resolvedOutDir = resolveOutDir(resolvedConfig, viteRoot)
      resolvedInput = Object.values(resolvedConfig.build.rolldownOptions.input || {}).map((item) =>
        (item as string).substring(0, (item as string).lastIndexOf('.')),
      )

      if (isDev) {
        if (isBackground) {
          // 从 resolvedConfig 中取出 background 的实际入口路径，避免硬编码
          const inputRecord = resolvedConfig.build.rolldownOptions.input as
            | Record<string, string>
            | undefined
          const backgroundTsPath = inputRecord?.[mode]
          // 预先计算 background 入口（去掉扩展名），供 transform 精确匹配
          backgroundEntryWithoutExt = backgroundTsPath
            ? backgroundTsPath.substring(0, backgroundTsPath.lastIndexOf('.'))
            : null
          wsServer = initWebSocketServer(viteRoot, crxHmrPort, backgroundTsPath)
          wsServer.startWebSocketServer(resolvedOutDir)
        } else if (isIife || isPage) {
          // 立即尝试连接（无需固定 2s 延迟），连接失败会自动退避重连
          wsClient = initWebSocketClient(mode, crxHmrPort)
          wsClient.connectWebSocketServer()
        }
      }
    },

    // 给 background.ts 注入 HMR 客户端代码，给 page 的入口 ts/tsx 文件注入页面刷新代码
    transform(code, id, _options) {
      if (isDev) {
        if (isBackground) {
          // 精确匹配：只对 configResolved 中记录的那一个 background 入口文件注入
          // 使用 backgroundEntryWithoutExt 而非 resolvedInput.includes，
          // 避免 background 模式下存在多入口时误注入非 background 文件
          const idWithoutExt = id.substring(0, id.lastIndexOf('.'))
          if (backgroundEntryWithoutExt && idWithoutExt === backgroundEntryWithoutExt) {
            console.log(`给 ${id} 注入 background HMR 代码`)
            return code + '\n' + generateBackgroundInjectCode(crxHmrPort)
          }
        } else if (
          isPage &&
          resolvedInput.includes(id.substring(0, id.lastIndexOf('.'))) &&
          !id.endsWith('.html')
        ) {
          const pageName = id.substring(id.lastIndexOf('/') + 1, id.lastIndexOf('.'))
          console.log(`给 ${id} 注入 page HMR 代码`)
          return code + '\n' + generatePageInjectCode(pageName)
        }
      }

      return code
    },

    // 打包完成后通知服务端(background)或客户端(page、iife)代码更新
    closeBundle() {
      if (isPage) {
        // 把页面 HTML 文件从 <outDir>/src/entries/xxx/xxx.html 拷贝到 <outDir>/xxx.html
        // 方便在 manifest.json 和 chrome.runtime.getURL 中少写点路径
        Object.entries(resolvedConfig.build.rolldownOptions.input || {}).forEach(([key, value]) => {
          const val = value as string
          if (val.endsWith('.html')) {
            // 构建产物路径：<outDir>/src/entries/<key>/<key>.html
            const from = resolve(resolvedOutDir, `src/entries/${key}/${key}.html`)
            // 简化后的路径：<outDir>/<key>.html
            const to = resolve(resolvedOutDir, `${key}.html`)
            if (fs.existsSync(from)) {
              fs.copyFileSync(from, to)
              // 拷贝完成后立即删除各自的入口子目录，而非整个 src 目录
              // 避免并行构建（如 background 也在写 dist/src/）时误删其他 mode 的产物
              deleteFolderRecursive(resolve(resolvedOutDir, `src/entries/${key}`))
            }
          }
        })
        // 若 src/entries 目录已为空（所有入口都已处理），再删除上层 src 目录
        const distEntriesDir = resolve(resolvedOutDir, 'src/entries')
        if (fs.existsSync(distEntriesDir) && fs.readdirSync(distEntriesDir).length === 0) {
          deleteFolderRecursive(resolve(resolvedOutDir, 'src'))
        }
      }

      if (isDev) {
        if (isBackground) {
          wsServer?.handleServerChanged()
        } else {
          wsClient?.handleClientChanged({ isIife, isPage })
        }
      }
    },
  }
}

export default crxHmrPlugin
