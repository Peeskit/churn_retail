import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, ComposedChart, Line,
  Cell, Legend,
} from 'recharts'
import useApi  from '../hooks/useApi'
import Spinner from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import { useChartTheme, getTooltipStyle, getAxisProps } from '../lib/chartTheme'

const fmt    = n => n == null ? '—' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtGBP = n => '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtPct = n => (n * 100).toFixed(1) + '%'

function Card({ title, subtitle, children, badge }) {
  return (
    <div className="card-pad">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function PlotImage({ src, alt, caption }) {
  const [err, setErr] = useState(false)
  return (
    <div className="card overflow-hidden">
      {err ? (
        <div className="flex items-center justify-center h-48 text-muted text-sm bg-surface2">
          re-run <code className="mx-1.5 bg-elevated px-1.5 py-0.5 rounded text-ink2">python main.py</code> to generate plots
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setErr(true)}
          className="w-full object-contain bg-surface2"
        />
      )}
      <p className="px-4 py-2.5 text-xs text-muted border-t border-border">{caption}</p>
    </div>
  )
}

const RFM_META_KEYS = ['recency', 'frequency', 'monetary']

export default function EDA() {
  const c  = useChartTheme()
  const TT = getTooltipStyle()
  const ax = getAxisProps()

  const RFM_META = {
    recency:   { label: 'Recency (days)',     color: c.brand,   note: 'Lower = more recent' },
    frequency: { label: 'Frequency (orders)', color: c.accent,  note: 'Higher = more loyal' },
    monetary:  { label: 'Monetary (£)',       color: c.success, note: 'Higher = more valuable' },
  }

  const { data: summary, loading: sLoad } = useApi('/api/summary')
  const { data: monthly, loading: mLoad } = useApi('/api/charts/monthly')
  const { data: rfm,     loading: rLoad } = useApi('/api/eda/rfm-summary')
  const { data: recBkts, loading: bLoad } = useApi('/api/eda/churn-by-recency')

  const KPI_META = [
    { label: 'Total Customers',  key: 'total_customers',  color: 'text-brand'   },
    { label: 'Unique Countries', key: 'unique_countries', color: 'text-accent'  },
    { label: 'Total Revenue',    key: 'total_revenue',    color: 'text-success', fmt: fmtGBP },
    { label: 'Churn Rate',       key: 'churn_rate',       color: 'text-danger',  fmt: fmtPct },
  ]

  return (
    <div className="space-y-8">

      <PageHeader
        title="Exploratory Data Analysis"
        subtitle="Dataset overview, customer behaviour patterns, and churn drivers"
        icon="M3 3v18h18M7 14l3-3 4 4 5-6"
      />

      {/* ── Dataset KPIs ── */}
      {!sLoad && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_META.map(k => (
            <div key={k.label} className="kpi">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-widest">{k.label}</p>
              <p className={`text-3xl font-bold mt-1.5 tabular-nums tracking-tight ${k.color}`}>
                {(k.fmt ?? fmt)(summary[k.key])}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Monthly Revenue & Volume ── */}
      <Card
        title="Monthly Revenue & Transaction Volume"
        subtitle="Revenue (£) and unique invoices per month"
        badge={<span className="chip bg-brand/10 text-brand">Time series</span>}
      >
        {mLoad ? <Spinner /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="edaRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={c.brand} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} />
              <XAxis dataKey="month" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} interval="preserveStartEnd" />
              <YAxis yAxisId="rev" tickFormatter={v => '£' + (v / 1000).toFixed(0) + 'k'} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
              <YAxis yAxisId="txn" orientation="right" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
              <Tooltip formatter={(v, name) => name === 'Revenue' ? fmtGBP(v) : fmt(v)} contentStyle={TT} />
              <Legend wrapperStyle={{ color: c.muted, fontSize: 12 }} />
              <Area yAxisId="rev" type="monotone" dataKey="revenue"   name="Revenue"      stroke={c.brand} strokeWidth={2.5} fill="url(#edaRev)" />
              <Line yAxisId="txn" type="monotone" dataKey="txn_count" name="Transactions" stroke={c.warn}  strokeWidth={2}   dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── RFM Analysis ── */}
      <div>
        <div className="mb-5 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-semibold text-ink">RFM Analysis — Churners vs Active Customers</h3>
            <p className="text-sm text-muted mt-0.5">Mean and median values for Recency, Frequency, and Monetary across churn groups</p>
          </div>
          <span className="chip bg-accent/10 text-accent">3 metrics</span>
        </div>

        {rLoad ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RFM_META_KEYS.map(col => {
              const meta = RFM_META[col]
              const data = rfm?.[col] ?? []
              return (
                <Card key={col} title={meta.label} subtitle={meta.note}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} vertical={false} />
                      <XAxis dataKey="label" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
                      <YAxis tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine}
                        tickFormatter={v => col === 'monetary' ? '£' + (v / 1000).toFixed(0) + 'k' : fmt(v)} />
                      <Tooltip contentStyle={TT} formatter={v => col === 'monetary' ? fmtGBP(v) : fmt(v)} />
                      <Legend wrapperStyle={{ color: c.muted, fontSize: 11 }} />
                      <Bar dataKey="mean"   name="Mean"   fill={meta.color}             radius={[6, 6, 0, 0]} maxBarSize={42} />
                      <Bar dataKey="median" name="Median" fill={meta.color} fillOpacity={0.45} radius={[6, 6, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Churn Rate by Recency ── */}
      <Card
        title="Churn Rate by Recency"
        subtitle="Customers grouped by days since last purchase — shows how inactivity drives churn"
        badge={<span className="chip bg-danger/10 text-danger">Risk profile</span>}
      >
        {bLoad ? <Spinner /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={recBkts ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ax.gridStroke} vertical={false} />
              <XAxis dataKey="bucket" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
              <YAxis yAxisId="rate" tickFormatter={v => (v * 100).toFixed(0) + '%'} tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
              <YAxis yAxisId="cnt"  orientation="right" tick={ax.tick} axisLine={ax.axisLine} tickLine={ax.tickLine} />
              <Tooltip contentStyle={TT} formatter={(v, name) => name === 'Churn Rate' ? fmtPct(v) : fmt(v)} />
              <Legend wrapperStyle={{ color: c.muted, fontSize: 12 }} />
              <Bar yAxisId="cnt"  dataKey="total"      name="Customers"  fill={c.border} radius={[6, 6, 0, 0]} maxBarSize={50} />
              <Bar yAxisId="rate" dataKey="churn_rate" name="Churn Rate" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {(recBkts ?? []).map((r, i) => (
                  <Cell key={i} fill={r.churn_rate > 0.6 ? c.danger : r.churn_rate > 0.3 ? c.warn : c.success} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Pipeline Plot Gallery ── */}
      <div>
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-ink">Pipeline EDA Plots</h3>
          <p className="text-sm text-muted mt-0.5">
            Static visualisations generated by the pipeline — re-run{' '}
            <code className="bg-surface2 px-1.5 py-0.5 rounded text-ink2 font-mono text-[12px]">python main.py</code> to refresh
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlotImage src="/plots/02_top_countries.png"     alt="Top countries" caption="Top 10 Countries by Revenue" />
          <PlotImage src="/plots/03_dow_transactions.png"  alt="Day of week"   caption="Transaction Volume by Day of Week" />
          <PlotImage src="/plots/04_churn_distribution.png" alt="Churn dist"   caption="Churn Distribution — Active vs Churned" />
          <PlotImage src="/plots/05_rfm_churn.png"         alt="RFM by churn" caption="RFM Distributions: Active vs Churned (KDE)" />
        </div>
      </div>
    </div>
  )
}
