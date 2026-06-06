import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'

const VALID_BASE_MODES = ['iife', 'background', 'page', 'web']

/** iife 模式下的 name 来源，通过环境变量 CRX_IIFE_NAME 指定，如 CRX_IIFE_NAME=content */
export const getIifeName = (): string | undefined => process.env.CRX_IIFE_NAME || undefined

export const deleteFolderRecursive = (path: string) => {
  fs.rmSync(path, { recursive: true, force: true })
}

export const copyFolderRecursive = (src: string, dest: string) => {
  fs.cpSync(src, dest, { recursive: true })
}

export const getQueryString = (req: IncomingMessage, name: string): string | null => {
  if (!req.url) {
    return null
  }
  try {
    // req.url 形如 "/?mode=background" 或 "?mode=background"，需要补全 base 才能解析
    const url = new URL(req.url, 'http://localhost')
    return url.searchParams.get(name)
  } catch {
    return null
  }
}

/**
 * 解析 Vite mode 参数
 *
 * 支持的格式：
 * - "background" / "page" / "web"
 * - "iife"（需配合 CRX_IIFE_NAME 环境变量使用，如 cross-env CRX_IIFE_NAME=content vite build --mode iife）
 */
export const parseMode = (mode: string) => {
  if (!mode || !VALID_BASE_MODES.includes(mode)) {
    throw new Error(
      `[vite-plugin-crx-hmr] Invalid mode "${mode}". Expected one of: ${VALID_BASE_MODES.join(', ')}`,
    )
  }

  const isIife = mode === 'iife'
  const isBackground = mode === 'background'
  const isPage = mode === 'page'

  return {
    isIife,
    isBackground,
    isPage,
  }
}
