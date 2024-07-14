const initCrxHmrPage = async () => {
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, _sendResponse) => {
      const pageName = '{pageNamePlaceholder}'
      if (request?.mode === 'page' && request?.action === 'reload') {
        console.log(`injectPage ${pageName} 收到刷新页面消息`, request, sender)
        window.location.reload()
      }
    })
    chrome.runtime.sendMessage({ mode: 'background', action: 'initCrxHmr' })

    // 对于 devtools 页面，当修改 background 后 reload 整个插件的场景就收不到上面的 onMessage 了，这里通过 catch sendMessage 的报错来自动刷新
    const clearId = setInterval(async () => {
      try {
        await chrome.runtime.sendMessage({ mode: 'background', action: 'ping' })
      } catch (e) {
        console.error('injectPage {pageNamePlaceholder} ping background 失败，刷新页面')
        clearInterval(clearId)
        setTimeout(() => {
          window.location.reload()
        }, 500);
      }
    }, 2000)
  }
}
initCrxHmrPage()
