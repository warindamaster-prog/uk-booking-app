import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("src"),
      // "server-only" throws when imported outside a server bundle; tests run in plain Node.
      "server-only": path.resolve("src/test/empty.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"], testTimeout: 30000 },
});
