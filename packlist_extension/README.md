# HTML Speak Tool — Order Pack List

Voice packing added **on top of** the dashboard's Order Pack List page. The pack list UI is not
changed, restyled or rebuilt — the tool reads the page and adds a control bar.

**Live:** Varmen AIOS hub, slug `speak_tool` —
<https://varman-aios-hub-varmens.vercel.app/view/hub_pages/speak_tool>
**Last updated:** 2026-10-05

---

## Three ways to run it

### 1. The loader page (what the hub serves)

`packlist_upload/Speak-Tool.html` — identical to `packlist_extension/speak-loader.html` — is one
self-contained page. Drop the day's **Order Packing HTML** on it and the page **becomes** the pack
list with the tool running.

- **Several files at once** are merged into one continuous run. Order is by the **number in the file
  name** (`1, 2 … 9, 10, 11`, never `1, 10, 11, 2`); unnumbered files follow alphabetically.
- Orders are merged into the pack list's own `<ul>`, using the dashboard's own markup. The control
  bar shows the source file: `Order 7 of 40 · file 2`.
- The page's own **"Total Orders: N"** is corrected to the merged total.
- **Survives a refresh.** The merged page is kept in IndexedDB (`stxSpeakTool`), and the packer's
  position, held orders and pass state in `sessionStorage` (`stxPos`). **← Open another** clears it
  and returns to the chooser.
- **Save a copy** writes `<name>.speak.html` with the tool inside. ⚠️ **Does not work on the Varmen
  AIOS hub** — the hub's iframe sandbox has no `allow-downloads`, so Chrome blocks it silently while
  the page still says "Saved". Works when the loader is opened directly.

### 2. One line on the live dashboard

```html
<script src="packlist-speak.js"></script>
```

before `</body>` of the pack list page. Serve it from the **same origin**, or the page's
Content-Security-Policy may block it.

### 3. A pack list saved to disk

```bash
node packlist_extension/add-speak.js ~/Downloads/packlist-today.html   # writes packlist-today.speak.html
node packlist_extension/add-speak.js a.html b.html c.html               # several
node packlist_extension/add-speak.js a.html --link                      # link instead of inline
node packlist_extension/add-speak.js a.html --force                     # overwrite existing output
```

The original is never modified. Running it twice is safe.

### Voice needs http(s)

`file://` has origin `null`, and Chrome cannot grant a microphone to it. Speech output, buttons and
keys still work; **voice commands do not**. Serve the file instead:

```bash
node packlist_extension/serve.js ~/Downloads/11.speak.html   # opens http://localhost:8000/11.speak.html
```

It picks another port if 8000 is busy and serves only that folder. The hub is served over https, so
voice works there.

---

## The control bar

