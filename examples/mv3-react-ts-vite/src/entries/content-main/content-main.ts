import { testChrome } from '@/utils/chrome-utils'
testChrome('content-main')

// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
console.log('content-main window.testName', window.testName)
// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
window.testName = 'content-main'

const checkHeadIntervalId = setInterval(() => {
  if (document.head) {
    clearInterval(checkHeadIntervalId)

    // world 为 MAIN 时支持 textContent
    const script = document.createElement('script')
    script.textContent = 'console.log("content-main.ts add script");'
    document.head.appendChild(script)
    script.remove()
  }
}, 50)
