/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      // PlatoVue / V0 Design Tokens
      colors: {
        // Background System
        'background': '#0f172a',
        'bg-base': '#0f172a',
        'bg-surface': 'rgba(30, 41, 59, 0.8)',
        'bg-elevated': 'rgba(30, 41, 59, 0.9)',
        'bg-glass': 'rgba(30, 41, 59, 0.7)',

        // Primary Accent (Cyan/Teal)
        'primary': '#06b6d4',
        'accent': {
          DEFAULT: '#06b6d4',
          hover: '#22d3ee',
          muted: '#0891b2',
          light: 'rgba(6, 182, 212, 0.15)',
        },

        // Secondary (Purple)
        'purple': {
          DEFAULT: '#8b5cf6',
          light: 'rgba(139, 92, 246, 0.15)',
          text: '#a78bfa',
        },

        // Semantic Colors
        'good': {
          DEFAULT: '#22c55e',
          bg: 'rgba(34, 197, 94, 0.12)',
          border: 'rgba(34, 197, 94, 0.4)',
          text: '#86efac',
        },
        'warn': {
          DEFAULT: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: '#fcd34d',
        },
        'bad': {
          DEFAULT: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.4)',
          text: '#fca5a5',
        },

        // Glass System
        'glass': {
          border: 'rgba(255, 255, 255, 0.08)',
          'border-strong': 'rgba(255, 255, 255, 0.12)',
        },

        // Text Colors
        'foreground': '#f8fafc',
        'muted-foreground': '#94a3b8',
        'dim': '#64748b',

        // Chart colors
        'chart': {
          1: '#06b6d4',
          2: '#8b5cf6',
          3: '#f59e0b',
          4: '#3b82f6',
          5: '#22c55e',
          6: '#ec4899',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },

      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },

      borderRadius: {
        'sm': '0.25rem',
        DEFAULT: '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
      },

      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      backdropBlur: {
        'glass': '12px',
        'glass-lg': '16px',
      },

      boxShadow: {
        'glass': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'glass-elevated': '0 8px 24px rgba(0, 0, 0, 0.5)',
      },

      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-slow': 'bounce 1.5s infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
