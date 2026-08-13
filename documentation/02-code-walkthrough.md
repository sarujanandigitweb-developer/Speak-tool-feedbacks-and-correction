# Apps Script — Code Walkthrough and Confirmed Root Causes

**Source:** [scripts/](../scripts/) — 5 files, 1,465 lines, exported from the Unit 3
Lampshade project.
**Date:** 2026-08-13

This closes the gap flagged in
[script-export-instructions.md](../handover/script-export-instructions.md). All seven
questions raised there are answered below, and the code **confirms every root cause** in
[open-defects.md](../validation/open-defects.md) — plus five more that could not be seen
from the data alone.

---

## 1. File map

| File | Lines | Role |
|---|---:|---|
| `action.gs` | 6 | Menu — `Speak All Rows` only |
| `cleaned.gs` | 296 | **Menu + the whole cleaning pipeline.** `mergeAndCleanSheets()` |
| `Merge SKU.gs` | 59 | `mergeAdjacentRowsAndRepeat()` — writes the `SKU Combined` column |
| `sku.gs` | 156 | Three helpers, **none of them called** by any pipeline |
| `Lithursan.gs` | 948 | The Speak Tool — builds the utterances, renders the modal |

`action.gs` and `cleaned.gs` both define `onOpen()`. In Apps Script the **last definition
loaded wins**, so one of these two menus silently does not exist. Which one depends on
file order — a coin flip that nobody controls.

## 2. Pipeline

```
Sheet1
  │
  ├─ mergeAndCleanSheets()                       cleaned.gs:9
  │    ├─ deletes + recreates "Cleaned Data"           :22-25
  │    ├─ reads names sheet by ID (live)               :13-15
  │    ├─ mergeAdjacentRowsAndRepeat()                 :64   ← writes 18 cols
  │    ├─ builds `output` (15 cols) and writes it      :153  ← overwrites only 15
  │    ├─ keepOnlyLastOccurrenceInD()  (post code)     :155
  │    ├─ keepOnlyLastOccurrenceInE()  (platform)      :156
  │    ├─ clearFIfDIsEmptyInSheet()    (QR)            :157
  │    ├─ removeRPR44WHAndTransferPostCode()           :158
  │    └─ addCombinedSKUSet()                          :159
  ▼
Cleaned Data
  │
  └─ readRowAndSpeak()                        Lithursan.gs:1
       ├─ groups rows by SKU Combined ?? Combo SKU     :60-72
       ├─ builds speech segments per group             :158-204
       └─ speakTextDialog() → modal + Web Speech API   :405
```

---

## 3. The seven questions, answered

### Q1 — How is the utterance built? Any SSML?

**Plain string concatenation. No SSML anywhere.** `Lithursan.gs:752`:

```js
const utter = new SpeechSynthesisUtterance(text);
utter.lang = "en-US";
```

Postcodes **are** already split character-by-character (`:186-191`, `:329-334`), so that
part of Theme A was attempted. Two things defeat it:

- `char.trim() !== ""` **drops the space inside the postcode**, so `PE11 3TY` becomes
  `P E 1 1 3 T Y` with no break between outward and inward code. The engine re-groups the
  digit run.
- **Product names are not normalised at all.** `:173-176`:
  ```js
  const nameWords = name.split(" ");
  segmentParts.push(":: " + nameWords.join(" "));
  ```
  `split(" ")` then `join(" ")` returns the identical string. This is a **no-op that looks
  like it does something** (also at `:320-321`). So a name containing `IP20` is handed to
  the engine raw → *"I P twenty thousand"*.

**Confirms Theme A.** The fix belongs in a tokeniser, exactly as proposed.

### Q2 — Is recognition continuous, and where is it restarted?

`recognition.continuous = true` (`:859`). Three problems, all in ~40 lines:

**(a) `stop()` immediately followed by `start()`** — `:886-887`, inside `onresult`:
```js
recognition.stop();
recognition.start();
```
`stop()` is asynchronous. Calling `start()` before the service has ended throws
`InvalidStateError`. That fires `onerror` (`:892`) — **which does not restart it.**
Recognition can die permanently mid-session, and the packer has no way to tell.

