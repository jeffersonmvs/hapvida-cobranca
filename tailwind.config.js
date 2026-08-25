/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0d1117',
        surface: '#161b22',
        surface2: '#1c2430',
        line: '#2a3441',
        brand: { DEFAULT: '#2f81f7', ink: '#0b1a2e' },
        critico: '#f85149',
        atencao: '#d29922',
        ok: '#3fb950',
        ia: '#a371f7',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
