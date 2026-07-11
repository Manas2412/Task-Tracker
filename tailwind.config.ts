import type { Config } from 'tailwindcss';

/**
 * Tailwind token map.
 *
 * Every colour resolves to a CSS custom property defined in
 * src/styles/tokens.css. Components consume Tailwind classes
 * (`bg-panel`, `text-ink-2`, `border-line`); the runtime swaps
 * the variable values, never the class names.
 *
 * See docs/COLOUR_TOKENS.css for the source of truth.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  // Dark mode is a token swap under [data-theme="dark"] (see styles/tokens.css).
  // Registered here so `dark:` variants resolve against the same selector when
  // an occasional component needs one beyond the automatic token flip.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        canvas: 'var(--canvas)',
        panel: 'var(--panel)',
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        onink: 'var(--on-ink)',
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line-2)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          soft: 'var(--primary-soft)',
          line: 'var(--primary-line)',
          tint: 'var(--primary-tint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
          tint: 'var(--accent-tint)',
        },
        urgent: { DEFAULT: 'var(--urgent)', soft: 'var(--urgent-soft)' },
        high: { DEFAULT: 'var(--high)', soft: 'var(--high-soft)' },
        medium: { DEFAULT: 'var(--medium)', soft: 'var(--medium-soft)' },
        low: { DEFAULT: 'var(--low)', soft: 'var(--low-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
        hold: { DEFAULT: 'var(--hold)', soft: 'var(--hold-soft)' },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        pending: { DEFAULT: 'var(--pending)', soft: 'var(--pending-soft)' },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'sans-serif'],
        serif: ['var(--font-newsreader)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      letterSpacing: {
        'pill': '0.01em',
        'label': '0.08em',
        'tight-title': '-0.015em',
      },
      borderRadius: {
        'pill': '11px',
        'sheet': '24px',
      },
      boxShadow: {
        'fab': '0 10px 20px -5px rgba(0,0,0,0.3), 0 4px 8px -2px rgba(0,0,0,0.15)',
        'sheet': '0 -6px 16px -8px rgba(0,0,0,0.1)',
        'card': 'var(--shadow-1)',
        'card-hover': 'var(--shadow-2)',
      },
    },
  },
  plugins: [],
};

export default config;
