/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Fond clinique très légèrement teinté (proche du blanc, juste adouci)
        mist: {
          50:  '#f6f9fc',
          100: '#eef3f9',
          200: '#e2eaf3',
          300: '#cfddec',
        },
        // Bleu/teal profond — navbar, hero, CTA
        deepsea: {
          600: '#0e6a99',
          700: '#0c557d',
          800: '#0a3f63',
          900: '#072b48',
        },
      },
    },
  },
  plugins: [],
}
