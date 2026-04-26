import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import useApi  from '../hooks/useApi'
import KpiCard  from '../components/KpiCard'
import Spinner  from '../components/Spinner'

const TIER_COLORS   = { High: '#7C3AED', Medium: '#2563EB', Low: '#9CA3AF' }
const TIER_BG       = { High: 'bg-purple-100 text-purple-700', Medium: 'bg-blue-100 text-blue-700', Low: 'bg-gray-100 text-gray-600' }
const fmt           = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct        = n => n == null ? '—' : (n * 100).toFixed(1) + '%'
const fmtGBP        = n => n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })

function ChurnBadge({ prob }) {
  const pct = prob * 100
  const cls = pct >= 70 ? 'bg-red-100 text-red-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{pct.toFixed(0)}%</span>
}

export default function Outcomes() {
  const { data: summary,   loading: sLoad } = useApi('/api/summary')
  const { data: allProbs,  loading: pLoad } = useApi('/api/all-probs')
  const { data: customers, loading: cLoad, error: cErr, refetch } = useApi('/api/customers?limit=15&sort_by=churn_probability&sort_dir=desc')
  const { data: tiers,     loading: tLoad } = useApi('/api/charts/tiers')

  const [page,       setPage]       = useState(1)
  const [tierFilter, setTierFilter] = useState('')
  const [search,     setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const pageSize = 15
  const customerUrl = `/api/customers?page=${page}&limit=${pageSize}&sort_by=churn_probability&sort_dir=desc${tierFilter ? `&tier=${tierFilter}` : ''}${debouncedSearch ? `&search=${debouncedSearch}` : ''}`
  const { data: pagedCustomers, loading: pcLoad } = useApi(customerUrl)

  // Histogram bins from all_probs
  const histogram = useMemo(() => {
    if (!allProbs) return []
    const bins = Array.from({ length: 10 }, (_, i) => ({
      range: `${(i * 10).toString().padStart(2, '0')}–${((i + 1) * 10).toString().padStart(2, '0')}%`,
      count: 0,
    }))
    allProbs.forEach(c => {
      const idx = Math.min(Math.floor(c.churn_probability * 10), 9)
      bins[idx].count++
    })
    return bins
  }, [allProbs])

  const tierPie = useMemo(() => {
    if (!tiers) return []
    return tiers.map(t => ({ name: t.value_tier, value: t.churner_count }))
  }, [tiers])

  const totalPages = pagedCustomers ? Math.ceil(pagedCustomers.total / pageSize) : 1

  function handleSearch(e) {
    const v = e.target.value
    setSearch(v)
    clearTimeout(window._searchTimer)
    window._searchTimer = setTimeout(() => { setDebouncedSearch(v); setPage(1) }, 400)
  }

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Outcomes</h2>
        <p className="text-gray-500 text-sm mt-0.5">Predicted churners, value tiers, and retention recommendations</p>
      </div>

      {/* ── KPI Row ── */}
      {sLoad ? <Spinner /> : summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Customers"    value={fmt(summary.total_customers)}  color="indigo" />
          <KpiCard title="Predicted Churners" value={fmt(summary.churner_count)}    color="red"    subtitle={fmtPct(summary.churn_rate) + ' of customers'} />
          <KpiCard title="Churn Rate"         value={fmtPct(summary.churn_rate)}    color="amber"  />
          <KpiCard title="Revenue at Risk"    value={fmtGBP(summary.revenue_at_risk)} color="purple" subtitle="from churning customers" />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Histogram */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Churn Probability Distribution</h3>
          {pLoad ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogram} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Customers" radius={[3, 3, 0, 0]}>
                  {histogram.map((_, i) => (
                    <Cell key={i} fill={i >= 5 ? '#EF4444' : i >= 3 ? '#F59E0B' : '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tier Pie */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Churners by Value Tier</h3>
          {tLoad ? <Spinner /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={tierPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {tierPie.map((e, i) => <Cell key={i} fill={TIER_COLORS[e.name] ?? '#ccc'} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {tiers && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {tiers.map(t => (
                    <div key={t.value_tier} className="text-center">
                      <p className={`text-xs font-semibold px-2 py-0.5 rounded ${TIER_BG[t.value_tier]}`}>{t.value_tier}</p>
                      <p className="text-sm font-bold text-gray-800 mt-1">{fmt(t.churner_count)}</p>
                      <p className="text-xs text-gray-400">{fmtGBP(t.revenue_at_risk)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Customer Table ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">At-Risk Customers</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Search customer ID…"
              className="border rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <select
              value={tierFilter}
              onChange={e => { setTierFilter(e.target.value); setPage(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">All tiers</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {pcLoad ? <Spinner /> : cErr ? (
          <p className="px-6 py-4 text-sm text-amber-700">re-run main.py to generate customer data.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Customer ID', 'Churn Prob', 'Tier', 'Top Purchased', 'Recommended Products', 'Promotion'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(pagedCustomers?.data ?? []).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-700">{row.customer_id}</td>
                      <td className="px-4 py-3"><ChurnBadge prob={row.churn_probability} /></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_BG[row.value_tier] ?? ''}`}>{row.value_tier}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={row.top_purchased}>{row.top_purchased}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={row.recommended_products}>{row.recommended_products}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={row.promotion}>{row.promotion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t flex items-center justify-between text-sm text-gray-500 bg-gray-50">
              <span>{pagedCustomers?.total ?? 0} customers</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100"
                >← Prev</button>
                <span className="px-2 py-1">Page {page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100"
                >Next →</button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
