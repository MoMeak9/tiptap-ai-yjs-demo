import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/**/*.test.ts"],
      rollupTypes: true,
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "TiptapCommentExtension",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "@tiptap/core",
        "@tiptap/pm",
        "@tiptap/pm/state",
        "@tiptap/pm/view",
        "@tiptap/pm/model",
        "yjs",
        "y-websocket",
      ],
      output: {
        exports: "named",
        globals: {
          "@tiptap/core": "TiptapCore",
          yjs: "Y",
          "y-websocket": "YWebsocket",
        },
      },
    },
    cssCodeSplit: false,
  },
});
