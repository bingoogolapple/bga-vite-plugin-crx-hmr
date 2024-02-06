import { useEffect } from "react"

function App() {
  useEffect(() => {
    setTimeout(() => {
      eval(`
      alert("我是 sandbox eval alert")
      `)
    }, 1000);
  }, [])
  return (
    <div>
      <h1>sandbox</h1>
      <ul>{Object.keys(chrome).map(item => <li>{item}</li>)}</ul>
    </div>
  )
}

export default App
