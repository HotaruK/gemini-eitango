import type { QuizDirection, QuizQuestion, Word } from '../types'

const UNSEEN_WEIGHT = 3.0
const EPSILON = 0.1
const MASTERED_MULTIPLIER = 0.15
export const MASTERY_MIN_QUIZ_COUNT = 5
export const MASTERY_MIN_RATE = 0.8

export function computeRate(quizCount: number, correctCount: number): number | undefined {
  return quizCount > 0 ? correctCount / quizCount : undefined
}

export function isMastered(quizCount: number, correctCount: number): boolean {
  const rate = computeRate(quizCount, correctCount)
  return quizCount >= MASTERY_MIN_QUIZ_COUNT && (rate ?? 0) >= MASTERY_MIN_RATE
}

export function directionWeight(quizCount: number, correctCount: number): number {
  if (quizCount === 0) return UNSEEN_WEIGHT
  const rate = computeRate(quizCount, correctCount) ?? 0
  let weight = 1 - rate + EPSILON
  if (isMastered(quizCount, correctCount)) weight *= MASTERED_MULTIPLIER
  return weight
}

export function wordWeight(word: Word): number {
  return (
    directionWeight(word.quizCount, word.correctCount) +
    directionWeight(word.quizCountReverse, word.correctCountReverse)
  )
}

function pickWeightedIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return Math.floor(Math.random() * weights.length)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

function pickDirection(word: Word): QuizDirection {
  const wForward = directionWeight(word.quizCount, word.correctCount)
  const wReverse = directionWeight(word.quizCountReverse, word.correctCountReverse)
  const idx = pickWeightedIndex([wForward, wReverse])
  return idx === 0 ? 'termToMeaning' : 'meaningToTerm'
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * ★フラグの語から重み付き抽選で1語選び、四択問題を構築する。
 * ダミー選択肢は同じ種別を優先し、不足分は全体から補う。
 */
export function buildQuestion(flagged: Word[], all: Word[]): QuizQuestion | null {
  if (flagged.length === 0) return null

  const weights = flagged.map(wordWeight)
  const target = flagged[pickWeightedIndex(weights)]
  const direction = pickDirection(target)

  const pool = all.filter((w) => w.id !== target.id)
  const sameType = pool.filter((w) => w.type === target.type)
  const others = pool.filter((w) => w.type !== target.type)
  const distractorPool = [...shuffle(sameType), ...shuffle(others)]

  const getText = (w: Word) => (direction === 'termToMeaning' ? w.meaningJa : w.term)
  const correctText = getText(target)

  const distractors: string[] = []
  for (const w of distractorPool) {
    const text = getText(w)
    if (text && text !== correctText && !distractors.includes(text)) {
      distractors.push(text)
    }
    if (distractors.length >= 3) break
  }

  const choices = shuffle([correctText, ...distractors])
  const correctIndex = choices.indexOf(correctText)

  return { direction, target, choices, correctIndex }
}
