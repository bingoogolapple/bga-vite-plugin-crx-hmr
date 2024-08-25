// 不指定 world 时，默认就是 ISOLATED

// 这里需要 import 一下 content.css，否则不会被打包
import './content.css'

import { testChrome } from '@/utils/chrome-utils'
testChrome('content')

// @ts-ignore
console.log('content window.testName', window.testName)
// @ts-ignore
window.testName = 'content'

let checkHeadIntervalId = setInterval(() => {
    if (document.head) {
        console.log('在 content.ts 中注入 inject.ts')
        clearInterval(checkHeadIntervalId)

        // 动态加载文件时需要在 manifest.json -> web_accessible_resources 中配置
        let jsPath = 'assets/inject.js'
        let temp = document.createElement('script')
        temp.setAttribute('type', 'text/javascript')
        temp.src = chrome.runtime.getURL(jsPath)
        document.head.appendChild(temp)

        // 不支持 textContent
        // var script = document.createElement('script');
        // script.textContent = 'console.log("content.ts add script");';
        // document.head.appendChild(script);
        // script.remove();
    }
}, 50)

chrome.runtime.sendMessage({ 'type': 'content' })