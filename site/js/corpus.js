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
    "cherries on top poster": {
      "what": "Cherries on top",
      "where": "https://www.instagram.com/p/DbbT9_BjMv2/?img_index=1",
      "image": "image-3.png"
    },
    "toph-letter": {
      "what": "Hey Toph, How is the metalbending academy? Hope you're not being too hard on your students! Anyway, i found something out and it is really big! I am going to need your help. I have asked Zuko to come pick you up, then I need you all to come meet me at Mount Baihu. Please hurry. Aang",
      "where": "movie",
      "image": "new-avatar-the-last-airbender-conscript-v0-clrg6ebgx8vg1-4.webp"
    }
  },
  "words": {
    "at": {
      "ipa": [
        "æ",
        "t"
      ],
      "count": 2,
      "sources": [
        "cherries on top poster",
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "cherries on top poster",
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
      "count": 1,
      "sources": [
        "cherries on top poster"
      ],
      "confidence": "certain",
      "source": "cherries on top poster"
    },
    "on": {
      "ipa": [
        "ɑ",
        "n"
      ],
      "count": 2,
      "sources": [
        "cherries on top poster",
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "cherries on top poster"
    },
    "top": {
      "ipa": [
        "t",
        "ɑ",
        "p",
        "∅"
      ],
      "count": 1,
      "sources": [
        "cherries on top poster"
      ],
      "confidence": "certain",
      "source": "cherries on top poster"
    },
    "aang": {
      "ipa": [
        "e",
        "ŋ"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "academy": {
      "ipa": [
        "ə",
        "∅",
        "k",
        "æ",
        "d",
        "ə",
        "m",
        "i"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "all": {
      "ipa": [
        "ɔ%",
        "l"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "am": {
      "ipa": [
        "æ",
        "m"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "and": {
      "ipa": [
        "æ",
        "n",
        "d",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "anyway": {
      "ipa": [
        "ɛ",
        "n",
        "i",
        "∅",
        "w",
        "e"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "asked": {
      "ipa": [
        "æ",
        "s$",
        "k",
        "t"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "baihu": {
      "ipa": [
        "b",
        "aɪ",
        "h",
        "u"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "gloss": "Baihu"
    },
    "being": {
      "ipa": [
        "b",
        "i",
        "ɪ",
        "ŋ"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "big": {
      "ipa": [
        "b",
        "ɪ",
        "g",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "come": {
      "ipa": [
        "k",
        "ʌ",
        "m",
        "∅"
      ],
      "count": 2,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "found": {
      "ipa": [
        "f",
        "aʊ",
        "n",
        "d"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "going": {
      "ipa": [
        "g",
        "oʊ",
        "ɪ",
        "ŋ"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "hard": {
      "ipa": [
        "h",
        "ɑ",
        "r",
        "d"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "have": {
      "ipa": [
        "h",
        "æ",
        "v",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "help": {
      "ipa": [
        "h",
        "ɛ",
        "l",
        "p"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "hey": {
      "ipa": [
        "h",
        "e"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "hope": {
      "ipa": [
        "h",
        "oʊ",
        "p",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "how": {
      "ipa": [
        "h",
        "aʊ"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "hurry": {
      "ipa": [
        "h",
        "ə",
        "r",
        "i"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "i": {
      "ipa": [
        "aɪ",
        "∅"
      ],
      "count": 4,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "is": {
      "ipa": [
        "ɪ",
        "z"
      ],
      "count": 2,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "it": {
      "ipa": [
        "ɪ",
        "t"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "me": {
      "ipa": [
        "m",
        "i"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "meet": {
      "ipa": [
        "m",
        "i",
        "t",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
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
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "mount": {
      "ipa": [
        "m",
        "aʊ",
        "n",
        "t"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "gloss": "Mount"
    },
    "need": {
      "ipa": [
        "n",
        "i",
        "d",
        "∅"
      ],
      "count": 2,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "not": {
      "ipa": [
        "n",
        "ɑ",
        "t",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "out": {
      "ipa": [
        "aʊ",
        "t"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "pick": {
      "ipa": [
        "p",
        "ɪ",
        "k",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "please": {
      "ipa": [
        "p",
        "l",
        "i",
        "z"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "really": {
      "ipa": [
        "r",
        "ɪ",
        "l",
        "i"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "something": {
      "ipa": [
        "s",
        "ʌ",
        "∅",
        "m",
        "θ",
        "ɪ",
        "ŋ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "the": {
      "ipa": [
        "ð",
        "ə"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "then": {
      "ipa": [
        "ð",
        "ɛ",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "to": {
      "ipa": [
        "t",
        "u"
      ],
      "count": 3,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "too": {
      "ipa": [
        "t",
        "u"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "toph": {
      "ipa": [
        "t",
        "ɑ",
        "f",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "up": {
      "ipa": [
        "ʌ",
        "p"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "you": {
      "ipa": [
        "j",
        "u"
      ],
      "count": 2,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "you're": {
      "ipa": [
        "j",
        "u",
        "r",
        "∅"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "your": {
      "ipa": [
        "j",
        "oʊ",
        "r",
        "∅"
      ],
      "count": 2,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "zuko": {
      "ipa": [
        "z",
        "u",
        "k",
        "oʊ"
      ],
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "gloss": "Zuko"
    }
  }
};
