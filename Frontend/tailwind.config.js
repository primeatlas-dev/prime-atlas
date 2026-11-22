/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      // BRAND COLOURS. The app's "blue" is re-mapped to the Prime Atlas copper and charcoal.
      // To go back to the original blue, delete this whole "colors" block and push.
      colors: {
        blue: {
          50: '#FAF5F0',
          100: '#F3E6DA',
          200: '#E7CDB6',
          300: '#D8AE8B',
          400: '#C98D63',
          500: '#B86C41',
          600: '#9E5A32',
          700: '#7E4626',
          800: '#232726',
          900: '#181C1B'
        }
      }
    }
  },
  plugins: []
};