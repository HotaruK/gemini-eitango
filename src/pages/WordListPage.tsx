import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { computeRate, isMastered } from '../utils/quiz'
import type { WordType } from '../types'

const TYPE_LABEL: Record<WordType, string> = {
  word: '単語',
  idiom: 'イディオム',
  slang: 'スラング',
  meme: 'ミーム',
  phrase: '成句',
}

type FlagFilter = 'all' | 'flagged' | 'unflagged'

function formatRate(quizCount: number, correctCount: number): string {
  const rate = computeRate(quizCount, correctCount)
  if (rate === undefined) return '未出題'
  return `${Math.round(rate * 100)}% (${correctCount}/${quizCount})`
}

export default function WordListPage() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<WordType | 'all'>('all')
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all')

  const words = useLiveQuery(
    () => db.words.toArray().then((arr) => arr.sort((a, b) => b.updatedAt - a.updatedAt)),
    [],
  )

  const filtered = useMemo(() => {
    if (!words) return []
    return words.filter((w) => {
      if (typeFilter !== 'all' && w.type !== typeFilter) return false
      if (flagFilter === 'flagged' && !w.isFlagged) return false
      if (flagFilter === 'unflagged' && w.isFlagged) return false
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        if (!w.term.toLowerCase().includes(q) && !w.meaningJa.includes(q)) return false
      }
      return true
    })
  }, [words, typeFilter, flagFilter, query])

  async function toggleFlag(id: number, current: boolean) {
    await db.words.update(id, { isFlagged: !current })
  }

  async function remove(id: number) {
    if (confirm('この単語を削除しますか?')) {
      await db.words.delete(id)
    }
  }

  return (
    <div className="page list-page">
      <h1>単語帳</h1>

      <div className="filters">
        <div className="field-clear-wrap">
          <input
            type="text"
            placeholder="語・意味で絞り込み"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as WordType | 'all')}>
          <option value="all">すべての種別</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value as FlagFilter)}>
          <option value="all">すべて</option>
          <option value="flagged">★のみ</option>
          <option value="unflagged">★以外</option>
        </select>
      </div>

      {words === undefined && <p>読み込み中…</p>}
      {words && words.length === 0 && <p>まだ単語が保存されていません。「調べる」タブから検索してください。</p>}
      {words && words.length > 0 && filtered.length === 0 && <p>条件に一致する単語がありません。</p>}

      <ul className="word-list">
        {filtered.map((w) => (
          <li key={w.id} className="word-item">
            <div className="word-item-head">
              <strong>{w.term}</strong>
              <span className="type-badge small">{TYPE_LABEL[w.type]}</span>
              {isMastered(w.quizCount, w.correctCount) && isMastered(w.quizCountReverse, w.correctCountReverse) && (
                <span className="mastered-badge">習得済み</span>
              )}
              <button
                className={`flag-btn small ${w.isFlagged ? 'flagged' : ''}`}
                onClick={() => toggleFlag(w.id!, w.isFlagged)}
              >
                {w.isFlagged ? '★' : '☆'}
              </button>
            </div>
            <p className="meaning">{w.meaningJa}</p>
            <div className="stats">
              <span>語→意味: {formatRate(w.quizCount, w.correctCount)}</span>
              <span>意味→語: {formatRate(w.quizCountReverse, w.correctCountReverse)}</span>
            </div>
            <button className="delete-btn" onClick={() => remove(w.id!)}>
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
