#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.server
import os
import socketserver
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def end_headers(self):
        # Force browser to always fetch current files from disk while debugging.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        # Ensure JS modules are served with the correct MIME type.
        if path.endswith(".js") or path.endswith(".mjs"):
            return "application/javascript"
        return super().guess_type(path)

    def log_message(self, fmt, *args):
        print(f"[dev-server] {self.address_string()} - {fmt % args}")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main() -> None:
    parser = argparse.ArgumentParser(description="Static dev server (no-cache) for Simple Volleyball Scout PWA")
    parser.add_argument("--port", "-p", type=int, default=int(os.environ.get("PORT", "8000")))
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    args = parser.parse_args()

    os.chdir(PROJECT_ROOT)
    with ReusableTCPServer((args.host, args.port), NoCacheHandler) as httpd:
        print(f"[dev-server] Serving {PROJECT_ROOT} on http://{args.host}:{args.port} (no-cache)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[dev-server] Stopped.")


if __name__ == "__main__":
    main()
