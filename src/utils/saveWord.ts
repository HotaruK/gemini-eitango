import db from '../db'
import type { LookupResult } from '../api/lookup'
import type { Word } from '../types'

/**
 * 検索結果をDBにupsertする。既存語は意味情報のみ更新し、★フラグと出題成績は保持する。
 * 新規語は isFlagged を opts.flagIfNew (既定 false) で作成する。
 */
export async function saveLookupResult(looked: LookupResult, opts?: { flagIfNew?: boolean }): Promise<Word> {
  const now = Date.now()
  const existing = await db.words.where('normalizedTerm').equals(looked.normalizedTerm).first()

  if (existing) {
    const saved: Word = {
      ...existing,
      ...looked,
      isFlagged: existing.isFlagged,
      quizCount: existing.quizCount,
      correctCount: existing.correctCount,
      quizCountReverse: existing.quizCountReverse,
      correctCountReverse: existing.correctCountReverse,
      createdAt: existing.createdAt,
      updatedAt: now,
    }
    await db.words.put(saved)
    return saved
  }

  const toInsert: Omit<Word, 'id'> = {
    ...looked,
    isFlagged: opts?.flagIfNew ?? false,
    quizCount: 0,
    correctCount: 0,
    quizCountReverse: 0,
    correctCountReverse: 0,
    createdAt: now,
    updatedAt: now,
  }
  const id = await db.words.add(toInsert as Word)
  return { ...toInsert, id } as Word
}
