import Dexie, { type EntityTable } from 'dexie'
import type { Attempt, Word } from './types'
import { MASTERY_INTERVAL_INDEX } from './utils/quiz'

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

// 間隔反復(SRS)用に intervalIndex / nextReviewAt を追加。
// 既存語は「旧定義(quizCount>=5 & rate>=0.8 が両方向とも成立)で習得済みだったか」で
// 初期ステップを決め、全語 nextReviewAt=now(即due)として新スケジュールを開始する。
db.version(3)
  .stores({
    words: '++id, &normalizedTerm, type, isFlagged, createdAt, nextReviewAt',
    attempts: '++id, wordId, answeredAt',
  })
  .upgrade(async (tx) => {
    const legacyMastered = (quizCount: number, correctCount: number): boolean => {
      const rate = quizCount > 0 ? correctCount / quizCount : 0
      return quizCount >= 5 && rate >= 0.8
    }
    const now = Date.now()
    await tx
      .table('words')
      .toCollection()
      .modify((w: Word) => {
        const wasMastered =
          legacyMastered(w.quizCount, w.correctCount) &&
          legacyMastered(w.quizCountReverse, w.correctCountReverse)
        w.intervalIndex = wasMastered ? MASTERY_INTERVAL_INDEX : 0
        w.nextReviewAt = now
      })
  })

// このタブがスキーマの新バージョンを開こうとしたとき、古いバージョンを保持している
// 側は自分から接続を閉じて再読み込みする（Dexie推奨パターン）。生きているタブはこれで解放される。
db.on('versionchange', () => {
  db.close()
  window.location.reload()
})

// 逆に「このタブが新バージョンを開こうとして、別インスタンス（凍結したバックグラウンドの
// PWA/タブなど）に阻まれている」状態。放置すると db.open() が永遠に解決せず、
// クイズ加算・検索保存など全DB操作が無音でフリーズする。UI側で検知できるよう状態を公開する。
let dbBlocked = false
const blockedListeners = new Set<(blocked: boolean) => void>()

function setBlocked(next: boolean) {
  if (dbBlocked === next) return
  dbBlocked = next
  blockedListeners.forEach((cb) => cb(next))
}

export function onDbBlockedChange(cb: (blocked: boolean) => void): () => void {
  blockedListeners.add(cb)
  cb(dbBlocked)
  return () => blockedListeners.delete(cb)
}

db.on('blocked', () => {
  console.warn('eitango-memo: DB upgrade blocked by another open tab/connection')
  setBlocked(true)
})

// 'blocked' イベントが発火しないケースの保険として、一定時間内に open できなければブロックとみなす。
const OPEN_WATCHDOG_MS = 3000
const watchdog = window.setTimeout(() => setBlocked(true), OPEN_WATCHDOG_MS)

db.open()
  .then(() => {
    window.clearTimeout(watchdog)
    setBlocked(false)
  })
  .catch((err) => {
    window.clearTimeout(watchdog)
    console.error('eitango-memo: failed to open database', err)
    // 開けなかった場合も無音で壊れるより回復UIを出す
    setBlocked(true)
  })

const ATTEMPT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export async function pruneOldAttempts() {
  try {
    const cutoff = Date.now() - ATTEMPT_RETENTION_MS
    await db.attempts.where('answeredAt').below(cutoff).delete()
  } catch (err) {
    console.error('Failed to prune old attempts', err)
  }
}

export default db
