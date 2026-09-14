# contrib-worker — the corpus contribution backend

A small Cloudflare Worker that lets someone submit an Avatarian sighting
from [`site/contribute.html`](../site/contribute.html) — without a GitHub
account — and have it become a pull request a maintainer reviews.

It is the one piece of server in an otherwise static, GitHub-Pages-hosted
project, and it exists for exactly one reason: Pages cannot take a write,
and a contributor without a GitHub account cannot open a PR. The Worker
authenticates as a **GitHub App**, does cheap sanity checks, and opens the
PR as the App's bot. It **cannot write to the corpus** — it can only
propose. The real validation is `build_corpus.check`, which runs as CI on
the PR ([`.github/workflows/validate-contrib.yml`](../.github/workflows/validate-contrib.yml))
and again at promote time ([`tools/promote_corpus.py`](../tools/promote_corpus.py)).

```
contribute.html ──POST /submit──▶ this Worker ──GitHub App──▶ PR
                                   (installation token)        (corpus/incoming/<slug>.json
                                                                + site/sources/<image>)
                                                              │
                        CI: promote_corpus.py --check + tests │  you review & merge
                                                              ▼
                        python3 tools/promote_corpus.py <slug>.json  → attested.json
```

## What it does per request

1. **Rate-limit** the caller's IP (KV, `RATE_LIMIT_PER_DAY` per day; skipped
   if no KV binding is configured).
2. **Cheap validation** — a pre-filter only: source name present, each
   spelling an even token count, confidence known, image an accepted type
   under 24 MB. Drawability and the rest are left to CI's `build_corpus.check`.
3. **Open the PR** as the GitHub App: mint a short-lived installation token,
   create a `contrib/<slug>` branch, commit the image to `site/sources/`,
   stage the submission at `corpus/incoming/<slug>.json`, and open a pull
   request against `main`.

Nothing auto-merges. Every submission is a PR you approve, and CI must pass.

## One-time setup

You need a Cloudflare account and [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
(`npm i -g wrangler`, then `wrangler login`).

### 1. Point the Worker at your repo

Edit [`wrangler.toml`](./wrangler.toml): set `REPO_OWNER`, `REPO_NAME`, and
`ALLOWED_ORIGIN` (your site's origin). `BASE_BRANCH` defaults to `main`.

### 2. Create a GitHub App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**:

- **Name:** anything, e.g. `Avatarian Corpus Bot` (this becomes the PR
  author, shown as `avatarian-corpus-bot[bot]`).
- **Homepage URL:** anything (your site is fine).
- **Webhook:** untick **Active** — no webhook is needed.
- **Repository permissions:** **Contents → Read and write**, and
  **Pull requests → Read and write**. Nothing else.
- **Where can this app be installed:** *Only on this account*.
- Create it.

Then, on the App's page:

- Note the **App ID** (a number near the top) → put it in `wrangler.toml`'s
  `GH_APP_ID`.
- Under **Private keys**, **Generate a private key** — it downloads a `.pem`.
- **Install App** (left sidebar) → install on your account → **Only select
  repositories** → pick **`avatarian`**.

### 3. Store the private key as a Worker secret

Pipe the downloaded `.pem` straight in (a multi-line value is awkward to
paste by hand):

```bash
cd contrib-worker
wrangler secret put GH_APP_PRIVATE_KEY < ~/Downloads/avatarian-corpus-bot.*.private-key.pem
```

The key can be GitHub's PKCS#1 (`BEGIN RSA PRIVATE KEY`) verbatim — the
Worker converts it. Keep the `.pem` somewhere safe or delete it; the secret
now lives only in Cloudflare.

### 4. Rate-limit store (optional)

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
  repo: "sckasturi/avatarian",   // powers the "open the PR yourself" link
  baseBranch: "main",
};
```

Commit that change; Pages redeploys and the page is live.

### 6. Clean up any old secrets

If you experimented with the earlier personal-token / Turnstile setup,
remove those secrets — they are unused now:

```bash
wrangler secret delete BOT_TOKEN
wrangler secret delete TURNSTILE_SECRET   # if it still exists
```

## Local development

```bash
wrangler dev
```

`wrangler dev` serves the Worker on `http://localhost:8787`. To exercise the
real PR path, put the App's key in a local `.dev.vars` (gitignored) and set
the App ID:

```
GH_APP_ID = "123456"
GH_APP_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

A sample request (opens a real PR — use a throwaway branch/repo):

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

## Files

- `src/index.js` — the Worker.
- `wrangler.toml` — repo + origin config, `GH_APP_ID`, and the KV binding.
- `package.json` — pins `wrangler` for `npm run deploy` / `npm run dev`.

## Security notes

- No long-lived credential is stored: the Worker signs a short JWT with the
  App key and mints an installation token (~1h) per request. Only the App's
  private key is a secret, and it never leaves Cloudflare or touches the repo.
- The App is scoped to this one repo with just Contents + Pull requests
  write — it can't touch anything else in your account.
- The Worker validates cheaply **before** spending a PR, so junk never
  reaches the repo; CI is the authoritative gate before anything can merge.
- Submissions are untrusted: the PR body says so, and the image + text
  should be reviewed before merge. `promote_corpus.py` copies entry fields
  one by one rather than trusting the submission wholesale.
