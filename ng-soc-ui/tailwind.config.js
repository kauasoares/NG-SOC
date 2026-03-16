/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#050b14',
          panel: '#0a192f',
          neon: '#00f3ff',
          alert: '#ff5722',
          success: '#00e676'
        }
      }
    },
  },
  plugins: [],
}