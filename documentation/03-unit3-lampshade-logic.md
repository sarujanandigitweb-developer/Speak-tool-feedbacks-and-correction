# Unit 3 Lampshade — Complete Logic & Data-Flow Analysis

**Purpose:** the pre-implementation reference. Every function, every transformation, every cell → UI
mapping, traced end to end.

**Sheet:** [`1AMQMzxu…`](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) — `Sheet1` **169 rows × 17 cols** · `Cleaned Data` **140 rows × 18 cols**
**Code:** [`scripts/Unit 3 Lampshade/`](../scripts/Unit%203%20Lampshade/) — 6 files, 1,766 lines
**Names master:** `16rx5Dz…` tab `names` — **19,739 rows**, col A = SKU, col B = spoken Name

---

## ⚠️ Correction to my earlier reports — read this first

In [02-code-walkthrough.md](./02-code-walkthrough.md) (finding **C1**) and
[discovery-report.md](../validation/discovery-report.md) (finding **R2**) I stated that the
`SKU Combined` column ends up **row-misaligned** after the row-deletion step, and that order grouping
therefore runs off a corrupted column. **That part was wrong.**

I verified it against the live sheet. `removeRPR44WHAndTransferPostCode()` reads with
`getDataRange()` — **all 18 columns** — and rewrites all 18 per surviving row, so `SKU Combined`
travels with its own row. All 8 rows that carry it check out:

| Row | SKU | `SKU Combined` (col R) | Own SKU in group? | Customer |
|---:|---|---|:---:|---|
| 49–52 | CRFF100BM · LHNSE27BM · CRFF100CO · LHNSE27CO | `CRFF100BM+LHNSE27BM+CRFF100CO+LHNSE27CO` | ✅ all four | Alan Robinson |
| 62–63 | LDMST64B224 · LSUL220BB | `LDMST64B224+LSUL220BB+RPR44WH` | ✅ both | Sharon McGrath |
| 131–132 | RWT460YE · RWT5100YE | `RWT460YE+RWT5100YE` | ✅ both | Stuart Craigie |

**What remains true:**

- The double write is real — cols **P, Q, R are leftovers**, and the duplicate headers come from it.
- The tool **depends on a column no documented code path writes** (`neededColumns` requires
  `SKU Combined` and aborts without it).
- Rows 62–63 expose a **different** bug: the group claims **3** components (`…+RPR44WH`) but only
  **2** rows survive, because the reducer plate was deleted. The packer is told a 3-part set and
  shown 2.
- The wrong-parcel risk is real but lives in **`Combo SKU` (col M)**, not `SKU Combined`.

**Consequence for implementation:** "fix the double write first" is **no longer a blocker** for the
grouping work. It is hygiene. The customer-collision bug stands on its own and is the real priority.

---

## 1. File inventory — and a collision that decides which code runs

| File | Lines | Functions defined |
|---|---:|---|
| `action.gs` | 6 | `onOpen` |
| `clean-1.gs` | 301 | `mergeAndCleanSheets`, `keepOnlyLastOccurrenceInD`, `keepOnlyLastOccurrenceInE`, `clearFIfDIsEmptyInSheet`, `addCombinedSKUSet`, `removeRPR44WHAndTransferPostCode` |
| `cleaned.gs` | 296 | `onOpen` **+ the same six** |
| `Lithursan.gs` | 948 | `readRowAndSpeak`, `speakTextDialog` |
| `Merge SKU.gs` | 59 | `mergeAdjacentRowsAndRepeat` |
| `sku.gs` | 156 | `blankDuplicateSKUsInSheet1`, `addProductNamesFromSKU`, `copySKUFromSheet1ToCleanedData` — **none called** |

### 🔴 `clean-1.gs` and `cleaned.gs` define the same six functions

Apps Script puts every `.gs` file in **one global scope**. Two definitions of the same name means the
**last one loaded wins** — and load order follows the file order in the editor, which nobody
deliberately set. `onOpen` also collides between `action.gs` and `cleaned.gs`.

**This is not a cosmetic duplicate. `clean-1.gs` is a newer, patched version**, and its own comment
says so:

```js
// clean-1.gs:208-212
// Group by "SKU Combined" (adjacency-based, already unique per order) instead
// of the Merge Order label text. The label (e.g. "merge order total: 2 :
// merge order: 1") only encodes the item count, so unrelated orders with the
// same count were colliding into one group here. Fall back to the label only
// if SKU Combined isn't populated for this row.
```

