/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class', // Enabling class-based dark mode
  theme: {
    extend: {
      colors: {
        // Light Mode Coffee-themed palette
        'light-bg': '#f5f0e6',     // Creamy beige for light backgrounds
        'light-card': '#c7ae94ff',   // A slightly off-white for cards
        'light-accent': '#392300ff',   // Caramel for buttons and highlights
        'light-text': '#3d2c22',        // Dark brown for text on light backgrounds

        // Dark Mode Coffee-themed palette
        'dark-bg': '#836250ff',      // Rich espresso for dark backgrounds
        'dark-card': '#d4b9a9ff',   // A darker, less saturated brown for cards
        'dark-accent': '#f3e2d3ff',   // A warm, vibrant caramel for accents
        'dark-text': '#000000ff',       // Off-white for text on dark backgrounds

        // Shared colors
        'danger': '#421e04ff',
      },
    },
  },
  plugins: [],
};