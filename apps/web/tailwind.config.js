/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B00',
        secondary: '#1A1A2E',
        accent: '#00D4AA',
      },
    },
  },
  plugins: [],
};
