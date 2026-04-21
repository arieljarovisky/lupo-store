/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        'lupo-black': '#1A1A1A',
        'lupo-gray': '#F7F7F5',
        'lupo-border': '#EAEAEA',
        'lupo-text': '#555555',
        'lupo-muted': '#888888',
        'lupo-night': '#0E1525',
        'lupo-ink': '#1F2A44',
        'lupo-sky': '#6EE7F9',
        'lupo-ice': '#D6E4FF',
        'lupo-slate': '#5E6B85',
      },
    },
  },
  plugins: [],
};
