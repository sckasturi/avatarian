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
    "toph-letter": {
      "what": "Hey Toph, How is the metalbending academy? Hope you're not being too hard on your students! Anyway, i found something out and it is really big! I am going to need your help. I have asked Zuko to come pick you up, then I need you all to come meet me at Mount Baihu. Please hurry. Aang",
      "where": "movie",
      "image": "toph-letter.webp"
    },
    "katara-letter": {
      "what": "Katara, Please do not be mad at me when you wake up, but I did not (unknown) I found out what the denied are after, (unknown) can (unknown) I (unknown)  you take Appa and Momo and gather up the rest of the team. I will be Aang (unknown) Aang",
      "where": "movie",
      "image": "katara-letter.webp"
    },
    "instagram-1.1": {
      "what": "still waters / trends this june / balloon festival / peeep farm / sad fish / noodle house / garden gems",
      "where": "https://www.instagram.com/p/DbYdfaFDJmt/?img_index=1",
      "image": "image-4.png"
    },
    "instagram-2.1": {
      "what": "joyful journey / salon / looking for hair models / biggest hand contest / ages 0-7 draw your fav animal / mama / cherries on top",
      "where": "https://www.instagram.com/p/DbYdfaFDJmt/?img_index=2",
      "image": "image-4.png"
    },
    "instagram-3.1": {
      "what": "evil seagull / save beaverfish / fresh from my garden / bao pie / looking for humansitters / miao / warrior within / courage in every step",
      "where": "https://www.instagram.com/mmara_art/p/DboCKbiDL_v/?img_index=1",
      "image": "instagram-3.1.png"
    },
    "instagram-1.2": {
      "what": "sula's baking class / frozen cream cakes / bending performacnce / ignite / cancel school / panda ballet / balance / catfish meal card",
      "where": "https://www.instagram.com/p/DbYdfaFDJmt/?img_index=2",
      "image": "image-5.png"
    }
  },
  "words": {
    "aang": {
      "ipa": [
        "e",
        "ŋ"
      ],
      "count": 2,
      "sources": [
        "toph-letter",
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "gloss": "Aang"
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
      "count": 3,
      "sources": [
        "toph-letter",
        "katara-letter"
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
    "at": {
      "ipa": [
        "æ",
        "t"
      ],
      "count": 2,
      "sources": [
        "toph-letter",
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
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
      "count": 2,
      "sources": [
        "toph-letter",
        "katara-letter"
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
      "count": 8,
      "sources": [
        "toph-letter",
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "gloss": "I"
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
      "count": 2,
      "sources": [
        "toph-letter",
        "katara-letter"
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
      "count": 3,
      "sources": [
        "toph-letter",
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "on": {
      "ipa": [
        "ɑ",
        "n"
      ],
      "count": 2,
      "sources": [
        "toph-letter",
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "out": {
      "ipa": [
        "aʊ",
        "t"
      ],
      "count": 2,
      "sources": [
        "toph-letter",
        "katara-letter"
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
      "count": 2,
      "sources": [
        "toph-letter",
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "gloss": "Please"
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
      "count": 4,
      "sources": [
        "toph-letter",
        "katara-letter"
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
      "count": 3,
      "sources": [
        "toph-letter",
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter"
    },
    "you": {
      "ipa": [
        "j",
        "u"
      ],
      "count": 4,
      "sources": [
        "toph-letter",
        "katara-letter"
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
      "count": 1,
      "sources": [
        "toph-letter"
      ],
      "confidence": "certain",
      "source": "toph-letter",
      "alternates": [
        {
          "ipa": [
            "j",
            "ɔ",
            "r",
            "∅"
          ],
          "count": 1,
          "sources": [
            "instagram-2.1"
          ],
          "confidence": "certain"
        }
      ],
      "contested": true
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
    },
    "after": {
      "ipa": [
        "æ",
        "f",
        "t",
        "ə",
        "r",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "appa": {
      "ipa": [
        "æ",
        "∅",
        "p",
        "∅",
        "ə",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter",
      "gloss": "Appa"
    },
    "are": {
      "ipa": [
        "ɑ",
        "r"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "be": {
      "ipa": [
        "b",
        "i"
      ],
      "count": 2,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "but": {
      "ipa": [
        "b",
        "ʌ",
        "t",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "can": {
      "ipa": [
        "k",
        "æ",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "denied": {
      "ipa": [
        "d",
        "e",
        "n",
        "aɪ",
        "d",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "did": {
      "ipa": [
        "d",
        "ɪ",
        "d",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "do": {
      "ipa": [
        "d",
        "u"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "gather": {
      "ipa": [
        "g",
        "æ",
        "ð",
        "ə",
        "r",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "katara": {
      "ipa": [
        "k",
        "ə",
        "t",
        "ɑ",
        "r",
        "ə"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter",
      "gloss": "Katara"
    },
    "mad": {
      "ipa": [
        "m",
        "æ",
        "d",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "momo": {
      "ipa": [
        "m",
        "oʊ",
        "m",
        "oʊ"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter",
      "gloss": "Momo"
    },
    "of": {
      "ipa": [
        "ʌ",
        "v"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "rest": {
      "ipa": [
        "r",
        "ɛ",
        "s",
        "t"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "take": {
      "ipa": [
        "t",
        "e",
        "k",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "team": {
      "ipa": [
        "t",
        "i",
        "m",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "wake": {
      "ipa": [
        "w",
        "e",
        "k",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "what": {
      "ipa": [
        "w",
        "ɑ",
        "t",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "when": {
      "ipa": [
        "w",
        "ɛ",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "will": {
      "ipa": [
        "w",
        "ɪ",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "katara-letter"
      ],
      "confidence": "certain",
      "source": "katara-letter"
    },
    "cabbages": {
      "ipa": [
        "k",
        "æ",
        "b",
        "ɪ",
        "dʒ",
        "ɪ",
        "z",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "farm": {
      "ipa": [
        "f",
        "ɑ",
        "r",
        "m"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "fish": {
      "ipa": [
        "f",
        "ɪ",
        "ʃ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "free": {
      "ipa": [
        "f",
        "r",
        "i",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "garden": {
      "ipa": [
        "g",
        "ɑ",
        "r",
        "∅",
        "d",
        "ə",
        "n",
        "∅"
      ],
      "count": 2,
      "sources": [
        "instagram-1.1",
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "gems": {
      "ipa": [
        "dʒ",
        "ɛ",
        "m",
        "z"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "house": {
      "ipa": [
        "h",
        "aʊ",
        "s",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "june": {
      "ipa": [
        "dʒ",
        "u",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "noodle": {
      "ipa": [
        "n",
        "u",
        "d",
        "ə",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "peeep": {
      "ipa": [
        "p",
        "i",
        "i",
        "∅",
        "i",
        "p"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "sad": {
      "ipa": [
        "s",
        "æ",
        "d",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "still": {
      "ipa": [
        "s%",
        "t",
        "ɪ",
        "l"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "this": {
      "ipa": [
        "ð",
        "ɪ",
        "s",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "trends": {
      "ipa": [
        "t",
        "r",
        "ɛ",
        "n",
        "d",
        "z"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "waters": {
      "ipa": [
        "w",
        "ɔ",
        "t",
        "ə",
        "r",
        "z"
      ],
      "count": 1,
      "sources": [
        "instagram-1.1"
      ],
      "confidence": "certain",
      "source": "instagram-1.1"
    },
    "ages": {
      "ipa": [
        "e",
        "∅",
        "ɪ",
        "∅",
        "dʒ",
        "ə",
        "z",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "animal": {
      "ipa": [
        "æ",
        "∅",
        "n",
        "ə",
        "m",
        "ə",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
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
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1",
      "gloss": "Baihu"
    },
    "biggest": {
      "ipa": [
        "b",
        "ɪ",
        "g",
        "ə",
        "?",
        "t"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
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
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "contest": {
      "ipa": [
        "k",
        "ɑ",
        "n",
        "∅",
        "t",
        "ɛ",
        "?",
        "t"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "draw": {
      "ipa": [
        "d",
        "?",
        "ɔ%",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "fav": {
      "ipa": [
        "f",
        "?",
        "v",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "for": {
      "ipa": [
        "f",
        "ɔ",
        "r",
        "∅"
      ],
      "count": 2,
      "sources": [
        "instagram-2.1",
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "hair": {
      "ipa": [
        "h",
        "ɛ",
        "r",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "hand": {
      "ipa": [
        "h",
        "æ",
        "n",
        "d"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "journey": {
      "ipa": [
        "dʒ",
        "ə",
        "r",
        "∅",
        "n",
        "i"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "joyful": {
      "ipa": [
        "dʒ",
        "ɔɪ",
        "f",
        "ə",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "looking": {
      "ipa": [
        "l",
        "ʊ",
        "k",
        "ɪ",
        "ŋ",
        "∅"
      ],
      "count": 2,
      "sources": [
        "instagram-2.1",
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "mama": {
      "ipa": [
        "m",
        "ɑ",
        "m",
        "ə"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "models": {
      "ipa": [
        "m",
        "ɑ",
        "d",
        "ə",
        "l",
        "z"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "salon": {
      "ipa": [
        "s",
        "ə",
        "l",
        "?",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1",
      "gloss": "salon"
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
        "instagram-2.1"
      ],
      "confidence": "certain",
      "source": "instagram-2.1"
    },
    "bao": {
      "ipa": [
        "b",
        "aʊ"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "courage": {
      "ipa": [
        "k",
        "ə",
        "r",
        "ə",
        "dʒ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "evil": {
      "ipa": [
        "i",
        "∅",
        "v",
        "ə",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "fresh": {
      "ipa": [
        "f",
        "r%",
        "ɛ",
        "ʃ"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "from": {
      "ipa": [
        "f",
        "r%",
        "ə",
        "m"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "humansitters": {
      "ipa": [
        "h",
        "u",
        "m",
        "∅",
        "n",
        "∅",
        "s",
        "i",
        "t",
        "∅",
        "t",
        "e",
        "r",
        "z"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "in": {
      "ipa": [
        "e",
        "n"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "my": {
      "ipa": [
        "m",
        "aɪ"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "pie": {
      "ipa": [
        "p",
        "aɪ"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "seagull": {
      "ipa": [
        "s",
        "i",
        "g",
        "æ",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "step": {
      "ipa": [
        "s%",
        "t",
        "ɛ",
        "p"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "warrior": {
      "ipa": [
        "w",
        "ɔ",
        "r",
        "?",
        "ə",
        "r"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "within": {
      "ipa": [
        "w",
        "ɪ",
        "ð",
        "?",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-3.1"
      ],
      "confidence": "certain",
      "source": "instagram-3.1"
    },
    "baking": {
      "ipa": [
        "b",
        "e",
        "ɪ",
        "∅",
        "k",
        "ɪ",
        "ŋ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "balance": {
      "ipa": [
        "b",
        "æ",
        "l",
        "ə",
        "n",
        "s$"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "ballet": {
      "ipa": [
        "b",
        "æ",
        "l",
        "e",
        "ɪ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "bending": {
      "ipa": [
        "b",
        "ɛ",
        "n",
        "∅",
        "d",
        "ɪ",
        "ŋ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "cakes": {
      "ipa": [
        "k",
        "e",
        "ɪ",
        "k",
        "s",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "cancel": {
      "ipa": [
        "k",
        "æ",
        "n",
        "∅",
        "s",
        "ə",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "card": {
      "ipa": [
        "k",
        "ɑ",
        "r",
        "d"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "catfish": {
      "ipa": [
        "k",
        "æ",
        "t",
        "∅",
        "f",
        "ɪ",
        "ʃ",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "class": {
      "ipa": [
        "k",
        "l",
        "æ",
        "s$"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "cream": {
      "ipa": [
        "k",
        "r%",
        "i",
        "m"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "frozen": {
      "ipa": [
        "f",
        "r%",
        "oʊ",
        "∅",
        "z",
        "ə",
        "n",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "ignite": {
      "ipa": [
        "ɪ",
        "g",
        "n",
        "aɪ",
        "t",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "meal": {
      "ipa": [
        "m",
        "i",
        "l",
        "∅"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "panda": {
      "ipa": [
        "p",
        "æ",
        "n",
        "∅",
        "d",
        "ə"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "performance": {
      "ipa": [
        "p",
        "ə",
        "r",
        "∅",
        "f",
        "∅",
        "r",
        "∅",
        "m",
        "ə",
        "n",
        "s$"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "school": {
      "ipa": [
        "s%",
        "k",
        "u",
        "l$"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    },
    "sula's": {
      "ipa": [
        "s",
        "u",
        "l",
        "s$"
      ],
      "count": 1,
      "sources": [
        "instagram-1.2"
      ],
      "confidence": "certain",
      "source": "instagram-1.2"
    }
  }
};
