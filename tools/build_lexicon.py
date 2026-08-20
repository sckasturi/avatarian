#!/usr/bin/env python3
"""
Turn the CMU Pronouncing Dictionary into site/js/lexicon.js.

    python3 tools/build_lexicon.py path/to/cmudict.dict

Why this exists
---------------

`g2p.js` guesses a pronunciation from spelling. It is decent on regular
English and wrong on a lot of ordinary words — on a 22-word test sentence
it got 13 wrong, including `measure`, `good` and `that`. A technical user
shrugs and edits the sounds box; everyone else just sees the wrong
answer. So the guesser becomes the FALLBACK and a real lexicon goes in
front of it.

The dictionary is not committed. This script reads it and emits the
generated JS; re-run it if you want to rebuild.

    CMU Pronouncing Dictionary, BSD-style licence.
    https://github.com/cmusphinx/cmudict

Mapping ARPAbet onto THIS project's phoneme set
-----------------------------------------------

CMU's inventory is not the one the glyph set is built on, so this is a
deliberate mapping rather than a substitution. Three decisions:

  AH0 -> ə   but AH1/AH2 -> ʌ
      CMU writes both the STRUT vowel and schwa as AH, separated only by
      stress. This project keeps them as different glyphs (`uh` vs
      `schwa`), so the stress digit is what tells them apart — and it is
      also what finally gives the site unstressed-vowel reduction, which
      the rule-based converter never modelled. "metalbending" comes out
      /m ɛ t ə l .../ instead of /m ɛ t æ l .../.

  ER  -> ə r
      CMU's ER is the r-coloured /ɝ/, one phoneme. `g2p.js` deliberately
      emits /ə/ with /r/ as a SEPARATE segment ("bird" -> ə r), because
      the vowel glyph carries no r-colouring. Splitting it here
      keeps the glyph set's distinction intact. Without this the lexicon
      would quietly stop ever emitting /r/ after that vowel.

  stress digits are otherwise dropped
      Nothing downstream reads stress, and keeping it would triple the
      distinct-symbol count for no gain.

/x/ never appears: CMU has no such phone, and it is the one sound with no
glyph anyway.

Size
----

The whole dictionary ships. It has to be inline — `fetch()` is
CORS-blocked on `file://` origins, which is why manifest.js is built this
way too — so two things keep it down:

  * phonemes are one character each, through a compact alphabet;
  * words are FRONT-CODED against the previous entry, which on a sorted
    list takes the word column from 1045 KB to 415 KB.

That lands at ~1.3 MB raw, ~500 KB over the wire once a host gzips it.

`--only-exceptions` would drop the ~20%% of entries the rules already get
right, but it is deliberately NOT the default: an 18%% saving isn't worth
tying this file's correctness to the exact current state of RULES in
g2p.js, where a later rule edit would silently change those words with
nothing to catch it.
"""

import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "js" / "lexicon.js"
G2P = ROOT / "site" / "js" / "g2p.js"

