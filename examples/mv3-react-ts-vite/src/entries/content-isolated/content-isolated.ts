import { testChrome } from '@/utils/chrome-utils'
testChrome('content-isolated')

// @ts-ignore
console.log('content-isolated window.testName', window.testName)
// @ts-ignore
window.testName = 'content-isolated'

chrome.runtime.sendMessage({ type: 'content-isolated' })

// let checkHeadIntervalId = setInterval(() => {
//   if (document.head) {
//     clearInterval(checkHeadIntervalId)

//     // 不支持 textContent
//     var script = document.createElement('script')
//     script.textContent = 'console.log("content-isolated.ts add script");'
//     document.head.appendChild(script)
//     script.remove()
//   }
// }, 50)
