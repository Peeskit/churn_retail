import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend, ReferenceLine, CartesianGrid,
} from 'recharts'
import useApi  from '../hooks/useApi'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { useChartTheme, getTooltipStyle, getAxisProps } from '../lib/chartTheme'

const fmt    = n => Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtGBP = n => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = (n, d = 1) => (n * 100).toFixed(d) + '%'

function StatCard({ label, value, sub, color = 'gray' }) {
  const CLS = {
    red:    'text-danger  bg-danger/10  border-danger/30',
    indigo: 'text-brand   bg-brand/10   border-brand/30',
    green:  'text-success bg-success/10 border-success/30',
    amber:  'text-warn    bg-warn/10    border-warn/30',
    gray:   'text-ink     bg-surface2   border-border',
  }
  return (
    <div className={`rounded-xl border p-4 ${CLS[color]} transition-all hover:-translate-y-0.5 hover:shadow-card`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[11px] mt-1 opacity-70">{sub}</p>}
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function WhatIf() {
  const c  = useChartTheme()
  const TT = getTooltipStyle()
  const ax = getAxisProps()

  const { data: allProbs, loading } = useApi('/api/all-probs')
  const { data: imp }               = useApi('/api/feature-importance')

  const [threshold,  setThreshold]  = useState(0.50)
  const [retRate,    setRetRate]    = useState(0.20)
  const [targetTier, setTargetTier] = useState('All')
  const [impModel,   setImpModel]   = useState('lgbm')

  const { highThr, midThr } = useMemo(() => {
    if (!allProbs?.length) return { highThr: Infinity, midThr: Infinity }
    const sorted = [...allProbs].map(c => c.monetary).sort((a, b) => a - b)
    const q = p => sorted[Math.floor(p * sorted.length)] ?? 0
    return { highThr: q(0.75), midThr: q(0.40) }
  }, [allProbs])

  const getTier = m => m >= highThr ? 'High' : m >= midThr ? 'Medium' : 'Low'

  const threshStats = useMemo(() => {
    if (!allProbs?.length) return null
    const predicted = allProbs.filter(c => c.churn_probability >= threshold)
    const actualPos = allProbs.filter(c => c.churn_actual === 1).length
    const tp = predicted.filter(c => c.churn_actual === 1).length
    const fp = predicted.filter(c => c.churn_actual === 0).length
    return {
      count:           predicted.length,
      rate:            predicted.length / allProbs.length,
      revenue_at_risk: predicted.reduce((s, c) => s + (c.monetary ?? 0), 0),
      precision:       tp + fp > 0 ? tp / (tp + fp) : 0,
      recall:          actualPos > 0 ? tp / actualPos : 0,
    }
  }, [allProbs, threshold])

  const prCurve = useMemo(() => {
    if (!allProbs?.length) return []
    const actualPos = allProbs.filter(c => c.churn_actual === 1).length
    return Array.from({ length: 17 }, (_, i) => {
      const t   = parseFloat((0.1 + i * 0.05).toFixed(2))
      const pos = allProbs.filter(c => c.churn_probability >= t)
      const tp  = pos.filter(c => c.churn_actual === 1).length
      const fp  = pos.length - tp
      return {
        threshold: t,
        Precision: tp + fp > 0 ? parseFloat((tp / (tp + fp)).toFixed(3)) : 0,
        Recall:    actualPos > 0 ? parseFloat((tp / actualPos).toFixed(3)) : 0,
      }
    })
  }, [allProbs])

  const retStats = useMemo(() => {
    if (!allProbs?.length || !threshStats) return null
    const churners = allProbs.filter(c => c.churn_probability >= threshold)
    const targeted = targetTier === 'All' ? churners : churners.filter(c => getTier(c.monetary) === targetTier)
    const risk     = targeted.reduce((s, c) => s + (c.monetary ?? 0), 0)
    return { count: targeted.length, risk, saved: risk * retRate, roi_text: `${(retRate * 100).toFixed(0)}% of ${fmtGBP(risk)} at risk` }
  }, [allProbs, threshold, retRate, targetTier, highThr, midThr])

  const impData = imp?.[impModel]?.slice(0, 15) ?? []

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">

      <PageHeader
        title="What-If Tools"
        subtitle="Interactively explore churn thresholds, retention scenarios, and feature drivers"
        icon="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />

      {/* ════════ SECTION 1 — Feature Importance ════════ */}
      <div className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <SectionTitle title="What drives churn?" subtitle="Global feature importance — contribution of each variable to predictions" />
          <div className="flex gap-1.5 p-1 rounded-lg bg-surface2 border border-border">
            {['lgbm', 'xgboost'].map(m => (
              <button
                key={m}
                onClick={() => setImpModel(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  impModel === m ? 'bg-brand-gradient text-white shadow-soft' : 'text-ink2 hover:text-ink'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={420}>
          <BarChart layout="vertical" data={impData} margin={{ left: 10, right: 60, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} horizontal={false} />
            <XAxis type="number" tickFormatter={v => (v * 100).toFixed(1) + '%'} tick={ax.tick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="feature" width={160} tick={{ ...ax.tick, fill: c.ink2, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => (v * 100).toFixed(2) + '%'} contentStyle={TT} />
            <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
              {impData.map((_, i) => <Cell key={i} fill={i < 3 ? c.brand : i < 7 ? c.brand2 : c.border} fillOpacity={i < 3 ? 1 : i < 7 ? 0.85 : 0.7} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {impData.length > 0 && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {impData.slice(0, 3).map((f, i) => (
              <div key={i} className="rounded-xl p-4 border border-brand/30 bg-brand/[0.06]">
                <p className="text-[10px] text-brand font-semibold uppercase tracking-wider">#{i + 1} Driver</p>
                <p className="text-sm font-bold text-ink mt-1">{f.feature}</p>
                <p className="text-xs text-muted mt-0.5 tabular-nums">{(f.importance * 100).toFixed(2)}% of model weight</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════ SECTION 2 — Threshold Simulator ════════ */}
      <div className="card-pad">
        <SectionTitle title="Threshold Simulator" subtitle="Adjust the decision threshold to balance precision vs recall" />

        <div className="rounded-xl bg-surface2 border border-border p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-ink2 min-w-max">Churn Threshold</label>
            <input
              type="range" min={0.10} max={0.90} step={0.05}
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              className="flex-1 min-w-48"
            />
            <span className="text-lg font-bold text-brand min-w-12 tabular-nums">{fmtPct(threshold, 0)}</span>
          </div>
        </div>

        {threshStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="Predicted Churners" value={fmt(threshStats.count)}              color="red"    />
            <StatCard label="Churn Rate"          value={fmtPct(threshStats.rate)}            color="amber"  />
            <StatCard label="Revenue at Risk"     value={fmtGBP(threshStats.revenue_at_risk)} color="indigo" />
            <StatCard label="Precision"           value={fmtPct(threshStats.precision)}       color="green"  sub="of flagged are real churners" />
            <StatCard label="Recall"              value={fmtPct(threshStats.recall)}          color="gray"   sub="of actual churners caught" />
          </div>
        )}

        <p className="text-sm font-medium text-ink2 mb-3">Precision–Recall tradeoff across thresholds</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={prCurve} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} />
            <XAxis dataKey="threshold" tickFormatter={v => fmtPct(v, 0)} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
            <YAxis domain={[0, 1]} tickFormatter={v => fmtPct(v, 0)} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
            <Tooltip formatter={v => fmtPct(v)} labelFormatter={v => `Threshold: ${fmtPct(v, 0)}`} contentStyle={TT} />
            <Legend wrapperStyle={{ color: c.muted }} />
            <ReferenceLine x={threshold} stroke={c.brand} strokeDasharray="4 3" label={{ value: 'current', position: 'top', fontSize: 11, fill: c.brand }} />
            <Line type="monotone" dataKey="Precision" stroke={c.success} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Recall"    stroke={c.warn}    strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ════════ SECTION 3 — Retention Simulator ════════ */}
      <div className="card-pad">
        <SectionTitle title="Retention Campaign Simulator" subtitle="Estimate revenue saved by targeting a segment with a retention offer" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div className="rounded-xl bg-surface2 border border-border p-4">
            <label className="text-sm font-medium text-ink2 block mb-2">
              Retention Rate — <span className="text-brand font-bold tabular-nums">{fmtPct(retRate, 0)}</span>
            </label>
            <input
              type="range" min={0.05} max={0.60} step={0.05}
              value={retRate}
              onChange={e => setRetRate(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-muted mt-1.5">
              <span>5%</span><span>Conservative (20%)</span><span>60%</span>
            </div>
          </div>
          <div className="rounded-xl bg-surface2 border border-border p-4">
            <label className="text-sm font-medium text-ink2 block mb-2">Target Tier</label>
            <div className="flex gap-2 flex-wrap">
              {['All', 'High', 'Medium', 'Low'].map(t => (
                <button
                  key={t}
                  onClick={() => setTargetTier(t)}
                  className={targetTier === t ? 'btn-ghost-active' : 'btn-ghost'}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {retStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Customers Targeted" value={fmt(retStats.count)}    color="indigo" sub={targetTier === 'All' ? 'all predicted churners' : `${targetTier}-value tier`} />
            <StatCard label="Revenue at Risk"    value={fmtGBP(retStats.risk)}  color="red"    sub="from targeted customers" />
            <StatCard label="Estimated Savings"  value={fmtGBP(retStats.saved)} color="green"  sub={retStats.roi_text} />
          </div>
        )}
      </div>
    </div>
  )
}
