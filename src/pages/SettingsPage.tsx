import { useRef, useState } from 'react'
import db from '../db'
import {
  getAutoUnflag,
  getGeminiApiKey,
  getGeminiModel,
  setAutoUnflag,
  setGeminiApiKey,
  setGeminiModel,
} from '../utils/settings'
import { csvToWords, downloadCsv, wordsToCsv } from '../utils/csv'
import { normalize } from '../db'

export default function SettingsPage() {
  const [apiKey, setApiKeyState] = useState(getGeminiApiKey())
  const [model, setModelState] = useState(getGeminiModel())
  const [autoUnflag, setAutoUnflagState] = useState(getAutoUnflag())
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function saveApiKey() {
    setGeminiApiKey(apiKey.trim())
    setMessage('APIキーを保存しました。')
  }

  function saveModel() {
    setGeminiModel(model.trim())
    setMessage('モデル名を保存しました。')
  }

  function toggleAutoUnflag() {
    const next = !autoUnflag
    setAutoUnflagState(next)
    setAutoUnflag(next)
  }

  async function handleExport() {
    const words = await db.words.toArray()
    const csv = wordsToCsv(words)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `eitango-memo-${date}.csv`)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = csvToWords(text)

    let added = 0
    let updated = 0
    for (const row of rows) {
      const norm = row.normalizedTerm || normalize(row.term)
      const existing = await db.words.where('normalizedTerm').equals(norm).first()
      if (existing) {
        await db.words.update(existing.id!, { ...row, normalizedTerm: norm })
        updated++
      } else {
        await db.words.add({ ...row, normalizedTerm: norm } as any)
        added++
      }
    }
    setMessage(`インポート完了: 新規 ${added}件 / 更新 ${updated}件`)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="page settings-page">
      <h1>設定</h1>

      {message && <p className="info-text">{message}</p>}

      <section className="settings-section">
        <h2>Gemini APIキー</h2>
        <p className="hint">
          Google AI Studio (aistudio.google.com) で取得したキーをこの端末内(localStorage)に保存します。外部には送信されません。
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKeyState(e.target.value)}
          placeholder="AIza... または AQ...."
        />
        <button onClick={saveApiKey}>保存</button>
      </section>

      <section className="settings-section">
        <h2>Geminiモデル名(任意)</h2>
        <p className="hint">空欄の場合は既定のモデル(gemini-flash-latest)を使用します。</p>
        <input
          type="text"
          value={model}
          onChange={(e) => setModelState(e.target.value)}
          placeholder="gemini-flash-latest"
        />
        <button onClick={saveModel}>保存</button>
      </section>

      <section className="settings-section">
        <h2>クイズの自動解除</h2>
        <label className="checkbox-row">
          <input type="checkbox" checked={autoUnflag} onChange={toggleAutoUnflag} />
          両方向で習得済みになった単語の★フラグを自動的に外す
        </label>
      </section>

      <section className="settings-section">
        <h2>データのバックアップ</h2>
        <button onClick={handleExport}>CSVとしてエクスポート</button>
        <div className="import-row">
          <label className="import-label">
            CSVをインポート
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportFile} />
          </label>
        </div>
      </section>
    </div>
  )
}
