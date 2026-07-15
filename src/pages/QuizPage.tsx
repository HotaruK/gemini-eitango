import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { buildQuestion, isMastered } from '../utils/quiz'
import { getAutoUnflag } from '../utils/settings'
import type { QuizQuestion, Word } from '../types'

export default function QuizPage() {
  const words = useLiveQuery(() => db.words.toArray(), [])
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [session, setSession] = useState({ asked: 0, correct: 0 })

  function nextQuestion(current: Word[]) {
    const flagged = current.filter((w) => w.isFlagged)
    setQuestion(buildQuestion(flagged, current))
    setSelected(null)
  }

  useEffect(() => {
    if (words && question === null) {
      nextQuestion(words)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  async function handleAnswer(idx: number) {
    if (selected !== null || !question || !words) return
    setSelected(idx)
    const correct = idx === question.correctIndex
    const w = question.target
    const isForward = question.direction === 'termToMeaning'

    const updates: Partial<Word> = isForward
      ? { quizCount: w.quizCount + 1, correctCount: w.correctCount + (correct ? 1 : 0) }
      : {
          quizCountReverse: w.quizCountReverse + 1,
          correctCountReverse: w.correctCountReverse + (correct ? 1 : 0),
        }

    await db.words.update(w.id!, updates)
    setSession((s) => ({ asked: s.asked + 1, correct: s.correct + (correct ? 1 : 0) }))

    if (getAutoUnflag()) {
      const merged = { ...w, ...updates } as Word
      if (isMastered(merged.quizCount, merged.correctCount) && isMastered(merged.quizCountReverse, merged.correctCountReverse)) {
        await db.words.update(w.id!, { isFlagged: false })
      }
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

  if (!question || question.choices.length < 2) {
    return (
      <div className="page quiz-page">
        <h1>クイズ</h1>
        <p>クイズには最低4語の登録が必要です。もう少し単語を登録してください。</p>
      </div>
    )
  }

  const directionLabel = question.direction === 'termToMeaning' ? 'この語の意味は?' : 'この意味を表す語は?'
  const prompt = question.direction === 'termToMeaning' ? question.target.term : question.target.meaningJa

  return (
    <div className="page quiz-page">
      <h1>クイズ</h1>
      <p className="session-stats">
        今回のセッション: {session.correct} / {session.asked} 問正解
      </p>

      <div className="quiz-card">
        <p className="quiz-direction">{directionLabel}</p>
        <p className="quiz-prompt">{prompt}</p>

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
            <button className="next-btn" onClick={() => nextQuestion(words)}>
              次の問題
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
