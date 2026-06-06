import { testChrome } from '@/utils/chrome-utils'
testChrome('inject')

// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
console.log('inject window.testName', window.testName)
// @ts-expect-error - Chrome extension content script injection - Chrome extension content script injection
window.testName = 'content'

const doc = document.documentElement
const interval = setInterval(() => {
  if (doc.scrollTop >= 1000) {
    clearInterval(interval)
  } else {
    doc.scrollTop += 2
  }
}, 50)
