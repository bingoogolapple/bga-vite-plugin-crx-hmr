const crxHmrPort = 54321

const getCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    // lastFocusedWindow: true,
  })
  if (!tab) {
    console.log('background getCurrentTab::', '当前 tab 为空')
    return
  }
  if (!tab.id) {
    console.log('background getCurrentTab::', '当前 tab 没有 id')
    return
  }
  console.log('background getCurrentTab::', '当前 tab 为', JSON.stringify(tab))
  return tab
}

const realReloadBackground = (webSocketClient: WebSocket | null) => {
  webSocketClient?.close()
  chrome.runtime.reload()
}

const reloadBackground = async (webSocketClient: WebSocket | null) => {
  const { currentPluginPageUrl, currentPluginPageTabId } =
    await chrome.storage.local.get([
      'currentPluginPageUrl',
      'currentPluginPageTabId',
    ])

  if (currentPluginPageUrl) {
    await chrome.storage.local.set({
      autoOpenCurrentPluginPageUrl: currentPluginPageUrl,
      autoOpenCurrentPluginPageTabId: currentPluginPageTabId,
    })
  }

  realReloadBackground(webSocketClient)
}

const reloadIife = async (webSocketClient: WebSocket | null) => {
  const tab = await getCurrentTab()
  if (
    !tab ||
    tab.url?.includes('newtab') ||
    tab.url?.includes(chrome.runtime.id)
  ) {
    return
  }

  // content 修改后需要 chrome.runtime.reload() 后才会生效，所以需要先注入延时刷新脚本，注入成功后再执行 chrome.runtime.reload()
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id! },
      func: () => {
        // 注入脚本后延时刷新
        setTimeout(() => {
          window.location.reload()
        }, 200)
      },
      args: [],
    },
    (injectionResults) => {
      for (const frameResult of injectionResults) {
        console.log('注入刷新页面脚本成功：' + JSON.stringify(frameResult))
      }

      if (webSocketClient) {
        realReloadBackground(webSocketClient)
      }
    }
  )
}

const reloadPage = async () => {
  // const tab = await getCurrentTab()
  // if (!tab) {
  //   return
  // }

  // 这种方式只能刷新当前选中的 tab，不支持自动刷新 popup、devtools、devtools-panel
  // chrome.tabs.reload(tab.id!)

  // 这种方式没权限刷新所有的 page
  // chrome.scripting
  //   .executeScript({
  //     target: { tabId: tab.id! },
  //     func: () => window.location.reload(),
  //   })
  //   .then((results) => {
  //     for (const result of results) {
  //       console.log(
  //         'background reloadPage::',
  //         '注入脚本成功',
  //         JSON.stringify(result)
  //       )
  //     }
  //   })
  //   .catch((e) => {
  //     console.log('background reloadPage::', '注入脚本失败', e)
  //   })

  // 这种方式会通知所有的 page
  chrome.runtime.sendMessage({ mode: 'page', action: 'reload' })
}

let hmrWebSocketClient: WebSocket | null
let keepAliveIntervalId: NodeJS.Timeout | null

const clearKeepAliveInterval = () => {
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId)
    keepAliveIntervalId = null
  }
}

const initCrxHmr = (retryCount: number) => {
  console.log('background initCrxHmr::', '初始化 webSocketClient', retryCount)

  hmrWebSocketClient = new WebSocket(
    `ws://127.0.0.1:${crxHmrPort}?mode=background`
  )

  // 1、定时发送心跳包，避免开发期间 Service Worker 休眠
  // 2、开发服务器重连检测
  keepAliveIntervalId = setInterval(() => {
    if (hmrWebSocketClient) {
      console.log('background initCrxHmr::', '发送 keepalive')
      hmrWebSocketClient.send('keepalive')
    } else {
      clearKeepAliveInterval()

      // 这里只检测 5 次，因为即使这里超过了检测次数，后续手动刷新任意页面时 injectPage.ts 中也会触发重新检测连接开发服务器
      if (retryCount < 5) {
        console.log('background initCrxHmr::', '尝试重连')
        initCrxHmr(retryCount + 1)
      } else {
        console.log('background initCrxHmr::', '超过最大次数，不再重连')
      }
    }
  }, 3 * 1000)

  hmrWebSocketClient.onopen = (event) => {
    console.log('background initCrxHmr::', 'onopen', event)
  }
  hmrWebSocketClient.onclose = (event) => {
    console.log('background initCrxHmr::', 'onclose', event)
    hmrWebSocketClient = null
  }

  hmrWebSocketClient.onmessage = (e) => {
    const { data } = e
    if (data === 'BACKGROUND_CHANGED') {
      console.log(
        'background initCrxHmr::',
        '收到更新 background.js 消息，关闭 ws 并重新加载'
      )

      reloadBackground(hmrWebSocketClient)
    } else if (data === 'IIFE_CHANGED') {
      console.log('background initCrxHmr::', '收到更新 iife 消息')

      reloadIife(hmrWebSocketClient)
    } else if (data === 'PAGE_CHANGED') {
      console.log('background initCrxHmr::', '收到更新 page 消息')

      reloadPage()
    }
  }
}

const saveCurrentPluginPage = async (tab: chrome.tabs.Tab) => {
  if (tab?.url?.includes('newtab') || tab?.url?.includes(chrome.runtime.id)) {
    await chrome.storage.local.set({
      currentPluginPageUrl: tab.url,
      currentPluginPageTabId: tab.id,
    })
  }
}
const removeCurrentPluginPage = async (tabId: number) => {
  const { currentPluginPageTabId } = await chrome.storage.local.get(
    'currentPluginPageTabId'
  )
  if (currentPluginPageTabId === tabId) {
    await chrome.storage.local.remove([
      'currentPluginPageUrl',
      'currentPluginPageTabId',
    ])
  }
}
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await removeCurrentPluginPage(tabId)
    await saveCurrentPluginPage(tab)
  }
})
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await removeCurrentPluginPage(tabId)
})
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  await saveCurrentPluginPage(tab)
})

chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request?.mode === 'background' && request?.action === 'initCrxHmr') {
    if (hmrWebSocketClient) {
      console.log('background', '已经存在 hmrWebSocketClient')
    } else {
      console.log('background', '不存在 hmrWebSocketClient')
      clearKeepAliveInterval()
      initCrxHmr(0)
    }
  }
})

initCrxHmr(0)

const handleAutoOpenCurrentPluginPageUrl = async () => {
  // 刷新 iife
  reloadIife(null)

  // 刷新之前打开的当前插件页面
  const { autoOpenCurrentPluginPageUrl, autoOpenCurrentPluginPageTabId } =
    await chrome.storage.local.get([
      'autoOpenCurrentPluginPageUrl',
      'autoOpenCurrentPluginPageTabId',
    ])
  if (autoOpenCurrentPluginPageUrl) {
    if (autoOpenCurrentPluginPageUrl.includes('newtab')) {
      await chrome.tabs.update(autoOpenCurrentPluginPageTabId, {
        url: autoOpenCurrentPluginPageUrl,
      })
    } else {
      await chrome.tabs.create({ url: autoOpenCurrentPluginPageUrl })
    }

    await chrome.storage.local.remove([
      'autoOpenCurrentPluginPageUrl',
      'autoOpenCurrentPluginPageTabId',
    ])
  }
}
handleAutoOpenCurrentPluginPageUrl()
