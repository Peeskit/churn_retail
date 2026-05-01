import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import useApi  from '../hooks/useApi'
import KpiCard  from '../components/KpiCard'
import Spinner  from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { useChartTheme, getTooltipStyle, getAxisProps } from '../lib/chartTheme'

const fmt    = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = n => n == null ? '—' : (n * 100).toFixed(1) + '%'
const fmtGBP = n => n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })

const TIER_CLS = {
  High:   'bg-brand-2/15 text-brand-2 border border-brand-2/30',
  Medium: 'bg-info/15    text-info    border border-info/30',
  Low:    'bg-surface2   text-muted   border border-border',
}

function ChurnBadge({ prob }) {
  const pct = prob * 100
  const cls = pct >= 70
    ? 'bg-danger/15 text-danger border border-danger/30'
    : pct >= 50
    ? 'bg-warn/15 text-warn border border-warn/30'
    : 'bg-success/15 text-success border border-success/30'
  return <span className={`chip tabular-nums ${cls}`}>{pct.toFixed(0)}%</span>
}

export default function Outcomes() {
  const c  = useChartTheme()
  const TT = getTooltipStyle()
  const ax = getAxisProps()

  const TIER_COLORS = { High: c.brand2, Medium: c.info, Low: c.muted }

  const { data: summary  } = useApi('/api/summary')
  const { data: allProbs } = useApi('/api/all-probs')
  const { data: tiers    } = useApi('/api/charts/tiers')

  const [page,            setPage]            = useState(1)
  const [tierFilter,      setTierFilter]      = useState('')
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const pageSize    = 15
  const customerUrl = `/api/customers?page=${page}&limit=${pageSize}&sort_by=churn_probability&sort_dir=desc${tierFilter ? `&tier=${tierFilter}` : ''}${debouncedSearch ? `&search=${debouncedSearch}` : ''}`
  const { data: pagedCustomers, loading: pcLoad } = useApi(customerUrl)

  const histogram = useMemo(() => {
    if (!allProbs) return []
    const bins = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}–${(i + 1) * 10}%`,
      count: 0,
    }))
    allProbs.forEach(c => {
      const idx = Math.min(Math.floor(c.churn_probability * 10), 9)
      bins[idx].count++
    })
    return bins
  }, [allProbs])

  const tierPie = useMemo(
    () => (tiers ?? []).map(t => ({ name: t.value_tier, value: t.churner_count })),
    [tiers]
  )

  const totalPages = pagedCustomers ? Math.ceil(pagedCustomers.total / pageSize) : 1

  function handleSearch(e) {
    const v = e.target.value
    setSearch(v)
    clearTimeout(window._st)
    window._st = setTimeout(() => { setDebouncedSearch(v); setPage(1) }, 400)
  }

  return (
    <div className="space-y-6">

      <PageHeader
        title="Outcomes"
        subtitle="Predicted churners, value tiers, and retention recommendations"
        icon="M5 13l4 4L19 7"
      />

      {/* ── KPI Row ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Customers"    value={fmt(summary.total_customers)}    color="indigo" />
          <KpiCard title="Predicted Churners" value={fmt(summary.churner_count)}      color="red"    subtitle={fmtPct(summary.churn_rate) + ' of customers'} />
          <KpiCard title="Churn Rate"         value={fmtPct(summary.churn_rate)}      color="amber"  />
          <KpiCard title="Revenue at Risk"    value={fmtGBP(summary.revenue_at_risk)} color="purple" subtitle="from churning customers" />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card-pad">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Churn Probability Distribution</h3>
            <span className="chip bg-brand/10 text-brand">10 buckets</span>
          </div>
          {!allProbs ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogram} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} vertical={false} />
                <XAxis dataKey="range" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
                <YAxis tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
                <Tooltip contentStyle={TT} labelStyle={{ color: c.ink }} />
                <Bar dataKey="count" name="Customers" radius={[6, 6, 0, 0]}>
                  {histogram.map((_, i) => (
                    <Cell key={i} fill={i >= 5 ? c.danger : i >= 3 ? c.warn : c.brand} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-pad">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Churners by Value Tier</h3>
            <span className="chip bg-brand-2/10 text-brand-2">3 tiers</span>
          </div>
          {!tiers ? <Spinner /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={tierPie} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: c.border }}
                  >
                    {tierPie.map((e, i) => <Cell key={i} fill={TIER_COLORS[e.name] ?? c.muted} stroke={c.surface} strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={TT} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {tiers.map(t => (
                  <div key={t.value_tier} className="text-center bg-surface2 rounded-xl p-3 border border-border">
                    <span className={`chip ${TIER_CLS[t.value_tier]}`}>{t.value_tier}</span>
                    <p className="text-base font-bold text-ink mt-1.5 tabular-nums">{fmt(t.churner_count)}</p>
                    <p className="text-[11px] text-muted tabular-nums">{fmtGBP(t.revenue_at_risk)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Customer Table ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap gap-3 items-center justify-between">
          <h3 className="section-title">At-Risk Customers</h3>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={handleSearch}
                placeholder="Search customer ID…"
                className="input pl-8 w-52"
              />
            </div>
            <select
              value={tierFilter}
              onChange={e => { setTierFilter(e.target.value); setPage(1) }}
              className="input"
            >
              <option value="">All tiers</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {pcLoad ? <Spinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {['Customer ID', 'Churn Prob', 'Tier', 'Top Purchased', 'Recommended Products', 'Promotion'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(pagedCustomers?.data ?? []).map((row, i) => (
                    <tr key={i}>
                      <td className="font-mono text-ink2">{row.customer_id}</td>
                      <td><ChurnBadge prob={row.churn_probability} /></td>
                      <td>
                        <span className={`chip ${TIER_CLS[row.value_tier] ?? TIER_CLS.Low}`}>{row.value_tier}</span>
                      </td>
                      <td className="text-muted max-w-xs truncate" title={row.top_purchased}>{row.top_purchased}</td>
                      <td className="text-muted max-w-xs truncate" title={row.recommended_products}>{row.recommended_products}</td>
                      <td className="text-muted max-w-xs truncate" title={row.promotion}>{row.promotion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm bg-surface2">
              <span className="text-muted tabular-nums">{pagedCustomers?.total ?? 0} customers</span>
              <div className="flex gap-2 items-center">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                >← Prev</button>
                <span className="px-2 text-ink2 tabular-nums">Page {page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                >Next →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
