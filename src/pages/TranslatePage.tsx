import { useState } from 'react'
import { analyzePassage } from '../api/passage'
import { lookupWord } from '../api/lookup'
import { getGeminiApiKey, getGeminiModel } from '../utils/settings'
import { saveLookupResult } from '../utils/saveWord'
import BackToTopButton from '../components/BackToTopButton'
import type { ExtractedTerm, PassageAnalysisResult, WordType } from '../types'

const TYPE_LABEL: Record<WordType, string> = {
  word: '単語',
  idiom: 'イディオム',
  slang: 'スラング',
  meme: 'ミーム',
  phrase: '成句',
}

type RegisterStatus = 'idle' | 'running' | 'done'

interface TranslatePageProps {
  onDone?: () => void
}

export default function TranslatePage({ onDone }: TranslatePageProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PassageAnalysisResult | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>('idle')
  const [registerProgress, setRegisterProgress] = useState({ done: 0, total: 0 })
  const [registerSummary, setRegisterSummary] = useState<{ added: string[]; failed: string[] } | null>(null)

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setError('Gemini APIキーが未設定です。設定タブで入力してください。')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setChecked(new Set())
    setRegisterStatus('idle')
    setRegisterSummary(null)

    try {
      const analysis = await analyzePassage(trimmed, apiKey, getGeminiModel())
      setResult(analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      onDone?.()
    }
  }

  function toggleChecked(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function selectAll() {
    if (!result) return
    setChecked(new Set(result.terms.map((_, i) => i)))
  }

  function selectNone() {
    setChecked(new Set())
  }

  async function handleBulkRegister() {
    if (!result || checked.size === 0) return
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setError('Gemini APIキーが未設定です。設定タブで入力してください。')
      return
    }

    const targets: ExtractedTerm[] = Array.from(checked)
      .sort((a, b) => a - b)
      .map((i) => result.terms[i])

    setRegisterStatus('running')
    setRegisterProgress({ done: 0, total: targets.length })
    const added: string[] = []
    const failed: string[] = []

    for (const t of targets) {
      try {
        const looked = await lookupWord(t.term, apiKey, getGeminiModel(), text)
        await saveLookupResult(looked, { flagIfNew: true })
        added.push(t.term)
      } catch {
        failed.push(t.term)
      }
      setRegisterProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setRegisterSummary({ added, failed })
    setRegisterStatus('done')
    setChecked(new Set())
    onDone?.()
  }

  return (
    <div className="page translate-page">
      <h1>翻訳・文章解析</h1>
      <form className="translate-form" onSubmit={handleAnalyze}>
        <div className="field-clear-wrap textarea-wrap">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="意味が取りづらい文章・段落・ページを貼り付けてください"
            rows={8}
          />
          {text && (
            <button
              type="button"
              className="field-clear-btn"
              onClick={() => setText('')}
              aria-label="クリア"
            >
              ×
            </button>
          )}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '解析中…(長文は時間がかかります)' : '解析する'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="analysis-result">
          <section className="result-card">
            <h3>日本語訳</h3>
            <p className="preserve-lines">{result.translationJa}</p>
          </section>

          <section className="result-card">
            <h3>何を言っているか</h3>
            <p className="preserve-lines">{result.explanation}</p>
          </section>

          {result.wordplay && (
            <section className="result-card">
              <h3>言葉遊び・韻・コールバック</h3>
              <p className="preserve-lines">{result.wordplay}</p>
            </section>
          )}

          <section className="result-card">
            <div className="terms-header">
              <h3>抽出された単語・イディオム({result.terms.length}件)</h3>
              {result.terms.length > 0 && (
                <div className="terms-header-actions">
                  <button type="button" className="link-btn" onClick={selectAll}>
                    全選択
                  </button>
                  <button type="button" className="link-btn" onClick={selectNone}>
                    選択解除
                  </button>
                </div>
              )}
            </div>

            {result.terms.length === 0 && <p>この文章から抽出すべき単語・イディオムは見つかりませんでした。</p>}

            <ul className="term-checklist">
              {result.terms.map((t, i) => (
                <li key={i} className="term-checklist-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={() => toggleChecked(i)}
                    />
                    <div className="term-checklist-body">
                      <div className="term-checklist-head">
                        <strong>{t.term}</strong>
                        <span className="type-badge small">{TYPE_LABEL[t.type]}</span>
                      </div>
                      <p className="meaning">{t.meaningJa}</p>
                      {t.note && <p className="term-note">{t.note}</p>}
                    </div>
                  </label>
                </li>
              ))}
            </ul>

            {result.terms.length > 0 && (
              <button
                className="bulk-register-btn"
                disabled={checked.size === 0 || registerStatus === 'running'}
                onClick={handleBulkRegister}
              >
                {registerStatus === 'running'
                  ? `登録中… (${registerProgress.done}/${registerProgress.total})`
                  : `選択した${checked.size}語を単語帳に一括登録`}
              </button>
            )}

            {registerSummary && (
              <p className="info-text">
                登録完了: {registerSummary.added.length}件
                {registerSummary.failed.length > 0 &&
                  ` / 失敗: ${registerSummary.failed.join(', ')}`}
              </p>
            )}
          </section>

          <BackToTopButton />
        </div>
      )}
    </div>
  )
}
