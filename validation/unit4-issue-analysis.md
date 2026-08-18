# Unit 4 — Issue-by-Issue Root Cause Analysis

**Data sheet:** [`1XPvIv32…`](https://docs.google.com/spreadsheets/d/1XPvIv32Fcj6zWABZRfx1u7h2TJ8px1VrJpqqyC9QCF8/edit?gid=0) — *Unit 4 speak tool*
**Issue sheet:** [`1uN-9zD…` gid=1959868645](https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=1959868645) — *Unit 4* tab, **59 issues**
**Code:** [`scripts/Unit 4 speak tool/`](../scripts/Unit%204%20speak%20tool/) — 6 files, 1,263 lines
**Status:** Analysis only. **No code changed.**

---

## 0. Critical context — Unit 4 runs a different version

Fingerprinting all six station copies (md5 of each file):

| Station | `Lithursan.gs` | `cleaned.gs` |
|---|---|---|
| Copy of jana speak | `086c35e6` — 1288 L | `00b8cedb` — 345 L |
| **Unit 4** | **`625c098a` — 703 L** | **`7a19fd3f` — 296 L** |
| Kronen | `625c098a` — 703 L | `af9a549b` — 263 L |
| Unit 3 Lampshade | `cf36959f` — 948 L | `7a19fd3f` — 296 L |
| Schmutter | `cf36959f` — 948 L | `af9a549b` — 263 L |
| Person 2 | `cea32a68` — 703 L | `af9a549b` — 263 L |

**Two findings that drive everything below:**

1. **Unit 4's `cleaned.gs` is byte-identical to Unit 3 Lampshade's.** Every cleaning-pipeline defect
   is shared exactly.
2. **Unit 4's `Lithursan.gs` is the 703-line variant, which has NO order-grouping logic at all.**
   Unit 3 Lampshade and Schmutter run a 948-line version that *does* group combo/merge rows into a
   single spoken order. Unit 4 does not. Verified: `combinedGroups`, `processedIndices` and
   `groupKey` have **zero occurrences** in Unit 4's file; the builder is a flat
   `dataRange.forEach(row => …)` at `Lithursan.gs:56`.

> **This single architectural gap explains 12 of the 59 tickets.** Unit 4 physically cannot speak
> "Component 1 of 3" because it never assembles a group.

### Unit 4 file map

| File | Lines | Contains | Wired up? |
|---|---:|---|---|
| `action.gs` | 6 | `onOpen()` — *Speak All Rows* | ⚠️ **Collides** with `cleaned.gs:1` |
| `cleaned.gs` | 296 | `onOpen()`, `mergeAndCleanSheets()` + 5 helpers | ✅ |
| `merged.gs` | 59 | `mergeAdjacentRowsAndRepeat()` | ✅ called at `cleaned.gs:64` |
| `Lithursan.gs` | 703 | `readRowAndSpeak()`, `speakTextDialog()` | ✅ |
| `sku.gs` | 156 | 3 functions | ❌ **none ever called** |
| `test.gs` | 43 | `replaceComboSKUsInPlace()` — **the mapping feature** | ❌ **never called** |

---

## 1. Root causes (12 causes → 59 tickets)

### RC-1 🔴 Mapping never runs, and cannot work even if it did

**Tickets: 14, 41, 42, 43, 45, 46 — six reports, the most-repeated issue in Unit 4.**
*"Mapping full set image should be shown" · "Mapping bulb is not shown" ×4 · "Mapping not shown in combo"*

**Two independent faults, both fatal:**

**(a) The function is never called.** `replaceComboSKUsInPlace()` is defined in `test.gs:1` and
referenced **nowhere else** in the project. It is not in either menu:

```
action.gs:4    .addItem('Speak All Rows', 'readRowAndSpeak')
cleaned.gs:4   .addItem('Speak All Rows', 'readRowAndSpeak')
cleaned.gs:5   .addItem('Run Clean and Merge', 'mergeAndCleanSheets')
```

It can only be run by hand from the Apps Script editor.

**(b) Even when run by hand it is a guaranteed no-op.** `test.gs:11-12` looks up two columns in the
shared names sheet:

```js
const skuIndex     = nameData[0].indexOf('SKU.1');
const mappingIndex = nameData[0].indexOf('Mapping SKU');
```

I fetched the live names master sheet (`16rx5Dz…`, 19,739 rows). Its header row is:

```
col A: ''   ← blank
col B: 'Name'
col C–Z: all blank
```

**Neither `SKU.1` nor `Mapping SKU` exists.** Both `indexOf` calls return **-1**, so
`nameData[i][-1]` is `undefined`, the guard at `test.gs:19` (`if (sku && mapped && sku !== mapped)`)
never passes, `skuMap` stays **empty**, and the loop at `:30-39` maps every SKU to itself. The
function completes successfully and changes nothing — no error, no log.

| | |
|---|---|
| **Caused by** | **Both** — Apps Script (not wired) **and** Google Sheet data (missing columns) |
| **Apps Script fault?** | Yes, partly |
| **File / function** | `test.gs` → `replaceComboSKUsInPlace()` |
| **Code to change** | `test.gs:11-12` (column lookup + guard), `cleaned.gs:3-6` (menu wiring) |
| **Correct fix** | 1. Add `SKU.1` and `Mapping SKU` header columns to the names master sheet and populate them. 2. Call `replaceComboSKUsInPlace()` from `mergeAndCleanSheets()` after `addCombinedSKUSet()` (`cleaned.gs:159`), so it runs as part of the clean. 3. Add a hard guard: `if (skuIndex === -1 \|\| mappingIndex === -1) throw new Error('names sheet is missing SKU.1 / Mapping SKU')` — a silent no-op is what hid this for five months. |

---

### RC-2 🔴 No order grouping — components are never assembled

**Tickets: 13, 22, 23, 25, 26, 32, 33, 43, 44, 49, 53, 54 — twelve reports.**
*"Merge orders should be mentioned with their total components and speak Component 1, component 2…" ·
"For merge orders all the components needs to be shown" · "Combo image not shown" · "Not all the combo product image shown"*

`Lithursan.gs:56` iterates rows **one at a time**:

```js
dataRange.forEach(row => {          // :56  — one queue entry per sheet row
```

There is no grouping stage. Each component of a combo becomes a separate, unrelated order in the
queue. Worse, the `Component` column **is read and then thrown away**:

```js
:70   const component = (row[colIndex["Component"]] || "").toString().trim();
```

`component` appears on that line and **nowhere else in the file** (verified). So the data needed to
say "Component 1 of 3" is loaded into memory and discarded.

Combo *images* partially work (`:80-94` splits `SKU Combined`/`Combo SKU` on `+` and looks up
`skuToImageUrl`), which is why some tickets say images show for one order but not another — the
lookup only succeeds when every component SKU also appears as its own row.

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **Apps Script fault?** | **Yes — entirely** |
| **File / function** | `Lithursan.gs` → `readRowAndSpeak()` |
| **Code to change** | Replace the flat loop at `Lithursan.gs:56-186` with a grouping pass |
| **Correct fix** | Port the grouping block from the 948-line version (Unit 3 Lampshade `Lithursan.gs:56-270`) — **but do not copy it as-is.** That version groups on `SKU Combined ?? Combo SKU` **alone**, which merges different customers who bought the same combo (proven in live data: 8 of 45 keys in one station are shared by more than one customer). Group on **`Combo SKU` + customer + postcode**. Then use `component` at `:70` to emit `"Component N of M"`, and speak the postcode **once, last**. |

---

### RC-3 🔴 Postcode dedupe deletes postcodes and QR flags

**Tickets: 28, 35, 50.** *"Post code not shown when 2 postcode same" (still OPEN) · "same postcode issue 1st order cant speak post code"*

`cleaned.gs:162-172` blanks a postcode when it equals **the row above** — adjacency only, no customer
check:

```js
:167   if (current && current === previous) {
:168     valuesD[i - 1][0] = '';      // deletes the EARLIER row's postcode
```

Two different customers who share a postcode and land next to each other → the first loses its
postcode entirely. Then `cleaned.gs:186-192` cascades:

```js
:190   for (let i = 0; i < numRows; i++) if (!valuesD[i][0]) valuesF[i][0] = '';
```

Column F is **Instruction QR** — so blanking a postcode also silently deletes that order's QR
instruction.

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **Apps Script fault?** | **Yes** |
| **File / function** | `cleaned.gs` → `keepOnlyLastOccurrenceInD()` and `clearFIfDIsEmptyInSheet()` |
| **Code to change** | `cleaned.gs:162-172` and `cleaned.gs:186-192` |
| **Correct fix** | Only suppress a repeated postcode within the **same order group** (same customer + address). Compare on a composite key, not on the adjacent cell. Decouple the QR clearing from the postcode entirely — QR availability has nothing to do with whether a postcode was deduped. |

---

### RC-4 🔴 The Postcode button reads a fixed array slot

**Ticket: 58.** *"Postcode button not working"* — marked done, still failing.

`Lithursan.gs:407`:

```js
speakLine([speakTexts[index][1]], function() { hideLoading(); });
```

Index `1` is hardcoded. `speakTexts` entries are built at `:128-132` as
`[segment1Parts, segment3Parts]`, where segment 3 is postcode **+ QR combined** (`:114-126`). Two
failure modes:

- Row has no postcode but **does** have a QR → slot 1 contains only the QR text, so the button
  speaks the QR instead of a postcode.
- Row has neither → slot 1 is `""` → `speakLine` hits the empty-segment branch at `:507-511`, writes
  *"No valid speech content"* into a **12px grey div** (`:217`), and returns. The packer presses the
  button and simply hears nothing.

The 948-line version searches for the segment containing `"Post Code"` instead of hardcoding the
index — Unit 4 was never given that fix.

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **Apps Script fault?** | **Yes** |
| **File / function** | `Lithursan.gs` → `controlSpeech()`, case `"postcode"` |
| **Code to change** | `Lithursan.gs:400-413` |
| **Correct fix** | Store the postcode as its own segment (or keep it in a parallel `postcodeTexts[]` array) and look it up by content, not position. When there is no postcode, **say so out loud** — *"No postcode for this order"* — rather than failing into a grey caption. |

---

### RC-5 🔴 The reducer plate is deleted from the queue

**Tickets: 15, 34, 37.** *"with Reducer plate product shouldn't be shown separate" → then "Reducer plate name is not shown" · "Reducer Plate not said"*

This is an over-correction. Ticket 15 asked for the reducer plate not to appear as a *separate*
order. The fix implemented was to **delete the row entirely** — `cleaned.gs:266-296`:

```js
:280   if (sku === "RPR44WH" && component) {
:281     const postCode = row[addressIndex];
:282     for (let k = cleaned.length - 1; k >= 1; k--) {   // scan BACKWARDS
:284       cleaned[k][addressIndex] = postCode; break;
:288     continue;                                          // row dropped
```

`RPR44WH` is the white reducer plate (confirmed against live data — its `Name` is
`"white Reducer plate"`). Deleting the row removes the plate from the spoken queue, which is exactly
what tickets 34 and 37 then reported. The backward scan at `:282-287` also attaches the plate's
postcode to whichever earlier row happens to have an empty one — potentially an unrelated order.

Note also that a **single product SKU is hardcoded into shared cleaning logic** (`:280`).

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **Apps Script fault?** | **Yes** |
| **File / function** | `cleaned.gs` → `removeRPR44WHAndTransferPostCode()` |
| **Code to change** | `cleaned.gs:266-296` — the whole function |
| **Correct fix** | Do not delete the row. Once RC-2 is in place, mark the reducer plate as a **component of its parent order** so it is spoken within the group ("component 3 of 3: white reducer plate") instead of as a standalone order. Move the SKU out of code into a config list, or better, drive it from the `Component` column. |

---

### RC-6 🔴 Voice recognition dies, and hears itself

**Tickets: 1, 4, 5, 10, 11, 16, 29, 40, 48, 51, 52 — eleven reports.**
*"Next command is not listening enough getting tired from it" (OPEN) · "Next Command not FAST enough" ×2 · "Stop and Run command not working" · "When postcode, voice command not working"*

**Fault (a) — the recogniser is restarted illegally.** `Lithursan.gs:646-647`, inside `onresult`:

```js
:646   recognition.stop();
:647   recognition.start();
```

`stop()` is asynchronous. Calling `start()` on the next line throws `InvalidStateError`. That lands
in `onerror` (`:652-656`), which **logs and does not restart**. Recognition can die permanently
mid-session with no visible sign. `onend` (`:658-661`) races the same call.

**Fault (b) — the microphone is never muted while the tool speaks.** Nothing gates recognition during
synthesis. The tool speaks `":Post Code:"` (`:116`); the open mic hears "post code"; `:639` matches:

```js
} else if (spokenText.includes("postcode") || spokenText.includes("post code")) {
```

**The tool fires its own postcode command at itself.** That is ticket 16, and it also explains
ticket 1 ("Skip issue") — a self-triggered command advances a row unexpectedly.

**Fault (c) — `stop` is not a command.** Tickets 5 and 10 ask for stop/run. Verified: there is **no
`includes("stop")` branch** at `:630-645`. Supported commands are only next / back / respeak /
postcode / restart. Pause exists as a **button only** (`:246`).

**Fault (d) — matching is unanchored substring.** `:642` matches `"start"`, which is also inside
`"restart"`; any sentence containing a keyword fires the command.

| | |
|---|---|
| **Caused by** | **Apps Script logic** (client-side JS inside the generated HTML) |
| **Apps Script fault?** | **Yes** |
| **File / function** | `Lithursan.gs` → `speakTextDialog()`, recognition handlers |
| **Code to change** | `:646-647`, `:652-656`, `:658-661`, `:630-645` |
| **Correct fix** | Remove the `stop()` at `:646` entirely — `continuous = true` already keeps it running. Restart from `onerror` with a short backoff, not just `onend`. Call `recognition.stop()` before `synth.speak()` and restart it in `utter.onend` so the tool cannot hear itself. Add `stop`/`pause`/`hold` branches. Anchor matching with a word-boundary regex instead of `includes()`. |

---

### RC-7 🟠 No SSML — codes and postcodes are mispronounced

**Tickets: 3, 8, 24, 57.** *"GB - Gigabyte acronyms" · "Acronym issue - st for street" · "Z kku Zee pronunciation" · "IP 20 Thousand issue" (OPEN)*

`Lithursan.gs:517-518` builds a plain utterance:

```js
const utter = new SpeechSynthesisUtterance(text);
utter.lang = "en-US";
```

No SSML anywhere. The browser applies English rules to every token: `GB` → "gigabyte", `ST` →
"street", `IP20` → "twenty thousand".

The name path **looks** like it normalises but does not — `:101-102`:

```js
const nameWords = name.split(" ");
segment1Parts.push(":: " + nameWords.join(" "));
```

`split(" ")` then `join(" ")` returns the identical string. **A no-op that reads as a fix.**

The dev note on ticket 57 says *"I changed the name for IP20 transformers"* — i.e. it was patched in
the names sheet, one product at a time. That approach cannot scale to postcodes, which are unbounded.

| | |
|---|---|
| **Caused by** | **Apps Script logic** (the name text itself is Sheet data) |
| **Apps Script fault?** | **Yes** |
| **File / function** | `Lithursan.gs` → `readRowAndSpeak()` (`:97-126`) and `speakLine()` (`:502-536`) |
| **Code to change** | `:101-102` (dead no-op), `:114-123` (postcode splitter), `:517-518` (utterance) |
| **Correct fix** | Add a token classifier before speaking: UK postcode → `<say-as interpret-as="characters">` with a break between outward and inward code; `IP\d\d` → characters; `\d+W`/`\d+V` → number + unit; `\d+m` → "metres". Set `utter.lang` from the selected voice instead of hardcoding `en-US`. |

---

### RC-8 🟠 No speech gap — all segments are one utterance

**Tickets: 18, 31.** *"Speech gap between Quantity and postcode" · "for single product orders - don't have to speak twice"*

`Lithursan.gs:513-517`:

```js
const text = segments.filter(seg => seg && seg.trim() !== "").join(". ");
const utter = new SpeechSynthesisUtterance(text);
```

Everything is concatenated into **one** utterance separated only by `". "`. There is no real pause
between the product and the postcode — the engine reads straight through.

The 948-line version speaks each segment as its own `SpeechSynthesisUtterance` chained on `onend`,
which produces a genuine gap. **Unit 4 is the version without it.** Ticket 18 was marked done; the
code shows the fix landed on a different station.

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **Apps Script fault?** | **Yes** |
| **File / function** | `Lithursan.gs` → `speakLine()` |
| **Code to change** | `Lithursan.gs:513-535` |
| **Correct fix** | Speak segments sequentially — one utterance per segment, chained on `utter.onend` — with an explicit configurable pause between them. |

---

### RC-9 🟠 Failed name lookup silently blanks the quantity

**Ticket: 30.** *"Quantity varela"* (the quantity doesn't come)

`cleaned.gs:112`:

```js
let lookupSku = rawSku.endsWith("PK") ? rawSku.slice(0, -3) : rawSku;
```

`slice(0, -3)` strips **three** characters to remove a **two**-character `"PK"` suffix. It works by
luck for single-digit packs (`…6PK` → strips `6PK`) and breaks for anything else (`…10PK` → strips
`0PK`, leaving a stray `1`). Then `:116`:

```js
if (!name) quantity = '';
```

When the lookup misses, the quantity is **deliberately blanked too** — so the row speaks nothing at
all rather than at least the quantity.

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **Apps Script fault?** | **Yes** |
| **File / function** | `cleaned.gs` → `mergeAndCleanSheets()` → inner `processRow()` |
| **Code to change** | `cleaned.gs:112` and `cleaned.gs:116` |
| **Correct fix** | Use a regex to strip a real pack suffix: `rawSku.replace(/\d+PK$/, '')`. Never blank the quantity — if the name is missing, fall back to spelling the SKU and log the gap for the postage team. |

---

### RC-10 🟠 Speed values do not match what was requested

**Tickets: 27, 38, 47.** *"Speak Speed Normal x1, Fast x1.25, Very fast x1.5" · "Change the speaking speed to default"*

`Lithursan.gs:233-236`:

```html
<option value="0.6">Slow</option>
<option value="0.7" selected>Normal</option>   ← "Normal" is 0.7×, not 1×
<option value="1.2">Fast</option>              ← requested 1.25
<option value="1.5">Very Fast</option>         ✓
```

Ticket 38 asked for Normal ×1, Fast ×1.25, Very fast ×1.5. The implemented values are 0.7 / 1.2 /
1.5, and the default (`:496 var speechRate = 0.7`) is 30 % slower than "normal". Ticket 47 —
*"change the speaking speed to default"* — is the packers noticing this.

| | |
|---|---|
| **Caused by** | **Apps Script logic** (hardcoded UI values) |
| **Apps Script fault?** | **Yes** |
| **File / function** | `Lithursan.gs` → `speakTextDialog()` HTML |
| **Code to change** | `Lithursan.gs:233-236` and `:496` |
| **Correct fix** | Set the options to `1.0` (Normal, selected), `1.25` (Fast), `1.5` (Very Fast), keep `0.75` for Slow, and initialise `speechRate = 1.0`. |

---

### RC-11 🟠 Three features exist as scaffolding only

| Ticket | Feature | Evidence |
|---|---|---|
| **2, 9** | *"Mic icon disappear"* | **There is no mic indicator in the DOM at all.** Verified: no `micIcon` / `mic-icon` / `🎤` element. The only feedback is `#voiceFeedback`, a 12px grey text div (`:217`). The packer has no way to see whether the tool is listening. |
| **12** | *"Order time delay with the quantity of the product"* | `pauseTime` is computed at `:136`, passed into `displays` at `:184`, and **never read by the client**. Dead. |
| **21** | *"Orders are auto moving to next order"* | No auto-advance exists in this version — `utter.onend` only calls `hideLoading()` (`:525-527`). Appears genuinely resolved. |

| | |
|---|---|
| **Caused by** | **Apps Script logic** |
| **File / function** | `Lithursan.gs` → `speakTextDialog()` |
| **Correct fix** | Add a real mic-state indicator bound to `recognition.onstart` / `onend` / `onerror` — a coloured dot large enough to read from a metre away. Either wire `pauseTime` into the segment chain or delete it. |

---

### RC-12 🟡 Requested data does not exist in the sheet

**Tickets: 19, 39, 55.** *"Mention if it is First class, International orders" · "for Amazon 2 Day Small orders - speak S label 2 kilos" (OPEN) · "Make the note available in speak tool but don't speak" (OPEN)*

`Sheet1` has 17 columns: Title, SKU, Quantity, Combo SKU, Combo Color, Combo Quantity, Price, Link,
Customer Info, Address, Selling Platform, Instruction QR, Status, Image URLs, Merge Order, Component,
Send Order Instruction.

There is **no carrier/service column, no shipping-class column, and no customer-note column**. No
code change can produce these.

| | |
|---|---|
| **Caused by** | **Google Sheet data** — missing source columns |
| **Apps Script fault?** | **No** |
| **Correct fix** | Add `Shipping Service` / `Shipping Class` / `Customer Note` columns to the platform import first. Then surface them in `cleaned.gs` `outputHeaders` (`:56-62`) and render/speak in `Lithursan.gs`. **Blocked upstream until the import changes.** |

---

## 2. Complete issue → cause map (all 59)

| # | Date | Issue | Status | Cause | Layer | File · function · line |
|---:|---|---|---|---|---|---|
| 1 | 02/06 | Skip issue | done | RC-6 | Script | `Lithursan.gs` recognition `:639-647` |
| 2 | 02/06 | Mic icon disappear | done | RC-11 | Script | `Lithursan.gs` — element absent |
| 3 | 02/06 | GB → Gigabyte acronyms | done | RC-7 | Script | `Lithursan.gs:517` |
| 4 | 02/06 | While speaking, listen to commands | done | RC-6 | Script | `Lithursan.gs:646` |
| 5 | 02/06 | Back and stop command issue | done | RC-6(c) | Script | `Lithursan.gs:630-645` — no `stop` branch |
| 6 | 02/06 | Naming issue | done | Data | Sheet | names master col B |
| 7 | 02/06 | Colour code not added | done | Data | Sheet | `Combo Color` not spoken — `Lithursan.gs` |
| 8 | 04/06 | Acronym — st for street | done | RC-7 | Script | `Lithursan.gs:517` |
| 9 | 04/06 | Mic icon disappear | done | RC-11 | Script | `Lithursan.gs` |
| 10 | 04/06 | Stop and Run command not working | done | RC-6(c) | Script | `Lithursan.gs:630-645` |
| 11 | 04/06 | Stopped speaking until next used | done | RC-6 | Script | `Lithursan.gs:652-661` |
| 12 | 04/06 | Order time delay with quantity | done | RC-11 | Script | `Lithursan.gs:136, 184` — dead |
| 13 | 04/06 | Combo and multi-line product packlist | done | RC-2 | Script | `Lithursan.gs:56` |
| 14 | 19/06 | Mapping full set image | done | **RC-1** | Script + Data | `test.gs:11-12` |
| 15 | 19/06 | Reducer plate shown separate | done | RC-5 | Script | `cleaned.gs:266` |
| 16 | 19/06 | Postcode → voice command not working | done | RC-6(b) | Script | `Lithursan.gs:639` self-trigger |
| 17 | 19/06 | Postcode took long time | done | RC-8 | Script | `Lithursan.gs:513` |
| 18 | 23/06 | Speech gap quantity ↔ postcode | done | **RC-8** | Script | `Lithursan.gs:513-517` |
| 19 | 23/06 | First class / International orders | done | RC-12 | **Sheet** | column absent |
| 20 | 23/06 | Speak quantity first then name | done | Script | Script | `Lithursan.gs:97-105` — order is name-then-qty |
| 21 | 23/06 | Orders auto moving to next | done | RC-11 | — | resolved in this version |
| 22 | 23/06 | Merge orders — speak Component 1, 2… | done | **RC-2** | Script | `Lithursan.gs:70` discarded |
| 23 | 23/06 | Multi/merge components shown in front | done | **RC-2** | Script | `Lithursan.gs:56` |
| 24 | 04/07 | Z → Zee pronunciation | done | RC-7 | Script | `Lithursan.gs:517` |
| 25 | 04/07 | Combo image not showing for one order | done | RC-2 | Script | `Lithursan.gs:80-94` |
| 26 | 04/07 | "Combo 1:" for single product | done | RC-2 | Script | `cleaned.gs:122-129` |
| 27 | 04/07 | Speed up the speech | done | RC-10 | Script | `Lithursan.gs:233-236` |
| 28 | 04/07 | Post code not shown / speak | done | RC-3 | Script | `cleaned.gs:167` |
| 29 | 04/07 | Next command not working twice | done | RC-6 | Script | `Lithursan.gs:646` |
| 30 | 08/07 | Quantity varela | done | **RC-9** | Script | `cleaned.gs:112, 116` |
| 31 | 08/07 | Single product — don't speak twice | done | RC-8 | Script | `Lithursan.gs:513` |
| 32 | 08/07 | Combo product image not shown | done | RC-2 | Script | `Lithursan.gs:80-94` |
| 33 | 08/07 | Not all combo images shown | done | RC-2 | Script | `Lithursan.gs:82-91` |
| 34 | 09/07 | Reducer plate name not shown | done | **RC-5** | Script | `cleaned.gs:280-288` |
| 35 | 09/07 | Post code not shown when 2 same | **OPEN** | **RC-3** | Script | `cleaned.gs:167-169` |
| 36 | 09/07 | Does back command work? | done | — | — | works — `:633`, `:384` |
| 37 | 10/07 | Reducer Plate not said | done | **RC-5** | Script | `cleaned.gs:280-288` |
| 38 | 11/07 | Speed ×1 / ×1.25 / ×1.5 | done | **RC-10** | Script | `Lithursan.gs:233-236` |
| 39 | 11/07 | Amazon 2-Day — S label 2 kilos | **OPEN** | RC-12 | **Sheet** | column absent |
| 40 | 11/07 | Next command not fast enough | done | RC-6 | Script | `Lithursan.gs:646` |
| 41 | 11/07 | Mapping bulb not shown | done | **RC-1** | Script + Data | `test.gs` |
| 42 | 14/07 | Mapping bulb not shown | done | **RC-1** | Script + Data | `test.gs` |
| 43 | 14/07 | Mapping not shown in combo | done | **RC-1** + RC-2 | Script + Data | `test.gs`, `Lithursan.gs:56` |
| 44 | 14/07 | Merge order said once vs total | done | RC-2 | Script | `cleaned.gs:92-94` |
| 45 | 14/07 | Mapping bulb not shown | done | **RC-1** | Script + Data | `test.gs` |
| 46 | 17/07 | Mapping bulb not shown | done | **RC-1** | Script + Data | `test.gs` |
| 47 | 17/07 | Change speaking speed to default | done | RC-10 | Script | `Lithursan.gs:496` |
| 48 | 17/07 | Next command not fast enough | done | RC-6 | Script | `Lithursan.gs:646` |
| 49 | 17/07 | Merge order said once vs total | done | RC-2 | Script | `cleaned.gs:92-94` |
| 50 | 18/07 | Same postcode — 1st order can't speak | done | **RC-3** | Script | `cleaned.gs:167-169` |
| 51 | 21/07 | Next not listening enough | **OPEN** | **RC-6** | Script | `Lithursan.gs:646-661` |
| 52 | 22/07 | Next not listening — getting tired | **OPEN** | **RC-6** | Script | `Lithursan.gs:646-661` |
| 53 | 23/07 | Combo image not shown | done | RC-2 | Script | `Lithursan.gs:80-94` |
| 54 | 23/07 | Merge orders — all components shown | done | **RC-2** | Script | `Lithursan.gs:56` |
| 55 | 06/08 | Note available but don't speak | **OPEN** | RC-12 | **Sheet** | column absent |
| 56 | 07/08 | One names sheet linked to all | done | — | — | done — `cleaned.gs:14` |
| 57 | 08/08 | IP 20 Thousand issue | **OPEN** | **RC-7** | Script | `Lithursan.gs:101-102, 517` |
| 58 | 19/08 | Postcode button not working | done | **RC-4** | Script | `Lithursan.gs:407` |
| 59 | 12/09 | Merge order wording | **OPEN** | RC-2 | Script | `cleaned.gs:92-94` |

### Attribution summary

| Cause layer | Tickets |
|---|---:|
| **Apps Script logic** | **50** |
| Apps Script **+** Sheet data (RC-1 mapping) | 6 |
| **Sheet data only** (missing columns) | 4 |
| Already resolved / not a defect | 3 |

> **No issue is caused by spreadsheet formatting or formulas.** Neither `Sheet1` nor `Cleaned Data`
> contains formulas — both are static values written by the script.

---

## 3. Additional defects found in Unit 4 that are **not** on the issue sheet

| # | Defect | Evidence | Impact |
|---|---|---|---|
| **U1** | **`Cleaned Data` is written twice with different widths.** `merged.gs:58` writes 18 cols; `cleaned.gs:153` overwrites only 15. Cols P/Q/R survive as leftovers — confirmed in the live sheet (`P=Component`, `Q=Send Order Instruction`, `R=SKU Combined`). ⚠️ *Correction: I previously said column R ends up row-misaligned — **verified false**. `removeRPR44WHAndTransferPostCode()` uses `getDataRange()`, so all 18 cols travel with each surviving row.* | `merged.gs:58`, `cleaned.gs:153` | `Lithursan.gs:25` **requires** `SKU Combined`, so the tool depends on a column no documented path writes. Hygiene, **not** a blocker. |
| **U2** | **Two competing `onOpen()` definitions.** `action.gs:1` and `cleaned.gs:1`. Last loaded wins. | both files | If `action.gs` wins, **"Run Clean and Merge" is unreachable** and the queue is never rebuilt. |
| **U3** | **`synth.resume()` exists nowhere.** `togglePause()` calls `synth.pause()` at `:441`. | `Lithursan.gs:439-448` | Pause is one-way. |
| **U4** | **No end-of-queue state.** `:347-349` wraps `currentSpeakIndex` to 0. | `Lithursan.gs:347-349` | Packer is never told the list is finished; it silently restarts. |
| **U5** | **Cancelled orders are not skipped.** `Status` can read `plz cancel this order`; shown in red at `:153` but never filtered. | `Lithursan.gs:153`; no filter | Packer is instructed to pack cancelled orders. |
| **U6** | **`sku.gs` — all 3 functions are dead**, including `addProductNamesFromSKU()` which duplicates live name-lookup logic. | `sku.gs` | Dead code that reads as live; a maintainer may "fix" the wrong function. |
| **U7** | **Dead code in the speech builder.** `previousPostCodeRaw` assigned at `:55`/`:78`, never read. Ternary at `:120` returns `char` in both branches. | `Lithursan.gs:55, 78, 120` | Misleading — looks like postcode logic that does nothing. |
| **U8** | **Unescaped interpolation.** `title`, `customerInfo`, `status` go raw into HTML (`:142`, `:164`, `:153`) and the whole payload is `JSON.stringify`'d into a `<script>` block (`:197-199`). | `Lithursan.gs` | A marketplace title containing `</script>` breaks the dialog. |

---

## 4. Recommended fix order

Nothing below has been implemented. Sequence matters — U1 first, because it corrupts the column that
everything else groups on.

| Step | Fix | Closes | Effort |
|---:|---|---:|---|
| 1 | **U1** — remove the double write; rebuild `SKU Combined` after row deletion | (blocker) | S |
| 2 | **U2** — delete the duplicate `onOpen()` in `action.gs` | (blocker) | XS |
| 3 | **RC-1** — add `SKU.1` + `Mapping SKU` to names sheet; wire + guard `replaceComboSKUsInPlace()` | **6** | S |
| 4 | **RC-9** — fix `slice(0,-3)`; stop blanking quantity | 1 | XS |
| 5 | **RC-10** — correct the speed values | 3 | XS |
| 6 | **RC-4** — look up the postcode segment by content | 1 | S |
| 7 | **RC-6** — recognition restart, mic gating, `stop` command, anchored matching | **11** | M |
| 8 | **RC-8** — sequential utterances with real pauses | 2 | S |
| 9 | **RC-7** — token classifier + SSML | 4 | M |
| 10 | **RC-3** — composite-key postcode dedupe; decouple QR | 3 | M |
| 11 | **RC-5** — keep the reducer plate as a component | 3 | M |
| 12 | **RC-2** — grouping pass (customer-safe key) | **12** | L |
| 13 | **RC-12** — blocked on new sheet columns | 4 | — |

Steps 1–6 are small and independently shippable, and together they close **11 tickets** plus both
blockers.

⚠️ **When implementing RC-2, do not copy the 948-line version's grouping verbatim.** It groups on the
combo-SKU string alone, which merges orders from different customers — proven against live data in
[discovery-report.md §8 R1](./discovery-report.md). Unit 4 does not currently have that bug; a naïve
port would introduce it.
