/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      'editor': ['EB Garamond', 'serif'],
      'editor2': ['Ibarra Real Nova', 'serif'],
      'index': ['Mukta', 'sans-serif'],
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
