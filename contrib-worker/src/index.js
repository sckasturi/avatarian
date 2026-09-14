/**
 * The Avatarian corpus contribution Worker.
 *
 * GitHub Pages serves static files and cannot take a write, so the public
 * contribution page (site/contribute.html) cannot save to the repo on its
 * own — and its contributors may have no GitHub account to open a PR with.
 * This Worker is the one small piece of server that closes that gap: it
 * receives a submission, does cheap sanity + anti-spam checks, and opens a
 * pull request on the contributor's behalf using a bot token that never
 * leaves the edge.
 *
 * What it deliberately does NOT do is decide whether a submission is a
 * VALID corpus entry. That authority stays with the python validator
 * (build_corpus.check), which runs as CI on the pull request this opens
 * (see .github/workflows/validate-contrib.yml) and again when a maintainer
 * promotes the submission (tools/promote_corpus.py). So the checks here are
 * only a pre-filter — enough to keep obvious junk and spam from becoming a
 * PR at all. The worst a submission that slips past them can do is be a
 * pull request that fails CI and gets closed. Nothing here can write to the
 * corpus; it can only ever propose.
 *
 * The pull request stages the sighting as one self-contained JSON file
 * under corpus/incoming/ and commits its image into site/sources/ — the
 * two files a maintainer reviews, and exactly what promote_corpus.py folds
 * in on merge.
 *
 * Secrets (wrangler secret put): BOT_TOKEN, TURNSTILE_SECRET.
 * Vars (wrangler.toml [vars]): REPO_OWNER, REPO_NAME, BASE_BRANCH,
 *   ALLOWED_ORIGIN. Binding: RATE (a KV namespace) for per-IP limiting.
 */

const GITHUB = "https://api.github.com";

// Mirror tools/corpus_server.py. The authoritative limits live in python;
// these are the courtesy copies that let the Worker reject early.
const MAX_IMAGE = 24 * 1024 * 1024;
const IMAGE_EXT = {
  "image/png": "png", "image/jpeg": "jpg",
  "image/webp": "webp", "image/gif": "gif",
};
const CONFIDENCE = new Set(["certain", "probable", "unclear"]);

// Anti-spam ceiling per IP per day. A real contributor files a handful; a
// script files thousands. Tune in wrangler.toml if you like.
const RATE_LIMIT_PER_DAY = 10;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    if (request.method === "OPTIONS") return preflight(origin);
    if (request.method !== "POST") {
      return json({ ok: false, error: "POST a submission to /submit." }, 405, origin);
    }
    const url = new URL(request.url);
    if (url.pathname !== "/submit" && url.pathname !== "/") {
      return json({ ok: false, error: "Not found." }, 404, origin);
    }

    try {
      return await handle(request, env, origin);
    } catch (err) {
      // Never leak internals to the page; the detail is in the Worker log.
      console.error("submit failed:", err && err.stack || err);
      return json({ ok: false, error: "The submission service hit an "
        + "unexpected error. Nothing was recorded." }, 500, origin);
    }
  },
};

async function handle(request, env, origin) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // 1. Rate limit (best-effort; if KV is unbound we simply don't limit).
  const limited = await overLimit(env, ip);
  if (limited) {
    return json({ ok: false, error: "You have submitted the daily maximum "
      + "from this connection. Try again tomorrow, or open a pull request "
      + "directly." }, 429, origin);
  }

  // 2. Parse.
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Expected a JSON body." }, 400, origin);
  }

  // 3. Anti-spam challenge. Required whenever a secret is configured.
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstileToken, ip);
    if (!ok) {
      return json({ ok: false, error: "The anti-spam check did not pass. "
        + "Reload the page and try again." }, 400, origin);
    }
  }

  // 4. Cheap validation (pre-filter only; CI is the real gate).
  const problem = validate(body);
  if (problem) return json({ ok: false, error: problem }, 400, origin);

  // 5. Normalise into the staging shape.
  const staged = buildStaged(body, request);

  // 6. Open the pull request.
  const prUrl = await openPullRequest(env, staged);
  await bump(env, ip);
  return json({ ok: true, prUrl }, 200, origin);
}

// ---------------------------------------------------------------------
// Validation (a pre-filter — build_corpus.check is the authority in CI)
// ---------------------------------------------------------------------

