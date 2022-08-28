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
    },
    extend: {
      keyframes: {
        fadein: {
          '0%': { 'opacity': '0'},
          '100%': { 'opacity': '1'}
        }
      },
      animation: {
        fadein: 'fadein .33s ease-in-out'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
