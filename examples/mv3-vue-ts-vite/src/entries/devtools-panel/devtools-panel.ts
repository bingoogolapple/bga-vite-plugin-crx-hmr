import { createApp } from 'vue'
import App from './App.vue'
import '../../style/index.css'
import { testChrome } from '@/utils/chrome-utils'
testChrome('devtools-panel')

createApp(App).mount('#root')
