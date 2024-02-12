# vite-plugin-crx-hmr

[![npm](https://img.shields.io/npm/v/@bgafe/vite-plugin-crx-hmr.svg) ![npm](https://img.shields.io/npm/dm/@bgafe/vite-plugin-crx-hmr.svg)](https://www.npmjs.com/package/@bgafe/vite-plugin-crx-hmr)

用于开发 Chromium manifest v3 插件的 Vite 热更新插件

## 功能介绍

1. 主要提供开发期间的热重载能力，监听文件变化后自动编译浏览器插件，并通知插件 background（Service Worker）自动重新加载、自动刷新页面
2. 该 Vite 插件内部添加了浏览器插件开发常用多入口配置
3. 已自测该 Vite 插件支持使用 React 和 Vue 来开发浏览器插件

## 基本使用

1. 安装依赖

```shell
pnpm add @bgafe/vite-plugin-crx-hmr -D
```

2. 在 vite.config.ts 中使用 crxHmrPlugin

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import crxHmrPlugin from '@bgafe/vite-plugin-crx-hmr'

export default defineConfig(async ({ mode }) => {
  const isDev = process.env.NODE_ENV === 'development'

  return {
    plugins: [react(), crxHmrPlugin({ mode, isDev })],
  }
})
```

3. 根据截图里的说明信息新建你业务所需的入口、新建并配置 public/manifest.json、配置 package.json 的 scripts

![usage](https://github.com/bingoogolapple/bga-vite-plugin-crx-hmr/assets/8949716/55344f19-4c68-4032-9d98-f163225eb82b)

## 扩展配置

1. 如果要新增 iife 脚本，直接新建对应入口，在 package.json 的 script 中添加相应的 build:xxx 即可

2. 插件内部针对 build:page（构建所有页面入口命令）预置了这些入口「newtab、history、bookmarks、popup、options、side-panel、devtools、devtools-panel、elements-sidebar-pane、recorder、update-version、sandbox、main」

![usage](https://github.com/bingoogolapple/bga-vite-plugin-crx-hmr/assets/8949716/d5905e2b-fdfc-48d4-9a2b-f81feda63caa)

如果这些默认页面入口名称不能满足你的业务需求，可在 vite.config.ts 中初始化 crxHmrPlugin 时通过 pageInput 参数指定新的页面入口

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import crxHmrPlugin from '@bgafe/vite-plugin-crx-hmr'
import { resolve } from 'path'

export default defineConfig(async ({ mode }) => {
  const isDev = process.env.NODE_ENV === 'development'

  return {
    plugins: [
      react(),
      crxHmrPlugin({
        mode,
        isDev,
        // 通过 pageInput 增加新的页面入口
        pageInput: {
          page1: resolve(process.cwd(), 'src/entries/page1/page1.html'),
        },
      }),
    ],
  }
})
```
