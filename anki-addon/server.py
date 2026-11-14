"""Tiny local HTTP server speaking the AnkiConnect-style JSON protocol. No Anki imports."""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 64 * 1024 * 1024


def start(port, allowed_origins, handle):
    allowed = set(allowed_origins)
    hosts = {f"127.0.0.1:{port}", f"localhost:{port}", f"[::1]:{port}"}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, code, body=b"", origin=None, extra=None):
            self.send_response(code)
            if origin is not None:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            if body:
                self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _guard(self):
            """Returns (ok, origin). Sends 403 itself when not ok."""
            if self.headers.get("Host") not in hosts:
                self._send(403)
                return False, None
            origin = self.headers.get("Origin")
            if origin is not None and origin not in allowed:
                self._send(403)
                return False, None
            return True, origin

        def do_OPTIONS(self):
            ok, origin = self._guard()
            if not ok:
                return
            if origin is None:
                return self._send(204)
            self._send(204, origin=origin, extra={
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Private-Network": "true",
                "Access-Control-Max-Age": "600",
            })

        def do_POST(self):
            ok, origin = self._guard()
            if not ok:
                return
            reply = lambda obj: self._send(200, json.dumps(obj).encode(), origin)
            try:
                length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                return self._send(411, origin=origin)
            if length < 0 or length > MAX_BODY:
                return self._send(413, origin=origin)
            try:
                req = json.loads(self.rfile.read(length))
                action, params = req["action"], req.get("params") or {}
            except Exception:
                return reply({"result": None, "error": "bad request: invalid JSON"})
            try:
                reply({"result": handle(action, params), "error": None})
            except Exception as e:
                reply({"result": None, "error": str(e)})

    class Server(ThreadingHTTPServer):
        # On Windows SO_REUSEADDR lets a second program share a busy port, so keep it off there.
        allow_reuse_address = os.name != "nt"

    server = Server(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def stop(server):
    server.shutdown()
    server.server_close()
