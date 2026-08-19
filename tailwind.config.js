/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        epl: {
          purple: "#37003c",
          magenta: "#e90052",
          cyan: "#04f5ff",
        },
      },
    },
  },
  plugins: [],
};