**(b) `onend` restarts with no guard or delay** (`:898-901`), racing the same call.

**(c) The microphone stays open while the tool is speaking.** Nothing pauses recognition
during synthesis. The TTS says *"Post Code"* out loud, the mic hears it, and `:879`
matches:
```js
} else if (spokenText.includes("postcode") || spokenText.includes("post code")) {
```
**The tool triggers its own postcode command from its own speech.** Same class of bug at
`:882` — `includes("start")` fires on any utterance containing "start".

**Confirms Theme B**, and (c) is a cause nobody had identified.

### Q3 — How are merge orders grouped?

Confirmed, and worse than the data suggested.

**Grouping requires rows to be physically adjacent** (`cleaned.gs:80-86`) — the loop walks
forward while `Merge Order` matches. If a merge group is not contiguous in `Sheet1`, it
silently splits into two.

**The label is generated at `cleaned.gs:92-94`:**
```js
const label = mergeOrderLabelCounter === 1
  ? `merge order total: ${labelCount} : merge order: 1`
  : `merge order : ${mergeOrderLabelCounter}`;
```
This is **verbatim** what FB-140 asked to be removed: *"Not need merge order total 2:
merge order 1, just say Merge Order."* One-line fix.

**Combo rows inside a merge group get no merge label at all** (`:97-99`) — `labelCount`
only counts rows with `componentCount <= 1`, and multi-component rows are passed an empty
label. That is FB-035/FB-036 *"merge & combo orders same time both names speak"*.

### Q4 — Is the Names Master Sheet read live?

**Yes** — `cleaned.gs:13-15` opens it by ID on every run. So FB-072 is *not* a stale-copy
problem. **The lookup key is mangled instead** (`cleaned.gs:112`):

```js
let lookupSku = rawSku.endsWith("PK") ? rawSku.slice(0, -3) : rawSku;
```

`slice(0, -3)` removes **three** characters, but `"PK"` is two. It only works when the
pack count is a single digit:

| SKU | Stripped to | Correct? |
|---|---|---|
| `LDMST64B2286PK` | `LDMST64B228` | ✅ by luck (`6PK`) |
| `LSCYRO120GD10PK` | `LSCYRO120GD1` | ❌ leaves the `1` of `10` |
| `SOMESKUPK` | `SOMESK` | ❌ eats a real character |

And the very next lines make a failed lookup **silent**:

```js
let name = skuToName[lookupSku] || "";
let quantity = ...;
if (!name) quantity = '';        // cleaned.gs:116
```

**A missed name deliberately blanks the quantity too.** The row then speaks nothing at
all. This single line is the root cause of FB-054 *"SP11 6TQ not speak quantity"*, FB-150
*"quantity not show"*, **and** the 6 blank `Name` / 6 blank `Quantity` cells measured in
[column-map.md](../data-maps/column-map.md).

### Q5 — Columns by header name or index?

**Both, inconsistently.**

- `Lithursan.gs:29` matches by header name, **first match wins**. `Cleaned Data` has
  `Component` and `Send Order Instruction` twice, so cols P and Q are silently ignored.
  Predicted in [column-map F3](../data-maps/column-map.md) — confirmed.
- `cleaned.gs:163, 175, 188-190` use **hardcoded column numbers** (`getRange(2, 4, …)` for
  Post Code, 5 for Platform, 6 for QR). Correct today only because `outputHeaders` happens
  to put them there.
- `cleaned.gs:280` **hardcodes a product SKU in the cleaning logic**:
  ```js
  if (sku === "RPR44WH" && component) {
  ```
  One specific reducer plate is special-cased in shared code. Its postcode is then pushed
  onto *"the nearest row above with an empty Post Code"* (`:282-287`) — a backwards scan
  that can attach a postcode to an unrelated earlier order. That is FB-075 *"Different
  postcodes for these 2 combo orders."*

### Q6 — What happens on a blank Name / Quantity / Post Code?

