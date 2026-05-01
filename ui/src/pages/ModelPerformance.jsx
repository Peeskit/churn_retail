import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts'
import useApi  from '../hooks/useApi'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { useChartTheme, getAxisProps } from '../lib/chartTheme'

const METRICS = ['AUC', 'F1', 'Precision', 'Recall', 'Accuracy']

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={active ? 'btn-ghost-active' : 'btn-ghost'}>
      {children}
    </button>
  )
}

function MissingData() {
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 text-warn p-4 text-sm flex items-start gap-3">
      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      <div>
        Data not found — re-run{' '}
        <code className="bg-warn/20 px-1.5 py-0.5 rounded font-mono text-[12px]">python main.py</code> to generate it.
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl p-3 shadow-elevate text-sm">
      <p className="text-ink font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {p.value?.toFixed(4)}
        </p>
      ))}
    </div>
  )
}

export default function ModelPerformance() {
  const c  = useChartTheme()
  const ax = getAxisProps()

  const METRIC_COLORS = {
    AUC:       c.brand,
    F1:        c.accent,
    Precision: c.success,
    Recall:    c.warn,
    Accuracy:  c.brand2,
  }

  const { data: metrics, loading: mLoad, error: mErr } = useApi('/api/model-metrics')
  const { data: imp,     loading: iLoad, error: iErr } = useApi('/api/feature-importance')
  const [view,     setView]     = useState('table')
  const [impModel, setImpModel] = useState('lgbm')

  const bestByMetric = METRICS.reduce((acc, m) => {
    if (metrics) acc[m] = Math.max(...metrics.map(r => r[m] ?? 0))
    return acc
  }, {})

  const impData = imp?.[impModel]?.slice(0, 15) ?? []

  return (
    <div className="space-y-6">

      <PageHeader
        title="Model Performance"
        subtitle="LGBM · XGBoost · ANN · LSTM evaluated on 20% hold-out"
        icon="M4 19h16M6 16V9m4 7V5m4 11V11m4 5V7"
        actions={
          <div className="flex gap-2 p-1 rounded-xl bg-surface2 border border-border">
            <TabBtn active={view === 'table'}      onClick={() => setView('table')}>Metrics Table</TabBtn>
            <TabBtn active={view === 'chart'}      onClick={() => setView('chart')}>Bar Chart</TabBtn>
            <TabBtn active={view === 'importance'} onClick={() => setView('importance')}>Feature Importance</TabBtn>
          </div>
        }
      />

      {/* ── Metrics Table ── */}
      {view === 'table' && (
        mLoad ? <Spinner /> : mErr ? <MissingData /> : (
          <div className="card overflow-hidden animate-fade-in">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Model</th>
                  {METRICS.map(m => (
                    <th key={m} className="text-right">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((row, i) => (
                  <tr key={i} className={i === 0 ? 'bg-brand/[0.06]' : ''}>
                    <td>
                      <div className="flex items-center gap-2 font-medium text-ink">
                        {i === 0 && <span className="dot bg-brand shadow-[0_0_8px_currentColor]" />}
                        {row.model}
                        {i === 0 && (
                          <span className="chip bg-brand/15 text-brand border border-brand/25 ml-1">Best</span>
                        )}
                      </div>
                    </td>
                    {METRICS.map(m => (
                      <td
                        key={m}
                        className={`text-right tabular-nums ${
                          row[m] === bestByMetric[m] ? 'font-bold text-brand' : 'text-ink2'
                        }`}
                      >
                        {row[m]?.toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-6 py-2.5 text-xs text-muted bg-surface2 border-t border-border">
              Bold values = best per metric. First row = best overall model by AUC.
            </p>
          </div>
        )
      )}

      {/* ── Bar Chart ── */}
      {view === 'chart' && (
        mLoad ? <Spinner /> : mErr ? <MissingData /> : (
          <div className="card-pad animate-fade-in">
            <h3 className="section-title mb-5">All Metrics Comparison</h3>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={metrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} vertical={false} />
                <XAxis dataKey="model" tick={{ ...ax.tick, fontSize: 13 }} axisLine={{ stroke: c.border }} tickLine={false} />
                <YAxis domain={[0.4, 1]} tickFormatter={v => v.toFixed(2)} tick={ax.tick} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: c.muted }} />
                {METRICS.map(m => (
                  <Bar key={m} dataKey={m} fill={METRIC_COLORS[m]} maxBarSize={20} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      )}

      {/* ── Feature Importance ── */}
      {view === 'importance' && (
        iLoad ? <Spinner /> : iErr ? <MissingData /> : (
          <div className="card-pad animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h3 className="section-title">Feature Importance — Top 15</h3>
              <div className="flex gap-1.5 p-1 rounded-lg bg-surface2 border border-border">
                {['lgbm', 'xgboost'].map(m => (
                  <button
                    key={m}
                    onClick={() => setImpModel(m)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      impModel === m
                        ? 'bg-brand-gradient text-white shadow-soft'
                        : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={460}>
              <BarChart layout="vertical" data={impData} margin={{ left: 10, right: 60, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} horizontal={false} />
                <XAxis type="number" tickFormatter={v => (v * 100).toFixed(1) + '%'} tick={ax.tick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="feature" width={160} tick={{ ...ax.tick, fill: c.ink2, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => (v * 100).toFixed(2) + '%'}
                  contentStyle={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, color: c.ink }}
                  labelStyle={{ color: c.ink }}
                />
                <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
                  {impData.map((_, i) => (
                    <Cell key={i} fill={i < 3 ? c.brand : i < 7 ? c.brand2 : c.border} fillOpacity={i < 3 ? 1 : i < 7 ? 0.85 : 0.7} />
                  ))}
                  <LabelList
                    dataKey="importance"
                    position="right"
                    formatter={v => (v * 100).toFixed(1) + '%'}
                    style={{ fontSize: 11, fill: c.muted }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {impData.length > 0 && (
              <div className="mt-6 rounded-xl p-4 border border-brand/30 bg-brand/[0.06]">
                <p className="text-sm font-semibold text-brand mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8Z" />
                  </svg>
                  Top 3 churn drivers
                </p>
                <ul className="space-y-1.5">
                  {impData.slice(0, 3).map((f, i) => (
                    <li key={i} className="text-sm text-ink2 flex items-baseline gap-2">
                      <span className="chip bg-brand/15 text-brand w-6 justify-center">{i + 1}</span>
                      <span className="font-semibold text-ink">{f.feature}</span>
                      <span className="text-muted">— {(f.importance * 100).toFixed(2)}% of model weight</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
