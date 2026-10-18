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
 * Auth is a GitHub App: it signs a short JWT with the App's private key,
 * exchanges it for an installation token scoped to this one repo, and opens
 * the PR as the App's bot. Nothing long-lived is stored.
 *
 * Secret (wrangler secret put): GH_APP_PRIVATE_KEY (the App's .pem).
 * Vars (wrangler.toml [vars]): GH_APP_ID, REPO_OWNER, REPO_NAME,
 *   BASE_BRANCH, ALLOWED_ORIGIN. Binding: RATE (a KV namespace) for
 *   per-IP limiting (optional).
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

// Marks that stand a full block beside the writing rather than filling a
// paired slot: the sentence punctuation, the hyphen, and the possessive `'s`.
// They are not counted toward the even-blocks rule — mirrors
// build_corpus.py's PUNCTUATION, so a spelling the corpus accepts (e.g. the
// possessive "she's" -> `ʃ i 's`) is not rejected here first.
const PUNCTUATION = new Set([",", ".", "?", "!", "--", "'s"]);

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
      // Never leak internals to the page; the detail is in the Worker log
      // (wrangler tail). Credential/permission failures on the GitHub side
      // surface here as a generic message on purpose.
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

// A submission is a BATCH of images under a category. Accept the new shape
// {category, sources:[{what,where,confidence,credit,entries,image,slide}, …]}
// and the legacy single shape {source, entries, image} as a batch of one, so
// an old page still works.
function inputSources(body) {
  if (Array.isArray(body && body.sources)) return body.sources;
  if (body && body.source) {
    return [{
      what: body.source.what, where: body.source.where,
      confidence: body.source.confidence, credit: body.source.credit,
      entries: body.entries, image: body.image,
    }];
  }
  return [];
}

function validate(body) {
  const sources = inputSources(body);
  if (!sources.length) return "The submission has no images.";
  if (sources.length > 24) return "That is too many images for one submission.";

  let totalBytes = 0;
  for (const src of sources) {
    const where = src && src.where
      ? `"${String(src.where).slice(0, 40)}"` : "an image";
    const entries = src && src.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return `${where} has no sightings.`;
    }
    if (entries.length > 200) {
      return `${where} has an implausible number of sightings.`;
    }
    for (const e of entries) {
      const key = String(e && e.key || "").trim();
      if (!key) return `A sighting on ${where} is missing its word.`;
      const tokens = String(e && e.spelling || "").split(" ").filter(Boolean);
      if (tokens.length === 0) return `"${key}" has no spelling.`;
      // The whole-blocks rule: two slots per block, so an even count — but
      // marks (punctuation, the possessive 's) are not slots, so they don't
      // count, exactly as build_corpus.py decides it in CI.
      const slots = tokens.filter((t) => !PUNCTUATION.has(t));
      if (slots.length % 2 !== 0) {
        return `"${key}" has an odd number of symbols — a null is missing.`;
      }
      const conf = e.confidence || "certain";
      if (!CONFIDENCE.has(conf)) {
        return `"${key}" has an unknown confidence "${conf}".`;
      }
    }

    const image = src && src.image;
    if (!image || typeof image.dataUrl !== "string") {
      return `${where} is missing its reference image.`;
    }
    const parsed = parseDataUrl(image.dataUrl);
    if (!parsed) return `${where}'s image is not a valid data URL.`;
    if (!IMAGE_EXT[parsed.mime]) {
      return `${parsed.mime} is not an accepted image type `
        + `(${Object.keys(IMAGE_EXT).join(", ")}).`;
    }
    // base64 decodes to ~3/4 its length; check before allocating.
    const bytes = parsed.base64.length * 0.75;
    if (bytes > MAX_IMAGE) return `${where}'s image is over the 24 MB limit.`;
    totalBytes += bytes;
  }
  if (totalBytes > MAX_IMAGE * 3) {
    return "The whole batch is too large — submit fewer images at a time.";
  }
  if (body && body.category && !safeStem(body.category)) {
    return "The category has no usable characters.";
  }
  return null;
}

// ---------------------------------------------------------------------
// Shape the submission into the staging file + image
// ---------------------------------------------------------------------

