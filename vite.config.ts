import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages (https://HotaruK.github.io/gemini-eitango/) がプロジェクトページのサブパス配信のため
  base: '/gemini-eitango/',
  server: {
    // localtunnel等の外部トンネル経由でのスマホ実機確認用(開発時のみ)
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: '英単語メモ',
        short_name: '英単語メモ',
        description: '単語・熟語・スラング・ミームの意味を調べて、クイズで定着させる学習アプリ',
        start_url: '.',
        display: 'standalone',
        background_color: '#0f1117',
        theme_color: '#0f1117',
        icons: [
          { src: 'icons/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // 検索(辞書API/Gemini)はオンライン必須。それ以外の静的アセットはキャッシュしてオフライン起動を可能にする。
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
})
