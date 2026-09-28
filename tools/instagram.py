#!/usr/bin/env python3
"""
Pull one carousel slide's image from a public Instagram post — no login.

The login wall on a post page is a dismissible overlay, not a real block:
the post's data (every carousel slide's image URL) is already embedded in
the page HTML as JSON, which is why an incognito visitor sees the slide the
moment they close the modal. This fetches that same HTML with browser-ish
headers, reads the embedded JSON, and returns the requested slide's bytes.

It is deliberately isolated in its own module: Instagram changes its page
shape without notice, so when this breaks it is the one file to fix, and
tools/corpus_server.py only ever calls fetch_slide().

    from instagram import fetch_slide, InstagramError
    raw, ext, meta = fetch_slide("https://www.instagram.com/p/CODE/?img_index=2")

`meta` carries {shortcode, index, count}. Raises InstagramError with a
human message on anything it can't do (private post, login wall served,
slide out of range, a video slide, a changed page shape).
"""

import json
import re
import urllib.parse
import urllib.request

# The public web app id Instagram's own site sends; harmless, and some
# responses are friendlier with it. Not auth — just identifies the client.
IG_APP_ID = "936619743392459"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
MAX_IMAGE = 25 * 1024 * 1024

SHORTCODE = re.compile(r"instagram\.com/(?:[^/]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)")
JSON_BLOB = re.compile(r'<script type="application/json"[^>]*>(.*?)</script>', re.S)
CONTENT_EXT = {"image/jpeg": ".jpg", "image/png": ".png",
               "image/webp": ".webp", "image/gif": ".gif"}


class InstagramError(Exception):
    """Something we can explain to the person, not a stack trace."""


def parse_url(url):
    """(shortcode, img_index-or-None) from a post URL."""
    m = SHORTCODE.search(url or "")
    if not m:
        raise InstagramError(
            "That doesn't look like an Instagram post URL "
            "(expected .../p/CODE/ or .../reel/CODE/).")
    shortcode = m.group(1)
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    idx = qs.get("img_index", [None])[0]
    return shortcode, (int(idx) if idx and idx.isdigit() else None)


def _get(url, binary=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": ("text/html,application/xhtml+xml,application/xml;q=0.9,"
                   "image/avif,image/webp,*/*;q=0.8"),
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "X-IG-App-ID": IG_APP_ID,
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read() if binary else (r.read().decode("utf-8", "replace"), r)


def _find_media(node, shortcode, out):
    """Every dict that looks like THIS post's media, by shortcode."""
    if isinstance(node, dict):
        code = node.get("code") or node.get("shortcode")
        if code == shortcode and (
                "carousel_media" in node or "image_versions2" in node):
            out.append(node)
        for v in node.values():
            _find_media(v, shortcode, out)
    elif isinstance(node, list):
        for v in node:
            _find_media(v, shortcode, out)


def _media_for(html, shortcode):
    hits = []
    for blob in JSON_BLOB.findall(html):
        try:
            _find_media(json.loads(blob), shortcode, hits)
        except (ValueError, RecursionError):
            continue
    return hits[0] if hits else None


def _slide_image_url(media, index):
    """The best-resolution image URL for 1-based slide `index`."""
    items = media.get("carousel_media")
    if items:
        count = len(items)
        if index < 1 or index > count:
            raise InstagramError(
                f"This post has {count} slide(s); slide {index} doesn't exist.")
        item = items[index - 1]
    else:
        count = 1
        if index not in (1, None):
            raise InstagramError(
                "This is a single-image post — there's only slide 1.")
        item = media

    if item.get("video_versions") and not item.get("image_versions2"):
        raise InstagramError(
            f"Slide {index} is a video, not an image.")

    cands = (item.get("image_versions2") or {}).get("candidates") or []
    if not cands:
        raise InstagramError(f"No image found for slide {index}.")
    # Instagram lists candidates largest-first; fall back to widest if a
    # future shape carries sizes.
    best = cands[0]
    for c in cands:
        if (c.get("width") or 0) > (best.get("width") or 0):
            best = c
    url = best.get("url")
    if not url:
        raise InstagramError(f"No image URL for slide {index}.")
    return url, count


def fetch_slide(url, index=None):
    """
    Fetch one slide. Returns (image_bytes, extension, meta).

    `index` (1-based) overrides the URL's img_index; if neither is given,
    slide 1. `meta` = {shortcode, index, count}.
    """
    shortcode, url_index = parse_url(url)
    if index is None:
        index = url_index if url_index else 1

    canonical = f"https://www.instagram.com/p/{shortcode}/"
    try:
        html, _ = _get(canonical)
    except Exception as e:                               # noqa: BLE001
        raise InstagramError(f"Couldn't reach Instagram: {e}")

    media = _media_for(html, shortcode)
    if not media:
        # Either a genuine login wall was served, or the page shape changed.
        if "loginForm" in html or "not-logged-in" in html and "carousel_media" not in html:
            raise InstagramError(
                "Instagram served a login wall for this post (it may be "
                "private, or the rate limit was hit). Try again shortly, or "
                "drop the image in by hand.")
        raise InstagramError(
            "Couldn't find the post's images in the page — Instagram may have "
            "changed its format. Drop the image in by hand; see tools/instagram.py.")

    img_url, count = _slide_image_url(media, index)

    try:
        with urllib.request.urlopen(
                urllib.request.Request(img_url, headers={"User-Agent": UA}),
                timeout=25) as r:
            ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip()
            raw = r.read(MAX_IMAGE + 1)
    except Exception as e:                               # noqa: BLE001
        raise InstagramError(f"Found the slide but couldn't download it: {e}")

    if len(raw) > MAX_IMAGE:
        raise InstagramError("That image is over 25 MB.")
    ext = CONTENT_EXT.get(ctype)
    if not ext:
        # Trust the magic bytes over a missing/odd content-type.
        ext = ".jpg" if raw[:3] == b"\xff\xd8\xff" else (
              ".png" if raw[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg")
    return raw, ext, {"shortcode": shortcode, "index": index, "count": count}


if __name__ == "__main__":
    import sys
    raw, ext, meta = fetch_slide(sys.argv[1],
                                 int(sys.argv[2]) if len(sys.argv) > 2 else None)
    out = f"{meta['shortcode']}-{meta['index']}{ext}"
    open(out, "wb").write(raw)
    print(f"saved {out} ({len(raw)} bytes) — slide {meta['index']} of {meta['count']}")
