import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one Postgres database; run files serially so a
    // fixture created in one file is never observed by an invariant check in
    // another before its afterAll cleanup runs.
    fileParallelism: false,
  },
});