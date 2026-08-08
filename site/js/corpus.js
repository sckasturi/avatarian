/* Auto-generated — do not edit by hand.
 * Source: corpus/attested.json    Regenerate: python3 tools/build_corpus.py
 * Or edit it in the workbench: python3 tools/corpus_server.py
 *
 * The attested corpus: words somebody has SEEN written in Avatarian,
 * stored as the finished block structure flattened two-slots-per-block,
 * in IPA. See CORPUS.md.
 *
 * This wins the lookup chain in g2p.js, ahead of EXCEPTIONS. Everything
 * below it produces phonemes and lets pairUp() choose the blocks; these
 * entries already ARE the blocks. Because nulls are written out and the
 * token count is even, pairUp() reproduces them exactly rather than
 * having to be bypassed. */
window.AVATARIAN_CORPUS = {
  "sources": {
    "wake-up-note": {
      "what": "Labelled writing sample, one line: \"please do not be mad at me when you wake up, but\". Every word glossed in English beside it.",
      "where": "Supplied by TechFilmer (Avatar Wiki). Read in session 1; the image is not yet catalogued in this repo — see TODO B2.",
      "why_it_matters": "This is the sample the whole pairing model was read off. All twelve words are here so that any future change to pairing can be checked against the evidence it came from."
    },
    "students": {
      "what": "The word \"students\", showing a mid-word null and two /s/ in top slots with different orientations.",
      "where": "Reference material, read in session 1. Not yet catalogued — see TODO B2."
    },
    "metalbending": {
      "what": "The word \"metalbending\", showing a mid-word null.",
      "where": "Reference material, read in session 1. Not yet catalogued — see TODO B2."
    },
    "appa-art": {
      "what": "In-world art showing \"Appa\" written as three blocks.",
      "where": "Reference material, read in session 7. Not yet catalogued — see TODO B2.",
      "why_it_matters": "The single spelling that cannot be expressed as a phoneme list plus the pairing rule, and therefore the reason the corpus stores finished spellings."
    },
    "name-references": {
      "what": "Reference material showing the in-world names written out.",
      "where": "Checked in session 7. The individual images are not yet catalogued — see TODO B2.",
      "why_it_matters": "Two of the first four checked were wrong in EXCEPTIONS. Assume the unchecked ones are too — TODO item 24."
    },
    "fanny-poster": {
      "what": "A poster reading \"fanny is missing\" — the first attested SENTENCE rather than an isolated name.",
      "where": "Read in session 7; link to follow. Not yet catalogued — see TODO B2.",
      "why_it_matters": "All three words already matched what the pipeline derives. It records where the model is RIGHT, which a corpus needs as much as it needs corrections."
    },
    "fire-photo": {
      "what": "Photograph of the word \"fire\", showing /aɪ/ in a bottom slot as the vertical mirror of its citation form.",
      "where": "Read in session 3; it is what put /aɪ/ in FLIPS. Not yet catalogued — see TODO B2."
    },
    "cherries on top poster": {
      "what": "Cherries on top",
      "where": "https://www.instagram.com/p/DbbT9_BjMv2/?img_index=1",
      "image": "image-3.png"
    }
  },
  "words": {
    "be": {
      "ipa": [
        "b",
        "i"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "but": {
      "ipa": [
        "b",
        "ʌ",
        "t",
        "∅"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "do": {
      "ipa": [
        "d",
        "u"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "mad": {
      "ipa": [
        "m",
        "æ",
        "d",
        "∅"
      ],
      "source": "wake-up-note",
      "confidence": "certain",
      "note": "/æ/ in a bottom slot, drawn as a cap ∩. Half the FLIPS evidence for æ; \"at\" is the other half."
    },
    "me": {
      "ipa": [
        "m",
        "i"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "not": {
      "ipa": [
        "n",
        "ɑ",
        "t",
        "∅"
      ],
      "source": "wake-up-note",
      "confidence": "certain",
      "note": "Three phonemes, so a trailing null. Cited against `appa`: an odd count on its own does not make canon give every phoneme its own block."
    },
    "please": {
      "ipa": [
        "p",
        "l",
        "i",
        "z"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "up": {
      "ipa": [
        "ʌ",
        "p"
      ],
      "source": "wake-up-note",
      "confidence": "certain",
      "note": "Vowel on TOP."
    },
    "wake": {
      "ipa": [
        "w",
        "e",
        "k",
        "∅"
      ],
      "source": "wake-up-note",
      "confidence": "certain",
      "note": "/e/ in a bottom slot. Pairs with \"aang\" (/e/ on top) as the FLIPS evidence for e."
    },
    "when": {
      "ipa": [
        "w",
        "ɛ",
        "n",
        "∅"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "you": {
      "ipa": [
        "j",
        "u"
      ],
      "source": "wake-up-note",
      "confidence": "certain"
    },
    "students": {
      "ipa": [
        "s%",
        "t",
        "u",
        "∅",
        "d",
        "ə",
        "n",
        "t",
        "s$",
        "∅"
      ],
      "source": "students",
      "confidence": "certain",
      "note": "A MID-WORD null: the word divides into two units, `stu` and `dents`, each paired independently and each padded if odd. What decides the split is unknown — not morphemes (`stu|dents` is not one) and not syllables. Both /s/ land in top slots yet are drawn differently (∨ first, ∧ last), which no slot rule can produce; hence the overrides. The drawn form of /s/ is ∧, so the first one is the mirrored `%` and the last the plain `$`."
    },
    "metalbending": {
      "ipa": [
        "m",
        "ɛ",
        "t",
        "ə",
        "l",
        "∅",
        "b",
        "ɛ",
        "n",
        "d",
        "ɪ",
        "ŋ"
      ],
      "source": "metalbending",
      "confidence": "certain",
      "note": "The second mid-word null, splitting `metal` / `bending`. Also the FLIPS evidence for ɪ, and it shows the linking vowel reduced to schwa — which is what the -bending guesses in EXCEPTIONS copy."
    },
    "appa": {
      "ipa": [
        "ɑ",
        "∅",
        "p",
        "∅",
        "ɑ",
        "∅"
      ],
      "source": "appa-art",
      "confidence": "certain",
      "gloss": "Appa",
      "note": "THREE blocks where pairing predicts two — every phoneme padded with its own null. Why is unknown, and the corpus does not need to know. Also the FLIPS evidence for /ɑ/ in a top slot. CONFIRMED against the art (TODO B3, session 10): the nulls are mixed heights, tall beside the vowels and short beside /p/, exactly as the pairing-partner rule predicts. That is the third word to confirm the rule, and it settles the syntax question — no `0c` code is needed, because `0` plus the partner is enough to say which null is written."
    },
    "aang": {
      "ipa": [
        "e",
        "ŋ"
      ],
      "source": "name-references",
      "confidence": "certain",
      "gloss": "Aang",
      "note": "Not /ɑ ŋ/, which is what EXCEPTIONS used to guess. The correction also repairs the FLIPS table, which cites \"Aang\" as showing /e/ in a top slot — evidence that made no sense while the word was read as containing no /e/."
    },
    "momo": {
      "ipa": [
        "m",
        "oʊ",
        "m",
        "oʊ"
      ],
      "source": "name-references",
      "confidence": "certain",
      "gloss": "Momo",
      "note": "Checked and already right."
    },
    "toph": {
      "ipa": [
        "t",
        "ɑ",
        "f",
        "∅"
      ],
      "source": "name-references",
      "confidence": "certain",
      "gloss": "Toph",
      "note": "Rhymes with \"off\", not with \"loaf\". EXCEPTIONS had /t oʊ f/."
    },
    "zuko": {
      "ipa": [
        "z",
        "u",
        "k",
        "oʊ"
      ],
      "source": "name-references",
      "confidence": "certain",
      "gloss": "Zuko",
      "note": "Checked and already right."
    },
    "fanny": {
      "ipa": [
        "f",
        "æ",
        "n",
        "i"
      ],
      "source": "fanny-poster",
      "confidence": "certain"
    },
    "is": {
      "ipa": [
        "ɪ",
        "z"
      ],
      "source": "fanny-poster",
      "confidence": "certain"
    },
    "missing": {
      "ipa": [
        "m",
        "ɪ",
        "s",
        "ɪ",
        "ŋ",
        "∅"
      ],
      "source": "fanny-poster",
      "confidence": "certain",
      "note": "Five phonemes and a trailing null, exactly as derived."
    },
    "fire": {
      "ipa": [
        "f",
        "aɪ",
        "ə",
        "r"
      ],
      "source": "fire-photo",
      "confidence": "probable",
      "note": "Only the FIRST block is directly attested — the photo was read for /aɪ/'s orientation in a bottom slot, which is (f,aɪ). The second block is the ordinary derivation and has not been checked. Downgrade or confirm when the image is catalogued (B2)."
    },
    "at": {
      "ipa": [
        "æ",
        "t"
      ],
      "source": "cherries on top poster",
      "confidence": "certain",
      "note": "Vowel on TOP, drawn as a cup ∪. This is the word that killed the syllable model."
    },
    "cherries": {
      "ipa": [
        "tʃ",
        "ɛ",
        "r",
        "i",
        "z",
        "∅"
      ],
      "source": "cherries on top poster",
      "confidence": "certain"
    },
    "on": {
      "ipa": [
        "ɑ",
        "n"
      ],
      "source": "cherries on top poster",
      "confidence": "certain"
    },
    "top": {
      "ipa": [
        "t",
        "ɑ",
        "p",
        "∅"
      ],
      "source": "cherries on top poster",
      "confidence": "certain"
    }
  }
};
