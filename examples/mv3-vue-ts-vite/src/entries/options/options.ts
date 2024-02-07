import { createApp } from 'vue'
import App from './App.vue'
import '../../style/index.css'
import { testChrome } from '@/utils/chrome-utils'
testChrome('options')

createApp(App).mount('#root')
