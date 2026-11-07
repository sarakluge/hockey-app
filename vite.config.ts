import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ["@mui/material", "@emotion/react", "@emotion/styled"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
