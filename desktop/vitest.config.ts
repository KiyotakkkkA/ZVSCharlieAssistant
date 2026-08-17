import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 15_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@host": resolve(root, "src/host"),
      "@ipc": resolve(root, "src/ipc"),
      "@shared": resolve(root, "src/shared"),
      "@renderer": resolve(root, "src/renderer"),
    },
  },
});
