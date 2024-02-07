import { testChrome } from '@/utils/chrome-utils'
testChrome('content-isolated')

// @ts-ignore
console.log('content-isolated window.testName', window.testName)
// @ts-ignore
window.testName = 'content-isolated'

chrome.runtime.sendMessage({'type': 'content-isolated'})
