#!/usr/bin/env python3
"""
Generate the Avatarian Scribunto (Lua) module from the glyph manifest and the
sounds syntax. This is how {{Avatarian|sounds}} renders on the wiki: Fandom's
mobile skin runs no site JS, so a client-side gadget shows only fallback English
on phones (see DEVELOPMENT.md, "Rendering on the wiki"). This module renders the
glyphs into the page HTML server-side, which every skin serves.

It emits the SAME `av-*` markup that tools/build_css_only.py styles, so
the two paths render identically. The string->markup logic (pairing, nulls,
orientation, clusters, marks) is ported from site/js/render.js and the code
lookups from site/js/sounds.js; the DATA tables below are read straight from
those files so they can't drift. Guard the port with tests/lua_golden.test.js,
which renders every corpus word through both the JS and this Lua and diffs.

Run:  python3 tools/build_lua_module.py [out.lua]   (default: wiki/Module_Avatarian.lua)
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "site" / "js" / "manifest.js"
SOUNDS = ROOT / "site" / "js" / "sounds.js"
OUT = ROOT / "wiki" / "Module_Avatarian.lua"


def brace_object(src, after):
    """The first {...} literal following the marker `after`, as JSON."""
    i = src.index("{", src.index(after))
    depth, j = 0, i
    while j < len(src):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return json.loads(src[i:j + 1])


def js_object(src, name):
    """A `const NAME = { ... };` object literal from sounds.js, as a dict.

    These are plain string:string maps with // comments and trailing commas —
    not JSON. Strip the comments, then read the "key": "val" pairs in order.
    """
    i = src.index("{", src.index("const " + name))
    depth, j = 0, i
    while j < len(src):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    body = src[i + 1:j]
    body = re.sub(r"//[^\n]*", "", body)
    pairs = re.findall(r'"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"', body)
    unescape = lambda s: s.encode().decode("unicode_escape").encode("latin1").decode("utf8")
    return [(unescape(k), unescape(v)) for k, v in pairs]


def lua_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def lua_map(name, pairs):
    body = ", ".join(f"[{lua_str(k)}]={lua_str(v)}" for k, v in pairs)
    return f"local {name} = {{{body}}}"


def lua_ink(ink):
    """{column: [[y0, y1], ...]} as a Lua table keyed by the column number."""
    return "{" + ",".join(
        "[%s]={%s}" % (col, ",".join("{" + ",".join("%d" % n for n in h) + "}" for h in hits))
        for col, hits in ink.items() if hits) + "}"


def main(out=None):
    """Write the file. `out` overrides the default path under wiki/."""
    out = pathlib.Path(out) if out else OUT
    man = MANIFEST.read_text(encoding="utf-8")
    snd = SOUNDS.read_text(encoding="utf-8")
    glyphs = brace_object(man, "AVATARIAN_GLYPHS")
    tweaks = brace_object(man, "AVATARIAN_BLOCK_TWEAKS")

    # --- code -> IPA lookups, straight from sounds.js -------------------------
    readable = js_object(snd, "READABLE")
    readable_aliases = js_object(snd, "READABLE_ALIASES")
    sound_aliases = js_object(snd, "SOUND_ALIASES")

    # --- glyph metadata, only the fields the renderer reads -------------------
    glyph_rows, wide_marks = [], []
    for key, g in glyphs.items():
        name, typ = g["name"], g.get("type")
        fields = [f"name={lua_str(name)}", f"type={lua_str(typ)}"]
        if g.get("rows") == 4:
            fields.append("rows=4")
        if g.get("flips"):
            fields.append("flips=true")
        if (g.get("variants") or {}).get("cluster"):
            fields.append("cluster=true")
        # Joins (render.js joinsFor): the glyph's emitters, and where its ink
        # sits on the columns emitters use — `ink` for the base form, `cink`
        # for the cluster form.
        if g.get("emit"):
            fields.append("emit={" + ",".join("{%d,%d,%d}" % tuple(e) for e in g["emit"]) + "}")
        if any(g.get("ink", {}).values()):
            fields.append("ink=" + lua_ink(g["ink"]))
        cink = ((g.get("variants") or {}).get("cluster") or {}).get("ink") or {}
        if any(cink.values()):
            fields.append("cink=" + lua_ink(cink))
        # Dots that block a join, the same two ways.
        if g.get("dots"):
            fields.append("dots=" + lua_ink(g["dots"]))
        cdots = ((g.get("variants") or {}).get("cluster") or {}).get("dots")
        if cdots:
            fields.append("cdots=" + lua_ink(cdots))
        if g.get("gaps"):
            fields.append("gaps=" + lua_ink(g["gaps"]))
        cgaps = ((g.get("variants") or {}).get("cluster") or {}).get("gaps")
        if cgaps:
            fields.append("cgaps=" + lua_ink(cgaps))
        # Alternate drawings (render.js resolveGlyph `alt`): the mask class
        # each is drawn with, and its own ink profile for joins into it.
        alts = []
        for label, v in sorted((g.get("variants") or {}).items()):
            if label == "cluster":
                continue
            f = [f"name={lua_str(v['name'])}"]
            if v.get("emit"):
                f.append("emit={" + ",".join("{%d,%d,%d}" % tuple(e) for e in v["emit"]) + "}")
            for k in ("ink", "dots", "gaps"):
                if any((v.get(k) or {}).values()):
                    f.append(f"{k}=" + lua_ink(v[k]))
            alts.append(f"[{lua_str(label)}]={{{', '.join(f)}}}")
        if alts:
            fields.append("alts={" + ", ".join(alts) + "}")
        glyph_rows.append(f"  [{lua_str(key)}]={{{', '.join(fields)}}},")
        # A mark whose box is wider than the 1-column 36 gets a wide class so
        # its mask keeps proportion: av-wide for 2 columns (`?`, at 52),
        # av-wide3 for 3 (the numerals, at 68). Matches makeMark's per-mark
        # aspect-ratio in render.js, coarsened to a class.
        if typ and typ.startswith("mark"):
            m = re.search(r'viewBox="0 0 ([\d.]+)', g.get("svg", ""))
            cols = round((float(m.group(1)) - 20) / 16) if m else 1
            if cols > 1:
                wide_marks.append((key, "av-wide" if cols == 2 else f"av-wide{cols}"))

    data = "\n".join([
        lua_map("READABLE", readable),
        lua_map("READABLE_ALIASES", readable_aliases),
        lua_map("SOUND_ALIASES", sound_aliases),
        "local MARK_WIDE = {" + ", ".join(f"[{lua_str(k)}]={lua_str(c)}" for k, c in wide_marks) + "}",
        # Per-block tweaks (render.js BLOCK_TWEAKS): how far /z/'s dots drop
        # where both survive.
        "local BLOCK_DOTS = {" + ", ".join(f"[{lua_str(k)}]={t['dots']:g}" for k, t in sorted(tweaks.items()) if t.get("dots")) + "}",
        # ... and how far a join runs in a block (render.js joinsFor `reach`).
        "local BLOCK_REACH = {" + ", ".join(f"[{lua_str(k)}]={lua_str(t['reach'])}" for k, t in sorted(tweaks.items()) if t.get("reach")) + "}",
        # ... and which alternate drawing a slot's glyph uses in a block.
        "local BLOCK_ALT = {" + ", ".join(
            f"[{lua_str(k)}]={{" + ", ".join(f"{s}={lua_str(t[s])}" for s in ("top", "bottom") if t.get(s)) + "}"
            for k, t in sorted(tweaks.items()) if t.get("top") or t.get("bottom")) + "}",
        "local GLYPH = {",
        "\n".join(glyph_rows),
        "}",
    ])

    out.write_text(LOGIC.replace("--[[DATA]]--", data), encoding="utf-8")
    print(f"Wrote {out} — {len(glyph_rows)} glyphs, {round(out.stat().st_size / 1024, 1)} KB")


# The renderer. Everything below the DATA marker is hand-written Lua ported from
# site/js/render.js (pairing / nulls / orientation / clusters / marks) and
# sounds.js (normaliseSound). It emits the av-* markup that build_css_only.py
# styles. Kept honest by tests/lua_golden.test.js.
LOGIC = r'''-- ===== Avatarian — Scribunto renderer (server-side, works on mobile) =========
-- GENERATED by tools/build_lua_module.py from site/js/manifest.js and
-- site/js/sounds.js. Do not hand-edit — regenerate. Emits the same av-* markup
-- that wiki/Avatarian-css-only.css styles (see DEVELOPMENT.md). Ported from
-- render.js; guarded by tests/lua_golden.test.js (JS vs Lua over the corpus).
-- Designed by [[User:TechFilmer]].
local p = {}

--[[DATA]]--

-- These are decisions of the SCRIPT, tied to specific sounds, so they live in
-- the logic beside the code that reads them (render.js keeps them the same way).
local NULL_V, NULL_C = "∅", "∅c"
local DRAWN_BOTTOM_UP    = { ["u"]=true, ["ɔ"]=true, ["ʊ"]=true }
local TURNS_IN_CLUSTER   = { ["ɹ"]=true, ["j"]=true, ["w"]=true }
local TURNS_ABOVE_CLUSTER = { ["s"]=true }
local UNREADABLE = "*"
local HEIGHT = { consonant="av-consonant", vowel="av-vowel",
                 null="av-null-v", null_consonant="av-null-c" }

local function isNull(s) return s == NULL_V or s == NULL_C end

-- Split trailing markers off a token: a $/% orientation override and/or a `_c`
-- cluster-form request. All three are ASCII, so byte-indexing a UTF-8 token is
-- safe here (a multibyte sound's last byte never equals $ % or the `_c` pair).
local function parseSymbol(token)
  local rest, forced, variant = token, nil, nil
  local last = rest:sub(-1)
  if last == "$" then forced, rest = "top", rest:sub(1, -2)
  elseif last == "%" then forced, rest = "bottom", rest:sub(1, -2) end
  if rest:sub(-2) == "_c" then variant, rest = "cluster", rest:sub(1, -3) end
  return rest, forced, variant
end

-- One typed token -> the manifest symbol, override suffix preserved. IPA (and
-- its aliases) first, then the readable codes case-insensitively (string.lower
-- only touches ASCII, which is all the code keys are), then the token as-is.
local function normaliseSound(token)
  local rest, over = token, ""
  local last = rest:sub(-1)
  if last == "$" or last == "%" then over, rest = last, rest:sub(1, -2) end
  local cluster = ""
  if rest:sub(-2) == "_c" then cluster, rest = "_c", rest:sub(1, -3) end
  local suffix = cluster .. over
  if SOUND_ALIASES[rest] then return SOUND_ALIASES[rest] .. suffix end
  local lower = rest:lower()
  if READABLE[lower] then return READABLE[lower] .. suffix end
  if READABLE_ALIASES[lower] then return READABLE_ALIASES[lower] .. suffix end
  return rest .. suffix
end

local function isVowel(token)
  if token == nil then return false end
  local e = GLYPH[(parseSymbol(token))]
  return e ~= nil and e.type == "vowel"
end

-- The null written beside `partner`: a vowel takes the tall (consonant-height)
-- null, a consonant the short one. A null with no vowel partner stays short.
local function nullFor(partner)
  return isVowel(partner) and NULL_C or NULL_V
end

-- True when the block partner is another consonant — i.e. a C-C block.
local function isClusterPartner(partner)
  if partner == nil or isVowel(partner) then return false end
  return not isNull((parseSymbol(partner)))
end

-- Which way round a glyph goes, before any explicit $/% override.
local function orientationOf(sym, entry, slot, partner)
  if DRAWN_BOTTOM_UP[sym] then return slot == "bottom" and "top" or "bottom" end
  if entry.flips then return slot end
  local clustered = isClusterPartner(partner)
  if clustered and slot == "bottom" and TURNS_IN_CLUSTER[sym] then return "bottom" end
  if clustered and slot == "top" and TURNS_ABOVE_CLUSTER[sym] then return "bottom" end
  return "top"
end

-- Pair a flat sequence two-to-a-block and resolve every null (a typed null, or
-- the empty final slot) to its tall/short form. The null is part of the
-- spelling, so an empty bottom slot is written, never dropped.
local function resolveBlocks(seq)
  local blocks = {}
  local i = 1
  while i <= #seq do
    local topTok, botTok = seq[i], seq[i + 1]
    local top = isNull(topTok) and nullFor(botTok) or topTok
    local bottom
    if botTok == nil or isNull(botTok) then bottom = nullFor(top) else bottom = botTok end
    blocks[#blocks + 1] = { top = top, bottom = bottom }
    i = i + 2
  end
  return blocks
end

local function esc(s)
  return (s:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;"))
end

-- Which form a slot draws and which way up (render.js resolveGlyph): the
-- cluster form in a C-C block (the r/l pair's top glyph excepted), flipped by
-- its own rule. Shared by glyphSpan and joinSpans, which asks it of the partner.
local function resolveGlyph(sym, forced, variant, e, slot, partner)
  -- A block can name an alternate drawing for this slot (BLOCK_ALT); typed
  -- overrides say otherwise and win. Third result: the alternate's row.
  if not forced and not variant and partner ~= nil and e.alts then
    local pSym = parseSymbol(partner)
    local key = slot == "top" and (sym .. "|" .. pSym) or (pSym .. "|" .. sym)
    local alt = e.alts[(BLOCK_ALT[key] or {})[slot] or ""]
    if alt then return false, false, alt end
  end
  local wantCluster = variant == "cluster"
  local useCluster = false
  if e.cluster then
    if wantCluster then
      useCluster = true
    elseif isClusterPartner(partner) then
      local pSym = parseSymbol(partner)
      local rlPair = (sym == "ɹ" or sym == "l") and (pSym == "ɹ" or pSym == "l") and pSym ~= sym
      if (not rlPair) or slot == "bottom" then useCluster = true end
    end
  end

  local flipped
  if useCluster then
    flipped = wantCluster and (forced == "top") or (not wantCluster and slot == "top")
  else
    local orientation = forced or orientationOf(sym, e, slot, partner)
    if forced and DRAWN_BOTTOM_UP[sym] then
      orientation = forced == "top" and "bottom" or "top"
    end
    flipped = orientation == "bottom"
  end
  return useCluster, flipped
end

-- One glyph span: stem class (g-name, plus _c for a cluster form), height class,
-- av-4row, av-flipped. The cluster/flip choice mirrors makeGlyph in render.js.
-- SVG-level tweaks it makes (/s/'s inset vertex, /z/'s dropped dots) have no
-- CSS-only class and are intentionally not reproduced — the mask path has none.
local joinSpans   -- defined below; glyphSpan asks it whether a dot is replaced

local function glyphSpan(token, slot, partner)
  local sym, forced, variant = parseSymbol(token)
  if sym == UNREADABLE then
    return '<span class="av-glyph av-consonant g-unreadable"></span>'
  end
  local e = GLYPH[sym]
  if not e then
    return '<span class="av-glyph av-missing" title="' .. esc(sym) .. '"></span>'
  end

  local useCluster, flipped, alt = resolveGlyph(sym, forced, variant, e, slot, partner)

  -- Stem class: the glyph name, plus a cluster form. /s/ and /z/ redraw in a
  -- C-C block (clusterForm in render.js): /s/ insets its vertex when the point
  -- faces the one-row overlap, /z/ drops the dot(s) that overlap rides up.
  local stem = e.name .. (useCluster and "_c" or "")
  if alt then
    stem = alt.name     -- drawn exactly as its design has it
  elseif not useCluster and isClusterPartner(partner) then
    if sym == "s" then
      local pointAtOverlap
      if slot == "top" then pointAtOverlap = flipped else pointAtOverlap = not flipped end
      if pointAtOverlap then stem = "s_inset" end
    elseif sym == "z" then
      local pSym = parseSymbol(partner)
      if pSym == "ɹ" then stem = "z_left"      -- right dot dropped, left kept
      elseif pSym == "l" then stem = "z_right"  -- left dot dropped, right kept
      elseif pSym == "m" then                   -- under /m/'s ring both dots stay
        local key = slot == "top" and (sym .. "|" .. pSym) or (pSym .. "|" .. sym)
        local dy = BLOCK_DOTS[key]
        stem = dy and ("z_d" .. dy) or "z"      -- ... dropped `dy` if the block says so
      else stem = "z_none" end
    end
  end
  -- The partner's stem replaces a dot at the seam (/b/ over a stem).
  if partner ~= nil then
    local _, dot = joinSpans(partner, slot == "top" and "bottom" or "top", token)
    if dot then stem = stem .. "_nodot" end
  end
  local cls = "av-glyph g-" .. stem .. " " .. HEIGHT[e.type]
  if e.rows == 4 then cls = cls .. " av-4row" end
  if flipped then cls = cls .. " av-flipped" end
  return '<span class="' .. cls .. '"></span>'
end

-- A full-height mark: nine rows tall, one column (two for `?`, three for a
-- numeral), unpaired.
local function markSpan(sym)
  local m = GLYPH[sym]
  local cls = "av-mark g-" .. m.name
  if MARK_WIDE[sym] then cls = cls .. " " .. MARK_WIDE[sym] end
  return '<span class="' .. cls .. '"></span>'
end

local function isMark(sym)
  local e = GLYPH[sym]
  return e ~= nil and e.type ~= nil and e.type:sub(1, 4) == "mark"
end

-- True when a slot reads as a consonant for the C-C overlap test: a real
-- consonant, or the unreadable `*` (drawn consonant-height, like render.js).
local function slotIsConsonant(token)
  local sym = parseSymbol(token)
  if sym == UNREADABLE then return true end
  local e = GLYPH[sym]
  return e ~= nil and e.type == "consonant"
end

-- The rail a glyph carries for an approximant partner (render.js railFor): in
-- every C-C block the approximant's long side runs on through the partner, as
-- its own span over the glyph.
local RAIL_SIDE = { ["l"]="l", ["ɹ"]="r" }   -- not /w/ or /j/, as in render.js
local function railSpan(token, slot, partner)
  local sym, forced, variant = parseSymbol(token)
  local pSym = parseSymbol(partner)
  if not RAIL_SIDE[pSym] or sym == UNREADABLE then return "" end   -- `*` draws no rail, as in render.js
  if GLYPH[sym] then   -- an alternate drawing carries no rail
    local _, _, alt = resolveGlyph(sym, forced, variant, GLYPH[sym], slot, partner)
    if alt then return "" end
  end
  if not (slotIsConsonant(token) and isClusterPartner(partner)) then return "" end
  local pe = GLYPH[pSym]
  if not (pe and pe.cluster) then return "" end
  local rlPair = (pSym == "ɹ" or pSym == "l") and (sym == "ɹ" or sym == "l") and pSym ~= sym
  if rlPair and slot == "bottom" then return "" end   -- the partner is on top: base form
  return '<span class="av-rail av-rail-' .. RAIL_SIDE[pSym] .. '"></span>'
end

-- JOINS (render.js joinsFor): a stroke from an emitter on one glyph on to its
-- partner's first ink in that column. The site draws it inside the glyph's
-- SVG; a mask can't take a second layer, so here each join is its own span in
-- the slot, like a rail. Geometry is in viewBox units (100 to the 1.25em box).
local TALL = { consonant=true, null_consonant=true }
local function boxHeight(e) return TALL[e.type] and 100 or 80 end

-- Where a glyph's box sits in its block, as the stylesheet stacks it.
local function placeGlyph(e, flipped, slot, topHeight, cc)
  local H = boxHeight(e)
  local threeRow = H == 80 and e.rows ~= 4
  local shift = 0
  if threeRow and slot == "top" and not flipped then shift = -16 end
  if threeRow and slot == "bottom" and flipped then shift = 16 end
  local y0 = 0
  if slot == "bottom" then y0 = topHeight - (cc and 36 or 18) end
  return { y0 = y0, H = H, shift = shift, flipped = flipped }
end

local function toSlot(pl, y)
  return pl.shift + (pl.flipped and (pl.H - y) or y)
end

local function receivesJoin(e)
  return e.type == "consonant" or (e.type == "vowel" and e.rows == 4)
end

-- Viewbox units -> em, as a fixed four-decimal string (100 units = 1.25em),
-- built from integers so the JS test serialiser prints the same bytes.
local function em(u)
  local n = math.floor(u * 125 + 0.5)
  local neg = n < 0
  if neg then n = -n end
  return (neg and "-" or "") .. string.format("%d.%04d", math.floor(n / 10000), n % 10000)
end

local JOIN_MAX = 40   -- render.js JOIN_MAX
local JOIN_OPEN = 20  -- render.js JOIN_OPEN
local JOIN_DOT = 20   -- render.js JOIN_DOT
local JOIN_W = 13   -- the mask's display stroke weight (build_css_only.py)
function joinSpans(token, slot, partner)
  if partner == nil then return "" end
  local sym, forced, variant = parseSymbol(token)
  local pSym, pForced, pVariant = parseSymbol(partner)
  local me, them = GLYPH[sym], GLYPH[pSym]
  if not (me and them) then return "" end
  local other = slot == "top" and "bottom" or "top"
  local myCluster, myFlipped, myAlt = resolveGlyph(sym, forced, variant, me, slot, partner)
  local theirCluster, theirFlipped, theirAlt = resolveGlyph(pSym, pForced, pVariant, them, other, token)
  -- A cluster form does not emit; an alternate has emitters of its own.
  local emit = myAlt and myAlt.emit or (not myAlt and me.emit) or nil
  if myCluster or not emit then return "" end
  local key = slot == "top" and (sym .. "|" .. pSym) or (pSym .. "|" .. sym)
  local reach = BLOCK_REACH[key]
  if reach == "none" then return "" end
  local explicit = reach == "open" or reach == "first" or reach == "second"
  if not explicit and not receivesJoin(them) then return "" end
  local cc = me.type == "consonant" and them.type == "consonant"
  local topHeight = boxHeight(slot == "top" and me or them)
  local mine = placeGlyph(me, myFlipped, slot, topHeight, cc)
  local theirs = placeGlyph(them, theirFlipped, other, topHeight, cc)
  local ink = (theirCluster and them.cink or them.ink) or {}
  local dots = (theirCluster and them.cdots or them.dots) or {}
  local gaps = (theirCluster and them.cgaps or them.gaps) or {}
  if theirAlt then ink, dots, gaps = theirAlt.ink or {}, theirAlt.dots or {}, theirAlt.gaps or {} end
  local out, tookDot = {}, false
  for _, em3 in ipairs(emit) do
    local x, y, dir = em3[1], em3[2], em3[3]
    local D = mine.flipped and -dir or dir
    if D == (slot == "top" and 1 or -1) then
      local Y = mine.y0 + toSlot(mine, y)
      local hits = {}
      for _, h in ipairs(ink[x] or {}) do
        local u, v = theirs.y0 + toSlot(theirs, h[1]), theirs.y0 + toSlot(theirs, h[2])
        local lo, hi = math.min(u, v), math.max(u, v)
        local behind
        if D > 0 then behind = hi < Y else behind = lo > Y end
        if not behind then
          hits[#hits + 1] = { len = math.max(0, D > 0 and (lo - Y) or (Y - hi)) }
        end
      end
      for _, g in ipairs(gaps[x] or {}) do   -- a mouth the stem closes
        local d = (theirs.y0 + toSlot(theirs, g[1]) - Y) * D
        if d > 0 then hits[#hits + 1] = { len = d, bar = g } end
      end
      for _, h in ipairs(dots[x] or {}) do   -- a dot at the seam receives it
        local u = (theirs.y0 + toSlot(theirs, h[1]) - Y) * D
        local v = (theirs.y0 + toSlot(theirs, h[2]) - Y) * D
        local near = math.min(u, v)
        if near > 0 and near <= JOIN_DOT then hits[#hits + 1] = { len = math.max(u, v), dot = true } end
      end
      if #hits > 0 then
        -- stable order for equal lengths is not needed: the kinds never tie
        table.sort(hits, function(m, n) return m.len < n.len end)
        local hit = hits[math.min(reach == "second" and 2 or 1, #hits)]
        local len = hit.len
        local blocked = false   -- a dot in the way; an explicit reach stands
        -- too deep: rise into the opening and stop short (render.js JOIN_OPEN)
        local open = not hit.bar and not hit.dot and len > JOIN_OPEN
          and (reach == "open" or (not explicit and len > JOIN_MAX))
        if not explicit and not hit.dot then
          for _, h in ipairs(dots[x] or {}) do
            local u = (theirs.y0 + toSlot(theirs, h[1]) - Y) * D
            local v = (theirs.y0 + toSlot(theirs, h[2]) - Y) * D
            if math.max(u, v) > 0 and math.min(u, v) < len then blocked = true end
          end
        end
        if open then len = JOIN_OPEN end
        if len > 0 and not blocked then
          if hit.dot then tookDot = true end
          local a = toSlot(mine, y)
          local b = a + D * len
          out[#out + 1] = '<span class="av-join" style="margin-left:' .. em(x - 50 - JOIN_W / 2)
            .. 'em;top:' .. em(math.min(a, b)) .. 'em;height:' .. em(math.abs(b - a)) .. 'em"></span>'
          if hit.bar and not open then   -- the bar across the mouth it closes
            out[#out + 1] = '<span class="av-join" style="margin-left:' .. em(hit.bar[2] - 50)
              .. 'em;top:' .. em(b - JOIN_W / 2) .. 'em;width:' .. em(hit.bar[3] - hit.bar[2])
              .. 'em;height:' .. em(JOIN_W) .. 'em"></span>'
          end
        end
      end
    end
  end
  return table.concat(out), tookDot
end

-- Render one word's IPA sequence into blocks. Punctuation is NOT paired: it
-- breaks the run so the sounds either side pair among themselves.
local function renderWord(seq)
  local out, run = {}, {}
  local function flush()
    for _, blk in ipairs(resolveBlocks(run)) do
      local cc = slotIsConsonant(blk.top) and slotIsConsonant(blk.bottom)
      out[#out + 1] = '<span class="av-block' .. (cc and " av-cc" or "") .. '">'
        .. '<span class="av-slot av-slot-top">' .. glyphSpan(blk.top, "top", blk.bottom)
        .. railSpan(blk.top, "top", blk.bottom) .. joinSpans(blk.top, "top", blk.bottom) .. '</span>'
        .. '<span class="av-slot av-slot-bottom">' .. glyphSpan(blk.bottom, "bottom", blk.top)
        .. railSpan(blk.bottom, "bottom", blk.top) .. joinSpans(blk.bottom, "bottom", blk.top) .. '</span>'
        .. '</span>'
    end
    run = {}
  end
  for _, tok in ipairs(seq) do
    if isMark((parseSymbol(tok))) then
      flush()
      out[#out + 1] = markSpan((parseSymbol(tok)))
    else
      run[#run + 1] = tok
    end
  end
  flush()
  return table.concat(out)
end

-- Testing seams for tests/lua_golden.test.js: render a resolved IPA array (as
-- the corpus stores it) to one word's block markup, and expose the code->IPA
-- normaliser, so both ports can be diffed against the JS directly.
function p._renderWord(seq) return renderWord(seq) end
function p._normaliseSound(token) return normaliseSound(token) end

-- (anything in parentheses) is a caption for the word, not a sound. A
-- depth-counting scan (not a regex) so a stray or nested bracket never reaches
-- the tokeniser. Ported from splitCaption in sounds.js. Scanned a byte at a
-- time — Scribunto is Lua 5.1, with no `utf8` library and no `goto` — which is
-- exact here: `(` and `)` are ASCII, so they never fall inside a multibyte
-- sound, and body/label reassemble those bytes in order.
local function splitCaption(chunk)
  local depth, body, label = 0, {}, {}
  for i = 1, #chunk do
    local ch = chunk:sub(i, i)
    local skip = false
    if ch == "(" then
      depth = depth + 1
      if depth == 1 then skip = true end
    elseif ch == ")" then
      if depth == 0 then
        skip = true
      else
        depth = depth - 1
        if depth == 0 then label[#label + 1] = " "; skip = true end
      end
    end
    if not skip then
      if depth > 0 then label[#label + 1] = ch else body[#body + 1] = ch end
    end
  end
  local lab = table.concat(label):gsub("^%s+", ""):gsub("%s+$", ""):gsub("%s+", " ")
  return table.concat(body), lab
end

local function trim(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end

-- Parse the sounds text into words: split on "/", strip each word's caption,
-- tokenise on whitespace, normalise each token. (spreadCaptions in sounds.js
-- only reshuffles caption text for the label; it does not touch the glyphs, so
-- the renderer does not need it.)
local function parseWords(text)
  local words = {}
  for chunk in (text .. "/"):gmatch("([^/]*)/") do
    local body, label = splitCaption(chunk)
    local ipa = {}
    for tok in body:gmatch("%S+") do
      -- A run of digits is a number: one numeral per digit
      -- (numberOrSound in sounds.js).
      if tok:match("^%d%d+$") then
        for d in tok:gmatch("%d") do ipa[#ipa + 1] = d end
      else
        ipa[#ipa + 1] = normaliseSound(tok)
      end
    end
    if #ipa > 0 then words[#words + 1] = { ipa = ipa, label = label } end
  end
  return words
end

-- The core: sounds (+ optional English label) -> av-* markup. A lone token with
-- no space or slash draws as one bare glyph (a chart letter); anything else
-- draws as paired blocks, one .av-word-part per /-separated word.
function p._main(sounds, label)
  sounds = trim(sounds or "")
  if sounds == "" then return "" end

  local words = parseWords(sounds)
  local caption = label and trim(label) or ""
  if caption == "" then
    local labs = {}
    for _, w in ipairs(words) do if w.label ~= "" then labs[#labs + 1] = w.label end end
    caption = table.concat(labs, " ")
  end
  local title = caption ~= "" and ' title="' .. esc(caption) .. '"' or ""

  -- Selectable copy text. Every glyph span is an empty CSS mask, so without this
  -- a reader who selects a word copies nothing and sees no selection highlight.
  -- .av-copy is a transparent, selectable text layer that the CSS sits BEHIND the
  -- glyphs (which it lifts above and makes click-through) — so dragging over a
  -- word highlights it like normal text and copies clean text.
  -- A token run's IPA, nulls dropped, in slashes — the copy text when a word (or
  -- a single glyph) has no English caption, e.g. /k ə t ɑ r ə/ or /ŋ/.
  local function ipaText(ipa)
    -- Parse first, keeping nulls, so the ə/ɹ adjacency that marks the NURSE
    -- vowel (ɜ) can be judged before the nulls drop out. Mirrors sounds.js
    -- nurseVowel: an ə directly before ɹ reads ɜ; a schwa a null keeps apart
    -- from the next ɹ (as in "around") stays ə. Display only.
    local syms = {}
    for _, tok in ipairs(ipa) do syms[#syms + 1] = parseSymbol(tok) end
    local out = {}
    for i, s in ipairs(syms) do
      if not isNull(s) then
        if s == "ə" and syms[i + 1] == "ɹ" then s = "ɜ" end
        out[#out + 1] = s
      end
    end
    return "/" .. table.concat(out, " ") .. "/"
  end

  local function overlay(text)
    if text == "" then return "" end
    return '<span class="av-copy">' .. esc(text) .. '</span>'
  end

  -- Solo: one token, no space and no slash (e.g. {{Avatarian|ng}}).
  -- A number is never a chart glyph: {{Avatarian|3}} is a number in running
  -- text, drawn at text size like {{Avatarian|2026}}, not the 1.4em of .av-solo.
  -- So any lone token that is digits (or @, the old zero) takes the word path.
  local loneNumber = sounds:match("^%d+$") or normaliseSound(sounds):match("^%d$")
  if not sounds:find("[%s/]") and not loneNumber then
    local ipa = normaliseSound(sounds)
    local sym = parseSymbol(ipa)
    local inner = isMark(sym) and markSpan(sym) or glyphSpan(ipa, "top", nil)
    return '<span class="av-word av-solo"' .. title .. '>'
      .. overlay(caption ~= "" and caption or ipaText({ipa})) .. inner .. '</span>'
  end

  if #words == 0 then return "" end

  -- Spread the caption over the /-separated parts so each word highlights and
  -- copies its own English: one caption word per part when the counts match (the
  -- usual case), else the whole caption rides the first part so a phrase still
  -- copies once and clean. A leading space on later parts keeps a multi-word copy
  -- spaced. With no caption a part copies its own sounds.
  local capWords = {}
  for wd in caption:gmatch("%S+") do capWords[#capWords + 1] = wd end
  local parts = {}
  for i, w in ipairs(words) do
    local text
    if #capWords == #words then text = capWords[i]
    elseif caption ~= "" then text = (i == 1) and caption or ""
    else text = ipaText(w.ipa) end
    if i > 1 and text ~= "" then text = " " .. text end
    parts[#parts + 1] = '<span class="av-word-part">' .. overlay(text) .. renderWord(w.ipa) .. '</span>'
  end
  return '<span class="av-word"' .. title .. '>' .. table.concat(parts) .. '</span>'
end

-- {{#invoke:Avatarian|render|<sounds>|<label>}} — the template's entry point.
function p.render(frame)
  local args = frame.args
  return p._main(args[1], args[2])
end

return p
'''


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
