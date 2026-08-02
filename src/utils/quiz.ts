import type { QuizDirection, QuizQuestion, Word } from '../types'

const UNSEEN_WEIGHT = 3.0
const EPSILON = 0.1
export const MASTERY_MIN_RATE = 0.8
export const ACTIVE_POOL_SIZE = 30

// 間隔反復(Leitner式)のステップ。正誤の2値しか得られないため易しさ係数は持たず、
// 正解でステップを1つ進め、不正解でステップ0(即再出題)に戻す。
export const INTERVAL_STEPS_DAYS = [0, 1, 3, 7, 14, 30, 60]
export const MASTERY_INTERVAL_INDEX = INTERVAL_STEPS_DAYS.length - 1
const DAY_MS = 24 * 60 * 60 * 1000

export function computeRate(quizCount: number, correctCount: number): number | undefined {
  return quizCount > 0 ? correctCount / quizCount : undefined
}

// direction単位の重み付けにのみ使う「この方向はよく正解できている」判定。
// 単語全体の習得済み判定(isWordMastered)とは別物。
function isDirectionSaturated(quizCount: number, correctCount: number): boolean {
  const rate = computeRate(quizCount, correctCount)
  return quizCount >= 5 && (rate ?? 0) >= MASTERY_MIN_RATE
}

export function isWordMastered(word: Pick<Word, 'intervalIndex'>): boolean {
  return word.intervalIndex >= MASTERY_INTERVAL_INDEX
}

export function isWordDue(word: Pick<Word, 'nextReviewAt'>, now: number = Date.now()): boolean {
  return word.nextReviewAt <= now
}

/**
 * 正誤に応じて次の間隔ステップと次回出題予定時刻を計算する。
 * 正解: ステップを1つ進める。不正解: ステップ0(即再出題)に戻す。
 */
export function computeNextReview(
  intervalIndex: number,
  correct: boolean,
  now: number = Date.now(),
): { intervalIndex: number; nextReviewAt: number } {
  const nextIndex = correct ? Math.min(intervalIndex + 1, MASTERY_INTERVAL_INDEX) : 0
  const nextReviewAt = now + INTERVAL_STEPS_DAYS[nextIndex] * DAY_MS
  return { intervalIndex: nextIndex, nextReviewAt }
}

/**
 * ★フラグの語のうち未習得のものを登録順に最大ACTIVE_POOL_SIZE件だけ「学習中プール」として返す。
 * 一度に大量の語をループさせると定着しにくいため出題対象をここで絞り、
 * 習得済みになった語は自然にプールから外れて次の語が繰り上がる。
 */
export function buildActivePool(words: Word[]): Word[] {
  return words
    .filter((w) => w.isFlagged && !isWordMastered(w))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, ACTIVE_POOL_SIZE)
}

/** 学習中プールのうち、復習予定時刻(nextReviewAt)が到来している語だけを返す。 */
export function buildDuePool(activePool: Word[], now: number = Date.now()): Word[] {
  return activePool.filter((w) => isWordDue(w, now))
}

export function directionWeight(quizCount: number, correctCount: number): number {
  if (quizCount === 0) return UNSEEN_WEIGHT
  if (isDirectionSaturated(quizCount, correctCount)) return 0
  const rate = computeRate(quizCount, correctCount) ?? 0
  return 1 - rate + EPSILON
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
