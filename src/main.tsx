import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

// アプリ起動のたびにSWを登録し直すことで、その都度ブラウザ側の更新チェックが走る。
// 新しいSWが見つかれば(autoUpdateによりskipWaiting/clientsClaim済み)自動でリロードする。
registerSW({ immediate: true })

if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
