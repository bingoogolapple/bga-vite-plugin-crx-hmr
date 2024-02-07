import { useCallback } from 'react'

function App() {
  const testSandbox = useCallback(async () => {
    let url = chrome.runtime.getURL('main.html')
    await chrome.tabs.create({ url })
  }, [])

  return (
    <div>
      <h1>newtab</h1>
      <ul>{Object.keys(chrome).map(item => <li key={item}>{item}</li>)}</ul>
      <button onClick={testSandbox}>打开 main.html 测试 sandbox.html</button>
    </div>
  )
}

export default App
