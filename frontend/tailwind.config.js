/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        db: {
          red: '#FF3621',
          'red-dark': '#CC2B1A',
          'red-light': '#FFF0EE',
          navy: '#1B2232',
          'navy-light': '#2D3A52',
          blue: '#00A3E0',
          'blue-light': '#E6F6FD',
          'grey-light': '#F5F5F5',
          'grey-mid': '#666666',
          'grey-dark': '#333333',
        },
      },
    },
  },
  plugins: [],
};