function buildStaged(body, request) {
  const batchId = shortId();
  const sources = inputSources(body);
  // The category is the shared prefix; each image is <category>.<slide>. With
  // no category the maintainer still names it, so each gets a unique
  // placeholder that is clearly "needs naming".
  const cat = safeStem(body && body.category);
  const submitter = String(body && body.submitter || "").trim().slice(0, 80);
  const at = new Date().toISOString();
  const ua = (request.headers.get("User-Agent") || "").slice(0, 200);

  const items = sources.map((src, i) => {
    const slide = Number.isInteger(src.slide) && src.slide > 0 ? src.slide : i + 1;
    const name = cat ? `${cat}.${slide}` : `submission-${batchId}-${i + 1}`;
    const parsed = parseDataUrl(src.image.dataUrl);
    const imageFile = `${name}.${IMAGE_EXT[parsed.mime]}`;
    const credit = String(src.credit || "").trim().slice(0, 80);

    const entries = (src.entries || []).map((e) => {
      const out = { key: String(e.key).trim(), spelling: String(e.spelling).trim(),
                    source: name, confidence: e.confidence || "certain" };
      if (e.gloss) out.gloss = String(e.gloss).trim();
      const times = parseInt(e.times, 10);
      if (Number.isInteger(times) && times > 1) out.times = times;
      if (e.note) out.note = String(e.note).trim();
      return out;
    });

    const submission = {
      _submission: { at, via: "contribute.html", ua, batch: batchId },
      source: {
        name,
        what: String(src.what || "").trim(),
        where: String(src.where || "").trim(),
        image: imageFile,
      },
      entries,
    };
    if (submitter) submission._submission.submitter = submitter;
    if (credit) submission.source.credit = credit;

    return {
      name,
      slug: name,                      // corpus/incoming/<name>.json
      imageFile,
      imageBase64: parsed.base64,
      submissionJson: JSON.stringify(submission, null, 2) + "\n",
      words: [...new Set(entries.map((e) => e.key))],
      credit,
    };
  });

  return {
    category: cat,
    // The PR branch, unique per submission. It carries the batch id so two
    // submissions never share a branch: a fixed name like contrib/<category>
    // (or the old, broken contrib/undefined — buildStaged returned branchSlug
    // while openPullRequest read staged.slug) makes GitHub reject the second
    // one with "reference already exists", which reaches the contributor only
    // as an opaque 500. The review console matches on the `contrib/` prefix,
    // not the rest, so the id is free to vary.
    branch: `contrib/${cat ? `${cat}-` : "submission-"}${batchId}`,
    items,
    submitter,
  };
}

// ---------------------------------------------------------------------
// GitHub: create a branch, commit the two files, open a PR
// ---------------------------------------------------------------------

async function openPullRequest(env, staged) {
  const owner = env.REPO_OWNER, repo = env.REPO_NAME;
  const base = env.BASE_BRANCH || "main";
  const branch = staged.branch;

  // A short-lived installation token for the GitHub App — minted per
  // request, never stored. The App is the bot identity the PR is opened
  // as, so nothing here rides on anyone's personal token.
  const token = await installationToken(env);

  // 1. The base branch's current commit.
  const ref = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${base}`);
  const baseSha = ref.object.sha;

  // 2. A branch off it.
  await gh(token, `/repos/${owner}/${repo}/git/refs`, "POST", {
    ref: `refs/heads/${branch}`, sha: baseSha,
  });

  // 3. Each image into site/sources/ (the deployed copy the corpus page
  //    links to and build_corpus.check looks for), then its staged JSON.
  for (const item of staged.items) {
    await putFile(token, owner, repo, branch,
      `site/sources/${item.imageFile}`, item.imageBase64,
      `corpus: reference image for ${item.name} (community submission)`);
    await putFile(token, owner, repo, branch,
      `corpus/incoming/${item.slug}.json`, utf8ToBase64(item.submissionJson),
      `corpus: stage ${item.words.join(", ")} from ${item.name} `
      + `(community submission)`);
  }

  // 4. One pull request for the whole batch.
  const n = staged.items.length;
  const title = n > 1
    ? `corpus: ${staged.category || staged.items[0].name} (${n} images, community submission)`
    : `corpus: ${staged.items[0].words.join(", ")} (community submission)`;
  const pr = await gh(token, `/repos/${owner}/${repo}/pulls`, "POST", {
    title, head: branch, base, body: prBody(staged),
  });
  return pr.html_url;
}

function prBody(staged) {
  const n = staged.items.length;
  const lines = [
    `Community submission from the [contribute page](https://avatarian.techfilmer.com/contribute.html).`,
    ``,
  ];
  if (staged.category) {
    lines.push(`**Category:** \`${staged.category}\` · ${n} image${n === 1 ? "" : "s"}`);
  }
  lines.push(`**Submitted by:** ${staged.submitter ? escapeMd(staged.submitter) : "_anonymous_"}`, ``);
  for (const item of staged.items) {
    lines.push(`- \`${item.name}\` — ${item.words.map((w) => `\`${w}\``).join(", ")}`
      + (item.credit ? ` · read by ${escapeMd(item.credit)}` : ""));
  }
  lines.push(
    ``,
    `Each is staged at \`corpus/incoming/<name>.json\` with its image at `,
    `\`site/sources/<name>.<ext>\`. CI validates with the same `,
    `\`build_corpus.check\` that guards every other write.`,
    ``,
    `To accept: merge, then promote each with `,
    `\`python3 tools/promote_corpus.py <name>.json --name <name>\` — or use the `,
    `review console's "approve all".`,
    ``,
    `_Opened by the contribution Worker on a contributor's behalf. Treat the `,
    `text and images as untrusted until reviewed._`);
  return lines.join("\n");
}

