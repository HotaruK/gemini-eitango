import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import QuizAnalysis from '../components/QuizAnalysis'
import WeeklyLineChart from '../components/WeeklyLineChart'
import type { Attempt, Word } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000
const HISTORY_DAYS = 7

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isSameDay(ts: number, dayStart: number): boolean {
  return startOfDay(ts) === dayStart
}

function formatDateLabel(dayStart: number): string {
  const d = new Date(dayStart)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function computeStreak(words: Word[], attempts: Attempt[], todayStart: number): number {
  let streak = 0
  for (let i = 0; ; i++) {
    const dayStart = todayStart - i * DAY_MS
    const hasActivity =
      words.some((w) => isSameDay(w.createdAt, dayStart)) ||
      attempts.some((a) => isSameDay(a.answeredAt, dayStart))
    if (!hasActivity) {
      if (i === 0) continue // 今日はまだ何もしていなくても連続記録は途切れさせない
      break
    }
    streak++
  }
  return streak
}

export default function AnalysisPage() {
  const words = useLiveQuery(() => db.words.toArray(), [])
  const attempts = useLiveQuery(() => db.attempts.toArray(), [])

  if (words === undefined || attempts === undefined) {
    return (
      <div className="page analysis-page">
        <h1>分析</h1>
        <p>読み込み中…</p>
      </div>
    )
  }

  const todayStart = startOfDay(Date.now())
  const todayWordsAdded = words.filter((w) => isSameDay(w.createdAt, todayStart)).length
  const todayQuizAnswered = attempts.filter((a) => isSameDay(a.answeredAt, todayStart)).length

  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => todayStart - (HISTORY_DAYS - 1 - i) * DAY_MS)
  const dateLabels = days.map(formatDateLabel)
  const wordsAddedByDay = days.map((day) => words.filter((w) => isSameDay(w.createdAt, day)).length)
  const quizAnsweredByDay = days.map((day) => attempts.filter((a) => isSameDay(a.answeredAt, day)).length)
  const masteredByDay = days.map(
    (day) => words.filter((w) => w.masteredAt !== undefined && isSameDay(w.masteredAt, day)).length,
  )

  const streak = computeStreak(words, attempts, todayStart)

  return (
    <div className="page analysis-page">
      <h1>分析</h1>

      <div className="stat-card-row">
        <div className="stat-card">
          <span className="stat-label">今日の単語登録数</span>
          <span className="stat-value">{todayWordsAdded}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">今日のクイズ回答数</span>
          <span className="stat-value">{todayQuizAnswered}</span>
        </div>
      </div>

      <WeeklyLineChart
        dateLabels={dateLabels}
        series={[
          { label: '登録数', values: wordsAddedByDay, colorVar: '--accent' },
          { label: '回答数', values: quizAnsweredByDay, colorVar: '--info' },
          { label: '習得数', values: masteredByDay, colorVar: '--success' },
        ]}
      />

      <div className="streak-badge">
        🔥 連続学習日数: <strong>{streak}日</strong>
      </div>

      <QuizAnalysis words={words} />
    </div>
  )
}
