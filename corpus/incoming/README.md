# corpus/incoming — the public submission staging area

Files here are **community submissions waiting for review**, one JSON file
per submission. They are the intake queue for the public contribution page
([site/contribute.html](../../site/contribute.html)); nothing in `tools/`
or `site/` reads them, exactly like `corpus/uncatalogued/`. They only
matter to two things:

- **CI** (`.github/workflows/validate-contrib.yml`) — when a pull request
  adds or changes a file here, CI folds it into a copy of
  `corpus/attested.json` in memory and runs `build_corpus.check` on the
  result, so a submission that would break the corpus fails the check
  before it can be merged.
- **`tools/promote_corpus.py`** — after you merge a submission, this folds
  its source and entries into `corpus/attested.json`, regenerates
  `site/js/corpus.js` (through the same `build_corpus.save` every other
  write uses), and deletes the file from here. Submissions arrive with a
  **placeholder source name** (`submission-<id>`) — the contribute page no
  longer asks contributors to name the source — so name it as you promote:
  `python3 tools/promote_corpus.py submission-<id>.json --name toph-letter`.

## Where these come from

The Cloudflare Worker in [`contrib-worker/`](../../contrib-worker) receives
a submission from the contribute page, commits the reference image into
`site/sources/`, writes one file here, and opens a pull request. The whole
point of the staging file is that the Worker never has to safely mutate the
canonical `attested.json` — it just drops a self-contained record, and the
fold into the real corpus is a reviewed, validated step you run.

## File shape

Self-contained, so it can be validated and promoted on its own. The
`source` block is keyed the same as an `attested.json` source; the entries
are ordinary corpus entries (finished block structure, flattened two slots
per block, in IPA — see [CORPUS.md](../../CORPUS.md)).

```json
{
  "_submission": {
    "at": "2026-09-14T10:45:00Z",
    "via": "contribute.html",
    "submitter": "…optional name/handle of who sent it…",
    "ua": "…optional user-agent…"
  },
  "source": {
    "name": "submission-ab12cd",
    "what": "A poster on the wall of the metalbending academy. “Cherries on top!”",
    "where": "movie (04:08) or a link to the post",
    "credit": "…optional name/handle of who READ the Avatarian…",
    "image": "submission-ab12cd.png"
  },
  "entries": [
    { "key": "cherries", "spelling": "tʃ ɛ ɹ i z ∅", "source": "fanny-poster",
      "confidence": "certain", "gloss": "cherries" }
  ]
}
```

`_submission` is process metadata (who sent it, when) and is **not** folded
into the corpus. `source.credit` — who did the reading, which is the actual
contribution — **is** carried through into `attested.json` by
`promote_corpus.py`.

`source.image` must name a file that exists in `site/sources/` — the Worker
commits it there in the same pull request, and `build_corpus.check`
requires it, so a submission whose image is missing fails CI.