Nothing visible. `Lithursan.gs:728-732`: if every segment is empty, it writes *"No valid
speech content"* into `#voiceFeedback` — **12px grey text** (`:431`) — and calls `onEnd()`.
The tool moves on in silence. The packer cannot distinguish "nothing to say" from "tool
broken". Confirms the Theme D recommendation.

### Q7 — How different are the six copies?

**Still unanswered** — only the Unit 3 Lampshade project was exported. Exporting the other
five and diffing remains worthwhile.

---

## 4. Five defects the data could not show

### C1 — `Cleaned Data` is written twice, and the tool depends on the leftovers ⚠️

The most serious finding.

`mergeAdjacentRowsAndRepeat()` (`cleaned.gs:64`) writes **18 columns** — Sheet1's 17
headers plus `SKU Combined`. Then `cleaned.gs:153` writes `output`, which is only **15
columns wide**:

```js
cleanedSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
```

`setValues` overwrites **columns 1–15 only**. Columns 16, 17 and 18 survive untouched.

That is exactly what the live sheet shows:

| Col | Header | Origin |
|---|---|---|
| A–O | the 15 real columns | `output` |
| **P** | `Component` *(dup)* | leftover — Sheet1 col P |
| **Q** | `Send Order Instruction` *(dup)* | leftover — Sheet1 col Q |
| **R** | `SKU Combined` | leftover — Merge SKU.gs |

The duplicate headers in [column-map F3](../data-maps/column-map.md) are **residue from a
double write**, not a design choice.

It gets worse. `removeRPR44WHAndTransferPostCode()` (`:158`) then **deletes rows**
(`:288 continue`) and rewrites the sheet. Columns A–O shift up with it; column R does not
get rebuilt. **`SKU Combined` is now misaligned with the rows beside it.**

And `Lithursan.gs:60-64` groups orders by that column, in preference to `Combo SKU`:

```js
const groupKey = skuCombined !== "" ? skuCombined : comboSku;
```

**Order grouping is driven by a stale, row-shifted column.** This is the strongest
explanation yet for the erratic merge behaviour — FB-079 *"RMI order and 2-4 1st order
came merged"*, FB-075, and the combos that group correctly one day and not the next.

`Lithursan.gs:25` also lists `"SKU Combined"` in `neededColumns` and **aborts with an
alert if it is missing** (`:34-37`) — so the tool now formally depends on the leftover.
Fixing the double write without also fixing this check would stop the tool starting.

### C2 — Blanking a postcode also deletes the QR flag

`keepOnlyLastOccurrenceInD` (`:162-172`) compares each postcode with **the row above** and
blanks the earlier one when they match:

```js
if (current && current === previous) {
  valuesD[i - 1][0] = '';
}
```

It compares adjacency only, with no customer check. Two *different* customers who share a
postcode and land next to each other → the first one's postcode is deleted. That is FB-116
and FB-071 *(marked **Important**)*.

Then `clearFIfDIsEmptyInSheet` (`:186-192`) wipes column F wherever column D is empty —
and column F is **Instruction QR**:

```js
for (let i = 0; i < numRows; i++) if (!valuesD[i][0]) valuesF[i][0] = '';
```

So deleting a postcode silently deletes that order's QR instruction. **FB-060, FB-070 and
FB-078 (*"QR sollala"*) are a side-effect of the postcode dedup** — two separate ticket
threads, one cause. Neither team could have known they were the same bug.

This also explains the measured fill rates: Post Code 109/140, Instruction QR 5/140.

### C3 — Leading zeros are destroyed before the script sees them

`cleaned.gs:27` uses `getDataRange().getValues()`. **`getDisplayValues()` appears nowhere
in the codebase.** `getValues()` returns a cell formatted as a number *as* a number, so a
German postcode `00049` arrives as `49`.

Directly confirms FB-148 *"postcode first number 0 not showing"*, FB-151 *"post code
00049"*, and FB-149 *"sometimes after speak wrong number like 53881"*. Both German
stations, one one-word fix: `getDisplayValues()`.

### C4 — Pause cannot be resumed

`togglePause()` (`:660-669`) calls `synth.pause()`. **`synth.resume()` does not exist
anywhere in the file.** Once paused, the only way forward is Respeak or Next.