That is a **real bug fix** for issue **U3L #21** (*"RMI orderum 2-4 1st orderum merge ahh vanthu
irukku"*) — unrelated orders merging. The two files are byte-identical apart from `onOpen` and this
one patch inside `addCombinedSKUSet()`:

| | `cleaned.gs` (old) | `clean-1.gs` (patched) |
|---|---|---|
| Merge group key | the **label text** `merge order total: N : merge order: 1` | **`SKU Combined`**, falling back to the label |
| Effect | two unrelated orders with the same item count collide | each order keeps its own group |

**If `cleaned.gs` loads last, the fix is dead and nobody would know.** Confirm the editor's file order
before touching anything; then delete the loser.

---

## 2. Entry points

```
Spreadsheet opens
   └─ onOpen()                              ← action.gs:1  AND  cleaned.gs:1  (collision)
        └─ menu "🗣 Speak Tool"
             ├─ "Speak All Rows"      → readRowAndSpeak()     Lithursan.gs:1
             └─ "Run Clean and Merge" → mergeAndCleanSheets()  cleaned.gs:9 / clean-1.gs:1
```

If `action.gs` wins the `onOpen` collision, its menu has **only** "Speak All Rows" — and
**"Run Clean and Merge" becomes unreachable from the UI**.

---

## 3. Pipeline — `Sheet1` → `Cleaned Data`

`mergeAndCleanSheets()` runs 13 steps. Line numbers are `cleaned.gs`.

```
 :13  open names master by ID (19,739 rows)  ─── live, every run
 :22  delete "Cleaned Data"
 :25  insert fresh "Cleaned Data"
 :30  build skuToName{}  ← names col A → col B
 :38  locate 15 Sheet1 columns by header name
 :56  build outputHeaders (15 names)
 :64  ── mergeAdjacentRowsAndRepeat()  ────────────► writes 18 cols   [STAGE A]
 :68  walk Sheet1 rows → build `output`  (15 cols)                    [STAGE B]
:153  write `output` over A–O            ── P, Q, R survive untouched
:155  keepOnlyLastOccurrenceInD()        ── blanks duplicate postcodes
:156  keepOnlyLastOccurrenceInE()        ── blanks duplicate platforms
:157  clearFIfDIsEmptyInSheet()          ── blanks QR where postcode blank
:158  removeRPR44WHAndTransferPostCode() ── deletes rows  169 → 140
:159  addCombinedSKUSet()                ── rebuilds Combo SKU (col M)
```

### STAGE A — `mergeAdjacentRowsAndRepeat()` · `Merge SKU.gs:1`

Writes the `SKU Combined` column.

```js
:6   cleanedSheet.clear();
:14  result = [[...Sheet1 headers, "SKU Combined"]];        // 18 columns
:24  if (mergeOrder && mergeOrder === currentMerge)  → same group
     else → flush previous group, start new one
:30  combined = currentGroup.join("+")                       // "SKU1+SKU2+SKU3"
:58  write result
```

**Groups only ADJACENT rows** (`:24` compares against `currentMerge`, reset on any break). If a merge
group's rows are not contiguous in `Sheet1`, it silently splits. Live data: **1 of 35 groups is
non-adjacent.**

Source column: `Merge Order` — populated on **9 of 169** rows. So `SKU Combined` ends up on **8 of
140** rows.

### STAGE B — the row builder · `cleaned.gs:68-151`

Walks `Sheet1`. For a row with no `Merge Order`, one `processRow(j, "")`. For a merge group, it
collects the block, counts the rows whose `Component` has ≤1 token, and labels them:

```js
:92  const label = mergeOrderLabelCounter === 1
       ? `merge order total: ${labelCount} : merge order: 1`   // ← the wording U3L/U4 object to
       : `merge order : ${mergeOrderLabelCounter}`;
:98  else processRow(r.index, "");   // combo rows in a merge get NO label
```

### `processRow()` · `cleaned.gs:105-151` — the core transformation

