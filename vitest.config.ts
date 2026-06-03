import { defineConfig } from "vitest/config";

// Standalone config so the unit tests don't load vite.config.ts (which pulls in
// the @tailwindcss/vite plugin and its peer-dep chain). Node environment is all
// the pure-logic parser tests need.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "functions/**/*.test.ts"],
  },
});
