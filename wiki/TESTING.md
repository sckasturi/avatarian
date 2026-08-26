# Testing the Avatarian wiki renderer

The wiki renderer is **server-side Lua + CSS, no JavaScript** — so most of
it can be checked *locally*, before anything touches a wiki, and the on-wiki
test needs no gadget/loader plumbing at all.

Regenerate both artifacts first so they're current:

```
python3 tools/build_lua_module.py     # -> wiki/Module_Avatarian.lua
python3 tools/build_css_only.py       # -> wiki/Avatarian-css-only.css
```

## 1. Locally (no wiki needed)

The Lua is a port of `render.js`; the golden test renders every corpus word
through both and asserts they're byte-identical, and checks it under Lua 5.1
(Fandom's Scribunto) if `lua`/`luajit` is on PATH:

```
node --test tests/lua_golden.test.js
```

To eyeball the markup for one word:

```
lua -e 'print((dofile("wiki/Module_Avatarian.lua"))._main("k uh t ah r uh","Katara"))'
```

To see it *drawn*, drop that markup into an HTML file with the stylesheet:
`<style>` + `wiki/Avatarian-css-only.css` + the `<span>…</span>` the command
prints. That's the exact output the wiki serves.

## 2. On a wiki, under your own account first

Nothing here is site-wide, so it only affects you. Replace **`YourName`**
with your wiki username.

> ⚠️ **Personal CSS is `Special:MyPage/common.css`** (lowercase `c`, i.e.
> `User:YourName/common.css`) — runs only for you. The site-wide
> `MediaWiki:Common.css` / `MediaWiki:Fandommobile.css` are the *go-live*
> pages and need admin rights; leave them for step 3.

1. **The module → a sandbox module page.** Scribunto modules live in the
   `Module:` namespace. Create `Module:Avatarian/sandbox` (creating modules
   is usually allowed for autoconfirmed users) and paste the **entire**
   `wiki/Module_Avatarian.lua`. Save.

2. **The styles → your personal CSS.** Go to `Special:MyPage/common.css`,
   paste the entire `wiki/Avatarian-css-only.css`. Save.

3. **A test page.** Go to `User:YourName/sandbox` and invoke the sandbox
   module directly (no template needed):

   ```
   {{#invoke:Avatarian/sandbox|render|k uh t ah r uh|Katara}}
   {{#invoke:Avatarian/sandbox|render|w ah t ?|what?}}
   {{#invoke:Avatarian/sandbox|render|p l ee z}}
   ```

   **Preview** the page — because rendering is server-side, the glyphs
   appear in the preview immediately (no hard-refresh needed for the markup).

4. **Hard-refresh** (Ctrl/Cmd + Shift + R) once so the personal CSS loads,
   then reload the saved page. English turns into Avatarian glyphs; hover
   shows the label.

5. **Check mobile — this is the whole point.** Open the page on a phone, or
   append `?useskin=minerva` (or your wiki's mobile skin) to the URL. Because
   there's no JS, the glyphs render there too. (Personal `common.css` may not
   apply to the mobile skin; if the glyphs are unstyled on mobile, that's
   expected until step 3 of go-live puts the CSS on `Fandommobile.css`.)

## 3. Going site-wide (admin / interface-editor rights)

1. Paste `wiki/Module_Avatarian.lua` into **`Module:Avatarian`**.
2. Paste `wiki/Avatarian-css-only.css` into **BOTH** `MediaWiki:Common.css`
   (desktop) **and** `MediaWiki:Fandommobile.css` (mobile — a separate page).
3. Create/confirm **`Template:Avatarian`** from `wiki/Template_Avatarian.wiki`
   (its body is `{{#invoke:Avatarian|render|{{{1|}}}|{{{2|}}}}}`).

Then articles use `{{Avatarian|k uh t ah r uh|Katara}}`, and you can delete
`Module:Avatarian/sandbox` and remove the CSS from your personal `common.css`.

## If glyphs don't appear

- **`Script error` / red error text where the glyphs should be** — a Lua
  problem. Re-paste `Module_Avatarian.lua` whole (partial paste truncates the
  module), and confirm you invoked the right module name (`Avatarian/sandbox`
  vs `Avatarian`).
- **Boxes/blanks, no shapes** — the CSS didn't load. Re-check
  `Special:MyPage/common.css`, hard-refresh; on mobile, the CSS must be on
  `Fandommobile.css` (step 3).
- **`{{#invoke:…}}` shows as literal text** — Scribunto isn't enabled, or the
  module page name is wrong. `Special:Version` should list "Scribunto".

To get the sounds for any word, type it into the translator and copy what
appears in its **Sounds** box.
