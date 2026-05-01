import { useEffect, useState, useCallback } from 'react'

/**
 * Reads/writes the current theme ('dark' | 'light').
 * The actual class is toggled on <html> so CSS variables in index.css swap.
 * The initial value is also restored by an inline script in index.html
 * to avoid a flash on first paint.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try { localStorage.setItem('theme', theme) } catch (_) {}
    // Notify anything that needs to re-read CSS variables (e.g. recharts colors)
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }))
  }, [theme])

  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
