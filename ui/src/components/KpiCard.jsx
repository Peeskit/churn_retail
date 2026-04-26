const BORDER = {
  indigo: 'border-indigo-500',
  red:    'border-red-500',
  green:  'border-green-500',
  amber:  'border-amber-500',
  purple: 'border-purple-500',
}
const TEXT = {
  indigo: 'text-indigo-400',
  red:    'text-red-400',
  green:  'text-green-400',
  amber:  'text-amber-400',
  purple: 'text-purple-400',
}

export default function KpiCard({ title, value, subtitle, color = 'indigo' }) {
  return (
    <div className={`bg-gray-800 rounded-xl border-l-4 ${BORDER[color]} p-5 shadow-lg`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${TEXT[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}