| Step | Line | Logic | Defect |
|---|---|---|---|
| SKU | `:108` | `SKU` else `Combo SKU`, trimmed, **uppercased** | — |
| Lookup key | `:112` | `rawSku.endsWith("PK") ? rawSku.slice(0,-3) : rawSku` | 🔴 strips **3** chars for a **2**-char suffix. Works for `…6PK`; breaks `…10PK`. For `CL3TCR5PK` → `CL3TCR`, whose name is the **1-metre** variant |
| Name | `:113` | `skuToName[lookupSku] \|\| ""` | silent miss |
| Quantity | `:115` | `Combo Quantity` else `Quantity` | — |
| **Quantity kill** | `:116` | `if (!name) quantity = '';` | 🔴 a failed name lookup **also blanks the quantity** — the row then speaks nothing |
| Cable unit | `:118` | `if (rawSku.startsWith("CL")) quantity += " meter"` | 🔴 appends to the *wrong* quantity — "1 meter" for a 5-metre product |
| Component | `:122-129` | `Combo: N` where N = comma-separated token count | `Combo: 1` announced for single products |
| Emit | `:131-150` | 15 fields in fixed order | — |

### Post-processing chain

**`keepOnlyLastOccurrenceInD` · `:162-172`** — hardcoded **column 4** (Post Code):
```js
:167  if (current && current === previous) valuesD[i-1][0] = '';   // blanks the EARLIER row
```
Compares only the **adjacent** cell, with no customer check. Two different customers sharing a
postcode → the first loses it. Result: Post Code **109/140 — 22 % blank**.

**`clearFIfDIsEmptyInSheet` · `:186-192`** — hardcoded **column 6** (Instruction QR):
```js
:190  if (!valuesD[i][0]) valuesF[i][0] = '';
```
🔴 **Deleting a postcode silently deletes the QR flag.** Result: QR **5/140**. Two ticket threads
(*"post code not shown"* and *"QR sollala"*) are the same bug.

**`removeRPR44WHAndTransferPostCode` · `:266-296`**
```js
:280  if (sku === "RPR44WH" && component) {          // a product SKU hardcoded in shared logic
:282    for (let k = cleaned.length-1; k >= 1; k--)  // scan BACKWARDS
:284      cleaned[k][addressIndex] = postCode; break;
:288    continue;                                     // row dropped
```
Deletes the white reducer plate (**169 → 140 rows**) and pushes its postcode onto the nearest earlier
row with a blank postcode — which may belong to a different order.

**`addCombinedSKUSet` · `:194-264`** — rebuilds `Combo SKU` (col M) in two passes:
1. **Merge groups** — join SKUs sharing the group key *(this is the pass `clean-1.gs` patches)*.
2. **Component sets** — scan for `Combo: 1`, accumulate while rows keep matching `Combo: \d+`, join
   their SKUs, write the joined string to **every row in the set**.

Pass 2 is why `Combo SKU` becomes a **product-shape identifier** rather than an order identifier —
and therefore why two different customers who bought the same combo end up with the same key.

### Resulting `Cleaned Data` layout

| Col | Header | Written by | Fill |
|---|---|---|---:|
| A | SKU | Stage B | 140/140 |
| B | **Name** | Stage B ← names master | 134/140 |
| C | Quantity | Stage B | 134/140 |
| D | **Post Code** | Stage B ← `Sheet1.Address` | **109/140** |
| E | Selling Platform | Stage B | 55/140 |
| F | Instruction QR | Stage B | **5/140** |
| G | Image URLs | Stage B | 140/140 |
| H | Merge Order | Stage B (the label) | 6/140 |
| I | Component | Stage B (`Combo: N`) | 72/140 |
| J | Title | Stage B | 140/140 |
| K | Price | Stage B | 140/140 |
| L | Customer Info | Stage B | 140/140 |
| M | **Combo SKU** | `addCombinedSKUSet` | 75/140 |
| N | Status | Stage B | 17/140 |
| O | Send Order Instruction | Stage B | 1/140 |
| **P** | Component *(dup)* | **Stage A leftover** | 72/140 |
| **Q** | Send Order Instruction *(dup)* | **Stage A leftover** | 1/140 |
| **R** | **SKU Combined** | **Stage A leftover** | **8/140** |

---

## 4. The speak tool — `readRowAndSpeak()` · `Lithursan.gs:1`

### 4.1 Column resolution · `:28-38`

```js
:29  headers.findIndex(h => h.toString().trim().toLowerCase() === colName.toLowerCase())
:34  if (colIndex[colName] === -1) { alert(...); return; }
```

**First match wins** — so `Component` binds to **I** (P ignored) and `Send Order Instruction` to
**O** (Q ignored). `SKU Combined` is in `neededColumns` (`:25`), so **the tool refuses to start
without the leftover column**.

