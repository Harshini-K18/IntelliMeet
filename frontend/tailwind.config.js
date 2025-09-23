/** @type {import('tailwindcss').Config} */
const config = {
	content: ["./src/**/*.{html,js}"],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				sans: ["Inter", "sans-serif"],
			},
		},
	},
	plugins: [],
};

module.exports = config;