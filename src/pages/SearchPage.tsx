import { useState } from 'react'
import db from '../db'
import { lookupWord } from '../api/lookup'
import { getGeminiApiKey, getGeminiModel } from '../utils/settings'
import { saveLookupResult } from '../utils/saveWord'
import BackToTopButton from '../components/BackToTopButton'
import type { Word, WordType } from '../types'

const TYPE_LABEL: Record<WordType, string> = {
  word: '単語',
  idiom: 'イディオム',
  slang: 'スラング',
  meme: 'ミーム',
  phrase: '成句',
}

const MAX_TERMS = 10

interface SearchItem {
  term: string
  status: 'loading' | 'done' | 'error'
  result?: Word
  error?: string
}

interface SearchPageProps {
  onDone?: () => void
}

function parseTerms(raw: string): string[] {
  const terms = raw
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set(terms)).slice(0, MAX_TERMS)
}

export default function SearchPage({ onDone }: SearchPageProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<SearchItem[]>([])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const terms = parseTerms(query)
    if (terms.length === 0) return

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setError('Gemini APIキーが未設定です。設定タブで入力してください。')
      return
    }

    setLoading(true)
    setError(null)
    setItems(terms.map((term) => ({ term, status: 'loading' })))

    // 1〜10件を並列でリクエストする(1件ずつ待つより体感速度が大きく改善するため)
    await Promise.allSettled(
      terms.map(async (term, idx) => {
        try {
          const looked = await lookupWord(term, apiKey, getGeminiModel())
          const saved = await saveLookupResult(looked)
          setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: 'done', result: saved } : it)))
        } catch (err) {
          setItems((prev) =>
            prev.map((it, i) =>
              i === idx ? { ...it, status: 'error', error: err instanceof Error ? err.message : String(err) } : it,
            ),
          )
        }
      }),
    )

    setLoading(false)
    onDone?.()
  }

  async function toggleFlag(idx: number) {
    const item = items[idx]
    if (!item.result?.id) return
    const next = !item.result.isFlagged
    await db.words.update(item.result.id, { isFlagged: next })
    setItems((prev) =>
      prev.map((it, i) => (i === idx && it.result ? { ...it, result: { ...it.result, isFlagged: next } } : it)),
    )
  }

  return (
    <div className="page search-page">
      <h1>調べる</h1>
      <form className="search-form" onSubmit={handleSearch}>
        <div className="field-clear-wrap textarea-wrap">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`単語・熟語・スラング・ミームを入力(1行またはカンマ区切りで最大${MAX_TERMS}個まで同時に調べられます)`}
            rows={3}
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

      <div className="search-results">
        {items.map((item, idx) => (
          <div key={idx} className="result-card">
            <div className="result-header">
              <h2>{item.term}</h2>
              {item.result && <span className="type-badge">{TYPE_LABEL[item.result.type]}</span>}
            </div>

            {item.status === 'loading' && <p className="loading-text">検索中…</p>}
            {item.status === 'error' && <p className="error-text">{item.error}</p>}

            {item.status === 'done' && item.result && (
              <>
                {item.result.phonetic && <p className="phonetic">/{item.result.phonetic}/</p>}

                <section>
                  <h3>意味(日本語)</h3>
                  <p>{item.result.meaningJa}</p>
                </section>

                <section>
                  <h3>英英定義</h3>
                  <p>{item.result.definitionEn}</p>
                </section>

                {item.result.examples.length > 0 && (
                  <section>
                    <h3>例文</h3>
                    <ul>
                      {item.result.examples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {item.result.note && (
                  <section>
                    <h3>ニュアンス・由来</h3>
                    <p>{item.result.note}</p>
                  </section>
                )}

                <button
                  className={`flag-btn ${item.result.isFlagged ? 'flagged' : ''}`}
                  onClick={() => toggleFlag(idx)}
                >
                  {item.result.isFlagged ? '★ 知らない語として登録中' : '☆ 知らない語としてフラグする'}
                </button>
                <p className="saved-note">この検索結果は単語帳に保存されました。</p>
              </>
            )}
          </div>
        ))}
      </div>

      {items.length > 0 && <BackToTopButton />}
    </div>
  )
}
