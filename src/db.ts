import Dexie, { type EntityTable } from 'dexie'
import type { Word } from './types'

export function normalize(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ')
}

const db = new Dexie('eitango-memo') as Dexie & {
  words: EntityTable<Word, 'id'>
}

db.version(1).stores({
  words: '++id, &normalizedTerm, type, isFlagged, createdAt',
})

export default db