function validate(body) {
  const source = body && body.source;
  if (!source || !safeStem(source.name)) {
    return "The source needs a name.";
  }
  const entries = body && body.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return "There are no sightings to submit.";
  }
  if (entries.length > 200) {
    return "That is an implausible number of sightings for one source.";
  }
  for (const e of entries) {
    const key = String(e && e.key || "").trim();
    if (!key) return "A sighting is missing its word.";
    const tokens = String(e && e.spelling || "").split(" ").filter(Boolean);
    if (tokens.length === 0) return `"${key}" has no spelling.`;
    // The whole-blocks rule: two slots per block, so an even count.
    if (tokens.length % 2 !== 0) {
      return `"${key}" has an odd number of symbols — a null is missing.`;
    }
    const conf = e.confidence || "certain";
    if (!CONFIDENCE.has(conf)) {
      return `"${key}" has an unknown confidence "${conf}".`;
    }
  }

  const image = body && body.image;
  if (!image || typeof image.dataUrl !== "string") {
    return "The reference image is missing.";
  }
  const parsed = parseDataUrl(image.dataUrl);
  if (!parsed) return "The image is not a valid data URL.";
  if (!IMAGE_EXT[parsed.mime]) {
    return `${parsed.mime} is not an accepted image type `
      + `(${Object.keys(IMAGE_EXT).join(", ")}).`;
  }
  // base64 decodes to ~3/4 its length; check before allocating.
  if (parsed.base64.length * 0.75 > MAX_IMAGE) {
    return "The image is over the 24 MB limit.";
  }
  return null;
}

// ---------------------------------------------------------------------
// Shape the submission into the staging file + image
// ---------------------------------------------------------------------

function buildStaged(body, request) {
  const name = safeStem(body.source.name);
  const parsed = parseDataUrl(body.image.dataUrl);
  const imageFile = `${name}.${IMAGE_EXT[parsed.mime]}`;

  const entries = body.entries.map((e) => {
    const out = { key: String(e.key).trim(), spelling: String(e.spelling).trim(),
                  source: name, confidence: e.confidence || "certain" };
    if (e.gloss) out.gloss = String(e.gloss).trim();
    const times = parseInt(e.times, 10);
    if (Number.isInteger(times) && times > 1) out.times = times;
    if (e.note) out.note = String(e.note).trim();
    return out;
  });

  // Who read the Avatarian, and who sent it — the reading is the
  // contribution, so `credit` (the reader) rides on the source; the
  // submitter is process metadata that stays in `_submission`.
  const submitter = String(body.submitter || "").trim().slice(0, 80);
  const credit = String(body.source.credit || "").trim().slice(0, 80);

  const submission = {
    _submission: {
      at: new Date().toISOString(),
      via: "contribute.html",
      ua: (request.headers.get("User-Agent") || "").slice(0, 200),
    },
    source: {
      name,
      what: String(body.source.what || "").trim(),
      where: String(body.source.where || "").trim(),
      image: imageFile,
    },
    entries,
  };
  if (submitter) submission._submission.submitter = submitter;
  if (credit) submission.source.credit = credit;

  const words = [...new Set(entries.map((e) => e.key))];
  return {
    name,
    slug: `${name}-${shortId()}`,
    imageFile,
    imageBase64: parsed.base64,
    submissionJson: JSON.stringify(submission, null, 2) + "\n",
    words,
    submitter,
    credit,
  };
}

// ---------------------------------------------------------------------
// GitHub: create a branch, commit the two files, open a PR
// ---------------------------------------------------------------------

async function openPullRequest(env, staged) {
  const owner = env.REPO_OWNER, repo = env.REPO_NAME;
  const base = env.BASE_BRANCH || "main";
  const branch = `contrib/${staged.slug}`;

  // 1. The base branch's current commit.
  const ref = await gh(env, `/repos/${owner}/${repo}/git/ref/heads/${base}`);
  const baseSha = ref.object.sha;

  // 2. A branch off it.
  await gh(env, `/repos/${owner}/${repo}/git/refs`, "POST", {
    ref: `refs/heads/${branch}`, sha: baseSha,
  });

  // 3. The image, committed into site/sources/ (the deployed, committed
  //    copy the corpus page links to, and the one build_corpus.check looks
  //    for). Then the staged submission JSON.
  await putFile(env, owner, repo, branch,
    `site/sources/${staged.imageFile}`, staged.imageBase64,
    `corpus: reference image for ${staged.name} (community submission)`);

  await putFile(env, owner, repo, branch,
    `corpus/incoming/${staged.slug}.json`, utf8ToBase64(staged.submissionJson),
    `corpus: stage ${staged.words.join(", ")} from ${staged.name} `
    + `(community submission)`);

  // 4. The pull request.
  const pr = await gh(env, `/repos/${owner}/${repo}/pulls`, "POST", {
    title: `corpus: ${staged.words.join(", ")} (community submission)`,
    head: branch,
    base,
    body: prBody(staged),
  });
  return pr.html_url;
}

