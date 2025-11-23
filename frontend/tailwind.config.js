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
        'light-accent': '#fd9d9dff',
        'light-text': '#3d222aff',
        'light-highlight': '#f69d9bf8',

        // Dark Mode Palette
        'dark-bg': '#111827',
        'dark-card': '#353577ff',
        'dark-accent': '#fd9d9dff',
        'dark-text': '#ffffffff',
        'dark-highlight': '#fd9d9dff',

        // Shared colors
        'danger': '#BF616A',
        extend: {
  // ... existing config
  animation: {
    'fade-in': 'fadeIn 1s ease-in-out',
  },
  keyframes: {
    fadeIn: {
      '0%': { opacity: '0', transform: 'translateY(10px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
  },
}
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