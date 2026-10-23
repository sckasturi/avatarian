#!/usr/bin/env python3
"""
Push the generated wiki files to the Fandom wiki, so you stop copy-pasting.

Two pages are kept in sync, each from a generated file in wiki/:

    Module:Avatarian            <- wiki/Module_Avatarian.lua
    User:TechFilmer/Avatarian.css <- wiki/Avatarian-css-only.css

It logs in as you over the MediaWiki Action API using a BOT PASSWORD (not
your real password), compares each page to the file, and edits ONLY the ones
that differ — so it is safe to run every time and a no-op when nothing moved.

SETUP (once)
------------
1. Build first so the wiki/ files are current (the designer's "ship it", or
   `python tools/build_glyphs.py && python tools/build_manifest.py &&
    python tools/build_lua_module.py && python tools/build_css_only.py`).

2. Create a bot password: on the wiki, open  Special:BotPasswords , add one
   (call it e.g. "deploy") and tick at least:
       - Edit existing pages
   It shows a username like  TechFilmer@deploy  and a long password token.
   (The CSS target is your own user subpage, so no admin grant is needed.)

3. Put the wiki URL and those credentials in your shell environment:
       export WIKI_API_URL="https://<your-wiki>.fandom.com/api.php"
       export WIKI_USER="TechFilmer@deploy"
       export WIKI_BOT_PASSWORD="<the long token>"
   (WIKI_API_URL can instead be hard-coded in API_URL_DEFAULT below.)

USAGE
-----
    python tools/deploy_wiki.py            # sync the pages
    python tools/deploy_wiki.py --check    # show what WOULD change; edit nothing

Only the standard library is used — no pip install, same as the rest of the
tooling.
"""

import difflib
import http.cookiejar
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent

# If you'd rather not export WIKI_API_URL every time, put the api.php URL here.
API_URL_DEFAULT = ""

# page title -> source file (relative to the repo root)
PAGES = {
    "Module:Avatarian": "wiki/Module_Avatarian.lua",
    "User:TechFilmer/Avatarian.css": "wiki/Avatarian-css-only.css",
}

SUMMARY = "Sync from the avatarian repo (tools/deploy_wiki.py)"


class WikiError(RuntimeError):
    pass


class Wiki:
    """A thin MediaWiki Action API client: cookie session + CSRF edits."""

    def __init__(self, api_url):
        self.api = api_url
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar))

    def _call(self, params, post=None):
        params = {**params, "format": "json"}
        url = self.api + "?" + urllib.parse.urlencode(params)
        data = urllib.parse.urlencode(post).encode() if post is not None else None
        req = urllib.request.Request(
            url, data=data,
            headers={"User-Agent": "avatarian-deploy-wiki/1.0 (repo tool)"})
        with self.opener.open(req, timeout=30) as resp:
            body = json.load(resp)
        if "error" in body:
            raise WikiError(f"{body['error'].get('code')}: "
                            f"{body['error'].get('info')}")
        return body

    def _token(self, kind):
        out = self._call({"action": "query", "meta": "tokens", "type": kind})
        return out["query"]["tokens"][kind + "token"]

    def login(self, user, password):
        token = self._token("login")
        out = self._call(
            {"action": "login"},
            post={"lgname": user, "lgpassword": password, "lgtoken": token})
        res = out.get("login", {}).get("result")
        if res != "Success":
            raise WikiError(f"login failed ({res}). Check WIKI_USER / "
                            f"WIKI_BOT_PASSWORD and that the bot password is "
                            f"still active.")
        self.csrf = self._token("csrf")

    def page_text(self, title):
        out = self._call({"action": "query", "prop": "revisions",
                          "rvprop": "content", "rvslots": "main",
                          "titles": title, "formatversion": "2"})
        page = out["query"]["pages"][0]
        if page.get("missing"):
            return None
        return page["revisions"][0]["slots"]["main"]["content"]

    def edit(self, title, text):
        self._call(
            {"action": "edit"},
            post={"title": title, "text": text, "summary": SUMMARY,
                  "token": self.csrf, "bot": "1"})


def main(argv):
    check = "--check" in argv
    api_url = os.environ.get("WIKI_API_URL") or API_URL_DEFAULT
    if not api_url:
        sys.exit("Set WIKI_API_URL (or API_URL_DEFAULT) to your wiki's "
                 "api.php URL, e.g. https://<wiki>.fandom.com/api.php")

    # Read the files first, so a missing/empty file fails before we log in.
    wanted = {}
    for title, rel in PAGES.items():
        path = ROOT / rel
        if not path.exists():
            sys.exit(f"missing {rel} — build the wiki files first "
                     f"(see this script's docstring).")
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            sys.exit(f"{rel} is empty — refusing to overwrite {title}.")
        wanted[title] = text

    wiki = Wiki(api_url)

    if not check:
        user = os.environ.get("WIKI_USER")
        pw = os.environ.get("WIKI_BOT_PASSWORD")
        if not user or not pw:
            sys.exit("Set WIKI_USER and WIKI_BOT_PASSWORD (a bot password "
                     "from Special:BotPasswords). See the docstring.")
        wiki.login(user, pw)
    else:
        # --check only reads; reading public pages needs no login.
        pass

    changed = 0
    for title, text in wanted.items():
        current = wiki.page_text(title)
        if current is None:
            print(f"+ {title}: does not exist yet — would be created")
            if not check:
                wiki.edit(title, text)
                print(f"  created ({len(text)} bytes)")
            changed += 1
            continue
        if current.rstrip("\n") == text.rstrip("\n"):
            print(f"= {title}: already up to date")
            continue
        changed += 1
        if check:
            diff = list(difflib.unified_diff(
                current.splitlines(), text.splitlines(),
                fromfile=f"{title} (wiki)", tofile=PAGES[title], lineterm=""))
            print(f"~ {title}: would change ({len(diff)} diff lines); first few:")
            for line in diff[:12]:
                print("    " + line)
        else:
            wiki.edit(title, text)
            print(f"~ {title}: updated ({len(text)} bytes)")

    verb = "would change" if check else "changed"
    print(f"\n{changed} page(s) {verb}; {len(PAGES) - changed} already current.")


if __name__ == "__main__":
    main(sys.argv[1:])
