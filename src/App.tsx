import { useCallback, useEffect, useRef, useState } from 'react'
import SearchPage from './pages/SearchPage'
import TranslatePage from './pages/TranslatePage'
import WordListPage from './pages/WordListPage'
import QuizPage from './pages/QuizPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'
import { pruneOldAttempts } from './db'

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

  useEffect(() => {
    pruneOldAttempts()
  }, [])

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
