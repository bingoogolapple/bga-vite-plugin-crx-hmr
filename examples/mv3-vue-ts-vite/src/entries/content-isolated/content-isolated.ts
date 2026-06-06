import { testChrome } from '@/utils/chrome-utils'
testChrome('content-isolated')

// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
console.log('content-isolated window.testName', window.testName)
// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
window.testName = 'content-isolated'

chrome.runtime.sendMessage({ type: 'content-isolated' })

const checkHeadIntervalId = setInterval(() => {
  if (document.head) {
    clearInterval(checkHeadIntervalId)

    // world 为 ISOLATED 时不支持 textContent
    // const script = document.createElement('script')
    // script.textContent = 'console.log("content-isolated.ts add script");'
    // document.head.appendChild(script)
    // script.remove()
  }
}, 50)
