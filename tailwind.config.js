/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        epl: {
          purple: "#37003c",
          purpledeep: "#1a001d",
          magenta: "#e90052",
          cyan: "#04f5ff",
          pitch: "#0a6b3a",
          pitchdark: "#095e33",
          bg: "#0e0713",
          surface: "#1c1024",
          surface2: "#241530",
        },
      },
      backgroundImage: {
        "epl-gradient": "linear-gradient(135deg, #1a001d 0%, #37003c 55%, #7a0e5e 100%)",
      },
    },
  },
  plugins: [],
};
