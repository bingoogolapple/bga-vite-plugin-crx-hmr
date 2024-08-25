const testWebWorker = (name: string) => {
  if (!URL?.createObjectURL) {
    console.log('chrome-utils', `${name} 中不支持 Worker`)
    return
  }

  const workerScript = `
    self.onmessage = function(e) {
      self.postMessage('origin: ' + e.data);
      // 不支持：background、extension_pages
      // 支持：sandbox、content-main、content-isolated、inject
      // self.postMessage('eval: ' + eval(e.data));
    };
  `
  // 创建一个新的 Blob 对象，其中包含你要执行的代码
  var blob = new Blob([workerScript], { type: 'application/javascript' })

  // 创建一个指向 Blob 对象的 URL
  var blobURL = URL.createObjectURL(blob)

  // 创建一个新的 Worker，并指向 Blob URL
  var worker = new Worker(blobURL)

  // 向 Worker 发送要执行的代码
  worker.postMessage('2 + 2')

  // 监听 Worker 的 message 事件，获取代码的执行结果
  worker.onmessage = function (e) {
    console.log('chrome-utils', `${name} 中测试 Worker`, e.data)
  }

  // 当不再需要这个 Worker 时，记得要终止它
  // worker.terminate()
}

export const testChrome = (name: string) => {
  console.log('chrome-utils', `我是来自 ${name} 的消息`, chrome)
  // 不支持：background、extension_pages、content-isolated
  // 支持：sandbox、content-main、inject
  if (
    ![
      'content',
      'content-isolated',
      'newtab',
      'options',
      'main',
      'side-panel',
      'background',
      'devtools-panel',
      'elements-sidebar-pane',
      'bookmarks',
      'history',
      'devtools',
    ].includes(name)
  ) {
    // console.log('chrome-utils', `${name} 中测试 eval`, eval('2 + 3'))
  }
  testWebWorker(name)
}
