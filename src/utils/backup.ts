import db from '../db'
import { wordsToCsv, downloadCsv } from './csv'
import { setLastBackupAt } from './settings'

export async function exportWordsBackup(): Promise<void> {
  const words = await db.words.toArray()
  const csv = wordsToCsv(words)
  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(csv, `eitango-memo-${date}.csv`)
  setLastBackupAt(Date.now())
}
