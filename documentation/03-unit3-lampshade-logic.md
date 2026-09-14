# Unit 3 Lampshade — Google Sheets Speak Tool: Logic Reference

**Last updated:** 2026-09-14 — replaces the 2026-08-13 pre-implementation analysis.
**Sheet:** [`1AMQMzxu…`](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0)
**Code:** [`scripts/Unit 3 Lampshade/`](../scripts/Unit%203%20Lampshade/)
**Reads:** Names Master Sheet [`16rx5Dz…`](https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M) (tab `names`) ·
Lampshade SOT [`1b9n4Rhy…`](https://docs.google.com/spreadsheets/d/1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI)

Function names are used instead of line numbers, which drift.

> ⚠️ **The repo is not guaranteed to match the live Apps Script.** The live `Lithursan.gs` voice layer
> differs from this folder (see [handover §3.1](../handover/handover-note.md#31-the-live-unit-3-lithursangs-is-not-in-this-repository-)),
> and the 2026-09-14 `packing-priority.gs` has not been pasted live. This document describes **the
> repository**.

---

## 1. Files

| File | Lines | What it does |
|---|---:|---|
| `action.gs` | 6 | `onOpen` — menu with **Speak All Rows** only |
| `cleaned.gs` | 404 | `onOpen` — menu with **Speak All Rows** and **Run Clean and Merge**; `mergeAndCleanSheets` and its cleaning steps; `addCombinedSKUSet` |
| `Merge SKU.gs` | 59 | `mergeAdjacentRowsAndRepeat` — writes `SKU Combined` |
| `packing-priority.gs` | 1,108 | Product type, colour, SOT, packing priority, merge sequencing, lampshade collections |
| `Lithursan.gs` | 2,089 | `readRowAndSpeak` (builds the queue) and `speakTextDialog` (the modal, speech and voice) |
| `sku.gs` | 149 | Three helpers — **not called** by any menu or pipeline step |

`*.bak*` and `*.work.now` are local backups from development, not deployed.

**`onOpen` is defined twice** (`action.gs`, `cleaned.gs`). Apps Script keeps the last one loaded. If
`action.gs` wins, **Run Clean and Merge** disappears from the menu.

---

## 2. Pipeline — `mergeAndCleanSheets()` · `cleaned.gs`

Menu **Run Clean and Merge**. Rebuilds `Cleaned Data` from `Sheet1` every time.

| # | Step | What it does |
|---:|---|---|
| 1 | Open Names Master Sheet | `openById("16rx5Dz…")`, tab `names`: col A SKU → col B spoken name. Read live every run |
| 2 | Recreate `Cleaned Data` | delete and insert |
| 3 | `mergeAdjacentRowsAndRepeat()` | For consecutive `Sheet1` rows sharing a `Merge Order` value, writes `SKU1+SKU2+…` into **`SKU Combined`**. Only **adjacent** rows group |
| 4 | Read `SKU Combined` back | one value per `Sheet1` row |
| 5 | Walk `Sheet1` → `processRow()` | See §2.1 |
| 6 | `ppStampCollections()` | Fills `Lampshade Collection` + `Lampshade Collection Speech` on the triggering order's first row (§4) |
| 7 | Write all columns | one `setValues` over the full width — no leftover columns |
| 8 | `keepOnlyLastOccurrenceInD` | blanks a postcode equal to the **adjacent** row's (hardcoded column 4) |
| 9 | `keepOnlyLastOccurrenceInE` | same for Selling Platform (column 5) |
| 10 | `clearFIfDIsEmptyInSheet` | blanks Instruction QR (column 6) where the postcode is blank |
| 11 | `removeRPR44WHAndTransferPostCode` | deletes `RPR44WH` component rows and moves their postcode to the nearest earlier blank one |
| 12 | `addCombinedSKUSet()` | Rebuilds `Combo SKU`: merge groups keyed by `SKU Combined`; component sets start at `Combo: 1` and **stop at a customer boundary** |
| 13 | `ppSortCleanedSheetRows()` | **Packing priority** — must run last (§3) |

### 2.1 `processRow()` and merge labels

**Merge labels.** Inside a run of `Sheet1` rows sharing a `Merge Order` value, each row with **≤ 1**
component token opens a sub-order and is labelled `merge order total: N : merge order: 1`, then
`merge order : 2`, `merge order : 3` … Rows with more tokens are combo continuations and get **no
label**. The label is spoken as the first words of its row.

| Field | Rule |
|---|---|
| SKU | `SKU`, else `Combo SKU`; trimmed, upper-cased |
| Name lookup | `rawSku.endsWith("PK") ? rawSku.slice(0, -3) : rawSku` — ⚠️ strips 3 characters for a 2-character suffix; wrong for `…10PK` |
| Quantity | `Combo Quantity`, else `Quantity`. Blanked **only if there is no name and no SKU** |
| Cable | SKU starting `CL`: quantity becomes `"<qty> meter"` |
| Component | `Combo: N`, N = comma-separated token count |
| Product Type | `ppProductType(rawSku, name)` |
| Colour | `ppProductColour(rawSku)` — SOT first, then SKU suffix |

### 2.2 `Cleaned Data` columns

`SKU · Name · Quantity · Post Code · Selling Platform · Instruction QR · Image URLs · Merge Order ·
Component · Title · Price · Customer Info · Combo SKU · Status · Send Order Instruction ·
SKU Combined · Product Type · Colour · Lampshade Collection · Lampshade Collection Speech`

`Title`, `Price`, `Customer Info`, `Status` and `Send Order Instruction` are included when `Sheet1` has
them. Details: [data-maps/column-map.md](../data-maps/column-map.md).

---

## 3. Packing priority — `packing-priority.gs`

### 3.1 Product type — `ppProductType(sku, name)`

Tested in this order; the first match wins.

| # | Test | Type |
|---:|---|---|
| 1 | name matches `/c[ei]+l[ei]*ng\s*rose/` — and `/re[c]?tangle\|rectangular/` | `RECT_ROSE` |
| 1 | name matches the rose test only | `ROSE` |
| 2 | name matches bulb/watts **and** SKU starts `LD` | `BULB` |
| 3 | SKU starts `LS` | `SHADE` |
| 4 | SKU starts `WCWD` | `SHADE` (ruled 2026-08-19) |
| 5 | SKU starts `WC` | `CAGE` (ruled 2026-09-11) |
| 6 | SKU starts `LD` | `BULB` |
| 7 | anything else | `OTHER` |

The rose test runs first, so an `LS`-prefixed rose is a `ROSE`.

### 3.2 Ranks — `PP_RANK_WITH_RECT` / `PP_RANK_NO_RECT`

| Type | Order has a Rect Rose | Order has none |
|---|---:|---:|
| RECT_ROSE | 1 | — |
| SHADE | 2 | 1 |
| CAGE | 3 | 2 |
| BULB | 4 | 3 |
| ROSE | 5 | 4 |
| OTHER | 5 | 4 |

`ppRank()` falls back to the table's own `OTHER`. Rose and Other tie; the sort is stable.

### 3.3 `ppSortCleanedSheetRows()` → `ppApplyPackingPriority()`

Rows are grouped into **contiguous runs of the same `Customer Info`** (postcode is not used — by this
point it survives on one row per order). Each run is handled one of two ways:

**A normal order** — if the run contains a `RECT_ROSE`, `SHADE` or `ROSE`, it is sorted by rank
(`RECT_ROSE` present → first table, otherwise the second). If it contains none of those (**Type 3**),
it is left in sheet order.

**A merge order** — `ppSequenceMergeOrder()` handles a run whose rows all share one non-empty
`SKU Combined` and whose first row carries a `Merge Order` label:

1. Split into sub-orders at each labelled row.
2. Sort each sub-order on its own contents (same rule as a normal order — the Rect Rose test is per
   sub-order).
3. If any sub-order has a Lampshade or Ceiling Rose, **sequence the sub-orders**: key = the
   sub-order's ranks from `PP_RANK_WITH_RECT`, best first; compare position by position; a full tie
   keeps sheet order. E.g. `Lampshade + Rect Rose [1,2]` → `Rect Rose + … [1,5]` →
   `Lampshade + Rose [2,5]` → `Bulb + Holder [4,5]`.
4. Re-stamp the `Merge Order` labels in the **new** spoken sequence, reusing the original label texts.

If `Merge Order` or `SKU Combined` is missing, merges fall back to the normal-order sort.

**Verified 2026-09-14** against 155 real orders (27 merges): sequence identical to the HTML Speak
Tool, 0 products lost, 0 labels misplaced.

---

## 4. Lampshade collections — `packing-priority.gs`

| Setting | Value |
|---|---|
| Limit per collection | **`PP_MAX_LAMPSHADE_COLLECTION = 15`** — ⚠️ the HTML tool uses **10** |
| List 1 — "These orders only" (`RUN`) | `LSBS LSSS LSWE WCCY LSCYRO LSBG LSCG LSFG LSGD LSGG LSGL WCB WCD WCWD` |
| List 2 — "Whole pack list" (`FULL`) | `LSCY2 LSDM LSDO LSEL LSFT LSHH LSHM LSLC LSLT LSMS LSOL LSRP LSTF LSTL LSTM LSUL LSWD` |
| Prefix match | longest wins (`LSCYRO` → list 1; `LSCY290…` → list 2) |

- A family is collected only when the order is **short** on that SKU — sufficiency is checked per SKU.
- List 1 walks only the run of consecutive orders carrying the family; **a run of one is not shown**.
  List 2 scans the rest of the pack list.
- The limit is **per list**: an order short on both gets two collections.
- The triggering order is always completed; if it alone exceeds the limit the batch is flagged
  `OVERFLOW`.
- The trolley pool is clamped at zero (2026-08-19 fix).
- Families not in either list are never collected — packed straight from the order.

Collections are grouped by `Customer Info` + `Post Code` and stamped **before** the packing sort, on
the order's first row:

```
Lampshade Collection         BATCH|<n>|<total>|<max>|<OVERFLOW or empty>|<RUN or FULL>
                             ITEM|<skus>|<size>|<colour>|<qty>|<orders>
Lampshade Collection Speech  the sentence spoken for the collection step
```

`ppLoadSot()` reads the Lampshade SOT (`PP_SOT_ID`) for colour, family, size and image, with
`PP_SOT_OVERRIDE` for rows whose SOT colour contradicts the product name.

---

## 5. The speak dialog — `Lithursan.gs`

Menu **Speak All Rows** → `readRowAndSpeak()`.

### 5.1 Building the queue

**Required columns** (the tool aborts without them): `SKU, Name, Quantity, Post Code, Selling
Platform, Instruction QR, Image URLs, Title, Price, Customer Info, Combo SKU, Status, Merge Order,
Component, Send Order Instruction, SKU Combined`. **Optional:** `Lampshade Collection`,
`Lampshade Collection Speech`, `Colour`.

**Grouping** — `groupKeyOf(row)`: label = `SKU Combined`, else `Combo SKU`; key = label **+ customer**.
Rows sharing a key become one queue entry, taken in sheet order. So a merge order is **one** entry, and
two customers who bought the same combo stay separate. A row with no label is a standalone entry.

**Collection step** — if the order carries `Lampshade Collection` text, a separate queue entry is
pushed **before** it, showing the batches and speaking the collection sentence.

**Speech, per component row:** `[merge label] :: <name or "This one" + colour> :: <qty> ::`.
The postcode (`:Post Code:` then characters, spaces dropped) and the note (Instruction QR and Send
Order Instruction, `: Note : …`) are glued onto the **last** component — no extra Next needed.
A nameless row with nothing to say is skipped entirely, keeping images and quantities aligned.

**Thumbnails** follow the spoken order: each row's own image first, then combo components that have no
row of their own.

### 5.2 The modal

`speakTextDialog()` embeds all queue data in one HTML string and opens a 1900 × 1400 modal. The sheet
is not read again while it is open.

| Element | Detail |
|---|---|
| Position | `Row N of M` · `Item a of b` |
| Timers | this order · total |
| Language / Voice | voices grouped by language; defaults to Google US English |
| Speed | Slow 0.6 · Normal 0.7 · Fast 1.2 · Faster 1.5 |
| Buttons | Restart · Back · Postcode · Pause · Repeat · Next |
| Spoken text + thumbnail strip | current component highlighted |
| Order card | title, names, platform, QR chip, status, image (click to zoom), per-component quantity, price, customer, postcode, note |
| Mic chip + level meter | listening state and live input level |

**Navigation:** Next steps through the order's components, then moves to the next order; after the last
order it wraps to the first. Back mirrors it. Repeat re-speaks the current component; Postcode reads just
the postcode.
**Keys:** `→` Next · `←` Back · `↑` Repeat · `↓` Pause · `Enter` Restart · `Esc` closes zoom.
**Headset** (MediaSession): play → resume/repeat, pause → pause, next track → Next, previous → Back.

### 5.3 Voice — repository version

- `continuous = true`, `interimResults = false`, `lang = "en-US"`. Restarted after every end.
- Listens **while the tool speaks**. Only `postcode` is ignored while speech plays (the tool says it).
- Last command word in the transcript wins; the same command within 1 second is ignored.

| Command | Words |
|---|---|
| next | next · forward · go on · go next |
| back | back · hack · bak · buck · rack · previous · prev |
| repeat | respeak · again · repeat |
| postcode | post code · postcode · post card · postcard · poscode · postco · pocket |
| restart | restart · start · start again |
| pause / resume | pause · resume · unpause |

`hack` and `pocket` came from a console capture (2026-08-24) — Chrome returned them for "back" and
"post code". `black`, `pack` and `bag` were rejected: 727, 56 and 97 catalogue names contain them.

**Not in the Sheets tool:** Hold, Restart confirmation, Finished card, master-sheet names on
collection cards, slower collection speech. These exist only in the HTML Speak Tool.

---

## 6. Status of the 2026-08-13 findings

Re-checked against the repository code on 2026-09-14. Original analysis:
[02-code-walkthrough.md](02-code-walkthrough.md).

| Finding (13 Aug) | Status |
|---|---|
| `clean-1.gs` / `cleaned.gs` define the same functions | ✅ Fixed — `clean-1.gs` removed |
| Duplicate `onOpen` (`action.gs`, `cleaned.gs`) | 🔴 Open |
| `Cleaned Data` double write leaves columns P/Q/R as leftovers | ✅ Fixed — full-width write; `SKU Combined` written deliberately |
| C1: `SKU Combined` becomes row-misaligned after rows are deleted | ❌ **Was wrong** — the deletion step rewrites every column, so the value stays on its row (verified on the live sheet 2026-08-13). The real wrong-parcel risk was the customer-less group key, fixed below |
| Group key has no customer — different customers merged into one entry | ✅ Fixed — key includes customer |
| Component set runs past a customer boundary | ✅ Fixed |
| Merge group keyed on label text (unrelated orders collide) | ✅ Fixed — keyed on `SKU Combined` |
| Quantity blanked when the name lookup fails | ✅ Fixed — only when there is no SKU; row spoken as "This one" |
| Pack-suffix lookup `slice(0, -3)` | 🔴 Open |
| Pause is one-way (no `synth.resume()`) | ✅ Fixed — verified resume |
| Microphone closed while speaking; recogniser dies | ✅ Fixed — always-on, restarted on end |
| No pack sequence | ✅ Fixed — packing priority, merge sequencing |
| `merge order total: N` wording (FB-140) | 🔴 Open |
| Postcode space dropped | 🔴 Open |
| `Status` shown but not spoken | 🔴 Open |
| Blanking a postcode blanks the QR flag | 🔴 Open |
| Duplicate-postcode check is adjacent-only, no customer | 🔴 Open |
| `RPR44WH` hardcoded in shared cleaning | 🔴 Open |
| Leading zeros lost (`getValues`) | 🔴 Open |
| No SSML / number normalisation | 🔴 Open |
| `pauseTime` computed, never used | 🔴 Open (harmless) |

---

## 7. Test data

- `order_details/1.html … 13.html` — 155 orders, 27 merges. The same pack lists the HTML tool is tested
  on; loading `packing-priority.gs` into Node and feeding it rows built from them is how the 2026-09-14
  merge change was verified against the HTML tool.
- The live sheet itself is the final check: paste, **Run Clean and Merge**, **Speak All Rows**.
