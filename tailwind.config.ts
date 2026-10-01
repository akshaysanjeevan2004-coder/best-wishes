import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14201b',
        brand: { 50: '#eef7f2', 100: '#d5ebdf', 600: '#1f7a55', 700: '#17624a', 800: '#134d3b', 900: '#0d382b' },
        saffron: { 100: '#fdeccb', 500: '#e8960f', 600: '#c97d06' },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
