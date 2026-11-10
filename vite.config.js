import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// kuromoji fetches the dictionary as raw .gz bytes and gunzips them itself.
// Vite's static file servers tag *.gz responses with Content-Encoding: gzip,
// so the browser decompresses them first and kuromoji then fails with
// "invalid file signature". Strip that header for /dict/.
function rawGzipDict() {
  const middleware = (req, res, next) => {
    if (req.url && req.url.startsWith("/dict/")) {
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

export default defineConfig({
  plugins: [react(), rawGzipDict()],
  server: {
    port: 5173,
  },
});
