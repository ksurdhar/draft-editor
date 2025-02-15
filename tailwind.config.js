/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
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
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
