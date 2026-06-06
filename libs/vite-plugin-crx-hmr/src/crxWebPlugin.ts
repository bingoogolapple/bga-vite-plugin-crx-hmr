// 前期不涉及浏览器插件特有 API 时使用当前配置当做纯 Web 项目开发来提升开发效率
import type { PluginOption, BuildOptions } from 'vite'
import { resolve } from 'node:path'
import fs from 'node:fs'
import { DEFAULT_PAGE_INPUT } from './constants'

interface IProps {
  isDev: boolean
  pageInput?: string[]
}

const getWebBuildConfig = ({
  isDev,
  pageInput = [],
  viteRoot,
}: IProps & { viteRoot: string }): BuildOptions => {
  const input: Record<string, string> = {}
  // 使用 Set 去重：用户自定义 pageInput 优先，DEFAULT_PAGE_INPUT 补充
  const allPageInput = [...new Set([...pageInput, ...DEFAULT_PAGE_INPUT])]
  allPageInput.forEach((key) => {
    const pagePath = resolve(viteRoot, `src/entries/${key}/${key}.html`)
    if (!input[key] && fs.existsSync(pagePath)) {
      input[key] = pagePath
    }
  })

  return {
    watch: isDev ? {} : null,
    /**
     * Vite 8 默认使用 Oxc 进行压缩，生产模式直接使用默认值
     */
    minify: isDev ? false : 'oxc',
    sourcemap: false,
    emptyOutDir: true,
    cssCodeSplit: false,
    rolldownOptions: {
      input,
    },
  }
}

export const crxWebPlugin = ({ isDev, pageInput = [] }: IProps): PluginOption => {
  let viteRoot = process.cwd()

  return {
    name: '@bgafe/vite-plugin-crx-web',
    enforce: 'pre',

    config(config, _env) {
      // 在 config 钩子中尽早获取 root
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
          ...getWebBuildConfig({ isDev, pageInput, viteRoot }),
        },
      }
    },
  }
}
