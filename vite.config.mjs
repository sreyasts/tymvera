import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    react(),
    {
      name: "planner-public-assets",
      generateBundle() {
        const root = fileURLToPath(new URL("./public/", import.meta.url));
        const emit = (directory, prefix = "") => {
          for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (["downloads", "vendor", "index.html"].includes(entry.name))
              continue;
            const fileName = `${prefix}${entry.name}`;
            const filePath = path.join(directory, entry.name);
            if (entry.isDirectory()) emit(filePath, `${fileName}/`);
            else
              this.emitFile({
                type: "asset",
                fileName,
                source: readFileSync(filePath),
              });
          }
        };
        emit(root);
      },
      configureServer(server) {
        // Static PWA files stay available in development; production emits only
        // current assets, excluding obsolete installers and runtime CSS tools.
        server.middlewares.use((req, res, next) => {
          const pathname = (req.url || "").split("?")[0];
          if (
            !/^\/(?:[\w.-]+\.(?:png|ico|json|txt|xml)|sw\.js)$/.test(pathname)
          )
            return next();
          try {
            const contents = readFileSync(
              fileURLToPath(new URL(`./public${pathname}`, import.meta.url)),
            );
            res.setHeader(
              "Content-Type",
              pathname.endsWith(".js")
                ? "application/javascript"
                : pathname.endsWith(".json")
                  ? "application/json"
                  : pathname.endsWith(".png")
                    ? "image/png"
                    : "text/plain",
            );
            res.end(contents);
          } catch {
            next();
          }
        });
      },
    },
  ],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: "dist",
  },
});
