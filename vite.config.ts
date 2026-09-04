import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import fs from "node:fs";
import path from "node:path";

function spaFallback(): Plugin {
  return {
    name: "spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (
          req.method === "GET" &&
          !url.startsWith("/@") &&
          !url.startsWith("/node_modules") &&
          !url.startsWith("/src") &&
          !url.startsWith("/src/") &&
          !url.includes(".") &&
          !url.startsWith("/functions/") &&
          !url.startsWith("/api/")
        ) {
          try {
            const indexPath = path.resolve(server.config.root, "index.html");
            const html = fs.readFileSync(indexPath, "utf-8");
            server.transformIndexHtml("/", html).then((transformed) => {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(transformed);
            }).catch(() => {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(html);
            });
            return;
          } catch {
            next();
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  appType: "spa",
  plugins: [react(), cloudflare(), spaFallback()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
