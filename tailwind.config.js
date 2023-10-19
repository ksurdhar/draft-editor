/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    fontFamily: {
      'editor2': ['var(--font-ibarra)'],
      'index': ['var(--font-mukta)'],
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
      },
      transitionProperty: {
        flex: 'flex'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
