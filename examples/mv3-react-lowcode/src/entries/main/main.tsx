import ReactDOM from "react-dom";
import '../../style/index.css'
import App from './App'

import { testChrome } from '@/utils/chrome-utils'
testChrome('main')

ReactDOM.render(<App />, document.getElementById('root'))
