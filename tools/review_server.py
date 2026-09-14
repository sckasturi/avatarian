#!/usr/bin/env python3
"""
The submission review console's local server.

    python3 tools/review_server.py        # http://localhost:8794/

A LOCAL tool, like the workbench and the designer — it is not deployed. It
is the maintainer's side of the public contribution flow: the contribute
page (site/contribute.html) posts to the Cloudflare Worker, which opens a
pull request staging a sighting under corpus/incoming/ with its image in
site/sources/. This console lists those open PRs, draws each one with the
product's own renderer, and lets you approve or reject.

APPROVE is hands-off: it names the source, merges the PR, folds it into the
corpus with tools/promote_corpus.py, commits, and pushes — the change goes
live on the next Pages deploy. REJECT closes the PR.

It shells out to `gh` (already authenticated) for everything on GitHub, and
to `git` for the local fold + push, so it inherits your credentials rather
than holding any of its own. It binds to 127.0.0.1 and is not hardened —
don't expose it.

API
---
    GET  /api/submissions   open contribution PRs, parsed + validated
    POST /api/approve       {number, slug, name} -> merge, promote, push
    POST /api/reject        {number, comment}    -> close the PR
    GET  /api/image         ?branch=&path=        a PR's reference image
    GET  /site/...          the site's own render.js / blocks.css, read-only
"""

import json
import pathlib
import re
import subprocess
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "review"
SITE = ROOT / "site"

PORT = 8794

# The site files the console may read, to draw Avatarian with the product's
# own code rather than a lookalike (same allow-list idea as the workbench).
SITE_FILES = {
    "js/manifest.js", "js/corpus.js", "js/sounds.js", "js/render.js",
    "css/blocks.css",
}
SITE_TYPES = {".js": "application/javascript", ".css": "text/css"}
IMAGE_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".webp": "image/webp", ".gif": "image/gif"}

CONTRIB_BRANCH = re.compile(r"^contrib/")
SAFE_PATH = re.compile(r"^site/sources/[A-Za-z0-9._-]+$")


def run(argv, **kw):
    """Run a command, returning (ok, stdout, stderr)."""
    p = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, **kw)
    return p.returncode == 0, p.stdout, p.stderr


def gh_json(args):
    ok, out, err = run(["gh", *args])
    if not ok:
        raise RuntimeError(f"gh {' '.join(args)}: {err.strip()}")
    return json.loads(out or "null")


