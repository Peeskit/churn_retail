import { useState } from 'react'
import ModelPerformance from './pages/ModelPerformance'
import Outcomes        from './pages/Outcomes'
import WhatIf          from './pages/WhatIf'
import Executive       from './pages/Executive'

const TABS = [
  { id: 'performance', label: 'Model Performance' },
  { id: 'outcomes',    label: 'Outcomes' },
  { id: 'whatif',      label: 'What-If Tools' },
  { id: 'executive',   label: 'Executive Dashboard' },
]

export default function App() {
  const [tab, setTab] = useState('performance')

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── Header ── */}
      <header className="bg-indigo-950 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Churn Intelligence Dashboard</h1>
            <p className="text-indigo-300 text-sm mt-0.5">Online Retail · Customer Retention Analytics</p>
          </div>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <nav className="bg-indigo-900 shadow-md">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors rounded-t-md ${
                tab === t.id
                  ? 'bg-gray-50 text-indigo-900'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'performance' && <ModelPerformance />}
        {tab === 'outcomes'    && <Outcomes />}
        {tab === 'whatif'      && <WhatIf />}
        {tab === 'executive'   && <Executive />}
      </main>

    </div>
  )
}
