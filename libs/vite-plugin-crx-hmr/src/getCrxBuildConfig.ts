import type { BuildOptions } from 'vite'
import { PreRenderedChunk, PreRenderedAsset } from 'rollup'
import fs from 'fs'
import { resolve } from 'path'
import { parseMode } from './utils'

const viteDirname = process.cwd()

interface IProps {
    isDev: boolean
    mode: string
    pageInput?: string[]
}

/**
 * https://cn.vitejs.dev/guide/build.html
 * https://cn.vitejs.dev/config/build-options.html
 */
export const getCrxBuildConfig = ({
    isDev,
    mode,
    pageInput = [],
}: IProps): BuildOptions => {
    let input: Record<string, string> = {}
    let format: 'esm' | 'iife' = 'esm'
    const { isBackground, isIife } = parseMode(mode)
    const iifeName = process.env.CRX_IIFE_NAME
    if (isIife && !iifeName) {
        throw new Error('mode 为 iife 时需要在 package.json scripts 对应脚本中指定 process.env.CRX_IIFE_NAME 参数')
    }

    if (isBackground) {
        input = {
            [mode]: resolve(viteDirname, `src/entries/${mode}/${mode}.ts`),
        }
    } else if (isIife) {
        input = {
            [iifeName!]: resolve(viteDirname, `src/entries/${iifeName}/${iifeName}.ts`),
        }
        format = 'iife'
    } else {
        const defaultPageInput = [
            'newtab',
            'history',
            'bookmarks',

            'popup',
            'options',
            'side-panel',

            'devtools',
            'devtools-panel',
            'elements-sidebar-pane',
            'recorder',

            'update-version',
            'sandbox',
            'main',
        ]
        const allPageInput = [...pageInput, ...defaultPageInput]
        allPageInput.forEach((key) => {
            const pagePath = resolve(viteDirname, `src/entries/${key}/${key}.html`)
            if (!input[key] && fs.existsSync(pagePath)) {
                input[key] = pagePath
            }
        })
    }

    return {
        /**
         * 设置为 {} 则会启用 rollup 的监听器
         * 0、默认值为 null
         */
        watch: isDev ? {} : null,
        /**
         * 是否最小化混淆，或指定使用哪种混淆器
         * 0、默认值为 esbuild
         * 1、true | false | 'esbuild' | 'terser'
         */
        minify: isDev ? false : 'esbuild',
        /**
         * 构建后是否生成 source map 文件
         * 0、默认值为 false
         * 1、如果为 true，将会创建一个独立的 source map 文件
         * 2、如果为 'inline'，source map 将作为一个 data URI 附加在输出文件中
         * 3、'hidden' 的工作原理与 'true' 相似，只是 bundle 文件中相应的注释将不被保留。浏览器不会自动加载 sourcemap，需要在浏览器的调试控制台中右键 - Add source map
         */
        sourcemap: false,
        /**
         * 是否清空 outDir。这里不能配置为清空，否则会因为同时通过多个 npm script 指定不同 mode 启动导致互相清空
         * 0、默认值为 true
         */
        emptyOutDir: false,
        /**
         * 是否启用 CSS 代码拆分。启用代码分割时 content.css 会被内联到 content.js 内部
         * 0、默认值为 true
         */
        cssCodeSplit: false,
        /**
         * https://www.rollupjs.com/guide/big-list-of-options
         */
        rollupOptions: {
            input,
            output: {
                /**
                 * 自定义构建结果中的静态文件名称
                 * 0、默认值为 'assets/[name]-[hash][extname]'
                 */
                assetFileNames: (_chunkInfo: PreRenderedAsset) => {
                    // console.log(`assetFileName ${JSON.stringify(_chunkInfo)}`)
                    if (mode === 'iife') {
                        return `assets/${iifeName}[extname]`
                    }
                    return `assets/[name][extname]`
                },
                /**
                 * 对代码分割中产生的 chunk 文件自定义命名
                 * 0、默认值为 'assets/[name]-[hash].js'
                 */
                chunkFileNames: (_chunkInfo: PreRenderedChunk) => {
                    // console.log(`chunkFileName ${chunkInfo.name}`)
                    return 'assets/[name].js'
                },
                /**
                 * 指定 chunks 的入口文件名
                 * 0、默认值为 'assets/[name]-[hash].js'
                 */
                entryFileNames: (chunkInfo: PreRenderedChunk) => {
                    // console.log(`entryFileName ${chunkInfo.name}`)
                    // Chrome 扩展要求 background.js 必须要放到最外层
                    if (chunkInfo.name === 'background') {
                        return '[name].js'
                    }
                    return 'assets/[name].js'
                },
                /**
                 * 指定是否扩展 umd 或 iife 格式中 name 选项定义的全局变量
                 * 0、默认值为 false
                 */
                extend: true,
                format,
            },
        },
    }
}
