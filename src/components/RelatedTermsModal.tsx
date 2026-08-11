import { useEffect, useState } from 'react'
import { fetchRelatedTerms, GeminiError, type RelatedTermsResult } from '../api/gemini'
import { getGeminiApiKey, getGeminiModel } from '../utils/settings'
import type { Word } from '../types'

interface RelatedTermsModalProps {
  word: Word
  onClose: () => void
}

export default function RelatedTermsModal({ word, onClose }: RelatedTermsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RelatedTermsResult | null>(null)

  useEffect(() => {
    let cancelled = false
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setLoading(false)
      setError('Gemini APIキーが未設定です。設定タブで入力してください。')
      return
    }

    setLoading(true)
    setError(null)
    fetchRelatedTerms(word.term, apiKey, { meaningJa: word.meaningJa, model: getGeminiModel() })
      .then((res) => {
        if (!cancelled) setResult(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof GeminiError ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [word.term, word.meaningJa])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="result-card">
          <div className="result-header">
            <h2>{word.term}</h2>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          </div>
          <p className="meaning">{word.meaningJa}</p>

          {loading && <p className="loading-text">検索中…</p>}
          {error && <p className="error-text">{error}</p>}

          {!loading && result && (
            <>
              <section>
                <h3>①似た意味の語</h3>
                {result.synonyms.length === 0 ? (
                  <p>見つかりませんでした。</p>
                ) : (
                  <ul>
                    {result.synonyms.map((s, i) => (
                      <li key={i}>
                        <strong>{s.term}</strong>
                        {s.meaningJa && ` — ${s.meaningJa}`}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3>②この語を使ったイディオム</h3>
                {result.idioms.length === 0 ? (
                  <p>見つかりませんでした。</p>
                ) : (
                  <ul>
                    {result.idioms.map((s, i) => (
                      <li key={i}>
                        <strong>{s.term}</strong>
                        {s.meaningJa && ` — ${s.meaningJa}`}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
