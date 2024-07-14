import type { PluginOption, ResolvedConfig } from 'vite'
import WebSocket, { WebSocketServer } from 'ws'
import fs from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import watch from 'watch'
import {
    copyFolderRecursive,
    deleteFolderRecursive,
    getQueryString,
    parseMode,
    // killProcessByPort,
} from './utils'
import { getCrxBuildConfig } from './getCrxBuildConfig'
// import chokidar from 'chokidar'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const viteDirname = process.cwd()

const crxHmrPort = 54321

const logServer = (...args: any[]) =>
    console.log('WebSocketServer::', ...args)

const logClient = (...args: any[]) =>
    console.log('WebSocketServerClient::', ...args)

// 初始化开发期间 WebSocket 服务端
const initWebSocketServer = () => {
    let webSocketServer: WebSocketServer | null = null

    // 发送 BACKGROUND_CHANGED 通知 injectBackground.ts 执行 chrome.runtime.reload()
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

    // 监听到 public 目录变更时在 dist 目录中同步更新，然后发送 BACKGROUND_CHANGED 通知 injectBackground.ts 处理刷新操作
    const watchPublicDir = () => {
        logServer('监听 public 目录变更', resolve(viteDirname, 'public'))

        watch.createMonitor(resolve(viteDirname, 'public'), (monitor) => {
            monitor.on("created", (f, stat) => {
                logServer('监听到 public 目录中的新增', f)
                const path = String(f)
                const destFilePath = path.replace('/public/', '/dist/')
                if (stat.isDirectory()) {
                    logServer(`新建目录 ${path}`)
                    copyFolderRecursive(path, destFilePath)
                } else {
                    logServer(`拷贝文件 ${path} 到 ${destFilePath}`)
                    fs.copyFileSync(path, destFilePath)
                }
                handleServerChanged()
            })
            monitor.on("changed", (f, _curr, _prev) => {
                logServer('监听到 public 目录中的修改', f)
                const path = String(f)
                const destFilePath = path.replace('/public/', '/dist/')
                logServer(`拷贝文件 ${path} 到 ${destFilePath}`)
                fs.copyFileSync(path, destFilePath)
                handleServerChanged()
            })
            monitor.on("removed", (f, _stat) => {
                logServer('监听到 public 目录中的删除', f)
                const path = String(f)
                const destFilePath = path.replace('/public/', '/dist/')
                if (fs.existsSync(destFilePath)) {
                    if (fs.lstatSync(destFilePath).isDirectory()) {
                        logServer(`删除目录 ${destFilePath}`)
                        deleteFolderRecursive(destFilePath)
                    } else {
                        logServer(`删除文件 ${destFilePath}`)
                        if (fs.existsSync(destFilePath)) {
                            fs.unlinkSync(destFilePath)
                        }
                    }
                }
                handleServerChanged()
            })
        })

        // TODO 打包时会报错。RollupError: Unexpected character '�' (Note that you need plugins to import files that are not JavaScript)
        // chokidar
        //   .watch([resolve(viteDirname, 'public')], { ignoreInitial: true })
        //   .on('all', (event, path) => {
        //     logServer('监听到 public 目录中的文件变更', event, path)

        //     if (event === 'addDir') {
        //       return
        //     }

        //     const destFilePath = path.replace('/public/', '/dist/')

        //     if (event === 'unlink') {
        //       logServer('删除文件', destFilePath)
        //       fs.unlinkSync(destFilePath)
        //       return
        //     }
        //     if (event === 'unlinkDir') {
        //       logServer('删除目录', destFilePath)
        //       fs.rmdirSync(destFilePath)
        //       return
        //     }
        //     if (event === 'add') {
        //       const destFileParentPath = destFilePath.substring(
        //         0,
        //         destFilePath.lastIndexOf('/')
        //       )
        //       if (!fs.existsSync(destFileParentPath)) {
        //         logServer(`新建目录 ${destFileParentPath}`)
        //         fs.mkdirSync(destFileParentPath)
        //       }
        //     }

        //     logServer(`copy file ${path} to ${destFilePath}`)
        //     fs.copyFileSync(path, destFilePath)

        //     handleServerChanged()
        //   })
    }

    // 启动开发期间的 WebSocket 服务端，服务端收到文件变更消息后会分发给 injectBackground.ts 处理刷新操作
    const startWebSocketServer = () => {
        watchPublicDir()

        logServer('启动 WebSocketServer')
        webSocketServer = new WebSocketServer({ port: crxHmrPort })

        webSocketServer.on('connection', (webSocket, req) => {
            const mode = getQueryString(req, 'mode')
            logServer('收到新的客户端连接', mode, req.url)

            webSocket.on('message', (message) => {
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

                    // 这种方式没用，因为根本就没有重新构建 background
                    // handleServerChanged()

                    // 通过修改 background.ts 的首行注释内容来主动触发 background 构建
                    const backgroundTsPath = resolve(viteDirname, `src/entries/background/background.ts`)
                    fs.readFile(backgroundTsPath, 'utf8', (err, data) => {
                        if (err) {
                            return
                        }

                        let result = data
                        if (result.startsWith('// 该行为热更新自动生成')) {
                            result = result.replace(/该行为热更新自动生成\d{10,20}请勿修改/g, `该行为热更新自动生成${new Date().getTime()}请勿修改`)
                        } else {
                            result = `// 该行为热更新自动生成${new Date().getTime()}请勿修改\n\n${result}`
                        }
                        fs.writeFileSync(backgroundTsPath, result)
                    })
                }
            })

            webSocket.on('close', () => {
                logServer(`${mode} 断开连接，停止发送心跳`)
            })
        })
    }
    return {
        startWebSocketServer,
        handleServerChanged,
    }
}

