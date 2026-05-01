/**
 * PageHeader — consistent title + subtitle + optional actions slot.
 * Pure presentation; no behaviour change.
 */
export default function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
