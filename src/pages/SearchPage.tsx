import { useState } from 'react'
import db from '../db'
import { lookupWord } from '../api/lookup'
import { getGeminiApiKey, getGeminiModel } from '../utils/settings'
import { saveLookupResult } from '../utils/saveWord'
import type { Word, WordType } from '../types'

const TYPE_LABEL: Record<WordType, string> = {
  word: '単語',
  idiom: 'イディオム',
  slang: 'スラング',
  meme: 'ミーム',
  phrase: '成句',
}

interface SearchPageProps {
  onDone?: () => void
}

export default function SearchPage({ onDone }: SearchPageProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Word | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = query.trim()
    if (!term) return

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setError('Gemini APIキーが未設定です。設定タブで入力してください。')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const looked = await lookupWord(term, apiKey, getGeminiModel())
      const saved = await saveLookupResult(looked)
      setResult(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      onDone?.()
    }
  }

  async function toggleFlag() {
    if (!result?.id) return
    const next = !result.isFlagged
    await db.words.update(result.id, { isFlagged: next })
    setResult({ ...result, isFlagged: next })
  }

  return (
    <div className="page search-page">
      <h1>調べる</h1>
      <form className="search-form" onSubmit={handleSearch}>
        <div className="field-clear-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="単語・熟語・スラング・ミームを入力"
            autoCapitalize="off"
            autoCorrect="off"
          />
          {query && (
            <button
              type="button"
              className="field-clear-btn"
              onClick={() => setQuery('')}
              aria-label="クリア"
            >
              ×
            </button>
          )}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '検索中…' : '検索'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-card">
          <div className="result-header">
            <h2>{result.term}</h2>
            <span className="type-badge">{TYPE_LABEL[result.type]}</span>
          </div>
          {result.phonetic && <p className="phonetic">/{result.phonetic}/</p>}

          <section>
            <h3>意味(日本語)</h3>
            <p>{result.meaningJa}</p>
          </section>

          <section>
            <h3>英英定義</h3>
            <p>{result.definitionEn}</p>
          </section>

          {result.examples.length > 0 && (
            <section>
              <h3>例文</h3>
              <ul>
                {result.examples.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </section>
          )}

          {result.note && (
            <section>
              <h3>ニュアンス・由来</h3>
              <p>{result.note}</p>
            </section>
          )}

          <button
            className={`flag-btn ${result.isFlagged ? 'flagged' : ''}`}
            onClick={toggleFlag}
          >
            {result.isFlagged ? '★ 知らない語として登録中' : '☆ 知らない語としてフラグする'}
          </button>
          <p className="saved-note">この検索結果は単語帳に保存されました。</p>
        </div>
      )}
    </div>
  )
}
