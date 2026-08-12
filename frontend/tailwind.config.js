/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        'bg-base':    '#0a0a0f',
        'bg-surface': '#111118',
        'bg-raised':  '#16161f',
        'bg-subtle':  '#1e1e2e',
        // Borders
        'border-dim':   '#252535',
        'border-muted': '#303048',
        // Text
        'text-primary': '#e8e8f0',
        'text-muted':   '#8888a0',
        'text-dim':     '#55556a',
        // Risk signals
        'risk-red':    '#ff4444',
        'risk-amber':  '#f59e0b',
        'risk-green':  '#22c55e',
        'risk-blue':   '#3b82f6',
        // Node type colors
        'node-pkg':   '#22c55e',
        'node-dev':   '#3b82f6',
        'node-repo':  '#a855f7',
        'node-org':   '#f97316',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
        xs:    ['0.75rem', { lineHeight: '1rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],
      },
    },
  },
  plugins: [],
};
