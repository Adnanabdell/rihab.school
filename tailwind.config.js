
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{,!(node_modules)/**/}*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
