import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import useApi  from '../hooks/useApi'
import KpiCard  from '../components/KpiCard'
import Spinner  from '../components/Spinner'

const fmt    = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtGBP = n => n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = n => n == null ? '—' : (n * 100).toFixed(1) + '%'
const TT_STYLE = { backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#F9FAFB' }

const TIER_CLS = { High: 'bg-purple-900/50 text-purple-300', Medium: 'bg-blue-900/50 text-blue-300', Low: 'bg-gray-700 text-gray-300' }

export default function Executive() {
  const { data: summary,     loading: sLoad } = useApi('/api/summary')
  const { data: monthly,     loading: mLoad } = useApi('/api/charts/monthly')
  const { data: countries,   loading: cLoad } = useApi('/api/charts/countries?top=12')
  const { data: tiers,       loading: tLoad } = useApi('/api/charts/tiers')
  const { data: topChurners, loading: topLoad } = useApi('/api/customers?limit=10&sort_by=churn_probability&sort_dir=desc&tier=High')

  const recovery20 = summary ? summary.revenue_at_risk * 0.20 : null

  const monthlyFmt = useMemo(() => (monthly ?? []).map(r => ({ ...r, label: r.month?.slice(0, 7) ?? r.month })), [monthly])

  if (sLoad) return <Spinner />

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold text-gray-100">Executive Dashboard</h2>
        <p className="text-gray-500 text-sm mt-0.5">Strategic overview — churn risk, revenue impact, and recommended actions</p>
      </div>

      {/* ── Top KPIs ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Revenue at Risk"         value={fmtGBP(summary.revenue_at_risk)} subtitle={`${fmtPct(summary.churn_rate)} of customers predicted to churn`} color="red"    />
          <KpiCard title="Customers at Risk"       value={fmt(summary.churner_count)}       subtitle={`out of ${fmt(summary.total_customers)} total`}                  color="amber"  />
          <KpiCard title="Potential Recovery (20%)" value={fmtGBP(recovery20)}             subtitle="if 20% of churners are retained"                                color="green"  />
          <KpiCard title={`Best Model (${summary.best_model})`} value={`AUC ${summary.best_auc?.toFixed(3)}`} subtitle={`F1 ${summary.best_f1?.toFixed(3)} · ${summary.unique_countries} countries`} color="indigo" />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-base font-semibold text-gray-200 mb-4">Monthly Revenue Trend</h3>
          {mLoad ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyFmt} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => '£' + (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => fmtGBP(v)} labelFormatter={l => `Month: ${l}`} contentStyle={TT_STYLE} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366F1" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-base font-semibold text-gray-200 mb-4">Churners by Country (Top 12)</h3>
          {cLoad ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart layout="vertical" data={countries ?? []} margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="country" width={90} tick={{ fontSize: 11, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => fmt(v)} contentStyle={TT_STYLE} />
                <Bar dataKey="churner_count" name="Churners" radius={[0, 4, 4, 0]}>
                  {(countries ?? []).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#EF4444' : i < 3 ? '#F87171' : '#7F1D1D'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-base font-semibold text-gray-200">Value Tier Breakdown</h3>
          </div>
          {tLoad ? <Spinner /> : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-700">
                  {['Tier', 'Customers', 'Churners', 'Churn Rate', 'Revenue at Risk'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(tiers ?? []).map((t, i) => (
                  <tr key={i} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_CLS[t.value_tier] ?? ''}`}>{t.value_tier}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{fmt(t.customer_count)}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(t.churner_count)}</td>
                    <td className="px-4 py-3 font-medium text-red-400">{fmtPct(t.churn_rate)}</td>
                    <td className="px-4 py-3 font-medium text-gray-200">{fmtGBP(t.revenue_at_risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-base font-semibold text-gray-200">Top 10 High-Value Customers at Risk</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sorted by churn probability · High tier only</p>
          </div>
          {topLoad ? <Spinner /> : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-700">
                  {['Customer', 'Churn Prob', 'Promotion'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(topChurners?.data ?? []).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-300">{row.customer_id}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-900/50 text-red-300">
                        {(row.churn_probability * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate" title={row.promotion}>{row.promotion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Strategic Actions ── */}
      {summary && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-200 mb-4">Recommended Strategic Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-purple-950/50 border border-purple-900 rounded-lg p-4">
              <p className="font-semibold text-purple-400 text-xs uppercase mb-2">Immediate · High-Value</p>
              <p className="text-gray-300">Deploy Premium Loyalty Reward to <span className="text-white font-semibold">{fmt(tiers?.find(t => t.value_tier === 'High')?.churner_count)}</span> high-value churners. Potential recovery: <span className="text-green-400 font-semibold">{fmtGBP((tiers?.find(t => t.value_tier === 'High')?.revenue_at_risk ?? 0) * 0.20)}</span>.</p>
            </div>
            <div className="bg-blue-950/50 border border-blue-900 rounded-lg p-4">
              <p className="font-semibold text-blue-400 text-xs uppercase mb-2">Short-term · Medium-Value</p>
              <p className="text-gray-300">Run Comeback Offer campaign for <span className="text-white font-semibold">{fmt(tiers?.find(t => t.value_tier === 'Medium')?.churner_count)}</span> medium-value customers with 15% discount.</p>
            </div>
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
              <p className="font-semibold text-gray-400 text-xs uppercase mb-2">Ongoing · Low-Value</p>
              <p className="text-gray-300">Send Reactivation Voucher (£5 off) to low-value segment. Focus on converting to repeat buyers to increase lifetime value.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
