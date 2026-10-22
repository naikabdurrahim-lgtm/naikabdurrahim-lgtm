import type { Config } from 'tailwindcss';

/**
 * Design tokens live here + in src/styles/index.css as CSS variables.
 * Rule (PROJECT_RULES 3.2): no magic colour/radius values inside components.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          raised: 'hsl(var(--surface-raised))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Semantic money/stock colours (green = in, red = due, amber = warning)
        money: {
          in: 'hsl(var(--money-in))',
          out: 'hsl(var(--money-out))',
        },
        warning: 'hsl(var(--warning))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        // Section 3.2: soft rounded corners, 16px cards
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      fontFamily: {
        sans: ['"Noto Sans Bengali"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        display: ['"Noto Sans Bengali"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Three accessibility levels are applied via [data-font-size] on <html>.
        xs: ['var(--text-xs)', { lineHeight: '1.4' }],
        sm: ['var(--text-sm)', { lineHeight: '1.45' }],
        base: ['var(--text-base)', { lineHeight: '1.55' }],
        lg: ['var(--text-lg)', { lineHeight: '1.5' }],
        xl: ['var(--text-xl)', { lineHeight: '1.4' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.35' }],
        '3xl': ['var(--text-3xl)', { lineHeight: '1.3' }],
      },
      spacing: {
        // Section 3.1 #5: 48px minimum touch target, 56px primary button
        touch: '3rem',
        cta: '3.5rem',
      },
      minHeight: {
        touch: '3rem',
        cta: '3.5rem',
      },
      minWidth: {
        touch: '3rem',
        cta: '3.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.35)',
        glow: '0 0 0 1px hsl(var(--ring) / 0.35), 0 8px 32px -8px hsl(var(--ring) / 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
