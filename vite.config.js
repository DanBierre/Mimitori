import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

// kuromoji fetches the dictionary as raw .gz bytes and gunzips them itself.
// Vite's static file servers tag *.gz responses with Content-Encoding: gzip,
// so the browser decompresses them first and kuromoji then fails with
// "invalid file signature". Strip that header for /dict/. Also drop the
// request's Accept-Encoding so `vite preview`'s compression middleware doesn't
// gzip the .gz bytes a second time.
function rawGzipDict() {
  const middleware = (req, res, next) => {
    if (req.url && req.url.startsWith("/dict/")) {
      delete req.headers["accept-encoding"];
      const setHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) =>
        name.toLowerCase() === "content-encoding" ? res : setHeader(name, value);
    }
    next();
  };
  return {
    name: "raw-gzip-dict",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// Cloudflare refuses any file of 25 MiB or more. The ONNX runtime wasm (26 MB) loads from
// jsdelivr at run time (transformers sets that path before ORT's own fallback URL is used),
// but ORT's fallback still makes Vite copy it into dist. Drop it, then fail the build if
// anything else is too big.
function cloudflareSizeLimit() {
  const LIMIT = 25 * 1024 * 1024;
  let outDir = "dist";
  return {
    name: "cloudflare-size-limit",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const big = [];
      for (const f of readdirSync(outDir, { recursive: true })) {
        const path = join(outDir, f);
        if (/ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(f)) rmSync(path);
        else if (statSync(path).isFile() && statSync(path).size >= LIMIT) big.push(f);
      }
      if (big.length) throw new Error(`Over Cloudflare's 25 MiB file limit: ${big.join(", ")}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), rawGzipDict(), cloudflareSizeLimit()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"], include: ["mediabunny"] },
  server: {
    port: 5173,
  },
});
