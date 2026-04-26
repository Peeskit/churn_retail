const BORDER = {
  indigo: 'border-indigo-500',
  red:    'border-red-500',
  green:  'border-green-500',
  amber:  'border-amber-500',
  purple: 'border-purple-500',
}
const TEXT = {
  indigo: 'text-indigo-700',
  red:    'text-red-700',
  green:  'text-green-600',
  amber:  'text-amber-700',
  purple: 'text-purple-700',
}

export default function KpiCard({ title, value, subtitle, color = 'indigo' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${BORDER[color]} p-5`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${TEXT[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
