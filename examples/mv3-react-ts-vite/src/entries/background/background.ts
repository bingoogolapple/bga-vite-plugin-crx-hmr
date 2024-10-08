// 该行为热更新自动生成1707289465453请勿修改

import { testChrome } from '@/utils/chrome-utils'
testChrome('background')

chrome.runtime.onInstalled.addListener(async (data: any) => {
  console.log('onInstalled 参数', JSON.stringify(data))
  // {"CHROME_UPDATE":"chrome_update","INSTALL":"install","SHARED_MODULE_UPDATE":"shared_module_update","UPDATE":"update"}
  if (data.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    let url = chrome.runtime.getURL('options.html')
    let tab = await chrome.tabs.create({ url })
    console.log(`background 安装完后打开选项 tab ${JSON.stringify(tab)}`)

    // 也可以直接使用 api 打开选项页面
    // chrome.runtime.openOptionsPage()
  }

  console.log('background 初始化完成')
})

chrome.runtime.onConnect.addListener((port) => {
  console.log('background chrome.runtime.onConnect', port)
  port.onMessage.addListener((msg) => {
    console.log('background port.onMessage', msg)
    port.postMessage('我是来自 background port.onMessage 的消息')
  })
})

chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  if (message?.mode === 'background' && message?.action === 'ping') {
    // 忽略开发期间 injectPage.ts 发来的 ping 消息
    return;
  }

  console.log('background chrome.runtime.onMessage', message, sender)
})
