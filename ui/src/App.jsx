import { useState } from 'react'
import ModelPerformance from './pages/ModelPerformance'
import Outcomes        from './pages/Outcomes'
import WhatIf          from './pages/WhatIf'
import Executive       from './pages/Executive'
import EDA             from './pages/EDA'
import Profiling       from './pages/Profiling'
import ChatBot         from './components/ChatBot'
import ThemeToggle     from './components/ThemeToggle'

const TABS = [
  { id: 'eda',         label: 'EDA',                 icon: 'M3 3v18h18M7 14l3-3 4 4 5-6' },
  { id: 'profiling',   label: 'Profiling',           icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z' },
  { id: 'performance', label: 'Model Performance',   icon: 'M4 19h16M6 16V9m4 7V5m4 11V11m4 5V7' },
  { id: 'outcomes',    label: 'Outcomes',            icon: 'M5 13l4 4L19 7' },
  { id: 'whatif',      label: 'What-If Tools',       icon: 'M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { id: 'executive',   label: 'Executive Dashboard', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
]

export default function App() {
  const [tab, setTab] = useState('performance')

  return (
    <div className="min-h-screen app-bg font-sans text-ink">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-surface/75 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 15l3-4 3 3 5-7" />
                <circle cx="19" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] sm:text-lg font-bold tracking-tight text-ink truncate">
                Churn Intelligence <span className="text-gradient-brand">Dashboard</span>
              </h1>
              <p className="text-muted text-[11px] sm:text-xs mt-0.5 flex items-center gap-1.5">
                <span className="dot bg-success animate-pulse" />
                Online Retail · Customer Retention Analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex chip bg-surface2 text-muted border border-border">
              v1.0 · Live
            </span>
            <ThemeToggle />
          </div>
        </div>

        {/* ── Tab nav ── */}
        <nav className="border-t border-border bg-surface/40">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex gap-0 overflow-x-auto">
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`tab-btn flex items-center gap-2 whitespace-nowrap ${active ? 'tab-btn-active' : ''}`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                  </svg>
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in" key={tab}>
        {tab === 'eda'         && <EDA />}
        {tab === 'profiling'   && <Profiling />}
        {tab === 'performance' && <ModelPerformance />}
        {tab === 'outcomes'    && <Outcomes />}
        {tab === 'whatif'      && <WhatIf />}
        {tab === 'executive'   && <Executive />}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-6 text-center text-xs text-muted">
        Built with care · Slate &amp; Steel theme
      </footer>

      <ChatBot />
    </div>
  )
}
