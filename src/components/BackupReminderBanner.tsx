import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { exportWordsBackup } from '../utils/backup'
import { getLastBackupAt, onLastBackupAtChange } from '../utils/settings'

const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export default function BackupReminderBanner() {
  const [lastBackupAt, setLastBackupAtState] = useState(getLastBackupAt())
  const wordCount = useLiveQuery(() => db.words.count(), [])

  useEffect(() => onLastBackupAtChange(setLastBackupAtState), [])

  const needsBackup = !!wordCount && (lastBackupAt === null || Date.now() - lastBackupAt > REMINDER_INTERVAL_MS)
  if (!needsBackup) return null

  async function handleBackup() {
    await exportWordsBackup()
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
