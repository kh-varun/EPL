/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        epl: {
          purple: "#37003c",
          purpledeep: "#1a001d",
          magenta: "#e90052",
          cyan: "#04f5ff",
          pitch: "#0a6b3a",
          pitchdark: "#095e33",
          bg: "#0b0510",
          surface: "#160c1e",
          surface2: "#1f1329",
        },
      },
      backgroundImage: {
        // Header keeps the Premier League purple identity but with more
        // depth than a single flat gradient - a magenta highlight in the
        // top-left corner reads as a light source.
        "epl-gradient":
          "radial-gradient(120% 140% at 0% 0%, #7a0e5e 0%, #37003c 45%, #1a001d 100%)",
        // Cards get a soft top-lit gradient instead of a flat fill, so they
        // catch the eye as raised surfaces rather than painted rectangles.
        "epl-card": "linear-gradient(160deg, #221530 0%, #160c1e 100%)",
        "epl-card-hover": "linear-gradient(160deg, #2a1a3a 0%, #1a0f24 100%)",
      },
      boxShadow: {
        // A deep, soft ambient shadow that lifts cards off the background.
        card: "0 10px 30px -12px rgba(0, 0, 0, 0.7)",
        "glow-magenta": "0 0 20px -2px rgba(233, 0, 82, 0.55)",
        "glow-cyan": "0 0 20px -2px rgba(4, 245, 255, 0.45)",
        "glow-red": "0 0 22px -2px rgba(239, 68, 68, 0.6)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};
