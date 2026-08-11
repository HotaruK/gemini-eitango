import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { downloadCsv, wordsToCsv } from '../utils/csv'
import { getLastBackupAt, onLastBackupAtChange, setLastBackupAt } from '../utils/settings'

const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export default function BackupReminderBanner() {
  const [lastBackupAt, setLastBackupAtState] = useState(getLastBackupAt())
  const wordCount = useLiveQuery(() => db.words.count(), [])

  useEffect(() => onLastBackupAtChange(setLastBackupAtState), [])

  const needsBackup = !!wordCount && (lastBackupAt === null || Date.now() - lastBackupAt > REMINDER_INTERVAL_MS)
  if (!needsBackup) return null

  async function handleBackup() {
    const words = await db.words.toArray()
    const csv = wordsToCsv(words)
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `eitango-memo-${date}.csv`)
    setLastBackupAt(Date.now())
  }

  return (
    <div className="backup-banner">
      <p>
        {lastBackupAt === null
          ? 'まだCSVバックアップを取っていません。'
          : '前回のバックアップから1週間以上経っています。'}
        端末のストレージ状況によってはデータが消えることがあるため、定期的なバックアップをおすすめします。
      </p>
      <button type="button" onClick={handleBackup}>
        今すぐバックアップ
      </button>
    </div>
  )
}
