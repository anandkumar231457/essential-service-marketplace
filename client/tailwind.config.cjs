/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#647494',
        accent: '#f59e0b',
        danger: '#ef4444',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
};