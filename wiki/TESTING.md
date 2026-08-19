# Testing the Avatarian gadget on a wiki (personal account first)

Try the whole thing under **your own account** before it touches the
site-wide `MediaWiki:Common.js`. Nothing here needs admin rights: personal
JS/CSS subpages and a user sandbox are enough, and they only affect you.

> ⚠️ **Two different pages — the capital letter is the whole difference.**
> `MediaWiki:Common.js` (capital `C`, `MediaWiki:` namespace) is the
> **site-wide** script for everyone, and needs admin rights — that is the
> *go-live* page, **not** for testing. Your personal script is
> `Special:MyPage/common.js` (lowercase `c`, which is
> `User:YourName/common.js`) and runs only for you. Put the testing loader
> there. Same for CSS: `Special:MyPage/common.css`, not
> `MediaWiki:Common.css`.

The pieces you'll paste are all in this `wiki/` folder. Build the bundle
first so it's current:

```
python3 tools/build_wiki_bundle.py     # writes wiki/MediaWiki_Avatarian.js.txt
```

Replace **`YourName`** below with your wiki username everywhere.

## Steps

1. **The bundle → your personal JS subpage.**
   Go to `User:YourName/Avatarian.js` (type it into the wiki's URL/search
   and create it). Paste the **entire** contents of
   `wiki/MediaWiki_Avatarian.js.txt`. Save.
   *(A `User:…/….js` page is served as JavaScript and only you — or an
   admin — can edit it. This is the ~60 KB renderer.)*

2. **The styles → your personal CSS.**
   Go to `Special:MyPage/common.css`. Paste the entire contents of
   `wiki/MediaWiki_Common.css.txt`. Save.

3. **The loader → your personal JS.**
   Go to `Special:MyPage/common.js`. Paste the entire contents of
   `wiki/MediaWiki_Common.js.txt`, then change the one config line to point
   at **your** bundle page from step 1:

   ```js
   var BUNDLE_PAGE = "User:YourName/Avatarian.js";
   ```

   Save.

4. **The template.** Go to `Template:Avatarian`, paste
   `wiki/Template_Avatarian.wiki`, save.
   *(If you can't create templates on this wiki yet, skip this and use the
   raw-span form in step 5 instead.)*

5. **A test page.** Go to `User:YourName/sandbox` and add a few:

   ```
   {{Avatarian|k uh t ah r uh|Katara}}
   {{Avatarian|w ʌ t ?|what?}}
   {{Avatarian|p l ee z}}
   ```

   Without the template, use the raw span the template expands to:

   ```
   <span class="avatarian-word" data-avatarian-sounds="k uh t ah r uh" data-avatarian-label="Katara">Katara</span>
   ```

   Save.

6. **Hard-refresh** the sandbox page (Ctrl/Cmd + Shift + R) to clear cached
   JS/CSS. The English text should turn into Avatarian glyphs; hovering
   shows the label and IPA, e.g. *Katara /k ə t ɑ r ə/*.

## If nothing happens

Open the browser console (F12 → Console) and reload:

- **Bundle 404 / "not found"** — the `BUNDLE_PAGE` title must match your
  subpage exactly, case included: `User:YourName/Avatarian.js`.
- **Glyphs render but look wrong-sized** — the CSS didn't take. Re-check
  `Special:MyPage/common.css` and hard-refresh.
- **No change at all, no console sign the bundle loaded** — the loader is
  probably on the wrong page. It must be your personal
  `Special:MyPage/common.js`, **not** the site-wide `MediaWiki:Common.js`
  (see the warning up top). Ad-blocker noise in the console
  (`ERR_BLOCKED_BY_CLIENT` for Fandom's tracking/ad scripts) is normal and
  unrelated — none of it is Avatarian.
- **No change at all** — MediaWiki caches personal JS/CSS hard. Hard-refresh
  again, or append `?debug=true` to the page URL, or give it a minute.
- **Still plain text and no console errors** — confirm the span actually
  reached the page: view source and look for `class="avatarian-word"`. If
  it's missing, the template didn't expand (step 4) — use the raw span.

To get the sounds for any word, type it into the translator and copy what
appears in its **Sounds** box.

## Going site-wide (after it works for you)

Anyone with admin / interface-editor rights then:

1. Pastes the bundle into **`MediaWiki:Avatarian.js`** (same content).
2. Appends `wiki/MediaWiki_Common.css.txt` to **`MediaWiki:Common.css`**.
3. Appends `wiki/MediaWiki_Common.js.txt` to **`MediaWiki:Common.js`**, with
   `BUNDLE_PAGE` left as `"MediaWiki:Avatarian.js"`.
4. Confirms **`Template:Avatarian`** exists.

Then remove the personal copies from your own `common.js` / `common.css`,
and delete `User:YourName/Avatarian.js`, so the wiki serves one shared copy.

When any bundled module changes later, re-run `build_wiki_bundle.py` and
re-paste the bundle into `MediaWiki:Avatarian.js`.