# ARPAbet -> this project's IPA, for reading the CMU dictionary (which is
# natively ARPAbet). Standalone — this is the only ARPAbet the project
# keeps, at build time; the two vowels that need more than a lookup are
# handled in `phones_to_ipa` below.
ARPA = {
    "AA": "ɑ", "AE": "æ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "EH": "ɛ", "EY": "e", "IH": "ɪ", "IY": "i", "OW": "oʊ",
    "OY": "ɔɪ", "UH": "ʊ", "UW": "u",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "g",
    "HH": "h", "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n",
    "NG": "ŋ", "P": "p", "R": "r", "S": "s", "SH": "ʃ", "T": "t",
    "TH": "θ", "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}

STRESS = re.compile(r"[012]$")
# Entries that aren't words anyone types: variants, and the punctuation
# CMU carries for speech work.
VARIANT = re.compile(r"\(\d+\)$")
WORD_OK = re.compile(r"^[a-z][a-z'.-]*$")


def phones_to_ipa(phones):
    """One CMU pronunciation -> a list of this project's IPA symbols."""
    out = []
    for p in phones:
        base = STRESS.sub("", p)
        stress = p[len(base):]
        if base == "AH":
            # The whole reason stress is read at all: unstressed AH is
            # schwa, stressed AH is STRUT, and they are separate glyphs.
            out.append("ə" if stress == "0" else "ʌ")
        elif base == "ER":
            # r-coloured in CMU, two segments here.
            out.extend(("ə", "r"))
        else:
            ipa = ARPA.get(base)
            if ipa is None:
                return None          # a tag like `#` or a foreign marker
            out.append(ipa)
    return out


def read_cmudict(path):
    """word -> [ipa], primary pronunciation only."""
    words = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.split("#")[0].strip()          # drop CMU's own comments
        if not line:
            continue
        head, *phones = line.split()
        if VARIANT.search(head):
            continue                               # keep one pronunciation
        word = head.lower()
        if not WORD_OK.match(word):
            continue
        ipa = phones_to_ipa(phones)
        if ipa:
            words.setdefault(word, ipa)
    return words


def rule_guesses(words):
    """What g2p.js's rules produce for each word, so entries it already
    gets right can be left out. Run through node in one batch — calling
    per word would take minutes."""
    script = f"""
      const g2p = require({json.dumps(str(G2P))});
      const words = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const out = {{}};
      for (const w of words) {{
        try {{ out[w] = g2p.wordToIPA(w); }} catch (e) {{ out[w] = null; }}
      }}
      process.stdout.write(JSON.stringify(out));
    """
    res = subprocess.run(["node", "-e", script],
                         input=json.dumps(sorted(words)),
                         capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmudict", type=pathlib.Path)
    ap.add_argument("--only-exceptions", action="store_true",
                    help="drop entries the rule-based guesser already gets "
                         "right. Saves ~18%% and is FRAGILE: it ties this "
                         "file's correctness to the exact current RULES in "
                         "g2p.js, so editing a rule later would silently "
                         "change those words with no signal. Not the default.")
    args = ap.parse_args()

    words = read_cmudict(args.cmudict)
    print(f"read {len(words)} words")

    kept = words
    if args.only_exceptions:
        guesses = rule_guesses(words)
        kept = {w: ipa for w, ipa in words.items() if guesses.get(w) != ipa}
        print(f"rules already correct for {len(words) - len(kept)}; "
              f"lexicon needs {len(kept)}")

    # One character per phoneme. Printable ASCII minus the two that would
    # need escaping inside the JSON string (" and \) and the two used as
    # separators in the body (space and newline) — those are already
    # below 33. Skipping them keeps the emitted file free of backslashes,
    # which is worth more than the two code points it costs.
    alphabet_pool = [chr(c) for c in range(33, 127) if chr(c) not in '"\\']
    symbols = sorted({s for ipa in kept.values() for s in ipa})
    assert len(symbols) <= len(alphabet_pool), f"{len(symbols)} symbols"
    code = {s: alphabet_pool[i] for i, s in enumerate(symbols)}
    code_index = {c: i for i, c in enumerate(alphabet_pool)}

    # Front-coding. The list is sorted, so most words share a long prefix
    # with the one before ("abandon", "abandoned", "abandoning"). Each
    # line stores how many leading characters to reuse, as a single
    # character, then only the rest. On the full dictionary this takes
    # the word column from 1045 KB to 415 KB.
    #
    # The count character is a CONTIGUOUS range (n = code - COUNT_SHIFT),
    # so it cannot reuse `alphabet_pool` — that skips " and \, which would
    # make every count above the gap decode one too high. Starting at '&'
    # keeps the whole range clear of both without any skipping; the cap
    # is well past the longest word in the dictionary.
    COUNT_SHIFT = 38                      # '&'
    MAX_SHARED = ord("\\") - 1 - COUNT_SHIFT      # 53, stays below backslash

    lines, prev = [], ""
    for w, ipa in sorted(kept.items()):
        n = 0
        limit = min(len(w), len(prev), MAX_SHARED)
        while n < limit and w[n] == prev[n]:
            n += 1
        lines.append(f"{chr(COUNT_SHIFT + n)}{w[n:]} "
                     f"{''.join(code[s] for s in ipa)}")
        prev = w

    body = "\n".join(lines)
    packed = lines

    # Round-trip the whole thing before writing. A format this compact is
    # exactly the kind that looks fine and is subtly wrong — the count
    # range above was wrong on the first attempt and decoded `a's` as
    # reusing two characters of `a`.
    decoded, prev = {}, ""
    for line in lines:
        head, codes = line.rsplit(" ", 1)
        n = ord(head[0]) - COUNT_SHIFT
        word = prev[:n] + head[1:]
        decoded[word] = [symbols[code_index[c]] for c in codes]
        prev = word
    assert decoded == kept, (
        f"round-trip failed: {len(decoded)} decoded vs {len(kept)} in, "
        f"first mismatch "
        f"{next((w for w in kept if decoded.get(w) != kept[w]), None)!r}")
    OUT.write_text(
        "/* Auto-generated — do not edit by hand.\n"
        " * Regenerate with: python3 tools/build_lexicon.py <cmudict.dict>\n"
        " *\n"
        " * English -> IPA. The CMU Pronouncing Dictionary, mapped onto\n"
        " * this project's phoneme set — see tools/build_lexicon.py for the\n"
        " * mapping decisions, the important one being that unstressed AH\n"
        " * becomes schwa, which is what finally gives the site vowel\n"
        " * reduction. g2p.js's rules stay the fallback for anything not\n"
        " * in here. CMU dictionary: BSD-style licence.\n"
        " *\n"
        " * FORMAT: one entry per line, `<n><suffix> <codes>`, sorted.\n"
        " * `n` is a single character: reuse that many leading characters\n"
        " * from the PREVIOUS word (n = charCode - shift), then append the\n"
        " * suffix. `codes` is one character per phoneme, indexing into\n"
        " * `codes`/`alphabet`. See expand() in g2p.js. */\n"
        "window.AVATARIAN_LEXICON = {\n"
        f"  alphabet: {json.dumps(symbols, ensure_ascii=False)},\n"
        f"  codes: {json.dumps(''.join(code[s] for s in symbols))},\n"
        f"  shift: {COUNT_SHIFT},\n"
        f"  words: {json.dumps(body, ensure_ascii=False)},\n"
        "};\n",
        encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(ROOT)} — {len(packed)} words, {kb:.0f} KB")


if __name__ == "__main__":
    main()
