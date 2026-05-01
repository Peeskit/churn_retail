import { useEffect, useState } from 'react'

/**
 * Resolves the current chart palette from the live CSS variables defined
 * in index.css. Re-resolves whenever the theme changes so Recharts picks
 * up new colors without a manual refresh.
 *
 * Returns concrete hex/hsl strings (Recharts doesn't accept CSS vars
 * inside SVG fills reliably across browsers).
 */
function read(varName, fallback = '#6366F1') {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return v ? `hsl(${v})` : fallback
}

function readAlpha(varName, alpha) {
  if (typeof window === 'undefined') return `rgba(99,102,241,${alpha})`
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return v ? `hsl(${v} / ${alpha})` : `rgba(99,102,241,${alpha})`
}

export function getChartColors() {
  return {
    brand:    read('--brand'),
    brand2:   read('--brand-2'),
    accent:   read('--accent'),
    success:  read('--success'),
    warn:     read('--warn'),
    danger:   read('--danger'),
    info:     read('--info'),
    ink:      read('--ink'),
    ink2:     read('--ink-2'),
    muted:    read('--muted'),
    surface:  read('--surface'),
    surface2: read('--surface-2'),
    border:   read('--border'),
    brandSoft:  readAlpha('--brand', 0.18),
    brandFaint: readAlpha('--brand', 0.04),
  }
}

export function getTooltipStyle() {
  const c = getChartColors()
  return {
    backgroundColor: c.elevated || c.surface,
    background: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    color: c.ink,
    fontSize: 12,
    boxShadow: '0 12px 32px -8px rgba(0,0,0,0.25)',
  }
}

export function getAxisProps() {
  const c = getChartColors()
  return {
    tick: { fill: c.muted, fontSize: 11 },
    axisLine: false,
    tickLine: false,
    gridStroke: c.border,
  }
}

/** Hook that re-renders chart components on theme change. */
export function useChartTheme() {
  const [colors, setColors] = useState(getChartColors)
  useEffect(() => {
    const handler = () => setColors(getChartColors())
    window.addEventListener('themechange', handler)
    return () => window.removeEventListener('themechange', handler)
  }, [])
  return colors
}
