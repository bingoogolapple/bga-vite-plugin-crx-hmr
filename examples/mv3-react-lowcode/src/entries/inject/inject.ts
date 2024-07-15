import { testChrome } from '@/utils/chrome-utils'
testChrome('inject')

// @ts-ignore
console.log('inject window.testName', window.testName)
// @ts-ignore
window.testName = 'content'

const doc = document.documentElement
const interval = setInterval(() => {
  if (doc.scrollTop >= 1000) {
    clearInterval(interval)
  } else {
    doc.scrollTop += 2
  }
}, 50)
