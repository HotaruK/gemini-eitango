import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { buildActivePool, buildDuePool, buildQuestion, computeNextReview, isWordMastered } from '../utils/quiz'
import { getAutoUnflag } from '../utils/settings'
import type { QuizQuestion, Word } from '../types'

export default function QuizPage() {
  const words = useLiveQuery(() => db.words.toArray(), [])
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [session, setSession] = useState({ asked: 0, correct: 0 })
  const [justMastered, setJustMastered] = useState<string | null>(null)
  const [studyAheadMode, setStudyAheadMode] = useState(false)
  const lastTargetIdRef = useRef<number | null>(null)

  function nextQuestion(current: Word[], studyAhead: boolean) {
    const active = buildActivePool(current)
    const due = buildDuePool(active)
    const pool = studyAhead ? active : due
    const candidates = pool.length > 1 ? pool.filter((w) => w.id !== lastTargetIdRef.current) : pool
    const q = buildQuestion(candidates, current)
    lastTargetIdRef.current = q?.target.id ?? null
    setQuestion(q)
    setSelected(null)
    setJustMastered(null)
  }

  useEffect(() => {
    if (words && question === null) {
      nextQuestion(words, studyAheadMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  async function handleAnswer(idx: number) {
    if (selected !== null || !question || !words) return
    setSelected(idx)
    const correct = idx === question.correctIndex
    const w = question.target
    const isForward = question.direction === 'termToMeaning'

    const { intervalIndex, nextReviewAt } = computeNextReview(w.intervalIndex, correct)
    const updates: Partial<Word> = isForward
      ? {
          quizCount: w.quizCount + 1,
          correctCount: w.correctCount + (correct ? 1 : 0),
          intervalIndex,
          nextReviewAt,
        }
      : {
          quizCountReverse: w.quizCountReverse + 1,
          correctCountReverse: w.correctCountReverse + (correct ? 1 : 0),
          intervalIndex,
          nextReviewAt,
        }

    const merged = { ...w, ...updates } as Word
    const justMasteredNow = isWordMastered(merged) && !isWordMastered(w)
    if (justMasteredNow) {
      updates.masteredAt = Date.now()
      if (getAutoUnflag()) updates.isFlagged = false
    }

    await db.words.update(w.id!, updates)
    setSession((s) => ({ asked: s.asked + 1, correct: s.correct + (correct ? 1 : 0) }))
    setJustMastered(justMasteredNow ? w.term : null)

    try {
      await db.attempts.add({ wordId: w.id!, correct, direction: question.direction, answeredAt: Date.now() })
    } catch (err) {
      console.error('Failed to log quiz attempt', err)
    }
  }

  if (words === undefined) {
    return (
      <div className="page quiz-page">
        <h1>クイズ</h1>
        <p>読み込み中…</p>
      </div>
    )
  }

  const flaggedCount = words.filter((w) => w.isFlagged).length

  if (flaggedCount === 0) {
    return (
      <div className="page quiz-page">
        <h1>クイズ</h1>
        <p>まだ★フラグの単語がありません。「調べる」タブで意味を調べた語に★を付けてください。</p>
      </div>
    )
  }

  const activePool = buildActivePool(words)

  if (activePool.length === 0) {
    return (
      <div className="page quiz-page">
        <h1>クイズ</h1>
        <p>
          ★フラグの単語はすべて習得済みです。新しい単語を「調べる」タブで登録して★を付けるか、
          「単語帳」タブで気になる語を「未習得に戻す」と復習できます。
        </p>
      </div>
    )
  }

  const duePool = buildDuePool(activePool)

  if (duePool.length === 0 && !studyAheadMode) {
    return (
      <div className="page quiz-page">
        <h1>クイズ</h1>
        <p>今日復習予定の単語はありません。明日以降にまた出題されます。</p>
        <button
          className="next-btn"
          onClick={() => {
            setStudyAheadMode(true)
            nextQuestion(words, true)
          }}
        >
          先取りで学習する({activePool.length}語)
        </button>
      </div>
    )
  }

  if (!question || question.choices.length < 2) {
    return (
      <div className="page quiz-page">
        <h1>クイズ</h1>
        <p>クイズには最低4語の登録が必要です。もう少し単語を登録してください。</p>
      </div>
    )
  }

  const isFillBlank = question.direction === 'meaningToTerm' && question.blankedSentence !== undefined
  const directionLabel = isFillBlank
    ? '空欄に入る語は?'
    : question.direction === 'termToMeaning'
      ? 'この語の意味は?'
      : 'この意味を表す語は?'
  const prompt = isFillBlank
    ? question.blankedSentence!
    : question.direction === 'termToMeaning'
      ? question.target.term
      : question.target.meaningJa

  return (
    <div className="page quiz-page">
      <h1>クイズ</h1>
      <p className="session-stats">
        今回のセッション: {session.correct} / {session.asked} 問正解
        {' ・ '}
        今日の復習: {duePool.length}語{studyAheadMode && '(先取り学習中)'}
      </p>

      <div className="quiz-card">
        <p className="quiz-direction">{directionLabel}</p>
        <p className={`quiz-prompt${isFillBlank ? ' sentence' : ''}`}>{prompt}</p>

        <div className="choices">
          {question.choices.map((choice, idx) => {
            let cls = 'choice-btn'
            if (selected !== null) {
              if (idx === question.correctIndex) cls += ' correct'
              else if (idx === selected) cls += ' incorrect'
            }
            return (
              <button
                key={idx}
                className={cls}
                disabled={selected !== null}
                onClick={() => handleAnswer(idx)}
              >
                {choice}
              </button>
            )
          })}
        </div>

        {selected !== null && (
          <div className="quiz-feedback">
            <p>{selected === question.correctIndex ? '正解!' : '不正解'}</p>
            {justMastered && <p className="mastered-toast">🎉 {justMastered} を習得しました!</p>}
            <button className="next-btn" onClick={() => nextQuestion(words, studyAheadMode)}>
              次の問題
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
