#!/usr/bin/env python3
"""
The transcription workbench's local server.

    python3 tools/corpus_server.py        # http://localhost:8793/

Serves workbench/ and a small JSON API over corpus/. Like the glyph
designer, this is a LOCAL tool and is not deployed: the site is static
and has no server, while this one writes files, which is the whole point.
It binds to 127.0.0.1 and is not hardened — don't expose it.

WHAT THE WORKFLOW IS. You supply a reference image and read the Avatarian
off it yourself. The image is **provenance, not input**: nothing here
looks at its pixels. It is stored so the entry can be re-checked in a
year, which is the single thing every current corpus entry is missing.

So the loop is: file the image as a source, transcribe what you can read
into a spelling, let the fuzzy reverse-decode suggest what English word
that is, confirm it, save.

API
---
    GET  /api/corpus         sources + entries + current validation state
    POST /api/corpus         save the lot (validates; writes nothing if bad)
    POST /api/image          store a reference image against a source
    GET  /images/<file>      a stored reference image

    GET  /site/...           the main site's own files, read-only

Saving goes through tools/build_corpus.py's `save()`, which is the same
function the command line uses — so there is no way to write an entry
through the UI that `python3 tools/build_corpus.py` would then reject.

/site/ is why the workbench can show real Avatarian: it serves the
deployed site's render.js, blocks.css and the rest straight off disk, so
the preview beside your transcription is drawn by the product's own code.
It also serves the 1.6 MB pronunciation dictionary, which the workbench
loads and the wiki gadget deliberately does not — reverse-decode needs
the whole dictionary to search, and this is a tool on your own laptop.
"""

import base64
import json
import pathlib
import re
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import build_corpus                                     # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "workbench"
SITE = ROOT / "site"
IMAGES = ROOT / "corpus" / "sources"

PORT = 8793

# The files under site/ the workbench may read. An allow-list rather than
# a path check, same as the designer: this server exists to write to
# corpus/, and the less of the tree it hands out the better.
SITE_FILES = {
    "js/manifest.js", "js/corpus.js", "js/lexicon.js", "js/g2p.js",
    "js/sounds.js", "js/render.js", "js/recognise.js", "js/draw.js",
    "js/reverse.js", "css/blocks.css",
}
SITE_TYPES = {".js": "application/javascript", ".css": "text/css"}

IMAGE_TYPES = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "image/gif": ".gif",
}
FILE_OK = re.compile(r"^[A-Za-z0-9._-]+$")
DATA_URL = re.compile(r"^data:([\w/+.-]+);base64,(.*)$", re.S)

# A reference photo can be big, but nothing legitimate here is enormous,
# and an accidental 200 MB paste should fail fast rather than eat memory.
MAX_IMAGE = 24 * 1024 * 1024


def safe_stem(name):
    """
    A filename from user text: keep it recognisable, keep it a name.

    The extension is dropped because the caller appends one derived from
    the actual image type — trusting the name instead would write
    `photo.png.png` for a dropped file, and `photo.png` for a JPEG that
    somebody had misnamed.
    """
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", (name or "").strip()).strip("-.")
    stem = re.sub(r"\.(png|jpe?g|webp|gif|heic|tiff?)$", "", stem, flags=re.I)
    return (stem or "source")[:60]


def unique_path(stem, suffix):
    """`stem.png`, then `stem-2.png`, so re-uploading never overwrites the
    image an existing entry cites."""
    IMAGES.mkdir(parents=True, exist_ok=True)
    path = IMAGES / f"{stem}{suffix}"
    n = 2
    while path.exists():
        path = IMAGES / f"{stem}-{n}{suffix}"
        n += 1
    return path


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    # --- plumbing ---------------------------------------------------------

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_IMAGE:
            raise ValueError("body too large")
        if not length:
            return None
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/") and self.command != "GET":
            sys.stderr.write("%s %s\n" % (self.command, self.path))

    def send_file(self, path, content_type):
        try:
            body = path.read_bytes()
        except OSError:
            return self.send_error(404)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # --- routes -----------------------------------------------------------

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/corpus":
            return self.get_corpus()
        if path.startswith("/site/"):
            return self.send_site(path[len("/site/"):])
        if path.startswith("/images/"):
            return self.send_image(path[len("/images/"):])
        return super().do_GET()

    def get_corpus(self):
        data = build_corpus.load() if build_corpus.SRC.exists() else {}
        problems, records = build_corpus.check(data)
        return self.send_json({
            "sources": data.get("sources") or {},
            "entries": data.get("entries") or [],
            "problems": problems,
            "count": len(records),
        })

    def send_site(self, rel):
        if rel not in SITE_FILES:
            return self.send_error(404)
        path = SITE / rel
        self.send_file(path, SITE_TYPES.get(path.suffix, "text/plain")
                       + "; charset=utf-8")

    def send_image(self, name):
        if not FILE_OK.match(name):
            return self.send_error(404)
        path = IMAGES / name
        suffix = {v: k for k, v in IMAGE_TYPES.items()}
        self.send_file(path, suffix.get(path.suffix, "application/octet-stream"))

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            if path == "/api/corpus":
                return self.save_corpus()
            if path == "/api/image":
                return self.store_image()
        except Exception as e:                       # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 400)
        return self.send_error(404)

    def save_corpus(self):
        """
        Validate and write. `save()` writes nothing at all if anything is
        wrong, so a rejected save leaves the file exactly as it was — the
        UI can show the problems and let you fix them without having half
        the edit already on disk.
        """
        body = self.read_json() or {}
        problems, records = build_corpus.save({
            "sources": body.get("sources") or {},
            "entries": body.get("entries") or [],
        })
        return self.send_json({
            "saved": not problems,
            "problems": problems,
            "count": len(records or {}),
        })

    def store_image(self):
        """
        Store a reference image against a source.

        The image is never read by anything here. It is kept so that
        "where did this spelling come from" has an answer that survives
        the session — which is the one thing every entry written before
        this tool existed is missing.
        """
        body = self.read_json() or {}
        match = DATA_URL.match(body.get("data") or "")
        if not match:
            return self.send_json({"error": "expected a data: URL"}, 400)
        mime, encoded = match.group(1), match.group(2)
        if mime not in IMAGE_TYPES:
            return self.send_json(
                {"error": f"{mime} is not an image type this stores "
                          f"({', '.join(sorted(IMAGE_TYPES))})"}, 400)
        raw = base64.b64decode(encoded, validate=False)
        if len(raw) > MAX_IMAGE:
            return self.send_json({"error": "image is over 24 MB"}, 400)

        path = unique_path(safe_stem(body.get("name")), IMAGE_TYPES[mime])
        path.write_bytes(raw)
        return self.send_json({"file": path.name, "bytes": len(raw)})


def main():
    IMAGES.mkdir(parents=True, exist_ok=True)
    data = build_corpus.load() if build_corpus.SRC.exists() else {}
    problems, records = build_corpus.check(data)
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Transcription workbench on http://localhost:{PORT}/")
    print(f"Corpus: {len(records)} entries, "
          f"{len(data.get('sources') or {})} sources, "
          f"{len(list(IMAGES.glob('*')))} stored image(s).")
    if problems:
        print(f"{len(problems)} problem(s) in the corpus — the workbench "
              f"will show them.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
