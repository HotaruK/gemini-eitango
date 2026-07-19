import db from '../db'
import { ACTIVE_POOL_SIZE, buildActivePool, isWordMastered, MASTERY_MIN_RATE } from '../utils/quiz'
import type { Word } from '../types'

const MIN_ATTEMPTS = 3
const WEAK_LIST_SIZE = 10
const RECENT_LIST_SIZE = 8

interface CombinedStats {
  quizCount: number
  correctCount: number
  rate: number | undefined
}

function combinedStats(w: Word): CombinedStats {
  const quizCount = w.quizCount + w.quizCountReverse
  const correctCount = w.correctCount + w.correctCountReverse
  return { quizCount, correctCount, rate: quizCount > 0 ? correctCount / quizCount : undefined }
}

function formatRelativeDate(ts: number): string {
  const diffDays = Math.round((ts - Date.now()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今日'
  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' })
  return rtf.format(diffDays, 'day')
}

export default function QuizAnalysis({ words }: { words: Word[] }) {
  if (words.length === 0) {
    return (
      <div className="analysis-empty">
        <p>まだ単語が登録されていません。「調べる」タブから単語を追加してください。</p>
      </div>
    )
  }

  const mastered = words.filter(isWordMastered)
  const unseen = words.filter((w) => w.quizCount === 0 && w.quizCountReverse === 0)
  const inProgress = words.length - mastered.length - unseen.length

  const activePool = buildActivePool(words)
  const learningQueueTotal = words.filter((w) => w.isFlagged && !isWordMastered(w)).length
  const queuedCount = learningQueueTotal - activePool.length

  const weakest = words
    .filter((w) => {
      const stats = combinedStats(w)
      return stats.quizCount >= MIN_ATTEMPTS && stats.rate !== undefined && stats.rate < MASTERY_MIN_RATE
    })
    .sort((a, b) => (combinedStats(a).rate ?? 0) - (combinedStats(b).rate ?? 0))
    .slice(0, WEAK_LIST_SIZE)

  const recentlyMastered = mastered
    .filter((w) => w.masteredAt !== undefined)
    .sort((a, b) => (b.masteredAt ?? 0) - (a.masteredAt ?? 0))
    .slice(0, RECENT_LIST_SIZE)

  async function addFlag(id: number) {
    await db.words.update(id, { isFlagged: true })
  }

  return (
    <div className="quiz-analysis">
      <section className="analysis-section">
        <h2>習得状況</h2>
        <div className="progress-bar">
          {mastered.length > 0 && (
            <div
              className="progress-segment mastered"
              style={{ width: `${(mastered.length / words.length) * 100}%` }}
            />
          )}
          {inProgress > 0 && (
            <div className="progress-segment in-progress" style={{ width: `${(inProgress / words.length) * 100}%` }} />
          )}
          {unseen.length > 0 && (
            <div className="progress-segment unseen" style={{ width: `${(unseen.length / words.length) * 100}%` }} />
          )}
        </div>
        <div className="progress-legend">
          <span><i className="dot mastered" />習得済み {mastered.length}</span>
          <span><i className="dot in-progress" />学習中 {inProgress}</span>
          <span><i className="dot unseen" />未出題 {unseen.length}</span>
        </div>
      </section>

      <section className="analysis-section">
        <h2>
          学習中の単語 ({activePool.length}/{ACTIVE_POOL_SIZE})
        </h2>
        {activePool.length === 0 ? (
          <p className="analysis-hint">現在ループ中の単語はありません。</p>
        ) : (
          <>
            <p className="analysis-hint">
              クイズはこの{activePool.length}語だけをループします。習得済みになると自動的に外れ、次の語が繰り上がります。
              {queuedCount > 0 && ` 他に${queuedCount}語が出番待ちです。`}
            </p>
            <ul className="analysis-list">
              {activePool.map((w) => {
                const stats = combinedStats(w)
                return (
                  <li key={w.id} className="analysis-item">
                    <div className="analysis-item-main">
                      <strong>{w.term}</strong>
                      <span className="meaning">{w.meaningJa}</span>
                    </div>
                    <div className="analysis-item-meta">
                      <span className="rate-badge neutral">
                        {stats.rate === undefined
                          ? '未出題'
                          : `${Math.round(stats.rate * 100)}% (${stats.correctCount}/${stats.quizCount})`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section className="analysis-section">
        <h2>苦手な単語</h2>
        {weakest.length === 0 ? (
          <p className="analysis-hint">
            まだ十分なデータがありません({MIN_ATTEMPTS}回以上出題された語が対象です)。
          </p>
        ) : (
          <ul className="analysis-list">
            {weakest.map((w) => {
              const stats = combinedStats(w)
              return (
                <li key={w.id} className="analysis-item">
                  <div className="analysis-item-main">
                    <strong>{w.term}</strong>
                    <span className="meaning">{w.meaningJa}</span>
                  </div>
                  <div className="analysis-item-meta">
                    <span className="rate-badge weak">
                      {Math.round((stats.rate ?? 0) * 100)}% ({stats.correctCount}/{stats.quizCount})
                    </span>
                    {!w.isFlagged && (
                      <button className="flag-add-btn" onClick={() => addFlag(w.id!)}>
                        ★ 出題対象に追加
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="analysis-section">
        <h2>最近習得した単語</h2>
        {recentlyMastered.length === 0 ? (
          <p className="analysis-hint">まだ習得済みの単語がありません。</p>
        ) : (
          <ul className="analysis-list">
            {recentlyMastered.map((w) => (
              <li key={w.id} className="analysis-item">
                <div className="analysis-item-main">
                  <strong>{w.term}</strong>
                  <span className="meaning">{w.meaningJa}</span>
                </div>
                <div className="analysis-item-meta">
                  <span className="mastered-date">{formatRelativeDate(w.masteredAt!)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
