/**
 * Chrome 扩展中常见的 page 入口名称列表
 * 在 getCrxBuildConfig 和 crxWebPlugin 中共享
 */
export const DEFAULT_PAGE_INPUT = [
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
] as const

/** 默认 WebSocket 端口 */
export const DEFAULT_CRX_HMR_PORT = 54321
