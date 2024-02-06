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

const reloadContent = async (webSocketClient: WebSocket) => {
  const tab = await getCurrentTab()
  if (!tab) {
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
        }, 200);
      },
      args: [],
    },
    (injectionResults) => {
      for (const frameResult of injectionResults) {
        console.log('注入刷新页面脚本成功：' + JSON.stringify(frameResult))
      }

      webSocketClient.close()
      chrome.runtime.reload()
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
export const initCrxHmrWebSocket = () => {
  console.log('background initWebSocketClient::', '初始化 webSocketClient')
  const webSocketClient = new WebSocket(
    `ws://127.0.0.1:${crxHmrPort}?mode=background`
  )
  setTimeout(() => {
    if (webSocketClient.readyState === WebSocket.CLOSED) {
      console.log('background initWebSocketClient::', '初始化 webSocketClient 失败')
    }
  }, 1500)
  webSocketClient.onopen = (event) => {
    console.log('background initWebSocketClient::', '初始化 webSocketClient 成功', event)
  }

  let isAlive = true
  webSocketClient.addEventListener('message', (e) => {
    const { data } = e
    if (data === 'BACKGROUND_CHANGED') {
      console.log(
        'background initWebSocketClient::',
        '收到更新 background.js 消息，关闭 ws 并重新加载'
      )
      webSocketClient.close()
      chrome.runtime.reload()
    } else if (data === 'CONTENT_CHANGED') {
      console.log(
        'background initWebSocketClient::',
        '收到更新 content 消息'
      )

      reloadContent(webSocketClient)
    } else if (data === 'PAGE_CHANGED') {
      console.log('background initWebSocketClient::', '收到更新页面消息')
      reloadPage()
    } else if (data === 'heartbeatMonitor') {
      console.log(
        'background initWebSocketClient::',
        'heartbeatMonitor'
      )
      isAlive = true
      const interval = setInterval(() => {
        if (!isAlive) {
          console.log(
            'background initWebSocketClient::',
            'heartbeatMonitor 非激活状态 => 重连来探测服务的是否在线'
          )
          const detectWs = new WebSocket(
            `ws://127.0.0.1:${crxHmrPort}?mode=backgroundDetect`
          )
          setTimeout(() => {
            if (detectWs.readyState === WebSocket.CLOSED) {
              console.log(
                'background initWebSocketClient::',
                'heartbeatMonitor 非激活状态 => 重连来探测服务的是否在线 => 不在线，清除定时任务'
              )
              clearInterval(interval)
            }
          }, 1500)
          detectWs.onopen = (event) => {
            console.log(
              'background initWebSocketClient::',
              'heartbeatMonitor 非激活状态 => 重连来探测服务的是否在线 => 在线',
              event
            )
            detectWs.close()
            webSocketClient.close()
            clearInterval(interval)
            initCrxHmrWebSocket()
          }
        }
      }, 3000)
    } else if (data === 'heartbeat') {
      console.log('background initWebSocketClient::', 'heartbeat')
      isAlive = true
      setTimeout(() => {
        isAlive = false
      }, 2500)
    }
  })
}
initCrxHmrWebSocket()
