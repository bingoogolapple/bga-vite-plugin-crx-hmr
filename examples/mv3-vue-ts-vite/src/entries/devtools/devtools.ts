import { testChrome } from '../../utils/chrome-utils'
testChrome('devtools')

const port = chrome.runtime.connect()
console.log('devtools chrome.runtime.onConnect', port)
port.onMessage.addListener((msg: any) => {
  console.log('devtools port.onMessage', msg)
})
port.postMessage('我是来自 devtools port.onMessage 的消息')

chrome.runtime.onMessage.addListener(
  (request: any, sender: any, sendResponse: any) => {
    console.log('devtools chrome.runtime.onMessage', request, sender)
    sendResponse('我是来自 devtools chrome.runtime.onMessage 的响应消息')
  }
)

// 可以创建多个面板
chrome.devtools.panels.create(
  'BGA面板',
  'images/32.png',
  'devtools-panel.html',
  (panel: chrome.devtools.panels.ExtensionPanel) => {
    console.log('devtools BGA面板创建成功', panel)
  }
)

// 创建 SidebarPane
chrome.devtools.panels.elements.createSidebarPane(
  "BGA Sidebar",
  (sidebarPane: chrome.devtools.panels.ExtensionSidebarPane) => {
    // 直接展示 kv 列表
    // sidebarPane.setObject({ some_data: "Some data to show" })

    // 展示独立页面
    sidebarPane.setPage(chrome.runtime.getURL('elements-sidebar-pane.html'))
  }
)
