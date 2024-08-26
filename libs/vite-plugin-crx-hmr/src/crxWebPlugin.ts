// 前期不涉及浏览器插件特有 API 时使用当前配置当做纯 Web 项目开发来提升开发效率
import type { PluginOption, BuildOptions } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

const viteDirname = process.cwd()

interface IProps {
  isDev: boolean
  pageInput?: string[]
}

const getWebBuildConfig = ({ isDev, pageInput = [] }: IProps): BuildOptions => {
  const input: Record<string, string> = {}
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
    sourcemap: isDev ? false : true,
    /**
     * 是否清空 outDir
     * 0、默认值为 true
     */
    emptyOutDir: true,
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
    },
  }
}

export const crxWebPlugin = ({ isDev, pageInput = [] }: IProps): PluginOption => {
  return {
    name: '@bgafe/vite-plugin-crx-web',
    enforce: 'pre',
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
          ...getWebBuildConfig({ isDev, pageInput }),
        },
      }
    },
  }
}
