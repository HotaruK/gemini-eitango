const GEMINI_KEY_STORAGE = 'eitango.geminiApiKey'
const GEMINI_MODEL_STORAGE = 'eitango.geminiModel'
const AUTO_UNFLAG_STORAGE = 'eitango.autoUnflag'
const LAST_BACKUP_AT_STORAGE = 'eitango.lastBackupAt'

export function getGeminiApiKey(): string {
  return localStorage.getItem(GEMINI_KEY_STORAGE) ?? ''
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_KEY_STORAGE, key)
}

export function getGeminiModel(): string {
  return localStorage.getItem(GEMINI_MODEL_STORAGE) ?? ''
}

export function setGeminiModel(model: string): void {
  localStorage.setItem(GEMINI_MODEL_STORAGE, model)
}

export function getAutoUnflag(): boolean {
  return localStorage.getItem(AUTO_UNFLAG_STORAGE) === 'true'
}

export function setAutoUnflag(value: boolean): void {
  localStorage.setItem(AUTO_UNFLAG_STORAGE, String(value))
}

export function getLastBackupAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_AT_STORAGE)
  return raw ? Number(raw) : null
}

const lastBackupListeners = new Set<(timestamp: number) => void>()

export function onLastBackupAtChange(cb: (timestamp: number) => void): () => void {
  lastBackupListeners.add(cb)
  return () => lastBackupListeners.delete(cb)
}

export function setLastBackupAt(timestamp: number): void {
  localStorage.setItem(LAST_BACKUP_AT_STORAGE, String(timestamp))
  lastBackupListeners.forEach((cb) => cb(timestamp))
}
