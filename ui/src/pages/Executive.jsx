import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import useApi  from '../hooks/useApi'
import KpiCard  from '../components/KpiCard'
import Spinner  from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { useChartTheme, getTooltipStyle, getAxisProps } from '../lib/chartTheme'

const fmt    = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtGBP = n => n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = n => n == null ? '—' : (n * 100).toFixed(1) + '%'

const TIER_CLS = {
  High:   'bg-brand-2/15 text-brand-2 border border-brand-2/30',
  Medium: 'bg-info/15    text-info    border border-info/30',
  Low:    'bg-surface2   text-muted   border border-border',
}

export default function Executive() {
  const c  = useChartTheme()
  const TT = getTooltipStyle()
  const ax = getAxisProps()

  const { data: summary,     loading: sLoad } = useApi('/api/summary')
  const { data: monthly,     loading: mLoad } = useApi('/api/charts/monthly')
  const { data: countries,   loading: cLoad } = useApi('/api/charts/countries?top=12')
  const { data: tiers,       loading: tLoad } = useApi('/api/charts/tiers')
  const { data: topChurners, loading: topLoad } = useApi('/api/customers?limit=10&sort_by=churn_probability&sort_dir=desc&tier=High')

  const recovery20 = summary ? summary.revenue_at_risk * 0.20 : null

  const monthlyFmt = useMemo(
    () => (monthly ?? []).map(r => ({ ...r, label: r.month?.slice(0, 7) ?? r.month })),
    [monthly]
  )

  if (sLoad) return <Spinner />

  return (
    <div className="space-y-6">

      <PageHeader
        title="Executive Dashboard"
        subtitle="Strategic overview — churn risk, revenue impact, and recommended actions"
        icon="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"
      />

      {/* ── Top KPIs ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Revenue at Risk"          value={fmtGBP(summary.revenue_at_risk)} subtitle={`${fmtPct(summary.churn_rate)} of customers predicted to churn`} color="red"    />
          <KpiCard title="Customers at Risk"        value={fmt(summary.churner_count)}      subtitle={`out of ${fmt(summary.total_customers)} total`}                 color="amber"  />
          <KpiCard title="Potential Recovery (20%)" value={fmtGBP(recovery20)}              subtitle="if 20% of churners are retained"                                color="green"  />
          <KpiCard title={`Best Model (${summary.best_model})`} value={`AUC ${summary.best_auc?.toFixed(3)}`} subtitle={`F1 ${summary.best_f1?.toFixed(3)} · ${summary.unique_countries} countries`} color="indigo" />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card-pad">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Monthly Revenue Trend</h3>
            <span className="chip bg-brand/10 text-brand">Revenue</span>
          </div>
          {mLoad ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyFmt} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="execRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={c.brand} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} />
                <XAxis dataKey="label" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => '£' + (v / 1000).toFixed(0) + 'k'} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
                <Tooltip formatter={v => fmtGBP(v)} labelFormatter={l => `Month: ${l}`} contentStyle={TT} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={c.brand} strokeWidth={2.5} fill="url(#execRev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-pad">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Churners by Country (Top 12)</h3>
            <span className="chip bg-danger/10 text-danger">Churners</span>
          </div>
          {cLoad ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart layout="vertical" data={countries ?? []} margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
                <YAxis type="category" dataKey="country" width={90} tick={{ ...ax.tick, fill: c.ink2 }} axisLine={ax.axisLine} tickLine={ax.tickLine} />
                <Tooltip formatter={v => fmt(v)} contentStyle={TT} />
                <Bar dataKey="churner_count" name="Churners" radius={[0, 6, 6, 0]}>
                  {(countries ?? []).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? c.danger : i < 3 ? c.warn : c.brand} fillOpacity={i === 0 ? 1 : i < 3 ? 0.85 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="section-title">Value Tier Breakdown</h3>
            <span className="chip bg-surface2 text-muted">{tiers?.length ?? 0} tiers</span>
          </div>
          {tLoad ? <Spinner /> : (
            <table className="table-base">
              <thead>
                <tr>
                  {['Tier', 'Customers', 'Churners', 'Churn Rate', 'Revenue at Risk'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(tiers ?? []).map((t, i) => (
                  <tr key={i}>
                    <td><span className={`chip ${TIER_CLS[t.value_tier] ?? ''}`}>{t.value_tier}</span></td>
                    <td className="tabular-nums">{fmt(t.customer_count)}</td>
                    <td className="tabular-nums">{fmt(t.churner_count)}</td>
                    <td className="font-semibold text-danger tabular-nums">{fmtPct(t.churn_rate)}</td>
                    <td className="font-semibold text-ink tabular-nums">{fmtGBP(t.revenue_at_risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="section-title">Top 10 High-Value Customers at Risk</h3>
            <p className="section-sub">Sorted by churn probability · High tier only</p>
          </div>
          {topLoad ? <Spinner /> : (
            <table className="table-base">
              <thead>
                <tr>
                  {['Customer', 'Churn Prob', 'Promotion'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(topChurners?.data ?? []).map((row, i) => (
                  <tr key={i}>
                    <td className="font-mono text-ink2">{row.customer_id}</td>
                    <td>
                      <span className="chip bg-danger/15 text-danger border border-danger/30 tabular-nums">
                        {(row.churn_probability * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-muted text-xs max-w-xs truncate" title={row.promotion}>{row.promotion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Strategic Actions ── */}
      {summary && (
        <div className="card-pad">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Recommended Strategic Actions</h3>
            <span className="chip bg-success/10 text-success">3 plays</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl p-4 border border-brand-2/30 bg-brand-2/[0.06]">
              <p className="chip bg-brand-2/15 text-brand-2 mb-2">Immediate · High-Value</p>
              <p className="text-ink2 leading-relaxed">
                Deploy Premium Loyalty Reward to{' '}
                <span className="text-ink font-semibold">{fmt(tiers?.find(t => t.value_tier === 'High')?.churner_count)}</span>{' '}
                high-value churners. Potential recovery:{' '}
                <span className="text-success font-semibold">
                  {fmtGBP((tiers?.find(t => t.value_tier === 'High')?.revenue_at_risk ?? 0) * 0.20)}
                </span>.
              </p>
            </div>
            <div className="rounded-xl p-4 border border-info/30 bg-info/[0.06]">
              <p className="chip bg-info/15 text-info mb-2">Short-term · Medium-Value</p>
              <p className="text-ink2 leading-relaxed">
                Run Comeback Offer campaign for{' '}
                <span className="text-ink font-semibold">{fmt(tiers?.find(t => t.value_tier === 'Medium')?.churner_count)}</span>{' '}
                medium-value customers with 15% discount.
              </p>
            </div>
            <div className="rounded-xl p-4 border border-border bg-surface2">
              <p className="chip bg-surface text-muted mb-2">Ongoing · Low-Value</p>
              <p className="text-ink2 leading-relaxed">
                Send Reactivation Voucher (£5 off) to low-value segment. Focus on converting to repeat buyers to increase lifetime value.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
