/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: '#06080F',
          900: '#0A0E17',
          850: '#0E1422',
          800: '#141D30',
          700: '#1D2A45',
          600: '#2A3B5E',
        },
        cobalt: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
          glow: '#60A5FA',
        },
        acid: {
          DEFAULT: '#84CC16',
          light: '#A3E635',
          dark: '#65A30D',
          glow: '#BEF264',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'cobalt-glow': '0 0 25px -5px rgba(37, 99, 235, 0.4)',
        'acid-glow': '0 0 25px -5px rgba(163, 230, 53, 0.4)',
      },
    },
  },
  plugins: [],
}
