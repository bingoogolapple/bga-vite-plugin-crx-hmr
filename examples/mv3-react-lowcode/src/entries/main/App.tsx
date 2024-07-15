function App() {
  return (
    <div>
      <h1>main</h1>
      <ul>{Object.keys(chrome).map(item => <li key={item}>{item}</li>)}</ul>
      <iframe src={chrome.runtime.getURL('sandbox.html')} width="400" height="400"></iframe>
    </div>
  )
}

export default App
