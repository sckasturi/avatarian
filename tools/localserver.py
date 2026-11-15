"""
The plumbing the three local tool servers share.

    designer_server.py   :8792
    corpus_server.py     :8793
    review_server.py     :8794

Each of them serves one folder of static files, hands out an allow-listed
handful of the site's own files under /site/, and speaks JSON on /api/.
That part was written three times; it lives here once.

It also holds the one piece of hardening a localhost tool needs. These
servers write files, run `git push` and merge pull requests, and a browser
will happily send a request to http://localhost:8793 from ANY web page that
is open while the tool runs. Binding to 127.0.0.1 does not stop that — the
request comes from this machine. So every request is checked:

  * the Host header must name this server on localhost (defeats DNS
    rebinding, where a hostile domain is re-pointed at 127.0.0.1);
  * a request that carries an Origin must carry OURS (a cross-site page's
    fetch or form post always carries its own);
  * a browser that says the request is cross-site (Sec-Fetch-Site) is
    believed.

A command-line client (curl, a script) sends no Origin and is let through:
it is already running on this machine with the user's permissions.
"""

import json
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

SITE_TYPES = {".js": "application/javascript", ".css": "text/css"}
IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".webp": "image/webp", ".gif": "image/gif"}
LOCAL_HOSTS = ("localhost", "127.0.0.1")


class BodyTooLarge(ValueError):
    pass


class LocalHandler(SimpleHTTPRequestHandler):
    """Subclass and set WEB (the folder served at /), SITE (the site root),
    and SITE_FILES (the relative paths /site/ may hand out)."""

    WEB = None
    SITE = None
    SITE_FILES = frozenset()
    MAX_BODY = 1024 * 1024           # a JSON edit; raise it where images post

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(self.WEB), **kw)

    # --- the same-origin guard -------------------------------------------

    def _allowed_origins(self):
        port = self.server.server_port
        return {f"http://{h}:{port}" for h in LOCAL_HOSTS}

    def request_is_local(self):
        port = self.server.server_port
        host = (self.headers.get("Host") or "").lower()
        if host not in {f"{h}:{port}" for h in LOCAL_HOSTS}:
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin not in self._allowed_origins():
            return False
        if self.command not in ("GET", "HEAD"):
            site = self.headers.get("Sec-Fetch-Site")
            if site is not None and site not in ("same-origin", "none"):
                return False
        return True

    def parse_request(self):
        if not super().parse_request():
            return False
        if not self.request_is_local():
            self.send_error(403, "Cross-origin request refused")
            return False
        return True

    # --- plumbing ---------------------------------------------------------

    def route(self):
        """The request path without its query string."""
        return self.path.split("?")[0]

    def send_bytes(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, payload, status=200):
        self.send_bytes(json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                        "application/json; charset=utf-8", status)

    def read_json(self):
        """The request's JSON body, or None when there is none."""
        length = int(self.headers.get("Content-Length") or 0)
        if length > self.MAX_BODY:
            raise BodyTooLarge("request body is too large")
        if not length:
            return None
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def send_file(self, path, content_type):
        try:
            body = path.read_bytes()
        except OSError:
            return self.send_error(404)
        self.send_bytes(body, content_type)

    def site_allows(self, rel):
        return rel in self.SITE_FILES

    def send_site(self, rel):
        """One of the main site's own files, so a preview is drawn by the
        product's code rather than a copy of it. An allow-list, not a path
        check: the less of the tree a writing server hands out, the less
        there is to get wrong."""
        if not self.site_allows(rel):
            return self.send_error(404)
        path = self.SITE / rel
        suffix = path.suffix.lower()
        if suffix in IMAGE_TYPES:
            return self.send_file(path, IMAGE_TYPES[suffix])
        self.send_file(path, SITE_TYPES.get(suffix, "text/plain")
                       + "; charset=utf-8")

    def end_headers(self):
        # The main site is bitten regularly by aggressive caching of its
        # generated files; a tool that serves a stale editor after an edit
        # would waste the same afternoon.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.command != "GET":
            sys.stderr.write("%s %s\n" % (self.command, self.path))


def serve(handler, port):
    """Serve on 127.0.0.1 until interrupted."""
    server = HTTPServer(("127.0.0.1", port), handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