FB-012 *"pause button not complte work"* is **marked Done**. It was not fixed. Worth
re-checking every other item closed in that batch.

### C5 — Three features are half-built and inert

| Feature | Evidence | Ticket |
|---|---|---|
| **Quantity-based pause** | `pauseTime` computed at `:214` and `:349`, passed into `displays` at `:269`/`:397`, **never read by the client** | FB-014, marked Done |
| **Hold / held rows** | `held` array, `#heldRows` div, CSS class, render logic at `:785-788` — **nothing ever pushes into `held`**, and there is no Hold button | FB-009, marked Done |
| **Screenshot** | `html2canvas` loaded from CDN at `:419`, **never called** | FB-021, marked Done |

All three are marked Done in the feedback sheet. All three are dead code. This is the
clearest evidence for the tracking changes in
[Upgrade Proposal §6](../capability/upgrade-proposal.md) — closing an item without a
verification step means "Done" carries no information.

Also unused: all three functions in `sku.gs` (`blankDuplicateSKUsInSheet1`,
`addProductNamesFromSKU`, `copySKUFromSheet1ToCleanedData`) are called from nowhere.

---

## 5. Smaller issues

| # | Issue | Where |
|---|---|---|
| 1 | Two competing `onOpen()` definitions — one menu silently loses | `action.gs:1`, `cleaned.gs:1` |
| 2 | `utter.lang` hardcoded `"en-US"` regardless of selected voice — wrong for Kronen/Schmutter | `Lithursan.gs:753` |
| 3 | Default voice hardcoded to `"Google US English"` — FB-030 asked for UK English | `:697` |
| 4 | Row counter shows `index + 1`, but navigation runs through `toSpeak[currentSpeakIndex]`; they diverge after any hold rotation | `:781` |
| 5 | `title`, `customerInfo`, `status` interpolated raw into HTML **and** into a `<script>` block — a marketplace title containing `<`, a quote or `</script>` breaks the modal | `:220`, `:245`, `:412` |
| 6 | `placeholder.com` fallback on image error — a dead third-party domain | `:238`, `:370` |
| 7 | `padding: 6px 400px` — fixed pixel padding, breaks on smaller screens | `:254`, `:386` |
| 8 | Deleting and recreating `Cleaned Data` on every run destroys any manual fix, formatting, or filter | `cleaned.gs:22-25` |

---

## 6. What this changes in the proposal

Nothing in [upgrade-proposal.md](../capability/upgrade-proposal.md) is overturned. The
priorities hold, and three of them get **cheaper** than estimated:

| Was | Now |
|---|---|
| Theme A — build a tokeniser | Still needed, but the postcode splitter already exists; it needs a space preserved (`:188`) and the name path un-no-op'd (`:174`) |
| Theme B — restart logic | One specific fix: delete `recognition.stop()` at `:886`, restart from `onerror`, and **pause recognition while speaking** to stop the self-trigger |
| FB-140 merge wording | One line — `cleaned.gs:93` |
| FB-148/151 leading zeros | One word — `getValues()` → `getDisplayValues()` |
| FB-054/150 missing quantity | One line — `cleaned.gs:116`, plus fixing `slice(0, -3)` → `slice(0, -2)` at `:112` |

**Added to the top of the list:** C1, the double write. It is not in any ticket because no
packer could see it, but it corrupts the column that drives order grouping — so it may be
sitting underneath several Theme C reports. Fix it before the merge-order rework, or the
rework will be built on a shifting column.

**Suggested first day of work** — all small, all independently shippable:

1. `cleaned.gs:112` — `slice(0, -3)` → `slice(0, -2)`
2. `cleaned.gs:116` — stop blanking quantity when the name lookup fails
3. `cleaned.gs:27` — `getValues()` → `getDisplayValues()`
4. `cleaned.gs:93` — drop the `merge order total: N` prefix
5. `Lithursan.gs:886` — remove `recognition.stop()`; restart from `onerror`
6. `Lithursan.gs:188` — keep the space inside the postcode
7. Add `synth.resume()` to `togglePause()`

That is seven small changes closing eight tickets. Then C1, then the merge-order model.
