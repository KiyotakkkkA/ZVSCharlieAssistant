import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/host/main.ts"),
        },
      },
    },
    resolve: {
      alias: {
        "@host": resolve("src/host"),
        "@ipc": resolve("src/ipc"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/host/preload.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
    resolve: {
      alias: {
        "@ipc": resolve("src/ipc"),
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    server: {
      host: true,
    },
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer"),
        "@ipc": resolve("src/ipc"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