| Control | Action |
|---|---|
| **← Open another** | Back to the file chooser (loader only) |
| **Restart** | Asks *"Restart from the first order?"* — answer **Yes** by button, **Enter**, or voice |
| **Back** | Previous component, then the previous order |
| **Postcode** | Reads just the postcode; position unchanged |
| **Pause** | Pause / resume speech (verified resume — re-speaks if Chrome's resume is silent) |
| **Repeat** | The current component again |
| **Next** | Next component; after the last, the next order (page scrolls to it) |
| **Hold** | Set the current order aside and carry on |
| **Held (N)** | Pack the held orders now |
| **Zoom on/off** | Auto-zoom of the product being spoken |
| **⚙ Voice** | Settings panel (below). Close with **×** or the Voice button |
| **Mic** | Turn recognition on/off |
| Mic chip | Listening state + live level meter |
| **▾** | Collapse the bar |

Status chip: `Remaining N of M`, `Held pass · x of y left`, or `✓ All orders completed`.

Since 2026-10-05 the bar also shows the **order type / merge label** next to the position chip, and
a **details panel** (QTY, postcode) beside the spoken text, read from the same line that is about to
be spoken so the screen and the voice never disagree. The spoken-text row now wraps instead of
truncating long names. **Postcode** (button or auto-reached in the queue) scrolls the page to the
postcode line as it is read, not just the product image.

**Keyboard:** `→` Next · `←` Back · `↑` Repeat · `↓` Pause · `Enter` Restart (or **Yes** while a
question is open) · `Esc` closes zoom (or **No** while a question is open). Ignored while typing in
one of the page's own fields.

### Settings panel

Speaking language · **Listening accent** (English UK / India–South Asia / US, remembered per browser)
· Voice · **Names** status with **Refresh Names** · Speed (Slow 0.6 · Normal 0.7 · Fast 1.2 · Faster
1.5).

### Hold

**Hold** sets the whole order aside (a collection card is held with its order). **Held (N)** starts a
held pass that speaks only held orders and skips their collection cards (already collected). When the
held pass ends, the tool returns to **where the normal pass was left**, and the Next that ended the
pass is applied there: mid-order → next component; finished order → next order. The saved position
survives a refresh.

### Finished

When every order — normal and held — is done, a **Finished** card shows orders packed, collections,
and pack lists merged, with **Start again** (goes through the Restart confirmation) and **Close**.

---

## Voice commands

Recognition is **continuous**, **final results only**, **one alternative**, language from the
Listening accent setting. The **last** command word in a transcript wins, because the tool's own
speech is transcribed before the packer's. Identical commands within **1 second** are treated as one.
A health check every 2 seconds restarts the recogniser if it has stopped. The microphone is opened
once (`getUserMedia`), shared by recognition and the level meter.

| Say | Action | Notes |
|---|---|---|
| next · forward · go on · go next | Next | |
| back · previous · prev | Back | |
| repeat · again · respeak | Repeat | |
| post code · postcode | Postcode | Ignored **while the tool is speaking** — it says ":Post Code:" itself |
| restart · start · start again | Restart | Opens the confirmation |
| pause / resume · unpause | Pause / Resume | One-way each |
| hold · held · holt · halt · old · cold · bold · fold · told · gold · *call girl* | Hold | While the tool is speaking, only a **strong** word counts (hold, keep, park, later, skip, aside, pending, wait) — `gold` is a colour it reads out |
| keep · park · later · skip · aside · pending · wait | Hold | |
| set it aside · pack later · skip this · park it … | Hold | Two-word forms, recognised more reliably |
| show held · held orders · pending orders · show the list … | Held | |
| **yes** · yeah · yep · yup · confirm · correct | Yes | **Only while a question is open**; ignored while the tool is speaking |
| **no** · nope · nah · cancel | No | Only while a question is open |

Every added word was checked against the 10,312 catalogue strings in `reference-data.js`. Rejected on
purpose: `ok`, `okay`, `right`, `sure` (filler — would confirm by accident); `hole`, `open`.

`STX.misses` in the console lists transcripts that matched nothing — that is how new mishearings are
found. `STX.debug = true` logs every recognition event.

---

## What it says, and in what order

**Names come from the master sheet only**, never the marketplace title. Lookup order:
**live Names Master Sheet** (CSV, fetched in the background, cached 6 hours in `localStorage`) →
built-in names in `reference-data.js` → the SKU with its pack suffix removed. A failed or truncated
fetch (< 500 rows) never lowers the built-in names. No name → **"This one"** plus the colour.

**The postcode is always last**, spelled character by character, riding on the last component.

**Counts:** the component's own count where the page gives one, otherwise quantity × pack code —
`1PK`–`9PK`=1–9, `APK`=10, `BPK`=15, `CPK`=20, `DPK`=30, `EPK`=50, `FPK`=100, `GPK`=12, `HPK`=16,
`IPK`=24, `JPK`=75, `KPK`=150, `LPK`=11, `MPK`=80, `NPK`=200, `OPK`=250, `PPK`=300, `QPK`=500,
`RPK`=1000, `SPK`=25 (full table and the matching `Engine.baseSku()` helper in `engine.js`, extended
2026-10-05 from the Flask-prototype table to cover codes seen in later pack lists). An unrecognised
suffix is treated as pack size 1, not stripped — `Engine.baseSku()` only strips a suffix it
recognises, which is what name lookup now uses instead of the old blanket `/\d*A?PK$/` regex.

**Colours:** Lampshade SOT first, then the SKU suffix table.

### Packing priority (per order)

| Order has a Rectangle Ceiling Rose | Order has none |
|---|---|
| 1 Rect Ceiling Rose | 1 Lampshade (`LS*`, `WCWD*`) |
| 2 Lampshade | 2 WC cage (`WC*` except `WCWD`) |
| 3 WC cage | 3 Bulb |
| 4 Bulb | 4 Ceiling Rose = Other |
| 5 Ceiling Rose = Other | |

Stable sort; Rose and Other tie. **No Lampshade and no Ceiling Rose → no reordering.**

### Merge orders

On the pack list, one order `<li>` with several product blocks (`…-0-li`, `…-1-li`) is a merge. In
the 13 test pack lists, every multi-block order is merge-tagged and no single order has more than one
block.

1. Each sub-order is sorted on its **own** contents — the Rect Rose test is per sub-order.
2. The **sub-orders are sequenced**: each gets its product ranks (best first); sub-orders are compared
   position by position; a full tie keeps the original order.
   `Lampshade + Rect Rose` → `Rect Rose + …` → `Lampshade + Rose` → `Bulb + Holder`.
3. If no sub-order has a Lampshade or Ceiling Rose, the merge keeps its original order.

### Lampshade collections

A collection is its own step, spoken **before** the order that triggered it.

- **List 1 — "These orders only"**: `LSBS LSSS LSWE WCCY LSCYRO LSBG LSCG LSFG LSGD LSGG LSGL WCB WCD
  WCWD`. Walks the run of consecutive orders carrying the family. A run of **one** order is not shown.
- **List 2 — "Whole pack list"**: `LSCY2 LSDM LSDO LSEL LSFT LSHH LSHM LSLC LSLT LSMS LSOL LSRP LSTF
  LSTL LSTM LSUL LSWD`.
- Longest prefix wins (`LSCYRO` → list 1, `LSCY290` → list 2).
- **Limit 10 per collection** (`Engine.MAX_COLLECTION`), per list. The triggering order is always
  completed; if it alone exceeds 10 the card is flagged.
- The card shows each shade's **master-sheet name** when the SKU (or its pack-suffix base) is in the
  Lampshade SOT, plus SKU, colour, size and count.
- Collection speech is read at **0.75 × the chosen speed** (minimum 0.4). Other speech is unchanged.

### Not spoken

**Send Order Instruction** — the pack list page has no field for it. The Google Sheets tool does
speak it.

**Instruction QR** changed 2026-10-05: it **is now spoken** when the pack list page shows an
`Instruction QR` badge on the order. It rides with the postcode, after it, on the last component.
Before 2026-10-05 it was parsed but never spoken — this handover closes that gap.

Also added 2026-10-05: each order's **type and merge status** (e.g. "Amazon Shipping Prime. Merge
Order.") is now announced before the first component, read from the pack list's own order-type
label (falling back to the source file name). This also shows as a label on the control bar.

---

## Page guarantees

Everything the tool adds lives in one `#stx-root` container; removing it removes the tool. No
existing element is edited, removed or restyled. The one mark on the page is a CSS `outline` on the
order being packed (takes no layout space). `STX.highlight = false` removes it.

```js
STX.zoom = 'auto'    // default: page's own zoom if it has one, otherwise the tool's
STX.zoom = 'own' | 'native' | 'off'
STX.listenWhileSpeaking = true   // false if a station without a headset hears itself
STX.meter = true                 // live microphone level
```

---

## Files and build

```
packlist_extension/
  src/speak-extension.js           UI, speech, voice, hold, collections view   (edit)
  src/names-live.js                live Names Master Sheet layer                (edit)
  src/speak-loader.template.html   the loader page                              (edit)
  build.js                         bundles the sources
  packlist-speak.js                GENERATED bundle — do not edit
  speak-loader.html                GENERATED loader with the bundle embedded (base64)
  add-speak.js                     inject the tool into a saved pack list
  serve.js                         serve over http so the mic works
  demo/1.html … 13.html            test pack lists with the one <script> line added

speak_tool_html_sheet_UI/
  engine.js                        packing rules, collections, parsing        (edit)
  reference-data.js                names master + Lampshade SOT, built in

packlist_upload/Speak-Tool.html    GENERATED — the file uploaded to the hub
```

`build.js` concatenates, in order: `reference-data.js` → `engine.js` → `names-live.js` →
`speak-extension.js`, into `packlist-speak.js`; then embeds that as base64 into the template to
produce `speak-loader.html` and `packlist_upload/Speak-Tool.html`. It refuses to build if the
template's inline script contains a literal `<script` or `<!--`.

```bash
node packlist_extension/build.js
```

**Always rebuild before uploading.** A source edit is not in `Speak-Tool.html` until the build runs.
A saved `.speak.html` keeps the version it was built with.

### Tests

```bash
node evidence/live-names-tests.js          # runs against the BUILT bundle
node evidence/hold-feature-tests.js
node evidence/html-order-details-tests.js  # pack-size table, order type, merge tag,
                                            # Instruction QR — needs jsdom (see below)
```

`html-order-details-tests.js` (added 2026-10-05) requires **jsdom**, which is not in
`package.json` — install it first (`npm install jsdom`, or point `NODE_PATH` at an existing
install) or the run fails with `Cannot find module 'jsdom'`. It compares the working tree's
`engine.js` against `git show HEAD:speak_tool_html_sheet_UI/engine.js` (or
`STX_BASELINE_ENGINE` if set), so it is most useful run **before committing** a change to
confirm order count and sequence are unaffected.

---

## Requirements

- **Chrome.** `SpeechRecognition` is Chrome-only and cloud-backed (needs network). Speech output is
  local. Buttons and keys always work.
- **http(s)** for voice commands.
- Network access to `docs.google.com` for live names; without it the built-in names are used.
- Nothing is written back: no order, sheet or dashboard record is changed.
