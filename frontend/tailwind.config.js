/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class', // Enabling class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Light Mode Palette
        'light-bg': '#FCF9EA',
        'light-card': '#b5cddaff',
        'light-accent': '#fbb0b0ff',
        'light-text': '#3d2c22',
        'light-highlight': '#d873cbff',

        // Dark Mode Palette
        'dark-bg': '#020202ff',
        'dark-card': '#25155dff',
        'dark-accent': '#e790adff',
        'dark-text': '#C8ACD6',
        'dark-highlight': '#ad4172ff',

        // Shared colors
        'danger': '#BF616A',
      },
      boxShadow: {
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'xl': '1rem',
      }
    },
  },
  plugins: [],
};