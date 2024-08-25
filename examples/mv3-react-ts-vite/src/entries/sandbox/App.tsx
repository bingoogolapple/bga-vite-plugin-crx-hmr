import { useEffect } from 'react'

function App() {
  useEffect(() => {
    // setTimeout(() => {
    //   eval(`alert("我是 sandbox eval alert")`)
    // }, 1000)

    const onMessage = (event: MessageEvent) => {
      console.log('子页面收到消息', event)
      setTimeout(() => {
        event.source?.postMessage(
          `我是来自子页面回复的消息 ${eval(`1 + 1 + 1`)}`,
          {
            targetOrigin: '*',
          }
        )
      }, 2000)
    }

    window.addEventListener('message', onMessage)

    window.parent.postMessage('我是来自子页面的消息', { targetOrigin: '*' })

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return (
    <div>
      <h1>sandbox</h1>
      <ul>
        {Object.keys(chrome).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default App