function prBody(staged) {
  return [
    `Community submission from the [contribute page](https://avatarian.techfilmer.com/contribute.html).`,
    ``,
    `**Source:** \`${staged.name}\``,
    `**Words:** ${staged.words.map((w) => `\`${w}\``).join(", ")}`,
    `**Read by:** ${staged.credit ? escapeMd(staged.credit) : "_not stated_"}`,
    `**Submitted by:** ${staged.submitter ? escapeMd(staged.submitter) : "_anonymous_"}`,
    ``,
    `Staged at \`corpus/incoming/${staged.slug}.json\` with its reference `,
    `image at \`site/sources/${staged.imageFile}\`. CI validates it with the `,
    `same \`build_corpus.check\` that guards every other write.`,
    ``,
    `To accept: merge, then \`python3 tools/promote_corpus.py ${staged.slug}.json\` `,
    `folds it into \`corpus/attested.json\` and regenerates \`site/js/corpus.js\`.`,
    ``,
    `_This PR was opened by the contribution Worker on a contributor's `,
    `behalf. Treat the text and image as untrusted until reviewed._`,
  ].join("\n");
}

/** Create-or-update one file on a branch via the Contents API. */
async function putFile(env, owner, repo, branch, path, contentBase64, message) {
  await gh(env, `/repos/${owner}/${repo}/contents/${encodePath(path)}`, "PUT", {
    message, content: contentBase64, branch,
  });
}

async function gh(env, path, method = "GET", payload) {
  const res = await fetch(GITHUB + path, {
    method,
    headers: {
      "Authorization": `Bearer ${env.BOT_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      // GitHub requires a User-Agent on every request.
      "User-Agent": "avatarian-contrib-worker",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${detail}`);
  }
  return res.status === 204 ? {} : res.json();
}

// ---------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip && ip !== "unknown") form.append("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form });
  const data = await res.json().catch(() => ({ success: false }));
  return !!data.success;
}

// ---------------------------------------------------------------------
// Rate limiting (KV; a no-op if the RATE binding is absent)
// ---------------------------------------------------------------------

function rateKey(ip) {
  const day = new Date().toISOString().slice(0, 10);
  return `rl:${ip}:${day}`;
}

async function overLimit(env, ip) {
  if (!env.RATE) return false;
  const n = parseInt(await env.RATE.get(rateKey(ip)), 10) || 0;
  return n >= RATE_LIMIT_PER_DAY;
}

async function bump(env, ip) {
  if (!env.RATE) return;
  const key = rateKey(ip);
  const n = (parseInt(await env.RATE.get(key), 10) || 0) + 1;
  // Expire a little after the day rolls over, so the counter self-cleans.
  await env.RATE.put(key, String(n), { expirationTtl: 60 * 60 * 26 });
}

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

/** Mirror tools/corpus_server.py safe_stem: keep it a recognisable name. */
function safeStem(name) {
  let stem = String(name || "").trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .replace(/\.(png|jpe?g|webp|gif|heic|tiff?)$/i, "");
  return stem.slice(0, 60);
}

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Neutralise a stranger's name/handle before it goes into the PR body:
 * one line, markdown punctuation escaped, and `@`/`#` defanged so a
 * submission cannot mass-mention or cross-reference through the credit.
 */
function escapeMd(s) {
  return String(s || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\`*_{}\[\]()#+\-.!|<>~@]/g, (c) => "\\" + c)
    .slice(0, 120);
}

function parseDataUrl(s) {
  const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(s || "");
  return m ? { mime: m[1], base64: m[2] } : null;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function preflight(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
