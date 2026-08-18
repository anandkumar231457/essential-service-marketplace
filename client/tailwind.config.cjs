/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#009c91',
        secondary: '#5f7280',
        accent: '#ffb454',
        danger: '#ef4444',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
};
