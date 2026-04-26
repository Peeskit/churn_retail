import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import useApi  from '../hooks/useApi'
import KpiCard  from '../components/KpiCard'
import Spinner  from '../components/Spinner'

const TIER_COLORS = { High: '#7C3AED', Medium: '#2563EB', Low: '#6B7280' }
const TIER_CLS    = { High: 'bg-purple-900/50 text-purple-300', Medium: 'bg-blue-900/50 text-blue-300', Low: 'bg-gray-700 text-gray-300' }
const fmt         = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct      = n => n == null ? '—' : (n * 100).toFixed(1) + '%'
const fmtGBP      = n => n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })

const TT_STYLE = { backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#F9FAFB' }

function ChurnBadge({ prob }) {
  const pct = prob * 100
  const cls = pct >= 70
    ? 'bg-red-900/50 text-red-300'
    : pct >= 50
    ? 'bg-amber-900/50 text-amber-300'
    : 'bg-green-900/50 text-green-300'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{pct.toFixed(0)}%</span>
}

export default function Outcomes() {
  const { data: summary  } = useApi('/api/summary')
  const { data: allProbs } = useApi('/api/all-probs')
  const { data: tiers    } = useApi('/api/charts/tiers')

  const [page,           setPage]           = useState(1)
  const [tierFilter,     setTierFilter]     = useState('')
  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const pageSize     = 15
  const customerUrl  = `/api/customers?page=${page}&limit=${pageSize}&sort_by=churn_probability&sort_dir=desc${tierFilter ? `&tier=${tierFilter}` : ''}${debouncedSearch ? `&search=${debouncedSearch}` : ''}`
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

  const tierPie = useMemo(() => (tiers ?? []).map(t => ({ name: t.value_tier, value: t.churner_count })), [tiers])

  const totalPages = pagedCustomers ? Math.ceil(pagedCustomers.total / pageSize) : 1

  function handleSearch(e) {
    const v = e.target.value
    setSearch(v)
    clearTimeout(window._st)
    window._st = setTimeout(() => { setDebouncedSearch(v); setPage(1) }, 400)
  }

  const inputCls = 'bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold text-gray-100">Outcomes</h2>
        <p className="text-gray-500 text-sm mt-0.5">Predicted churners, value tiers, and retention recommendations</p>
      </div>

      {/* ── KPI Row ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Customers"    value={fmt(summary.total_customers)}      color="indigo" />
          <KpiCard title="Predicted Churners" value={fmt(summary.churner_count)}        color="red"    subtitle={fmtPct(summary.churn_rate) + ' of customers'} />
          <KpiCard title="Churn Rate"         value={fmtPct(summary.churn_rate)}        color="amber"  />
          <KpiCard title="Revenue at Risk"    value={fmtGBP(summary.revenue_at_risk)}   color="purple" subtitle="from churning customers" />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-base font-semibold text-gray-200 mb-4">Churn Probability Distribution</h3>
          {!allProbs ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogram} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: '#E5E7EB' }} />
                <Bar dataKey="count" name="Customers" radius={[3, 3, 0, 0]}>
                  {histogram.map((_, i) => (
                    <Cell key={i} fill={i >= 5 ? '#EF4444' : i >= 3 ? '#F59E0B' : '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <h3 className="text-base font-semibold text-gray-200 mb-4">Churners by Value Tier</h3>
          {!tiers ? <Spinner /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={tierPie} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={75}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#4B5563' }}
                  >
                    {tierPie.map((e, i) => <Cell key={i} fill={TIER_COLORS[e.name] ?? '#6B7280'} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {tiers.map(t => (
                  <div key={t.value_tier} className="text-center bg-gray-900/50 rounded-lg p-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TIER_CLS[t.value_tier]}`}>{t.value_tier}</span>
                    <p className="text-sm font-bold text-gray-100 mt-1">{fmt(t.churner_count)}</p>
                    <p className="text-xs text-gray-500">{fmtGBP(t.revenue_at_risk)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Customer Table ── */}
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700 flex flex-wrap gap-3 items-center justify-between">
          <h3 className="text-base font-semibold text-gray-200">At-Risk Customers</h3>
          <div className="flex gap-2 flex-wrap">
            <input value={search} onChange={handleSearch} placeholder="Search customer ID…" className={inputCls + ' w-44'} />
            <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1) }} className={inputCls}>
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
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-700">
                    {['Customer ID', 'Churn Prob', 'Tier', 'Top Purchased', 'Recommended Products', 'Promotion'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {(pagedCustomers?.data ?? []).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-300">{row.customer_id}</td>
                      <td className="px-4 py-3"><ChurnBadge prob={row.churn_probability} /></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_CLS[row.value_tier] ?? 'bg-gray-700 text-gray-300'}`}>{row.value_tier}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={row.top_purchased}>{row.top_purchased}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={row.recommended_products}>{row.recommended_products}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={row.promotion}>{row.promotion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-gray-700 flex items-center justify-between text-sm text-gray-500 bg-gray-900/50">
              <span>{pagedCustomers?.total ?? 0} customers</span>
              <div className="flex gap-2 items-center">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded border border-gray-700 disabled:opacity-30 hover:bg-gray-700 text-gray-300 transition-colors">
                  ← Prev
                </button>
                <span className="px-2 text-gray-400">Page {page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded border border-gray-700 disabled:opacity-30 hover:bg-gray-700 text-gray-300 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
