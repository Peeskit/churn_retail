import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import useApi  from '../hooks/useApi'
import Spinner from '../components/Spinner'

const METRICS = ['AUC', 'F1', 'Precision', 'Recall', 'Accuracy']
const METRIC_COLORS = {
  AUC:       '#4F46E5',
  F1:        '#06B6D4',
  Precision: '#10B981',
  Recall:    '#F59E0B',
  Accuracy:  '#8B5CF6',
}
const TIER_COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#8B5CF6']

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function MissingData({ msg }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
      Data not found — re-run <code className="bg-amber-100 px-1 rounded">python main.py</code> to generate it.
      {msg && <span className="ml-1 text-amber-600">({msg})</span>}
    </div>
  )
}

export default function ModelPerformance() {
  const { data: metrics, loading: mLoad, error: mErr } = useApi('/api/model-metrics')
  const { data: imp,     loading: iLoad, error: iErr } = useApi('/api/feature-importance')
  const [view,        setView]        = useState('table')
  const [impModel,    setImpModel]    = useState('lgbm')

  const bestByMetric = METRICS.reduce((acc, m) => {
    if (metrics) acc[m] = Math.max(...metrics.map(r => r[m] ?? 0))
    return acc
  }, {})

  const impData = imp?.[impModel]?.slice(0, 15) ?? []

  return (
    <div className="space-y-6">

      {/* ── Title row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Model Performance</h2>
          <p className="text-gray-500 text-sm mt-0.5">LGBM · XGBoost · ANN · LSTM evaluated on 20 % hold-out</p>
        </div>
        <div className="flex gap-2">
          <TabBtn active={view === 'table'}      onClick={() => setView('table')}>Metrics Table</TabBtn>
          <TabBtn active={view === 'chart'}      onClick={() => setView('chart')}>Bar Chart</TabBtn>
          <TabBtn active={view === 'importance'} onClick={() => setView('importance')}>Feature Importance</TabBtn>
        </div>
      </div>

      {/* ── Metrics Table ── */}
      {view === 'table' && (
        mLoad ? <Spinner /> : mErr ? <MissingData msg={mErr} /> : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Model</th>
                  {METRICS.map(m => (
                    <th key={m} className="px-6 py-3 text-right font-semibold text-gray-600">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.map((row, i) => (
                  <tr key={i} className={i === 0 ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                      {i === 0 && <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />}
                      {row.model}
                      {i === 0 && <span className="text-xs text-indigo-500 font-normal">Best</span>}
                    </td>
                    {METRICS.map(m => (
                      <td
                        key={m}
                        className={`px-6 py-4 text-right tabular-nums ${
                          row[m] === bestByMetric[m]
                            ? 'font-bold text-indigo-700'
                            : 'text-gray-600'
                        }`}
                      >
                        {row[m]?.toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-6 py-2 text-xs text-gray-400 bg-gray-50 border-t">
              Bold values = best per metric. First row = best overall model by AUC.
            </p>
          </div>
        )
      )}

      {/* ── Bar Chart ── */}
      {view === 'chart' && (
        mLoad ? <Spinner /> : mErr ? <MissingData msg={mErr} /> : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">All Metrics Comparison</h3>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={metrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={2}>
                <XAxis dataKey="model" tick={{ fontSize: 13 }} />
                <YAxis domain={[0.4, 1]} tickFormatter={v => v.toFixed(2)} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => v.toFixed(4)} />
                <Legend />
                {METRICS.map((m, i) => (
                  <Bar key={m} dataKey={m} fill={METRIC_COLORS[m]} maxBarSize={18} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      )}

      {/* ── Feature Importance ── */}
      {view === 'importance' && (
        iLoad ? <Spinner /> : iErr ? <MissingData msg={iErr} /> : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h3 className="text-base font-semibold text-gray-800">Feature Importance — Top 15</h3>
              <div className="flex gap-2">
                {['lgbm', 'xgboost'].map(m => (
                  <button
                    key={m}
                    onClick={() => setImpModel(m)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      impModel === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={460}>
              <BarChart layout="vertical" data={impData} margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
                <XAxis type="number" tickFormatter={v => (v * 100).toFixed(1) + '%'} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => (v * 100).toFixed(2) + '%'} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {impData.map((_, i) => (
                    <Cell key={i} fill={i < 3 ? '#4F46E5' : i < 7 ? '#6366F1' : '#A5B4FC'} />
                  ))}
                  <LabelList
                    dataKey="importance"
                    position="right"
                    formatter={v => (v * 100).toFixed(1) + '%'}
                    style={{ fontSize: 11, fill: '#6B7280' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {impData.length > 0 && (
              <div className="mt-5 p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm font-semibold text-indigo-800 mb-2">Top 3 churn drivers</p>
                <ul className="space-y-1">
                  {impData.slice(0, 3).map((f, i) => (
                    <li key={i} className="text-sm text-indigo-700">
                      <span className="font-medium">{i + 1}. {f.feature}</span>
                      <span className="text-indigo-400 ml-2">— {(f.importance * 100).toFixed(2)}% of model weight</span>
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
