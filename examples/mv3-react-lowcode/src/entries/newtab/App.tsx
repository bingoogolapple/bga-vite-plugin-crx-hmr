import { useCallback } from 'react'

function App() {
  const testSandbox = useCallback(async () => {
    let url = chrome.runtime.getURL('main.html')
    await chrome.tabs.create({ url })
  }, [])

  const testLowCode = useCallback(async () => {
    let url = chrome.runtime.getURL('lowcode-editor.html')
    await chrome.tabs.create({ url })
  }, [])

  return (
    <div>
      <h1>newtab</h1>
      <ul>
        {Object.keys(chrome).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button onClick={testSandbox}>打开 main.html 测试 sandbox.html</button>
      <button onClick={testLowCode}>打开低代码编辑器页面</button>
    </div>
  )
}

export default App