// 初始化开发期间 WebSocket 客户端
const initWebSocketClient = (mode: string) => {
    let webSocketClient: WebSocket | null = null
    let isReady = false

    // 链接到 WebSocket 服务端，链接失败时等 1s 再自动重连
    const connectWebSocketServer = () => {
        if (webSocketClient || isReady) {
            return
        }

        try {
            webSocketClient = new WebSocket(
                `ws://127.0.0.1:${crxHmrPort}?mode=${mode}`
            )
            webSocketClient.onopen = (_event) => {
                logClient(mode, 'connectWebSocketServer => 成功')
                isReady = true
            }
        } catch (e) {
            logClient(mode, 'connectWebSocketServer => 失败', e)
            webSocketClient = null
            setTimeout(connectWebSocketServer, 1000)
        }
    }
    // 发送客户端文件变更消息给服务端，服务端收到文件变更消息后会分发给 injectBackground.ts 处理刷新操作
    const handleClientChanged = ({
        isIife,
        isPage,
    }: {
        isIife: boolean
        isPage: boolean
    }) => {
        if (!webSocketClient || !isReady) {
            logClient(
                mode,
                'handleClientChanged => 无 webSocketClient 或未连接到服务端'
            )
            return
        }

        logClient(
            mode,
            'handleClientChanged => 通过 WebSocket 触发 client 重新加载'
        )
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

interface IProps {
    isDev: boolean
    mode: string
    pageInput?: Record<string, string>
}

/**
 * hmr 插件
 * 1、启动文件监听服务
 * 2、打包期间注入 injectBackground.ts 和 injectPage.ts
 * 3、打包完成后发消息通知 injectBackground.ts 文件变更
 */
const crxHmrPlugin = ({ isDev, mode, pageInput }: IProps): PluginOption => {
    const { isBackground, isIife, isPage } = parseMode(mode)

    // if (isBackground) {
    //   killProcessByPort(crxHmrPort)
    // }

    const { startWebSocketServer, handleServerChanged } =
        initWebSocketServer()
    const { connectWebSocketServer, handleClientChanged } =
        initWebSocketClient(mode)

    let resolvedConfig: ResolvedConfig
    let resolvedInput: string[] = []

    return {
        name: '@bgafe/vite-plugin-crx-hmr',
        /**
         * https://cn.vitejs.dev/guide/api-plugin#plugin-ordering
         */
        enforce: 'pre',
        /**
         * 在解析 Vite 配置前调用。钩子接收原始用户配置（命令行选项指定的会与配置文件合并）和一个描述配置环境的变量，包含正在使用的 mode 和 command。
         * 它可以返回一个将被深度合并到现有配置中的部分配置对象，或者直接改变配置（如果默认的合并不能达到预期的结果）
         * https://cn.vitejs.dev/guide/api-plugin#config
         */
        config(config, env) {
            return {
                resolve: {
                    alias: {
                        '@': resolve(viteDirname, 'src'),
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
                    })
                }
            }
        },
        /**
         * 在解析 Vite 配置后调用。使用这个钩子读取和存储最终解析的配置。当插件需要根据运行的命令做一些不同的事情时，它也很有用。
         * https://cn.vitejs.dev/guide/api-plugin.html#configresolved
         */
        configResolved(config: ResolvedConfig) {
            resolvedConfig = config
            resolvedInput = Object.values(
                resolvedConfig.build.rollupOptions.input || {}
            ).map((item) => item.substring(0, item.lastIndexOf('.')))

            if (isDev) {
                if (isBackground) {
                    // 启动 ws 服务端
                    startWebSocketServer()
                } else if (isIife || isPage) {
                    // 链接 ws 服务端
                    setTimeout(connectWebSocketServer, 2000)
                }
            }
        },
        // 给 background.ts 注入 injectBackground.ts 或者给 page 的入口 ts/tsx 文件注入 injectPage.ts
        transform(code, id, _options) {
            if (isDev) {
                if (isBackground && id.includes('background/background.ts')) {
                    console.log(`给 ${id} 注入 injectBackground.ts`)
                    const injectDevCode = fs.readFileSync(
                        resolve(__dirname, 'injectBackground.ts'),
                        'utf-8'
                    )
                    // 加个 \n 换行，避免原始代码最后无空行并且最后一行不是分号结尾时报错
                    return code + '\n' + injectDevCode
                } else if (
                    isPage &&
                    resolvedInput.includes(id.substring(0, id.lastIndexOf('.'))) && !id.includes('.html')
                ) {
                    console.log(`给 ${id} 注入 injectPage.ts`)
                    let injectDevCode = fs.readFileSync(
                        resolve(__dirname, 'injectPage.ts'),
                        'utf-8'
                    )
                    injectDevCode = injectDevCode.replaceAll('{pageNamePlaceholder}', id.substring(id.lastIndexOf('/') + 1, id.lastIndexOf('.')))
                    return code + '\n' + injectDevCode
                }
            }

            return code
        },
        // 打包完成后通知服务端(background)或客户端(page、iife)代码更新
        closeBundle() {
            if (isPage) {
                // 把页面路径修改短一些，方便在 manifest.json 和 chrome.runtime.getURL 中少写点路径
                Object.entries(
                    resolvedConfig.build.rollupOptions.input || {}
                ).forEach(([key, value]) => {
                    if (value.endsWith('.html')) {
                        const from = value.replace('src/entries', 'dist/src/entries')
                        const to = from.replace(`/src/entries/${key}`, '')
                        fs.copyFileSync(from, to)
                    }
                })
                deleteFolderRecursive(resolve(viteDirname, 'dist/src'))
            }

            if (isDev) {
                if (isBackground) {
                    handleServerChanged()
                } else {
                    handleClientChanged({ isIife, isPage })
                }
            }
        },
    }
}

export default crxHmrPlugin