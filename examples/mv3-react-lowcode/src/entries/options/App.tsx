function App() {
  return (
    <div>
      <h1>options</h1>
      <ul>{Object.keys(chrome).map(item => <li key={item}>{item}</li>)}</ul>
    </div>
  )
}

export default App
