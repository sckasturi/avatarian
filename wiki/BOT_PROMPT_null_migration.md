You are operating a pywikibot instance on avatar.fandom.com. Your job is to migrate how the Avatarian script's "null" is written in every call to the Avatarian template/module. Do it in two phases, and do not start Phase 2 until I tell you to.

## Background

Pages draw Avatarian with `{{Avatarian|<sounds>|<label>}}`, or occasionally `{{#invoke:Avatarian|render|<sounds>|<label>}}`. The first positional parameter is a space-separated list of sound codes, with `/` between words. The null (an empty slot) has been typed `0`; it is now `-`. The numeral zero has been typed `@`; it will become `0`.

## Which pages

Every page that transcludes `Template:Avatarian` (all namespaces), plus every page that calls `{{#invoke:Avatarian|...}}` directly. Do not edit `Module:Avatarian` itself or any `.css` page.

## What to edit — parameter 1 only

Edit only the FIRST positional parameter (the sounds). Never touch parameter 2 (the label), named parameters, or any text outside the template call. Parse the call properly (mwparserfromhell, via `pywikibot`'s textlib or directly) rather than regexing the page, so nested templates and `|` inside other templates are handled.

Inside parameter 1:
- Split it into tokens on whitespace and `/`. Keep every separator exactly as it was, including runs of spaces and the slashes.
- Text inside `(parentheses)` is a caption, not sounds. Leave everything inside parentheses alone, nested parentheses included.
- Transform only whole tokens, never substrings.

## Phase 1 — nulls only (run this now)

| token | becomes |
| --- | --- |
| `0` | `-` |
| `0c` | `-c` |
| `0$` / `0%` | `-$` / `-%` |
| `0c$` / `0c%` | `-c$` / `-c%` |

Leave everything else exactly as it is. In particular:
- `@` stays `@` in this phase.
- A multi-digit token like `20` or `1000` is a number. Leave it.
- `-`, `_`, `*`, `.`, `,`, `?`, `!`, and every letter code stay as they are.

Examples (parameter 1, before → after):
- `a v uh 0 t ah r 0` → `a v uh - t ah r -`
- `a 0 p 0 uh 0` → `a - p - uh -`
- `0` → `-`   (a lone null, e.g. in the glyph table)
- `0c` → `-c`
- `m e t uh l 0 b e n d i ng (metal 0 bending)` → `m e t uh l - b e n d i ng (metal 0 bending)`   (caption untouched)
- `1 @ 0` → `1 @ -`
- `20` → `20`

Edit summary: `Avatarian: the null is now typed "-" instead of "0" (bot)`. Mark edits as bot edits and minor.

## Procedure

1. Dry run first. List every page you would change, and for each one show the before → after of each changed parameter. Also list anything you skipped or couldn't parse, with the reason. Show me this, and wait for my go-ahead before saving anything.
2. On my go-ahead, save the edits at a gentle rate (respect `put_throttle`; at least 5 seconds between edits) and stop on the first API error.
3. Afterwards, report: the pages edited, the pages skipped, and a final scan confirming that no `{{Avatarian}}` or `{{#invoke:Avatarian}}` parameter 1 still contains a bare `0` token outside parentheses.

## Phase 2 — zero (only when I say so)

This runs only after I confirm `Module:Avatarian` has been updated so that `0` means zero. Running it earlier would turn every zero into a null.

Same pages and same rules (parameter 1 only, whole tokens, parentheses untouched). One mapping: `@` → `0`. Dry run, wait for my go-ahead, then save. Summary: `Avatarian: numeral zero is now typed "0" instead of "@" (bot)`.
