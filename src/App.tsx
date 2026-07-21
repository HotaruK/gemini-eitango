import { useCallback, useEffect, useRef, useState } from 'react'
import SearchPage from './pages/SearchPage'
import TranslatePage from './pages/TranslatePage'
import WordListPage from './pages/WordListPage'
import QuizPage from './pages/QuizPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'
import { onDbBlockedChange, pruneOldAttempts } from './db'

type Tab = 'search' | 'translate' | 'list' | 'quiz' | 'analysis' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'search', label: '調べる', icon: '🔍' },
  { key: 'translate', label: '翻訳', icon: '📝' },
  { key: 'list', label: '単語帳', icon: '📖' },
  { key: 'quiz', label: 'クイズ', icon: '❓' },
  { key: 'analysis', label: '分析', icon: '📊' },
  { key: 'settings', label: '設定', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('search')
  const [badges, setBadges] = useState<Partial<Record<Tab, boolean>>>({})
  const [dbBlocked, setDbBlocked] = useState(false)

  useEffect(() => {
    pruneOldAttempts()
  }, [])

  useEffect(() => onDbBlockedChange(setDbBlocked), [])

  // タブ切り替え直後の非同期処理完了イベントでも常に最新のアクティブタブと比較できるよう ref で保持する
  const tabRef = useRef(tab)
  tabRef.current = tab

  const markDone = useCallback((key: Tab) => {
    if (key === tabRef.current) return
    setBadges((prev) => ({ ...prev, [key]: true }))
  }, [])

  function selectTab(key: Tab) {
    setTab(key)
    setBadges((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  }

  if (dbBlocked) {
    return (
      <div className="app-shell">
        <div className="db-blocked">
          <h1>⚠️ 更新を適用できません</h1>
          <p>
            このアプリを別のタブ、または「ホーム画面に追加」したPWAとして同時に開いていると、
            データベースの更新が完了できず、単語登録やクイズの記録が保存できなくなります。
          </p>
          <p>他のタブ・ウィンドウ（インストール済みアプリ含む）をすべて閉じてから、下のボタンで再読み込みしてください。</p>
          <button type="button" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <div className={tab === 'search' ? '' : 'hidden-tab'}>
          <SearchPage onDone={() => markDone('search')} />
        </div>
        <div className={tab === 'translate' ? '' : 'hidden-tab'}>
          <TranslatePage onDone={() => markDone('translate')} />
        </div>
        <div className={tab === 'list' ? '' : 'hidden-tab'}>
          <WordListPage />
        </div>
        <div className={tab === 'quiz' ? '' : 'hidden-tab'}>
          <QuizPage />
        </div>
        <div className={tab === 'analysis' ? '' : 'hidden-tab'}>
          <AnalysisPage />
        </div>
        <div className={tab === 'settings' ? '' : 'hidden-tab'}>
          <SettingsPage />
        </div>
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`bottom-nav-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => selectTab(t.key)}
          >
            <span className="icon">
              {t.icon}
              {badges[t.key] && <span className="nav-badge">❗</span>}
            </span>
            <span className="label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
