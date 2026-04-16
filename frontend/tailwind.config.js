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
      },
    },
  },
  plugins: [],
};
