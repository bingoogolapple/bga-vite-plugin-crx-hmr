/**
 * 生成注入到 background.ts 的 HMR 客户端代码
 *
 * 此函数返回的代码将在 Chrome 扩展的 Service Worker 中运行，
 * 负责建立 WebSocket 连接并响应各种 HMR 消息。
 */
export function generateBackgroundInjectCode(port: number): string {
  return `
;(function() {
  const crxHmrPort = ${port};

  const getCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      console.log('background getCurrentTab::', '当前 tab 为空');
      return;
    }
    if (!tab.id) {
      console.log('background getCurrentTab::', '当前 tab 没有 id');
      return;
    }
    console.log('background getCurrentTab::', '当前 tab 为', JSON.stringify(tab));
    return tab;
  };

  const realReloadBackground = (webSocketClient) => {
    webSocketClient?.close();
    chrome.runtime.reload();
  };

  const reloadBackground = async (webSocketClient) => {
    const { currentPluginPageUrl, currentPluginPageTabId } =
      await chrome.storage.local.get([
        'currentPluginPageUrl',
        'currentPluginPageTabId',
      ]);

    if (currentPluginPageUrl) {
      await chrome.storage.local.set({
        autoOpenCurrentPluginPageUrl: currentPluginPageUrl,
        autoOpenCurrentPluginPageTabId: currentPluginPageTabId,
      });
    }

    realReloadBackground(webSocketClient);
  };

  const reloadIife = async (webSocketClient) => {
    const tab = await getCurrentTab();
    if (
      !tab ||
      !tab.id ||
      !tab.url ||
      tab.url.includes('newtab') ||
      tab.url.includes('//extensions/') ||
      tab.url.includes(chrome.runtime.id) ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('devtools://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('data:') ||
      tab.url.startsWith('javascript:')
    ) {
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          setTimeout(() => {
            window.location.reload();
          }, 200);
        },
        args: [],
      },
      (injectionResults) => {
        if (injectionResults) {
          for (const frameResult of injectionResults) {
            console.log('注入刷新页面脚本成功：' + JSON.stringify(frameResult));
          }
        } else {
          console.log('注入刷新页面脚本失败', tab);
        }

        if (webSocketClient) {
          realReloadBackground(webSocketClient);
        }
      }
    );
  };

  const reloadPage = async () => {
    chrome.runtime.sendMessage({ mode: 'page', action: 'reload' });
  };

  let hmrWebSocketClient = null;
  let keepAliveIntervalId = null;

  const clearKeepAliveInterval = () => {
    if (keepAliveIntervalId) {
      clearInterval(keepAliveIntervalId);
      keepAliveIntervalId = null;
    }
  };

  const initCrxHmr = (retryCount) => {
    console.log('background initCrxHmr::', '初始化 webSocketClient', retryCount);

    hmrWebSocketClient = new WebSocket(
      \`ws://127.0.0.1:\${crxHmrPort}?mode=background\`
    );

    hmrWebSocketClient.onopen = (event) => {
      console.log('background initCrxHmr::', 'onopen', event);
      // 连接成功后才启动 keepalive，避免在连接建立前就开始发送
      clearKeepAliveInterval();
      keepAliveIntervalId = setInterval(() => {
        if (hmrWebSocketClient && hmrWebSocketClient.readyState === WebSocket.OPEN) {
          console.log('background initCrxHmr::', '发送 keepalive');
          hmrWebSocketClient.send('keepalive');
        }
      }, 3 * 1000);
    };
    hmrWebSocketClient.onerror = (event) => {
      console.log('background initCrxHmr::', 'onerror', event);
    };
    hmrWebSocketClient.onclose = (event) => {
      console.log('background initCrxHmr::', 'onclose', event);
      // 先清除 keepalive interval，再重置客户端引用，避免 interval 累积
      clearKeepAliveInterval();
      hmrWebSocketClient = null;
      // 指数退避重连：最小 1s，每次翻倍，最大 30s，无限重试（开发期间 HMR 服务可能重启）
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30 * 1000);
      // delay 到达上限后不再增加 retryCount，避免数值无限膨胀
      const nextRetryCount = delay < 30 * 1000 ? retryCount + 1 : retryCount;
      console.log('background initCrxHmr::', \`将在 \${delay}ms 后尝试第 \${retryCount + 1} 次重连\`);
      setTimeout(() => initCrxHmr(nextRetryCount), delay);
    };

    hmrWebSocketClient.onmessage = (e) => {
      const { data } = e;
      if (data === 'BACKGROUND_CHANGED') {
        console.log(
          'background initCrxHmr::',
          '收到更新 background.js 消息，关闭 ws 并重新加载'
        );
        reloadBackground(hmrWebSocketClient);
      } else if (data === 'IIFE_CHANGED') {
        console.log('background initCrxHmr::', '收到更新 iife 消息');
        reloadIife(hmrWebSocketClient);
      } else if (data === 'PAGE_CHANGED') {
        console.log('background initCrxHmr::', '收到更新 page 消息');
        reloadPage();
      }
    };
  };

  const saveCurrentPluginPage = async (tab) => {
    if (tab?.url?.includes('newtab') || tab?.url?.includes(chrome.runtime.id)) {
      await chrome.storage.local.set({
        currentPluginPageUrl: tab.url,
        currentPluginPageTabId: tab.id,
      });
    }
  };
  const removeCurrentPluginPage = async (tabId) => {
    const { currentPluginPageTabId } = await chrome.storage.local.get(
      'currentPluginPageTabId'
    );
    if (currentPluginPageTabId === tabId) {
      await chrome.storage.local.remove([
        'currentPluginPageUrl',
        'currentPluginPageTabId',
      ]);
    }
  };
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      await removeCurrentPluginPage(tabId);
      await saveCurrentPluginPage(tab);
    }
  });
  chrome.tabs.onRemoved.addListener(async (tabId, _removeInfo) => {
    await removeCurrentPluginPage(tabId);
  });
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await saveCurrentPluginPage(tab);
  });

  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request?.mode === 'background' && request?.action === 'initCrxHmr') {
      if (hmrWebSocketClient) {
        console.log('background', '已经存在 hmrWebSocketClient');
      } else {
        console.log('background', '不存在 hmrWebSocketClient');
        clearKeepAliveInterval();
        initCrxHmr(0);
      }
    }
  });

  initCrxHmr(0);

  const handleAutoOpenCurrentPluginPageUrl = async () => {
    // 必须先读取 storage、完成 tab 操作，再执行 reloadIife：
    // 因为 reloadIife 最终会调用 chrome.runtime.reload()，导致 Service Worker 被重启，
    // 如果先调用 reloadIife 会与后续的 storage.get / tabs.create 形成竞态，导致 auto-open 失效
    const result = await chrome.storage.local.get([
      'autoOpenCurrentPluginPageUrl',
      'autoOpenCurrentPluginPageTabId',
    ]);
    const autoOpenCurrentPluginPageUrl = result.autoOpenCurrentPluginPageUrl;
    const autoOpenCurrentPluginPageTabId = result.autoOpenCurrentPluginPageTabId;
    if (!autoOpenCurrentPluginPageUrl) {
      // 没有需要自动恢复的页面，直接返回，避免无条件 reloadIife 导致 background 无限重启
      return;
    }

    try {
      if (autoOpenCurrentPluginPageUrl.includes('newtab')) {
        await chrome.tabs.update(autoOpenCurrentPluginPageTabId, {
          url: autoOpenCurrentPluginPageUrl,
        });
      } else {
        await chrome.tabs.create({ url: autoOpenCurrentPluginPageUrl });
      }
    } catch (e) {
      console.log('background handleAutoOpenCurrentPluginPageUrl::', 'auto-open 插件页面失败', e);
    }

    await chrome.storage.local.remove([
      'autoOpenCurrentPluginPageUrl',
      'autoOpenCurrentPluginPageTabId',
    ]);

    // auto-open 操作完成后，再 reload iife 并重启 background（仅在有需要恢复的页面时执行）
    await reloadIife(null);
  };
  handleAutoOpenCurrentPluginPageUrl();
})();
`
}

/**
 * 生成注入到 page 入口文件的 HMR 客户端代码
 *
 * 此函数返回的代码将在 Chrome 扩展的 page（popup、options 等）中运行，
 * 负责监听消息并在收到刷新通知时重新加载页面。
 */
export function generatePageInjectCode(pageName: string): string {
  return `
;(function() {
  const initCrxHmrPage = async () => {
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, _sendResponse) => {
        if (request?.mode === 'page' && request?.action === 'reload') {
          console.log('injectPage ${pageName} 收到刷新页面消息', request, sender);
          window.location.reload();
        }
      });
      chrome.runtime.sendMessage({ mode: 'background', action: 'initCrxHmr' });

      const clearId = setInterval(async () => {
        try {
          await chrome.runtime.sendMessage({ mode: 'background', action: 'ping' });
        } catch (e) {
          console.error('injectPage ${pageName} ping background 失败，刷新页面');
          clearInterval(clearId);
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }, 2000);

      // 页面卸载时清除 ping interval，避免内存泄漏
      window.addEventListener('unload', () => {
        clearInterval(clearId);
      }, { once: true });
    }
  };
  initCrxHmrPage();
})();
`
}
