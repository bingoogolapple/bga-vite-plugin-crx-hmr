import { testChrome } from '@/utils/chrome-utils'
testChrome('content-main')

// @ts-ignore
console.log('content-main window.testName', window.testName)
// @ts-ignore
window.testName = 'content-main'


let checkHeadIntervalId = setInterval(() => {
    if (document.head) {
        clearInterval(checkHeadIntervalId)

        // 支持 textContent
        var script = document.createElement('script');
        script.textContent = 'console.log("content-main.ts add script");';
        document.head.appendChild(script);
        script.remove();
    }
}, 50)
