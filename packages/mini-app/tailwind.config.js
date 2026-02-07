import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indigo: colors.indigo,
        slate: colors.slate,
        emerald: colors.emerald,
        rose: colors.rose,
        amber: colors.amber,
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 15px rgba(0,0,0,0.1)',
        button: '0 4px 6px rgba(0,0,0,0.07)',
      },
    },
  },
  plugins: [],
};
