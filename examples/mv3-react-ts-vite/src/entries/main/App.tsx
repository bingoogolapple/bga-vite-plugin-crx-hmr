import { useEffect } from 'react'

function App() {
  useEffect(() => {
    let count = 0
    const onMessage = (event: MessageEvent) => {
      console.log('父容器收到消息', event)
      if (count >= 2) {
        return
      }

      count++
      setTimeout(() => {
        event.source?.postMessage('我是来自父容器回复的消息', {
          targetOrigin: '*',
        })
      }, 2000)
    }
    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return (
    <div>
      <h1>main</h1>
      <ul>
        {Object.keys(chrome).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <iframe
        src={chrome.runtime.getURL('sandbox.html')}
        width="400"
        height="400"
      ></iframe>
    </div>
  )
}

export default App
