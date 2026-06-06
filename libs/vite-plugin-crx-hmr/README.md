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

![usage](https://github.com/user-attachments/assets/3fa8e298-a0c6-4fde-aaef-8e80bc6b89e2)

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
        // 仅需指定页面名称记录，例如指定 ['page1']，则插件内部会自动添加 resolve(process.cwd(), 'src/entries/page1/page1.html')
        pageInput: ['page1', 'page2'],
      }),
    ],
  }
})
```

## 原理

### 整体架构

插件将 Chrome 扩展开发中的多种模式（background、iife、page）拆分为独立的 Vite 构建进程，通过一个中心化的 WebSocket HMR 服务协调它们之间的热更新通信。

```mermaid
graph TB
    subgraph Dev["开发机（Node.js 进程）"]
        direction TB
        ViteBG["Vite 构建进程\n(--mode background)\nRolldown watch"]
        ViteIIFE["Vite 构建进程\n(--mode iife-content)\nRolldown watch"]
        VitePage["Vite 构建进程\n(--mode page)\nRolldown watch"]
        WSSrv["WebSocket Server\n:54321\n(background 进程持有)"]
        FSWatch["fs.watch\n监听 public/ 目录\n100ms debounce"]

        ViteBG -- "持有 & 启动" --> WSSrv
        ViteBG -- "持有 & 启动" --> FSWatch
        ViteIIFE -- "closeBundle → send IIFE_CHANGED" --> WSSrv
        VitePage -- "closeBundle → send PAGE_CHANGED" --> WSSrv
        FSWatch -- "文件同步到 dist/\nthen send BACKGROUND_CHANGED" --> WSSrv
    end

    subgraph Browser["浏览器（Chrome 扩展运行时）"]
        direction TB
        BG["background.js\n(Service Worker)\n注入 HMR 客户端"]
        PageJS["popup/options/… .js\n注入 page HMR 客户端"]
        IIFECtx["当前活动 Tab"]
    end

    WSSrv -- "WebSocket\nBACKGROUND_CHANGED\nIIFE_CHANGED\nPAGE_CHANGED" --> BG
    BG -- "chrome.runtime.reload()" --> BG
    BG -- "chrome.scripting\n.executeScript(reload)" --> IIFECtx
    BG -- "chrome.runtime\n.sendMessage(reload)" --> PageJS
    PageJS -- "window.location.reload()" --> PageJS
```

### 构建时：代码注入（transform 钩子）

Vite 在 `transform` 阶段，插件会向入口文件追加 HMR 客户端代码，使浏览器端具备接收热更新信号的能力。

```mermaid
flowchart TD
    T["Vite transform 钩子\n处理每个模块"] --> Q1{isDev?}
    Q1 -- 否 --> Pass["原样返回，不注入"]
    Q1 -- 是 --> Q2{构建模式}

    Q2 -- "background 模式\n且命中入口文件" --> InjectBG["追加 generateBackgroundInjectCode\n\n建立 WebSocket 连接到 :54321\n指数退避自动重连 1s→2s→…→30s\n每 3s 发送 keepalive 保活\n监听 BACKGROUND/IIFE/PAGE_CHANGED 消息"]

    Q2 -- "page 模式\n且命中入口 .ts/.tsx 文件" --> InjectPage["追加 generatePageInjectCode\n\n注册 chrome.runtime.onMessage 监听\n每 2s ping background（存活探针）\npong 失败则自动刷新页面"]

    Q2 -- "iife 模式" --> NoInject["不注入（background 代为处理刷新）"]

    InjectBG --> Bundle["Rolldown 打包输出 dist/"]
    InjectPage --> Bundle
    NoInject --> Bundle
```

### 运行时：HMR 消息流转

文件变更后，消息在 Node.js 进程与浏览器之间的完整传递链路：

```mermaid
sequenceDiagram
    participant Dev  as 开发者（修改源码）
    participant VBG  as Vite(background)
    participant VIIFE as Vite(iife)
    participant VPG  as Vite(page)
    participant WSS  as WebSocket Server
    participant BGjs as background.js (SW)
    participant Tab  as 活动 Tab / Page

    Note over VBG,WSS: background 模式下，Vite 进程持有 WebSocket Server

    Dev->>VBG: 修改 background 相关源码
    VBG->>VBG: Rolldown 重新构建 → closeBundle
    VBG->>WSS: handleServerChanged()<br/>广播 BACKGROUND_CHANGED
    WSS-->>BGjs: BACKGROUND_CHANGED
    BGjs->>BGjs: chrome.runtime.reload()<br/>Service Worker 重启

    Dev->>VIIFE: 修改 iife（content script）源码
    VIIFE->>VIIFE: Rolldown 重新构建 → closeBundle
    VIIFE->>WSS: send IIFE_CHANGED
    WSS-->>BGjs: IIFE_CHANGED
    BGjs->>Tab: chrome.scripting.executeScript<br/>window.location.reload()

    Dev->>VPG: 修改 page（popup/options 等）源码
    VPG->>VPG: Rolldown 重新构建 → closeBundle
    VPG->>WSS: send PAGE_CHANGED
    WSS-->>BGjs: PAGE_CHANGED
    BGjs->>Tab: chrome.runtime.sendMessage({action:'reload'})
    Tab->>Tab: window.location.reload()
```

### 特殊场景：插件自身代码变更（tsdown watch）

当 Vite 插件的 Node.js 源码（`libs/vite-plugin-crx-hmr`）在 watch 模式下重新构建完成时，需要触发扩展重载。由于此时没有 Vite 构建进程接管，`tsdown.config.ts` 中的 `build:done` 钩子扮演了触发者角色：

```mermaid
sequenceDiagram
    participant Dev  as 开发者（修改插件源码）
    participant TD   as tsdown watch
    participant WSS  as WebSocket Server
    participant BGts as background.ts（源文件）
    participant VBG  as Vite(background) watch
    participant BGjs as background.js (SW)

    Dev->>TD: 修改 libs/vite-plugin-crx-hmr/src/**
    TD->>TD: 重新构建 dist/index.mjs
    TD->>WSS: build:done 钩子<br/>send BACKGROUND_CHANGED<br/>（以 hmrPlugin 身份连接）
    WSS->>BGts: 修改 background.ts 首行注释<br/>// 该行为热更新自动生成{timestamp}请勿修改
    Note over BGts,VBG: 文件内容变化触发 Rolldown 重新构建
    VBG->>VBG: Rolldown 重新构建 background
    VBG->>WSS: closeBundle → 广播 BACKGROUND_CHANGED
    WSS-->>BGjs: BACKGROUND_CHANGED
    BGjs->>BGjs: chrome.runtime.reload()
```

### public 目录变更同步

`manifest.json`、图标等静态资源修改无需重新编译，插件通过 `fs.watch` 直接同步到 `dist/` 并触发扩展重载：

```mermaid
flowchart LR
    Dev["修改 public/ 下文件\nmanifest.json / 图标 / 静态资源"]
    --> Watch["fs.watch 递归监听\n100ms debounce 防抖\nSet 收集批量变更"]
    --> Sync["同步到 dist/\n增量：copyFileSync / cpSync\n删除：unlinkSync / rmSync"]
    --> BC["广播 BACKGROUND_CHANGED"]
    --> SW["background.js\nchrome.runtime.reload()"]
```
