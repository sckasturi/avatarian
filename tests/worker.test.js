/**
 * The contribution Worker's pure pieces: the pre-filter, the staging of a
 * submission into files, and the text it writes into a pull request.
 *
 * The Worker is the one part of the project strangers can reach, and none
 * of it was under test. What is checked here is everything that does not
 * need GitHub or the Workers runtime: `validate` (what is refused before a
 * PR exists), `buildStaged` (what the PR will contain), and the escaping of
 * a stranger's text on its way into a title, a commit subject and a PR body.
 *
 * Run:  node --test tests/worker.test.js
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const WORKER = pathToFileURL(
  path.resolve(__dirname, "..", "contrib-worker", "src", "index.js")).href;
const load = async () => (await import(WORKER)).default.internals;

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const request = { headers: { get: () => "test-agent" } };

function source(over = {}) {
  return {
    what: "a sign", where: "episode 1", confidence: "certain",
    image: { dataUrl: PNG },
    entries: [{ key: "fire", spelling: "f aɪ ə ɹ" }],
    ...over,
  };
}

test("a well-formed submission passes the pre-filter", async () => {
  const { validate } = await load();
  assert.equal(validate({ sources: [source()] }), null);
  // The older single-source shape is still accepted.
  const s = source();
  assert.equal(validate({ source: s, entries: s.entries, image: s.image }), null);
});

test("the pre-filter refuses the obvious junk", async () => {
  const { validate } = await load();
  assert.match(validate({}), /no images/);
  assert.match(validate({ sources: [source({ entries: [] })] }), /no sightings/);
  assert.match(validate({ sources: [source({ image: null })] }), /missing its reference image/);
  assert.match(validate({ sources: [source({ image: { dataUrl: "data:image/svg+xml;base64,AA==" } })] }),
    /not an accepted image type/);
  assert.match(validate({ sources: [source({ entries: [{ key: "x", spelling: "f aɪ ə" }] })] }),
    /odd number of symbols/);
  assert.match(validate({ sources: [source({ entries: [{ key: "", spelling: "f aɪ" }] })] }),
    /missing its word/);
  assert.match(validate({ sources: [source({ entries: [{ key: "x", spelling: "f aɪ", confidence: "sure" }] })] }),
    /unknown confidence/);
  assert.match(validate({ sources: Array.from({ length: 25 }, () => source()) }), /too many images/);
});

test("punctuation does not count toward the whole-blocks rule", async () => {
  const { validate } = await load();
  const entries = [{ key: "fire!", spelling: "f aɪ ə ɹ !" }];
  assert.equal(validate({ sources: [source({ entries })] }), null);
});

test("a colon is punctuation, as it is for the validator", async () => {
  const { validate } = await load();
  const entries = [{ key: "note", spelling: "n oʊ t ∅ :" }];
  assert.equal(validate({ sources: [source({ entries })] }), null);
});

test("free text has a ceiling", async () => {
  const { validate } = await load();
  const long = "x".repeat(600);
  assert.match(validate({ sources: [source({ what: long })] }), /"what" text .* too long/);
  assert.match(validate({ sources: [source({ entries: [{ key: "k", spelling: "f aɪ", note: long }] })] }),
    /note that is too long/);
  assert.match(validate({ submitter: long, sources: [source()] }), /name is too long/);
});

test("an image must be the type it claims", async () => {
  const { validate, sniffImage } = await load();
  const html = "data:image/png;base64," + Buffer.from("<html><script>x</script>").toString("base64");
  assert.match(validate({ sources: [source({ image: { dataUrl: html } })] }), /not a valid png file/);
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  assert.equal(sniffImage(b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), "image/png");
  assert.equal(sniffImage(b64([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  assert.equal(sniffImage(b64([...Buffer.from("GIF89a"), 0, 0, 0, 0, 0, 0])), "image/gif");
  assert.equal(sniffImage(b64([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP")])), "image/webp");
  assert.equal(sniffImage("!!!"), null);
});

test("two images numbered alike are refused before GitHub is touched", async () => {
  const { validate } = await load();
  const body = { category: "reddit", sources: [source({ slide: 2 }), source({ slide: 2 })] };
  assert.match(validate(body), /both numbered 2/);
  body.sources[1].slide = 3;
  assert.equal(validate(body), null);
});

test("a batch is staged as <category>.<slide>, image beside it", async () => {
  const { buildStaged } = await load();
  const staged = buildStaged({
    category: "My Source!", submitter: "someone",
    sources: [source(), source({ slide: 5, credit: "a reader" })],
  }, request);
  assert.deepEqual(staged.items.map((i) => i.name), ["My-Source.1", "My-Source.5"]);
  assert.deepEqual(staged.items.map((i) => i.imageFile), ["My-Source.1.png", "My-Source.5.png"]);
  assert.match(staged.branch, /^contrib\/My-Source-[a-z0-9]+$/);
  const submission = JSON.parse(staged.items[1].submissionJson);
  assert.equal(submission.source.name, "My-Source.5");
  assert.equal(submission.source.credit, "a reader");
  assert.equal(submission.entries[0].source, "My-Source.5");
  assert.equal(submission._submission.submitter, "someone");
});

test("an uncategorised submission gets a placeholder name", async () => {
  const { buildStaged } = await load();
  const staged = buildStaged({ sources: [source()] }, request);
  assert.match(staged.items[0].name, /^submission-[a-z0-9]+-1$/);
  assert.match(staged.branch, /^contrib\/submission-[a-z0-9]+$/);
});

test("a stranger's word cannot break out of the pull request text", async () => {
  const { buildStaged, prTitle, prBody } = await load();
  const key = "fire`\n@everyone ![x](http://evil)";
  const staged = buildStaged({
    submitter: "@org/team\n# heading",
    sources: [source({ entries: [{ key, spelling: "f aɪ ə ɹ" }] })],
  }, request);
  const title = prTitle(staged);
  assert.ok(!title.includes("\n"));
  const body = prBody(staged);
  const wordLine = body.split("\n").find((l) => l.startsWith("- `"));
  // name span + one span for the one word: exactly four backticks.
  assert.equal(wordLine.split("`").length - 1, 4);
  assert.ok(body.includes("\\@org/team"));
  assert.ok(!/^# heading/m.test(body));
});

test("long text is cut to one bounded line", async () => {
  const { oneLine, codeSpan } = await load();
  assert.equal(oneLine("a\n b\t c"), "a b c");
  assert.equal(oneLine("x".repeat(500)).length, 200);
  assert.equal(codeSpan("a`b\nc"), "a b c");
});

test("safeStem keeps a recognisable, path-safe name", async () => {
  const { safeStem } = await load();
  assert.equal(safeStem("../../etc/passwd"), "etc-passwd");
  assert.equal(safeStem("photo.PNG"), "photo");
  assert.equal(safeStem("  "), "");
});

test("a PKCS#1 key is wrapped into a well-formed PKCS#8 envelope", async () => {
  const { wrapPkcs1ToPkcs8, derLen } = await load();
  assert.deepEqual(derLen(5), [5]);
  assert.deepEqual(derLen(300), [0x82, 0x01, 0x2c]);
  const inner = new Uint8Array(300).fill(7);
  const out = wrapPkcs1ToPkcs8(inner);
  assert.equal(out[0], 0x30);                              // SEQUENCE
  assert.deepEqual([...out.slice(-300)], [...inner]);      // key rides at the end
  assert.equal(out.length, 4 + 3 + 15 + 4 + 300);
});
