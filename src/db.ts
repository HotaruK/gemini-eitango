import Dexie, { type EntityTable } from 'dexie'
import type { Attempt, Word } from './types'

export function normalize(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ')
}

const db = new Dexie('eitango-memo') as Dexie & {
  words: EntityTable<Word, 'id'>
  attempts: EntityTable<Attempt, 'id'>
}

db.version(1).stores({
  words: '++id, &normalizedTerm, type, isFlagged, createdAt',
})

db.version(2).stores({
  words: '++id, &normalizedTerm, type, isFlagged, createdAt',
  attempts: '++id, wordId, answeredAt',
})

const ATTEMPT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export async function pruneOldAttempts() {
  const cutoff = Date.now() - ATTEMPT_RETENTION_MS
  await db.attempts.where('answeredAt').below(cutoff).delete()
}

export default db
