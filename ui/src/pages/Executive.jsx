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

const TIER_COLORS = { High: '#7C3AED', Medium: '#2563EB', Low: '#9CA3AF' }
const TIER_BG     = { High: 'bg-purple-100 text-purple-700', Medium: 'bg-blue-100 text-blue-700', Low: 'bg-gray-100 text-gray-600' }

function MissingBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
      Some data is missing — re-run <code className="bg-amber-100 px-1 rounded">python main.py</code> to generate all dashboard files.
    </div>
  )
}

export default function Executive() {
  const { data: summary, loading: sLoad, error: sErr } = useApi('/api/summary')
  const { data: monthly, loading: mLoad, error: mErr } = useApi('/api/charts/monthly')
  const { data: countries, loading: cLoad }            = useApi('/api/charts/countries?top=12')
  const { data: tiers, loading: tLoad }                = useApi('/api/charts/tiers')
  const { data: topChurners, loading: topLoad }        = useApi('/api/customers?limit=10&sort_by=churn_probability&sort_dir=desc&tier=High')

  const recovery20 = summary ? summary.revenue_at_risk * 0.20 : null

  // Format monthly labels
  const monthlyFmt = useMemo(() => {
    if (!monthly) return []
    return monthly.map(r => ({ ...r, label: r.month?.slice(0, 7) ?? r.month }))
  }, [monthly])

  if (sLoad) return <Spinner />

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Executive Dashboard</h2>
        <p className="text-gray-500 text-sm mt-0.5">Strategic overview for leadership — churn risk, revenue impact, and recommended actions</p>
      </div>

      {sErr && <MissingBanner />}

      {/* ── Top KPIs ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Revenue at Risk"
            value={fmtGBP(summary.revenue_at_risk)}
            subtitle={`${fmtPct(summary.churn_rate)} of customers predicted to churn`}
            color="red"
          />
          <KpiCard
            title="Customers at Risk"
            value={fmt(summary.churner_count)}
            subtitle={`out of ${fmt(summary.total_customers)} total`}
            color="amber"
          />
          <KpiCard
            title="Potential Recovery (20%)"
            value={fmtGBP(recovery20)}
            subtitle="if 20% of churners are retained"
            color="green"
          />
          <KpiCard
            title={`Best Model (${summary.best_model})`}
            value={`AUC ${summary.best_auc?.toFixed(3)}`}
            subtitle={`F1 ${summary.best_f1?.toFixed(3)} · ${summary.unique_countries} countries`}
            color="indigo"
          />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Monthly Revenue Trend</h3>
          {mLoad ? <Spinner /> : mErr ? <p className="text-sm text-amber-700">re-run main.py</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyFmt} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4F46E5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => '£' + (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmtGBP(v)} labelFormatter={l => `Month: ${l}`} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4F46E5" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Churn by Country */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Churners by Country (Top 12)</h3>
          {cLoad ? <Spinner /> : !countries ? <p className="text-sm text-amber-700">re-run main.py</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart layout="vertical" data={countries} margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="churner_count" name="Churners" radius={[0, 4, 4, 0]}>
                  {(countries ?? []).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#EF4444' : i < 3 ? '#F87171' : '#FCA5A5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tier Summary Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-base font-semibold text-gray-800">Value Tier Breakdown</h3>
          </div>
          {tLoad ? <Spinner /> : !tiers ? <p className="px-6 py-4 text-sm text-amber-700">re-run main.py</p> : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Tier', 'Customers', 'Churners', 'Churn Rate', 'Revenue at Risk'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tiers.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BG[t.value_tier] ?? ''}`}>{t.value_tier}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmt(t.customer_count)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(t.churner_count)}</td>
                    <td className="px-4 py-3 font-medium text-red-600">{fmtPct(t.churn_rate)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{fmtGBP(t.revenue_at_risk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top 10 High-Value At-Risk */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-base font-semibold text-gray-800">Top 10 High-Value Customers at Risk</h3>
            <p className="text-xs text-gray-400 mt-0.5">Sorted by churn probability · High tier only</p>
          </div>
          {topLoad ? <Spinner /> : !topChurners ? <p className="px-6 py-4 text-sm text-amber-700">re-run main.py</p> : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Customer', 'Churn Prob', 'Promotion'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(topChurners.data ?? []).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-700">{row.customer_id}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                        {(row.churn_probability * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={row.promotion}>
                      {row.promotion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ── Strategic Actions ── */}
      {summary && (
        <div className="bg-indigo-950 rounded-xl p-6 text-white">
          <h3 className="text-base font-semibold mb-4">Recommended Strategic Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-indigo-900 rounded-lg p-4">
              <p className="font-semibold text-indigo-200 text-xs uppercase mb-2">Immediate (High-Value)</p>
              <p>Deploy Premium Loyalty Reward to {fmt(tiers?.find(t => t.value_tier === 'High')?.churner_count)} high-value churners. Potential recovery: {fmtGBP((tiers?.find(t => t.value_tier === 'High')?.revenue_at_risk ?? 0) * 0.20)}.</p>
            </div>
            <div className="bg-indigo-900 rounded-lg p-4">
              <p className="font-semibold text-indigo-200 text-xs uppercase mb-2">Short-term (Medium-Value)</p>
              <p>Run Comeback Offer campaign for {fmt(tiers?.find(t => t.value_tier === 'Medium')?.churner_count)} medium-value customers with 15% discount.</p>
            </div>
            <div className="bg-indigo-900 rounded-lg p-4">
              <p className="font-semibold text-indigo-200 text-xs uppercase mb-2">Ongoing (Low-Value)</p>
              <p>Send Reactivation Voucher (£5 off) to low-value segment. Focus on converting to repeat buyers to increase lifetime value.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
