import { testChrome } from '@/utils/chrome-utils'
testChrome('content-main')

// @ts-ignore
console.log('content-main window.testName', window.testName)
// @ts-ignore
window.testName = 'content-main'
