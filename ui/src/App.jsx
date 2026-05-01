import { useState } from 'react'
import ModelPerformance from './pages/ModelPerformance'
import Outcomes        from './pages/Outcomes'
import WhatIf          from './pages/WhatIf'
import Executive       from './pages/Executive'
import EDA             from './pages/EDA'
import ChatBot         from './components/ChatBot'

const TABS = [
  { id: 'eda',         label: 'EDA' },
  { id: 'performance', label: 'Model Performance' },
  { id: 'outcomes',    label: 'Outcomes' },
  { id: 'whatif',      label: 'What-If Tools' },
  { id: 'executive',   label: 'Executive Dashboard' },
]

export default function App() {
  const [tab, setTab] = useState('performance')

  return (
    <div className="min-h-screen bg-gray-950 font-sans">

      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight text-white">Churn Intelligence Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Online Retail · Customer Retention Analytics</p>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors rounded-t-md ${
                tab === t.id
                  ? 'bg-gray-950 text-white border-t-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'eda'         && <EDA />}
        {tab === 'performance' && <ModelPerformance />}
        {tab === 'outcomes'    && <Outcomes />}
        {tab === 'whatif'      && <WhatIf />}
        {tab === 'executive'   && <Executive />}
      </main>

      <ChatBot />

    </div>
  )
}