### 4.2 Image map · `:47-52`

`skuToImageUrl[sku] = imgUrl` — **last write wins** per SKU. Tested: **0 conflicts** in this sheet.

### 4.3 Grouping · `:57-72`

```js
:64  const groupKey = skuCombined !== "" ? skuCombined : comboSku;   // R preferred over M
:70  combinedGroups[groupKey].push({row, index});
```

Scans the **whole sheet**, not adjacent rows, with **no customer or postcode check**.

**Live result — this is the queue the packer actually gets:**

| | Count |
|---|---:|
| `Cleaned Data` rows | 140 |
| Standalone rows (no group key) | 65 |
| Group keys | 35 |
| Rows inside groups | 75 |
| **Spoken entries in the queue** | **100** |

Group sizes: 14×1, 10×2, 6×3, 2×4, 3×5.

🔴 **4 group keys span more than one customer:**

| Key | Rows | Customers |
|---|---:|---:|
| `LSHM400HE` | 5 | **5** |
| `WCDCBM` | 3 | 3 |
| `LSCY210BG` | 3 | 3 |
| `LSEL400WH` | 2 | 2 |

Five separate parcels collapse into **one** spoken entry. Display data comes from `group[0]` only
(`:94`, `:117-124`) and the postcode from the first row that has one (`:99-115`). **This is the
wrong-parcel risk.**

### 4.4 Speech assembly · `:158-204`

Per row in the group:
```js
:172  if (mergeOrder !== "") segmentParts.push(mergeOrder);
:174  const nameWords = name.split(" ");                 // 🔴 no-op
:175  segmentParts.push(":: " + nameWords.join(" "));    //     returns the same string
:177  segmentParts.push(" :: " + quantity + " ::");
```

Then one final segment for the whole group:
```js
:186  postCode.split("")  → per character
:188  if (char.trim() !== "") push(char)                 // 🔴 drops the space inside the postcode
:196  if (qr !== "") push(": : " + qr)
```

Produces, for a 2-component group:
```
segment 0:  "merge order total: 2 : merge order: 1 :: 40 cm hemp shade :: 2 ::"
segment 1:  ":: 1 meter short holder pendant full set :: 1 ::"
segment 2:  ":Post Code: C M 6 3 Z B : : Instruction QR Available"
```

Each segment is a **separate `SpeechSynthesisUtterance`** chained on `onend` (`:760-763`) — so this
station *does* get real pauses between segments. `rowImages[]` swaps the main image per segment
(`:744-749`).

`pauseTime` is computed at `:214` and **never read** by the client.

### 4.5 Transport · `speakTextDialog()` · `:405-949`

`JSON.stringify` of all three arrays is embedded into one HTML string (`:411-413`) and shown as a
modal (`:948`, 1100×1300). **There is no `google.script.run` anywhere** — once the dialog opens it is
fully self-contained and the sheet is never read again.

---

## 5. Cell → UI mapping

### On screen (grouped order · `:216-262`)

| UI element | Source | Line |
|---|---|---|
| `Title:` | `firstRow[Title]` | `:220` |
| Blue bold name(s) | **every** row's `Name`, joined `" + "` | `:221-224` |
| Grey platform chip | `firstRow[Selling Platform]` | `:227` |
| Red text under chip | first non-empty `Instruction QR` in group | `:231` |
| Large red text | `firstRow[Status]` — `international` / `firstclass` | `:234` |
| Main image (green border) | `firstRow[Image URLs]`, swaps per segment | `:238`, `:746` |
| Price pill | `firstRow[Price]`, non-numeric stripped | `:242` |
| Customer block | `firstRow[Customer Info]` | `:245` |
| Bold postcode | first non-empty `Post Code` in group | `:246` |
| Red instruction | `firstRow[Send Order Instruction]` | `:249` |
| Green quantity badge | **every** row's `Quantity`, joined `" + "` → `x 2 + x 1` | `:255-258` |
| Grey text under badge | `groupKey` (`SKU Combined` or `Combo SKU`) | `:260` |
| Thumbnail strip | `comboImages[]` — group key split on `+`, mapped to images | `:539-551` |
| `Row: N of M` | `index+1` / `speakTexts.length` | `:781` |
| `Row Time` / `Total Time` | client timers | `:517-537` |

