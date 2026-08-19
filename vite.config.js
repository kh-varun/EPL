import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Repo name is "EPL" -> GitHub Pages project site served from /EPL/
export default defineConfig({
  plugins: [react()],
  base: "/EPL/",
});