def repo_slug():
    """owner/name for the current repo, from gh."""
    data = gh_json(["repo", "view", "--json", "owner,name"])
    return data["owner"]["login"], data["name"]


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
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def log_message(self, fmt, *args):
        if self.command != "GET":
            sys.stderr.write("%s %s\n" % (self.command, self.path))

    # --- routes -----------------------------------------------------------

    def do_GET(self):
        path = self.path.split("?")[0]
        try:
            if path == "/api/submissions":
                return self.get_submissions()
            if path == "/api/image":
                return self.get_image()
            if path.startswith("/site/"):
                return self.send_site(path[len("/site/"):])
        except Exception as e:                           # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            if path == "/api/approve":
                return self.approve()
            if path == "/api/reject":
                return self.reject()
        except Exception as e:                           # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 400)
        return self.send_error(404)

    def send_site(self, rel):
        if rel not in SITE_FILES:
            return self.send_error(404)
        p = SITE / rel
        try:
            body = p.read_bytes()
        except OSError:
            return self.send_error(404)
        self.send_response(200)
        self.send_header("Content-Type",
                         SITE_TYPES.get(p.suffix, "text/plain") + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # --- submissions ------------------------------------------------------

    def get_submissions(self):
        owner, repo = repo_slug()
        prs = gh_json(["pr", "list", "--state", "open", "--json",
                       "number,title,author,url,createdAt,headRefName,files"])
        out = []
        for pr in prs or []:
            branch = pr["headRefName"]
            if not CONTRIB_BRANCH.match(branch):
                continue
            paths = [f["path"] for f in pr.get("files") or []]
            incoming = next((p for p in paths
                             if p.startswith("corpus/incoming/") and p.endswith(".json")), None)
            image = next((p for p in paths if p.startswith("site/sources/")), None)
            if not incoming:
                continue
            # The staged file's content, straight off the PR branch.
            ok, raw, err = run(["gh", "api",
                                f"repos/{owner}/{repo}/contents/{incoming}?ref={branch}",
                                "-H", "Accept: application/vnd.github.raw"])
            submission = json.loads(raw) if ok and raw.strip() else None
            out.append({
                "number": pr["number"],
                "url": pr["url"],
                "author": (pr.get("author") or {}).get("login", ""),
                "createdAt": pr["createdAt"],
                "branch": branch,
                "slug": incoming[len("corpus/incoming/"):-len(".json")],
                "imagePath": image,
                "submission": submission,
                "error": None if submission else (err.strip() or "could not read the staged file"),
            })
        # Newest first.
        out.sort(key=lambda s: s["number"], reverse=True)
        return self.send_json({"submissions": out, "repo": f"{owner}/{repo}"})

    def get_image(self):
        from urllib.parse import parse_qs, urlparse
        q = parse_qs(urlparse(self.path).query)
        branch = (q.get("branch") or [""])[0]
        path = (q.get("path") or [""])[0]
        if not branch or not SAFE_PATH.match(path):
            return self.send_error(404)
        owner, repo = repo_slug()
        p = subprocess.run(
            ["gh", "api", f"repos/{owner}/{repo}/contents/{path}?ref={branch}",
             "-H", "Accept: application/vnd.github.raw"],
            cwd=ROOT, capture_output=True)
        if p.returncode != 0:
            return self.send_error(404)
        suffix = pathlib.Path(path).suffix.lower()
        self.send_response(200)
        self.send_header("Content-Type", IMAGE_TYPES.get(suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(p.stdout)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(p.stdout)

    # --- actions ----------------------------------------------------------

    def approve(self):
        """
        Hands-off approve: name, merge, fold, commit, push.

        All-or-nothing where it matters — a dirty working tree is refused
        up front so the fold and commit can't sweep up unrelated changes,
        and each step's output is returned so a failure says exactly how
        far it got.
        """
        body = self.read_json()
        number = int(body.get("number"))
        slug = str(body.get("slug") or "")
        name = str(body.get("name") or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._-]+", slug):
            return self.send_json({"error": "bad submission id"}, 400)
        if not name:
            return self.send_json({"error": "give the source a name"}, 400)

        log = []

        def step(title, argv):
            ok, out, err = run(argv)
            log.append({"step": title, "ok": ok,
                        "out": (out or "").strip(), "err": (err or "").strip()})
            return ok

        # Refuse on a dirty tree — the commit below stages everything.
        ok, out, _ = run(["git", "status", "--porcelain"])
        if out.strip():
            return self.send_json({
                "error": "Your working tree has uncommitted changes. Commit or "
                         "stash them before approving, so the fold lands on its own.",
                "log": log,
            }, 409)

        if not step("checkout main", ["git", "checkout", "main"]):
            return self.send_json({"error": "could not switch to main", "log": log}, 500)
        if not step(f"merge PR #{number}",
                    ["gh", "pr", "merge", str(number), "--squash", "--delete-branch"]):
            return self.send_json({"error": "merge failed — see the log", "log": log}, 500)
        if not step("pull main", ["git", "pull", "--ff-only", "origin", "main"]):
            return self.send_json({"error": "could not fast-forward main", "log": log}, 500)
        if not step(f"promote as '{name}'",
                    [sys.executable, "tools/promote_corpus.py", f"{slug}.json", "--name", name]):
            return self.send_json({"error": "promote failed — see the log", "log": log}, 500)
        if not step("stage", ["git", "add", "-A"]):
            return self.send_json({"error": "git add failed", "log": log}, 500)
        if not step("commit",
                    ["git", "commit", "-m",
                     f"corpus: promote {name} (community submission)"]):
            return self.send_json({"error": "git commit failed", "log": log}, 500)
        if not step("push", ["git", "push"]):
            return self.send_json({"error": "git push failed", "log": log}, 500)

        return self.send_json({"ok": True, "log": log})

    def reject(self):
        body = self.read_json()
        number = int(body.get("number"))
        comment = str(body.get("comment") or "").strip()
        argv = ["gh", "pr", "close", str(number), "--delete-branch"]
        if comment:
            argv += ["--comment", comment]
        ok, out, err = run(argv)
        if not ok:
            return self.send_json({"error": err.strip() or "close failed"}, 500)
        return self.send_json({"ok": True})


def main():
    if not WEB.exists():
        print(f"missing {WEB.relative_to(ROOT)}/ — is this the right repo?",
              file=sys.stderr)
        return 1
    try:
        owner, repo = repo_slug()
    except Exception as e:                               # noqa: BLE001
        print(f"Could not reach GitHub via gh: {e}\n"
              f"Run `gh auth login` first.", file=sys.stderr)
        return 1
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Review console on http://localhost:{PORT}/  ({owner}/{repo})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
