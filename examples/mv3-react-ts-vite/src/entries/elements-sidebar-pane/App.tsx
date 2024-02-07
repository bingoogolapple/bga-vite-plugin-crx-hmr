// https://developer.chrome.com/docs/extensions/reference/api/sidePanel?hl=zh-cn
// https://learn.microsoft.com/zh-cn/microsoft-edge/extensions-chromium/developer-guide/sidebar

function App() {
  return (
    <div>
      <h1>elements-sidebar-pane</h1>
      <ul>{Object.keys(chrome).map(item => <li key={item}>{item}</li>)}</ul>
    </div>
  )
}

export default App
