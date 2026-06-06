// 不指定 world 时，默认就是 ISOLATED

// 这里需要 import 一下 content.css，否则不会被打包
import './content.css'

import { testChrome } from '@/utils/chrome-utils'
testChrome('content')

// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
console.log('content window.testName', window.testName)
// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
window.testName = 'content'

const checkHeadIntervalId = setInterval(() => {
  if (document.head) {
    console.log('在 content.ts 中注入 inject.ts')
    clearInterval(checkHeadIntervalId)

    // 动态加载文件时需要在 manifest.json -> web_accessible_resources 中配置
    const jsPath = 'assets/inject.js'
    const temp = document.createElement('script')
    temp.setAttribute('type', 'text/javascript')
    temp.src = chrome.runtime.getURL(jsPath)
    document.head.appendChild(temp)

    // world 为 ISOLATED 时不支持 textContent
    // const script = document.createElement('script')
    // script.textContent = 'console.log("content.ts add script");'
    // document.head.appendChild(script)
    // script.remove()
  }
}, 50)

chrome.runtime.sendMessage({ type: 'content' })
