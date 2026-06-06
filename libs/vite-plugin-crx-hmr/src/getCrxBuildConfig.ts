import type { BuildOptions } from 'vite'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { parseMode, getIifeName } from './utils'
import { DEFAULT_PAGE_INPUT } from './constants'

interface IProps {
  isDev: boolean
  mode: string
  pageInput?: string[]
  viteRoot: string
}

/**
 * https://cn.vitejs.dev/guide/build.html
 * https://cn.vitejs.dev/config/build-options.html
 */
export const getCrxBuildConfig = ({
  isDev,
  mode,
  pageInput = [],
  viteRoot,
}: IProps): BuildOptions => {
  let input: Record<string, string> = {}
  let format: 'esm' | 'iife' = 'esm'
  const { isBackground, isIife } = parseMode(mode)
  const iifeName = getIifeName()

  if (isIife && !iifeName) {
    throw new Error(
      '[vite-plugin-crx-hmr] mode 为 iife 时需通过环境变量 CRX_IIFE_NAME 指定 iife name，' +
        '例如：cross-env CRX_IIFE_NAME=content vite build --mode iife',
    )
  }

  if (isBackground) {
    input = {
      [mode]: resolve(viteRoot, `src/entries/${mode}/${mode}.ts`),
    }
  } else if (isIife) {
    input = {
      [iifeName!]: resolve(viteRoot, `src/entries/${iifeName}/${iifeName}.ts`),
    }
    format = 'iife'
  } else {
    // 使用 Set 去重：用户自定义 pageInput 优先，DEFAULT_PAGE_INPUT 补充
    const allPageInput = [...new Set([...pageInput, ...DEFAULT_PAGE_INPUT])]
    allPageInput.forEach((key) => {
      const pagePath = resolve(viteRoot, `src/entries/${key}/${key}.html`)
      if (!input[key] && fs.existsSync(pagePath)) {
        input[key] = pagePath
      }
    })
  }

  type RolldownOptions = NonNullable<BuildOptions['rolldownOptions']>
  const rolldownOptions: RolldownOptions = {
    input,
    output: {
      assetFileNames: () => {
        if (isIife) {
          return `assets/${iifeName}[extname]`
        }
        return 'assets/[name][extname]'
      },
      chunkFileNames: (chunkInfo) => {
        // iife 模式下加上 iifeName 前缀，防止多个 iife 入口的 chunk 文件名冲突
        if (isIife && iifeName) {
          return `assets/${iifeName}-${chunkInfo.name}.js`
        }
        return 'assets/[name].js'
      },
      entryFileNames: (chunkInfo) => {
        // Chrome 扩展要求 background.js 必须要放到最外层
        if (chunkInfo.name === 'background') {
          return '[name].js'
        }
        return 'assets/[name].js'
      },
      extend: true,
      format,
    },
  }

  return {
    /**
     * 设置为 {} 则会启用 Rolldown 的监听器（Vite 8 使用 Rolldown 的 WatcherOptions）
     * 默认值为 null
     */
    watch: isDev ? {} : null,
    /**
     * 是否最小化混淆
     * Vite 8 默认使用 Oxc 进行压缩，生产模式直接使用默认值
     */
    minify: isDev ? false : 'oxc',
    /**
     * 构建后是否生成 source map 文件
     * 默认值为 false
     */
    sourcemap: false,
    /**
     * 是否清空 outDir。不能清空，否则多 mode 并行构建时会互相清空
     */
    emptyOutDir: false,
    /**
     * 是否启用 CSS 代码拆分
     */
    cssCodeSplit: false,
    rolldownOptions,
  }
}
