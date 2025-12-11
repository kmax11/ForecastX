/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        surface: "#0f172a",
        card: "#111827",
        accent: "#38bdf8",
        accent2: "#22d3ee",
      },
    },
  },
  plugins: [],
};
