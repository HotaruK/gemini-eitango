import { useState } from 'react'
import { analyzePassage } from '../api/passage'
import { extractTextFromImage } from '../api/ocr'
import { lookupWords } from '../api/lookup'
import { getGeminiApiKey, getGeminiModel, MISSING_GEMINI_API_KEY_MESSAGE } from '../utils/settings'
import { saveLookupResult } from '../utils/saveWord'
import { getErrorMessage } from '../utils/errors'
import { prepareImageForGemini } from '../utils/image'
import BackToTopButton from '../components/BackToTopButton'
import TypeBadge from '../components/TypeBadge'
import type { ExtractedTerm, PassageAnalysisResult } from '../types'

type RegisterStatus = 'idle' | 'running' | 'done'

interface TranslatePageProps {
  onDone?: () => void
}

export default function TranslatePage({ onDone }: TranslatePageProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
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
      setError(MISSING_GEMINI_API_KEY_MESSAGE)
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
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
      onDone?.()
    }
  }

  async function handleImage(file: Blob) {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setError(MISSING_GEMINI_API_KEY_MESSAGE)
      return
    }

    setOcrLoading(true)
    setError(null)
    try {
      const image = await prepareImageForGemini(file)
      const extracted = await extractTextFromImage(image, apiKey, getGeminiModel())
      // 複数枚のスクショを続けて読み込めるよう、入力済みの文章は消さずに末尾へ追記する
      setText((prev) => (prev.trim() ? `${prev.trimEnd()}

${extracted}` : extracted))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setOcrLoading(false)
    }
  }

  function handleImageInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 同じ画像を選び直してもonChangeが発火するようにリセットしておく
    e.target.value = ''
    if (file) handleImage(file)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith('image/'))
    const file = imageItem?.getAsFile()
    if (!file) return
    e.preventDefault()
    if (!ocrLoading) handleImage(file)
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
      setError(MISSING_GEMINI_API_KEY_MESSAGE)
      return
    }

    const targets: ExtractedTerm[] = Array.from(checked)
      .sort((a, b) => a - b)
      .map((i) => result.terms[i])

    setRegisterStatus('running')
    setRegisterProgress({ done: 0, total: targets.length })
    setError(null)
    const added: string[] = []
    const failed: string[] = []

    // 単語数によらずGeminiへの問い合わせは1回にまとめる(単語ごとの逐次リクエストは無駄に回数がかさむため)
    try {
      const looked = await lookupWords(
        targets.map((t) => t.term),
        apiKey,
        getGeminiModel(),
        text,
      )
      for (const l of looked) {
        try {
          await saveLookupResult(l, { flagIfNew: true })
          added.push(l.term)
        } catch {
          failed.push(l.term)
        }
        setRegisterProgress((p) => ({ ...p, done: p.done + 1 }))
      }
    } catch (err) {
      failed.push(...targets.map((t) => t.term))
      setRegisterProgress({ done: targets.length, total: targets.length })
      setError(getErrorMessage(err))
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
            onPaste={handlePaste}
            placeholder="意味が取りづらい文章・段落・ページを貼り付けてください(画像の貼り付けも可)"
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
        <div className="translate-actions">
          <label className={`ocr-label${ocrLoading ? ' disabled' : ''}`}>
            {ocrLoading ? '読み取り中…' : '📷 画像から読み取る'}
            <input type="file" accept="image/*" onChange={handleImageInput} disabled={ocrLoading} />
          </label>
          <button type="submit" disabled={loading || ocrLoading}>
            {loading ? '解析中…(長文は時間がかかります)' : '解析する'}
          </button>
        </div>
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
                        <TypeBadge type={t.type} small />
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
