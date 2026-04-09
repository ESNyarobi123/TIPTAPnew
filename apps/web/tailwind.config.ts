import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: '#EEEBD9',
          50: '#FAF9F2',
          100: '#EEEBD9',
          200: '#E0DBC5',
          300: '#D1C9B0',
          400: '#C2B79C',
        },
        smoke: {
          DEFAULT: '#282427',
          50: '#5C5660',
          100: '#4A444E',
          200: '#3D3841',
          300: '#322E35',
          400: '#282427',
          500: '#1E1B20',
          600: '#151317',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 24px -4px rgba(40, 36, 39, 0.08), 0 8px 32px -8px rgba(40, 36, 39, 0.12)',
        'card-hover':
          '0 8px 32px -6px rgba(40, 36, 39, 0.12), 0 16px 48px -12px rgba(40, 36, 39, 0.14)',
        soft: '0 2px 12px rgba(40, 36, 39, 0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      transitionDuration: {
        400: '400ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
