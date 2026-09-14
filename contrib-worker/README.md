# contrib-worker — the corpus contribution backend

A small Cloudflare Worker that lets **anyone** (no GitHub account needed)
submit an Avatarian sighting from [`site/contribute.html`](../site/contribute.html)
and have it become a pull request a maintainer reviews.

It is the one piece of server in an otherwise static, GitHub-Pages-hosted
project, and it exists for exactly one reason: Pages cannot take a write,
and an anonymous contributor cannot open a PR. The Worker holds a bot token
at the edge, does cheap sanity + anti-spam checks, and opens the PR on the
contributor's behalf. It **cannot write to the corpus** — it can only
propose. The real validation is `build_corpus.check`, which runs as CI on
the PR ([`.github/workflows/validate-contrib.yml`](../.github/workflows/validate-contrib.yml))
and again at promote time ([`tools/promote_corpus.py`](../tools/promote_corpus.py)).

```
contribute.html ──POST /submit──▶ this Worker ──GitHub API──▶ PR
                                   (bot token)                 (corpus/incoming/<slug>.json
                                                                + site/sources/<image>)
                                                              │
                        CI: promote_corpus.py --check + tests │  you review & merge
                                                              ▼
                        python3 tools/promote_corpus.py <slug>.json  → attested.json
```

## What it does per request

1. **Rate-limit** the caller's IP (KV, `RATE_LIMIT_PER_DAY` per day).
2. **Verify Turnstile** (Cloudflare's CAPTCHA) if a secret is configured.
3. **Cheap validation** — a pre-filter only: source name present, each
   spelling an even token count, confidence known, image an accepted type
   under 24 MB. Drawability and the rest are left to CI's `build_corpus.check`.
4. **Open the PR** with the bot token: a `contrib/<slug>` branch, the image
   committed to `site/sources/`, the submission staged at
   `corpus/incoming/<slug>.json`, and a pull request against `main`.

Nothing auto-merges. Every submission is a PR you approve, and CI must pass.

## One-time setup

You need a Cloudflare account and [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
(`npm i -g wrangler`, then `wrangler login`).

### 1. Point the Worker at your repo

Edit [`wrangler.toml`](./wrangler.toml): set `REPO_OWNER`, `REPO_NAME`, and
`ALLOWED_ORIGIN` (your site's origin). `BASE_BRANCH` defaults to `main`.

### 2. A bot token (kept as a Worker secret)

Create a **fine-grained personal access token** scoped to **only this
repository**, with repository permissions:

- **Contents: Read and write** (to push the branch + files)
- **Pull requests: Read and write** (to open the PR)

Then store it — it is never committed:

```bash
cd contrib-worker
wrangler secret put BOT_TOKEN        # paste the token
```

> Prefer a dedicated bot account's token, or a GitHub App installation
> token, so community PRs are clearly not authored by you. A fine-grained
> PAT on your own account works too.

### 3. Turnstile (anti-spam)

Create a **Turnstile** widget in the Cloudflare dashboard (Turnstile →
Add site). You get two keys:

- the **site key** (public) → put it in `site/contribute.html`'s
  `window.AVATARIAN_CONTRIB.turnstileSiteKey`.
- the **secret key** → store it in the Worker:

```bash
wrangler secret put TURNSTILE_SECRET
```

If you skip Turnstile, leave both empty; the Worker then does not require a
challenge (rate-limiting still applies). Not recommended for a public,
anonymous endpoint.

### 4. Rate-limit store (recommended)

```bash
wrangler kv namespace create RATE
```

Paste the printed `id` into the `[[kv_namespaces]]` block in `wrangler.toml`
and uncomment it. Without the binding the Worker runs but does not
rate-limit.

### 5. Deploy

```bash
wrangler deploy
```

Wrangler prints the Worker URL (e.g.
`https://avatarian-contrib.<you>.workers.dev`). Put its `/submit` endpoint
into `site/contribute.html`:

```js
window.AVATARIAN_CONTRIB = {
  submitUrl: "https://avatarian-contrib.<you>.workers.dev/submit",
  turnstileSiteKey: "0x4AAAAAAA...",   // the Turnstile SITE key
};
```

Commit that change; Pages redeploys and the page is live.

## Local development

```bash
wrangler dev
```

`wrangler dev` serves the Worker on `http://localhost:8787`. To exercise the
real PR path you still need `BOT_TOKEN` (put it in a local `.dev.vars` file,
which is gitignored) and a repo you don't mind test branches in. A sample
request:

```bash
curl -sX POST http://localhost:8787/submit \
  -H 'Content-Type: application/json' \
  -d '{
        "source": { "name": "curl-test", "what": "x", "where": "y", "credit": "BokerBigBanana" },
        "submitter": "someone",
        "entries": [ { "key": "cherries", "spelling": "tʃ ɛ ɹ i z ∅", "confidence": "probable" } ],
        "image": { "name": "t.png", "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }
      }'
```

With no `TURNSTILE_SECRET` set locally, the challenge is skipped, so this
opens a real PR if `BOT_TOKEN` is present — use a throwaway branch/repo.

## Files

- `src/index.js` — the Worker.
- `wrangler.toml` — repo + origin config and the KV binding.
- `package.json` — pins `wrangler` for `npm run deploy` / `npm run dev`.

## Security notes

- The token lives only as a Worker secret, never in the repo or the page.
- The Worker validates cheaply **before** spending a PR, so junk never
  reaches the repo; CI is the authoritative gate before anything can merge.
- Submissions are untrusted: the PR body says so, and the image + text
  should be reviewed before merge. `promote_corpus.py` copies entry fields
  one by one rather than trusting the submission wholesale.