### Spoken (never spoken: Title, Price, Customer Info, Platform, Status)

| Spoken | Source | Line |
|---|---|---|
| Merge label | `Merge Order` (col H) | `:172` |
| Product | `Name` (col B) — **raw, no normalisation** | `:174-176` |
| Quantity | `Quantity` (col C) | `:177` |
| Postcode | `Post Code` (col D), char by char, **space dropped** | `:184-192` |
| QR | `Instruction QR` (col F) | `:195-197` |

> **`Status` is displayed but never spoken** — so `international` and `firstclass` never reach the
> packer's ears. Screenshot **P12** shows exactly this.

---

## 6. Navigation state · client-side only

| Variable | Line | Meaning |
|---|---|---|
| `index` | `:475` | position in `speakTexts` — drives display and speech |
| `toSpeak` | `:481` | indices in play, initialised `[0…99]` |
| `currentSpeakIndex` | `:483` | cursor **into `toSpeak`** |
| `held` | `:482` | deferred rows — **nothing ever writes to it** |

```
"next" → controlSpeech("next") :584 → changeIndex("next") :555
   currentSpeakIndex += 1
   if past end → currentSpeakIndex = 0        :561-563   ← WRAPS, no end-of-queue
   index = toSpeak[currentSpeakIndex]         :570
   updateUI() :572  +  speakLine() :574
```

Voice commands (`:870-885`): `next|forward|go on` · `back|prev|previous` · `respeak|again|repeat` ·
`postcode|post code` · `restart|start`. **No `stop`, no `pause`.** Matching is unanchored
`includes()`. Also wired: arrow keys (`:832-851`) and MediaSession headset buttons (`:802-830`).

---

## 7. Implementation targets, in dependency order

| # | Change | File · line | Closes | Effort |
|---:|---|---|---|---|
| 1 | **Resolve the `clean-1.gs` / `cleaned.gs` collision** — confirm which loads last, keep the patched one, delete the other | both files | unblocks everything | XS |
| 2 | Remove the duplicate `onOpen` | `action.gs:1` | menu reliability | XS |
| 3 | Pack-suffix regex `replace(/\d+PK$/,'')` | `cleaned.gs:112` | wrong name/length | XS |
| 4 | Never blank quantity on lookup miss | `cleaned.gs:116` | silent rows | XS |
| 5 | `getValues()` → `getDisplayValues()` | `cleaned.gs:27` | leading zeros | XS |
| 6 | Drop the `merge order total: N` prefix | `cleaned.gs:92-94` | U3L #15, U4 #59 | XS |
| 7 | Speak `Status` | `Lithursan.gs:172` | international/firstclass | XS |
| 8 | Keep the space inside the postcode | `Lithursan.gs:188` | postcode mispronunciation | XS |
| 9 | Add `synth.resume()` | `Lithursan.gs:660` | pause is one-way | XS |
| 10 | Decouple QR from postcode | `cleaned.gs:190` | QR 5/140 | S |
| 11 | Composite-key postcode dedupe | `cleaned.gs:167` | postcode 109/140 | M |
| 12 | Recognition: drop `stop()`, restart on error, gate mic while speaking | `Lithursan.gs:886, 892, 898` | "not listening" | M |
| 13 | **Customer-safe group key** — `Combo SKU + customer + postcode` | `Lithursan.gs:64` | **wrong-parcel risk** | M |
| 14 | Keep the reducer plate as a component; drop the backward scan | `cleaned.gs:266-296` | reducer not said | M |
| 15 | Pack sequence — bulb first, shade last | new | U3L #8, #11, #22 | M |
| 16 | Token classifier + SSML | `Lithursan.gs:752` | all pronunciation | M |

**Steps 1–9 are nine one-line changes.** Step 13 is the one that matters most for correctness.

---

## 8. Test fixtures — verify against these exact rows

| Case | Where | Expected after fix |
|---|---|---|
| Group spanning 5 customers | key `LSHM400HE` | 5 separate queue entries, not 1 |
| Group referencing a deleted component | rows 62–63, `…+RPR44WH` | reducer plate spoken as component 3 of 3 |
| Correct 4-component group | rows 49–52, Alan Robinson | unchanged — must not regress |
| Non-adjacent merge group | 1 group in the sheet | still grouped |
| Blank name → blank quantity | 6 rows | quantity retained, SKU spelled |
| Blank postcode | 31 rows | audible "postcode missing" |
