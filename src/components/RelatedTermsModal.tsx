import { useEffect, useState } from 'react'
import { fetchRelatedTerms, type RelatedTermsResult } from '../api/gemini'
import { lookupWords } from '../api/lookup'
import { getGeminiApiKey, getGeminiModel, MISSING_GEMINI_API_KEY_MESSAGE } from '../utils/settings'
import { saveLookupResult } from '../utils/saveWord'
import { getErrorMessage } from '../utils/errors'
import type { Word } from '../types'

interface RelatedTermsModalProps {
  word: Word
  onClose: () => void
}

type RegisterStatus = 'idle' | 'loading' | 'done' | 'error'

export default function RelatedTermsModal({ word, onClose }: RelatedTermsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RelatedTermsResult | null>(null)
  const [registerStatus, setRegisterStatus] = useState<Record<string, RegisterStatus>>({})
  const [registerError, setRegisterError] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setLoading(false)
      setError(MISSING_GEMINI_API_KEY_MESSAGE)
      return
    }

    setLoading(true)
    setError(null)
    fetchRelatedTerms(word.term, apiKey, { meaningJa: word.meaningJa, model: getGeminiModel() })
      .then((res) => {
        if (!cancelled) setResult(res)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [word.term, word.meaningJa])

  async function registerTerm(term: string) {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setRegisterStatus((prev) => ({ ...prev, [term]: 'error' }))
      setRegisterError((prev) => ({ ...prev, [term]: MISSING_GEMINI_API_KEY_MESSAGE }))
      return
    }

    setRegisterStatus((prev) => ({ ...prev, [term]: 'loading' }))
    setRegisterError((prev) => {
      const next = { ...prev }
      delete next[term]
      return next
    })
    try {
      // 単語検索時と同じ経路(辞書API + Gemini)で情報を取得し、知らない単語として登録する
      const [looked] = await lookupWords([term], apiKey, getGeminiModel())
      await saveLookupResult(looked, { flagIfNew: true })
      setRegisterStatus((prev) => ({ ...prev, [term]: 'done' }))
    } catch (err) {
      setRegisterStatus((prev) => ({ ...prev, [term]: 'error' }))
      setRegisterError((prev) => ({ ...prev, [term]: getErrorMessage(err) }))
    }
  }

  function renderTermList(items: RelatedTermsResult['synonyms']) {
    return (
      <ul className="related-term-list">
        {items.map((s, i) => {
          const status = registerStatus[s.term] ?? 'idle'
          return (
            <li key={i} className="related-term-item">
              <div className="related-term-row">
                <div className="related-term-text">
                  <strong>{s.term}</strong>
                  {s.meaningJa && ` — ${s.meaningJa}`}
                </div>
                <button
                  type="button"
                  className={`register-term-btn ${status}`}
                  disabled={status === 'loading' || status === 'done'}
                  onClick={() => registerTerm(s.term)}
                >
                  {status === 'loading' && '登録中…'}
                  {status === 'done' && '✓ 登録済み'}
                  {status === 'error' && '再試行'}
                  {status === 'idle' && '＋ 単語帳に登録'}
                </button>
              </div>
              {status === 'error' && registerError[s.term] && (
                <p className="error-text small">{registerError[s.term]}</p>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

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
                {result.synonyms.length === 0 ? <p>見つかりませんでした。</p> : renderTermList(result.synonyms)}
              </section>

              <section>
                <h3>②この語を使ったイディオム</h3>
                {result.idioms.length === 0 ? <p>見つかりませんでした。</p> : renderTermList(result.idioms)}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
