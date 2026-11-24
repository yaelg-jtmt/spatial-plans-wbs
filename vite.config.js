import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" + hash routing => works on GitHub Pages under /<repo-name>/ without extra config
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
