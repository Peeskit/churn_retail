import useTheme from '../hooks/useTheme'

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label="Toggle color theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg
                 border border-border bg-surface2 text-ink2 hover:text-ink
                 hover:border-brand/50 transition-all"
    >
      {isDark ? (
        // Sun
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  )
}
