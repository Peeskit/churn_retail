import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend, ReferenceLine,
} from 'recharts'
import useApi  from '../hooks/useApi'
import Spinner from '../components/Spinner'

const fmt    = n => Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtGBP = n => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = (n, d = 1) => (n * 100).toFixed(d) + '%'

function StatCard({ label, value, sub, color = 'gray' }) {
  const COLORS = {
    red:    'text-red-700 bg-red-50 border-red-200',
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    green:  'text-green-700 bg-green-50 border-green-200',
    amber:  'text-amber-700 bg-amber-50 border-amber-200',
    gray:   'text-gray-700 bg-gray-50 border-gray-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${COLORS[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function WhatIf() {
  const { data: allProbs, loading } = useApi('/api/all-probs')
  const { data: imp }               = useApi('/api/feature-importance')

  const [threshold,     setThreshold]     = useState(0.50)
  const [retRate,       setRetRate]       = useState(0.20)
  const [targetTier,    setTargetTier]    = useState('All')
  const [impModel,      setImpModel]      = useState('lgbm')

  // ── Pre-compute tier thresholds once ──
  const { highThr, midThr } = useMemo(() => {
    if (!allProbs?.length) return { highThr: Infinity, midThr: Infinity }
    const sorted = [...allProbs].map(c => c.monetary).sort((a, b) => a - b)
    const q = p => sorted[Math.floor(p * sorted.length)] ?? 0
    return { highThr: q(0.75), midThr: q(0.40) }
  }, [allProbs])

  const getTier = m => m >= highThr ? 'High' : m >= midThr ? 'Medium' : 'Low'

  // ── Threshold simulator ──
  const threshStats = useMemo(() => {
    if (!allProbs?.length) return null
    const predicted = allProbs.filter(c => c.churn_probability >= threshold)
    const total     = allProbs.length
    const actualPos = allProbs.filter(c => c.churn_actual === 1).length

    const tp = predicted.filter(c => c.churn_actual === 1).length
    const fp = predicted.filter(c => c.churn_actual === 0).length
    const fn = actualPos - tp

    const precision      = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall         = actualPos > 0 ? tp / actualPos : 0
    const revenue_at_risk = predicted.reduce((s, c) => s + (c.monetary ?? 0), 0)

    return { count: predicted.length, rate: predicted.length / total, revenue_at_risk, precision, recall, tp, fp, fn }
  }, [allProbs, threshold])

  // ── PR curve across thresholds ──
  const prCurve = useMemo(() => {
    if (!allProbs?.length) return []
    const actualPos = allProbs.filter(c => c.churn_actual === 1).length
    return Array.from({ length: 17 }, (_, i) => {
      const t   = 0.1 + i * 0.05
      const pos = allProbs.filter(c => c.churn_probability >= t)
      const tp  = pos.filter(c => c.churn_actual === 1).length
      const fp  = pos.length - tp
      return {
        threshold:  parseFloat(t.toFixed(2)),
        Precision:  tp + fp > 0 ? parseFloat((tp / (tp + fp)).toFixed(3)) : 0,
        Recall:     actualPos > 0 ? parseFloat((tp / actualPos).toFixed(3)) : 0,
      }
    })
  }, [allProbs])

  // ── Retention simulator ──
  const retStats = useMemo(() => {
    if (!allProbs?.length || !threshStats) return null
    const churners = allProbs.filter(c => c.churn_probability >= threshold)
    const targeted = targetTier === 'All' ? churners : churners.filter(c => getTier(c.monetary) === targetTier)
    const risk     = targeted.reduce((s, c) => s + (c.monetary ?? 0), 0)
    return {
      count:    targeted.length,
      risk,
      saved:    risk * retRate,
      roi_text: `${(retRate * 100).toFixed(0)}% of ${fmtGBP(risk)} at risk`,
    }
  }, [allProbs, threshold, retRate, targetTier, highThr, midThr])

  const impData = imp?.[impModel]?.slice(0, 15) ?? []

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">

      <div>
        <h2 className="text-2xl font-bold text-gray-900">What-If Tools</h2>
        <p className="text-gray-500 text-sm mt-0.5">Interactively explore churn thresholds, retention scenarios, and feature drivers</p>
      </div>

      {/* ══════════════════════════════════════
          SECTION 1 — Feature Importance
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <SectionTitle
            title="What drives churn?"
            subtitle="Global feature importance — how much each variable contributes to predictions"
          />
          <div className="flex gap-2">
            {['lgbm', 'xgboost'].map(m => (
              <button key={m} onClick={() => setImpModel(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${impModel === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={420}>
          <BarChart layout="vertical" data={impData} margin={{ left: 10, right: 60, top: 0, bottom: 0 }}>
            <XAxis type="number" tickFormatter={v => (v * 100).toFixed(1) + '%'} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 12 }} />
            <Tooltip formatter={v => (v * 100).toFixed(2) + '%'} />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {impData.map((_, i) => <Cell key={i} fill={i < 3 ? '#4F46E5' : i < 7 ? '#818CF8' : '#C7D2FE'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {impData.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {impData.slice(0, 3).map((f, i) => (
              <div key={i} className="bg-indigo-50 rounded-lg p-3">
                <p className="text-xs text-indigo-400 font-semibold uppercase">#{i + 1} Driver</p>
                <p className="text-sm font-bold text-indigo-800 mt-0.5">{f.feature}</p>
                <p className="text-xs text-indigo-500">{(f.importance * 100).toFixed(2)}% of model weight</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          SECTION 2 — Threshold Simulator
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <SectionTitle
          title="Threshold Simulator"
          subtitle="Adjust the decision threshold to balance precision vs recall"
        />

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <label className="text-sm font-medium text-gray-700 min-w-max">Churn Threshold</label>
          <input
            type="range" min={0.10} max={0.90} step={0.05}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="flex-1 min-w-48 accent-indigo-600"
          />
          <span className="text-lg font-bold text-indigo-700 min-w-12">{fmtPct(threshold, 0)}</span>
        </div>

        {threshStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="Predicted Churners" value={fmt(threshStats.count)}                    color="red"    />
            <StatCard label="Churn Rate"          value={fmtPct(threshStats.rate)}                 color="amber"  />
            <StatCard label="Revenue at Risk"     value={fmtGBP(threshStats.revenue_at_risk)}      color="indigo" />
            <StatCard label="Precision"           value={fmtPct(threshStats.precision)}            color="green"  sub="of flagged are real churners" />
            <StatCard label="Recall"              value={fmtPct(threshStats.recall)}               color="gray"   sub="of actual churners caught" />
          </div>
        )}

        {/* Precision / Recall tradeoff curve */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-3">Precision–Recall tradeoff across thresholds</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={prCurve} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="threshold" tickFormatter={v => fmtPct(v, 0)} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tickFormatter={v => fmtPct(v, 0)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => fmtPct(v)} labelFormatter={v => `Threshold: ${fmtPct(v, 0)}`} />
              <Legend />
              <ReferenceLine x={threshold} stroke="#6366F1" strokeDasharray="4 3" label={{ value: 'current', position: 'top', fontSize: 11, fill: '#6366F1' }} />
              <Line type="monotone" dataKey="Precision" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Recall"    stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SECTION 3 — Retention Simulator
      ══════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <SectionTitle
          title="Retention Campaign Simulator"
          subtitle="Estimate revenue saved by targeting a specific segment with a retention offer"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Retention Rate — <span className="text-indigo-600 font-bold">{fmtPct(retRate, 0)}</span>
            </label>
            <input
              type="range" min={0.05} max={0.60} step={0.05}
              value={retRate}
              onChange={e => setRetRate(parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5%</span><span>Conservative (20%)</span><span>60%</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Target Tier</label>
            <div className="flex gap-2 flex-wrap">
              {['All', 'High', 'Medium', 'Low'].map(t => (
                <button key={t} onClick={() => setTargetTier(t)}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                    targetTier === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {retStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Customers Targeted" value={fmt(retStats.count)}       color="indigo" sub={targetTier === 'All' ? 'all predicted churners' : `${targetTier}-value tier`} />
            <StatCard label="Revenue at Risk"    value={fmtGBP(retStats.risk)}     color="red"    sub="from targeted customers" />
            <StatCard label="Estimated Savings"  value={fmtGBP(retStats.saved)}    color="green"  sub={retStats.roi_text} />
          </div>
        )}
      </div>

    </div>
  )
}
