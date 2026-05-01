/**
 * Slate & Steel — enterprise BI design system.
 * All colors are HSL CSS variables defined in src/index.css so the
 * `.dark` class on <html> swaps the entire palette atomically.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Surfaces
        bg:        'hsl(var(--bg) / <alpha-value>)',
        surface:   'hsl(var(--surface) / <alpha-value>)',
        surface2:  'hsl(var(--surface-2) / <alpha-value>)',
        elevated:  'hsl(var(--elevated) / <alpha-value>)',
        border:    'hsl(var(--border) / <alpha-value>)',
        ring:      'hsl(var(--ring) / <alpha-value>)',

        // Text
        ink:       'hsl(var(--ink) / <alpha-value>)',
        ink2:      'hsl(var(--ink-2) / <alpha-value>)',
        muted:     'hsl(var(--muted) / <alpha-value>)',

        // Brand & semantic
        brand:     'hsl(var(--brand) / <alpha-value>)',
        'brand-2': 'hsl(var(--brand-2) / <alpha-value>)',
        accent:    'hsl(var(--accent) / <alpha-value>)',
        success:   'hsl(var(--success) / <alpha-value>)',
        warn:      'hsl(var(--warn) / <alpha-value>)',
        danger:    'hsl(var(--danger) / <alpha-value>)',
        info:      'hsl(var(--info) / <alpha-value>)',
      },
      boxShadow: {
        soft:    '0 1px 2px 0 hsl(var(--shadow) / 0.06), 0 1px 3px 0 hsl(var(--shadow) / 0.10)',
        card:    '0 4px 16px -4px hsl(var(--shadow) / 0.18), 0 2px 4px -2px hsl(var(--shadow) / 0.10)',
        elevate: '0 12px 32px -8px hsl(var(--shadow) / 0.30), 0 4px 12px -4px hsl(var(--shadow) / 0.18)',
        glow:    '0 0 0 1px hsl(var(--brand) / 0.35), 0 8px 28px -6px hsl(var(--brand) / 0.45)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.55) 1px, transparent 0)',
        'brand-gradient':
          'linear-gradient(135deg, hsl(var(--brand)) 0%, hsl(var(--brand-2)) 100%)',
        'surface-sheen':
          'linear-gradient(180deg, hsl(var(--surface) / 1) 0%, hsl(var(--surface-2) / 1) 100%)',
      },
      keyframes: {
        'fade-in':  { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'none' } },
        'slide-up': { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer:    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-in':  'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.35s ease-out',
        shimmer:    'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
}