/** Create-or-update one file on a branch via the Contents API. */
async function putFile(token, owner, repo, branch, path, contentBase64, message) {
  await gh(token, `/repos/${owner}/${repo}/contents/${encodePath(path)}`, "PUT", {
    message, content: contentBase64, branch,
  });
}

/**
 * One GitHub REST call. `token` is either the App JWT (for the two
 * app-level endpoints) or an installation token (for everything else) —
 * both are sent as Bearer.
 */
async function gh(token, path, method = "GET", payload) {
  const res = await fetch(GITHUB + path, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
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
// GitHub App authentication
// ---------------------------------------------------------------------
//
// The Worker acts as a GitHub App, not a personal token: it signs a short
// JWT with the App's private key, exchanges it for an installation token
// scoped to the one repo the App is installed on, and uses that. Tokens
// live ~1h and are minted per request, so nothing long-lived is stored
// and the PR is authored by the App's bot identity.

async function installationToken(env) {
  if (!env.GH_APP_ID || !env.GH_APP_PRIVATE_KEY) {
    throw new Error("GitHub App not configured (GH_APP_ID / GH_APP_PRIVATE_KEY)");
  }
  const jwt = await appJwt(env);
  // Resolve the installation from the repo itself, so no installation id
  // has to be configured by hand.
  const inst = await gh(jwt,
    `/repos/${env.REPO_OWNER}/${env.REPO_NAME}/installation`);
  const res = await gh(jwt,
    `/app/installations/${inst.id}/access_tokens`, "POST");
  return res.token;
}

/** A signed App JWT (RS256), valid ~9 minutes. */
async function appJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = strToB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // iat backdated 60s to tolerate clock skew; exp within the 10-min cap.
  const payload = strToB64url(JSON.stringify({
    iat: now - 60, exp: now + 540, iss: String(env.GH_APP_ID),
  }));
  const data = `${header}.${payload}`;
  const key = await importPrivateKey(env.GH_APP_PRIVATE_KEY);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(data));
  return `${data}.${bytesToB64url(new Uint8Array(sig))}`;
}

/**
 * Import the App's PEM private key for signing. GitHub hands out a PKCS#1
 * key ("BEGIN RSA PRIVATE KEY"), which WebCrypto can't import directly, so
 * it is wrapped into PKCS#8 first; a key already in PKCS#8 ("BEGIN PRIVATE
 * KEY") is imported as-is. So you can paste GitHub's .pem verbatim.
 */
async function importPrivateKey(pem) {
  const isPkcs8 = /BEGIN PRIVATE KEY/.test(pem);
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const der = b64ToBytes(body);
  const pkcs8 = isPkcs8 ? der : wrapPkcs1ToPkcs8(der);
  return crypto.subtle.importKey(
    "pkcs8", pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

/** DER length bytes (short form under 128, else long form). */
function derLen(n) {
  if (n < 0x80) return [n];
  const out = [];
  let x = n;
  while (x > 0) { out.unshift(x & 0xff); x >>= 8; }
  return [0x80 | out.length, ...out];
}

/** Wrap a PKCS#1 RSAPrivateKey (DER) into a PKCS#8 PrivateKeyInfo (DER). */
function wrapPkcs1ToPkcs8(pkcs1) {
  const version = [0x02, 0x01, 0x00];
  // AlgorithmIdentifier: rsaEncryption (1.2.840.113549.1.1.1) + NULL.
  const algId = [0x30, 0x0d, 0x06, 0x09,
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length), ...pkcs1];
  const bodyLen = version.length + algId.length + octet.length;
  const seq = [0x30, ...derLen(bodyLen), ...version, ...algId, ...octet];
  return new Uint8Array(seq);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToB64url(s) {
  return bytesToB64url(new TextEncoder().encode(s));
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
