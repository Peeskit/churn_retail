import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, ComposedChart, Line,
  Cell, Legend,
} from 'recharts'
import useApi  from '../hooks/useApi'
import Spinner from '../components/Spinner'

const TT  = { backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#F9FAFB' }
const AX  = { fill: '#6B7280', fontSize: 11 }
const fmt    = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtGBP = n => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = n => (n * 100).toFixed(1) + '%'

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6">
      <h3 className="text-base font-semibold text-gray-200">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  )
}

function PlotImage({ src, alt, caption }) {
  const [err, setErr] = useState(false)
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
      {err ? (
        <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
          re-run <code className="mx-1 bg-gray-700 px-1 rounded">python main.py</code> to generate plots
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setErr(true)}
          className="w-full object-contain bg-gray-900"
        />
      )}
      <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-700">{caption}</p>
    </div>
  )
}

const RFM_META = {
  recency:   { label: 'Recency (days)',      color: '#6366F1', note: 'Lower = more recent' },
  frequency: { label: 'Frequency (orders)',  color: '#06B6D4', note: 'Higher = more loyal' },
  monetary:  { label: 'Monetary (£)',        color: '#10B981', note: 'Higher = more valuable' },
}

export default function EDA() {
  const { data: summary, loading: sLoad } = useApi('/api/summary')
  const { data: monthly, loading: mLoad } = useApi('/api/charts/monthly')
  const { data: rfm,     loading: rLoad } = useApi('/api/eda/rfm-summary')
  const { data: recBkts, loading: bLoad } = useApi('/api/eda/churn-by-recency')

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Exploratory Data Analysis</h2>
        <p className="text-gray-500 text-sm mt-0.5">Dataset overview, customer behaviour patterns, and churn drivers</p>
      </div>

      {/* ── Dataset KPIs ── */}
      {!sLoad && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Customers',  value: fmt(summary.total_customers),   color: 'text-indigo-400' },
            { label: 'Unique Countries', value: fmt(summary.unique_countries),  color: 'text-cyan-400'   },
            { label: 'Total Revenue',    value: fmtGBP(summary.total_revenue),  color: 'text-green-400'  },
            { label: 'Churn Rate',       value: fmtPct(summary.churn_rate),     color: 'text-red-400'    },
          ].map(k => (
            <div key={k.label} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Monthly Revenue & Volume ── */}
      <Card title="Monthly Revenue & Transaction Volume" subtitle="Revenue (£) and unique invoices per month">
        {mLoad ? <Spinner /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="month" tick={AX} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="rev" tickFormatter={v => '£' + (v / 1000).toFixed(0) + 'k'} tick={AX} axisLine={false} tickLine={false} />
              <YAxis yAxisId="txn" orientation="right" tick={AX} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => name === 'Revenue' ? fmtGBP(v) : fmt(v)}
                contentStyle={TT}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#6366F1" strokeWidth={2} fill="url(#revGrad)" />
              <Line yAxisId="txn" type="monotone" dataKey="txn_count" name="Transactions" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── RFM Analysis ── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-1">RFM Analysis — Churners vs Active Customers</h3>
        <p className="text-sm text-gray-500 mb-4">Mean and median values for Recency, Frequency, and Monetary across churn groups</p>

        {rLoad ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(RFM_META).map(([col, meta]) => {
              const data = rfm?.[col] ?? []
              return (
                <Card key={col} title={meta.label} subtitle={meta.note}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barGap={6}>
                      <XAxis dataKey="label" tick={AX} axisLine={false} tickLine={false} />
                      <YAxis tick={AX} axisLine={false} tickLine={false}
                        tickFormatter={v => col === 'monetary' ? '£' + (v / 1000).toFixed(0) + 'k' : fmt(v)} />
                      <Tooltip
                        contentStyle={TT}
                        formatter={v => col === 'monetary' ? fmtGBP(v) : fmt(v)}
                      />
                      <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
                      <Bar dataKey="mean"   name="Mean"   fill={meta.color}   radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="median" name="Median" fill={meta.color + '80'} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Churn Rate by Recency Bucket ── */}
      <Card title="Churn Rate by Recency" subtitle="Customers grouped by days since last purchase — shows how inactivity drives churn">
        {bLoad ? <Spinner /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={recBkts ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="bucket" tick={AX} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rate" tickFormatter={v => (v * 100).toFixed(0) + '%'} tick={AX} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cnt"  orientation="right" tick={AX} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={TT}
                formatter={(v, name) => name === 'Churn Rate' ? fmtPct(v) : fmt(v)}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Bar yAxisId="cnt"  dataKey="total"      name="Customers"  fill="#374151" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar yAxisId="rate" dataKey="churn_rate" name="Churn Rate" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {(recBkts ?? []).map((r, i) => (
                  <Cell key={i} fill={r.churn_rate > 0.6 ? '#EF4444' : r.churn_rate > 0.3 ? '#F59E0B' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Pipeline Plot Gallery ── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-1">Pipeline EDA Plots</h3>
        <p className="text-sm text-gray-500 mb-4">Static visualisations generated by the pipeline — re-run <code className="bg-gray-800 px-1 rounded text-gray-300">python main.py</code> to refresh</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlotImage src="/plots/02_top_countries.png"   alt="Top countries"     caption="Top 10 Countries by Revenue" />
          <PlotImage src="/plots/03_dow_transactions.png" alt="Day of week"       caption="Transaction Volume by Day of Week" />
          <PlotImage src="/plots/04_churn_distribution.png" alt="Churn dist"      caption="Churn Distribution — Active vs Churned" />
          <PlotImage src="/plots/05_rfm_churn.png"       alt="RFM by churn"      caption="RFM Distributions: Active vs Churned (KDE)" />
        </div>
      </div>

    </div>
  )
}
