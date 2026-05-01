/**
 * KpiCard — preserves the original API: { title, value, subtitle, color }.
 * Accepted color keys (must remain compatible with existing pages):
 *   indigo | red | green | amber | purple
 */
const ACCENT_BAR = {
  indigo: 'from-brand to-accent',
  red:    'from-danger to-warn',
  green:  'from-success to-accent',
  amber:  'from-warn to-danger',
  purple: 'from-brand-2 to-brand',
}
const VALUE_TEXT = {
  indigo: 'text-ink',
  red:    'text-danger',
  green:  'text-success',
  amber:  'text-warn',
  purple: 'text-brand-2',
}
const ICON_BG = {
  indigo: 'bg-brand/10 text-brand',
  red:    'bg-danger/10 text-danger',
  green:  'bg-success/10 text-success',
  amber:  'bg-warn/10 text-warn',
  purple: 'bg-brand-2/10 text-brand-2',
}

function Spark({ color }) {
  // Decorative inline icon — keeps cards visually rich without changing API
  return (
    <svg viewBox="0 0 24 24" className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 6h7v7" opacity="0.6" />
    </svg>
  )
}

export default function KpiCard({ title, value, subtitle, color = 'indigo' }) {
  const bar = ACCENT_BAR[color] ?? ACCENT_BAR.indigo
  return (
    <div className="kpi group">
      {/* override the gradient bar from .kpi::before with this color-specific one */}
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${bar} opacity-90`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-widest truncate">{title}</p>
          <p className={`text-3xl font-bold mt-1.5 tabular-nums tracking-tight ${VALUE_TEXT[color] ?? 'text-ink'}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted mt-1.5">{subtitle}</p>}
        </div>
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${ICON_BG[color] ?? ICON_BG.indigo}`}>
          <Spark color="" />
        </div>
      </div>
    </div>
  )
}
