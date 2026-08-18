# Speech Tool — System Discovery & Analysis

**Stage:** Discovery + analysis only. Nothing was modified, created in the live system, or deployed.
**Date:** 2026-08-13
**Evidence base:** 2 spreadsheets downloaded and profiled · 5 Apps Script files (1,465 lines) read in full · 2 data-integrity hypotheses tested against live data.

---

## 1. Executive Summary

**What it is.** The Speech Tool is a **Google Apps Script HTML Service modal dialog**, opened from a
custom spreadsheet menu, which reads the day's order queue aloud through the **browser's Web Speech
API** and accepts voice commands to move through it. It is not a web app, has no server, and makes no
network calls back to Apps Script once open.

**What problem it solves.** A packer needs both hands and both eyes on stock. Reading a printed
packlist forces them to look away from the shelf for every line. The tool speaks the order instead —
quantity, phonetic product name, then postcode — so the packer keeps working while listening.

**How it actually works.** The pipeline is two-stage and **fully pre-computed**:

1. `mergeAndCleanSheets()` transforms the raw platform import (`Sheet1`) into a speech-ready tab
   (`Cleaned Data`), looking up phonetic product names from an external shared spreadsheet.
2. `readRowAndSpeak()` reads `Cleaned Data` **once**, builds every utterance string and every HTML
   panel for the entire queue, serialises the whole lot into a single HTML document, and shows it as
   a modal.

From that point on the dialog is **self-contained client-side JavaScript**. There is no
`google.script.run` anywhere in the codebase (verified: 0 occurrences). Navigation, speech and voice
recognition all run in the browser against the pre-baked array.

**Does it match the intended concept?** Mostly yes, with two substantive deviations.

| # | Expected behaviour | Actual | Status |
|---|---|---|---|
| 1 | User opens the order list | Spreadsheet with `Sheet1` + `Cleaned Data` | ✅ |
| 2 | User clicks the Speak Tool | Custom menu `🗣 Speak Tool → Speak All Rows` | ⚠️ Two competing `onOpen()` definitions — see R7 |
| 3 | Speech/voice window opens | `HtmlService` modal, 1100×1300 | ✅ |
| 4 | Current order read aloud | `speakLine()` via `SpeechSynthesisUtterance` | ✅ |
| 5 | Voice commands available | `webkitSpeechRecognition`, 5 command families | ✅ |
| 6 | "next" moves to next order | `controlSpeech("next")` → `changeIndex("next")` | ✅ — but see R3 |
| 7 | Continue without clicking | Works until recognition throws, then dies silently | ⚠️ See R3 |
| 8 | Uses existing order data | Uses **`Cleaned Data`**, a derived tab — *not* `Sheet1` | ⚠️ See §9 |

> **The tool does not read the order sheet the business edits.** It reads a derived tab that is
> deleted and rebuilt on every clean run (`cleaned.gs:22-25`). Any manual correction made in
> `Cleaned Data` is destroyed the next time the clean is run.

---

## 2. Current Architecture

The diagram in the brief implies a live loop between the UI and Apps Script. **That is not the
implementation.** The real architecture is one-shot injection:

```text
┌─ SERVER (Google Apps Script, runs once) ──────────────────────────────┐
│                                                                       │
│  Sheet1 (raw import)          Names Master Sheet (external, by ID)    │
│        │                              │                               │
│        └──────────┬───────────────────┘                               │
│                   ▼                                                   │
│         mergeAndCleanSheets()                      cleaned.gs:9       │
│                   │  (delete + recreate "Cleaned Data")               │
│                   ▼                                                   │
│           Cleaned Data (derived tab)                                  │
│                   │                                                   │
│                   ▼                                                   │
│           readRowAndSpeak()                     Lithursan.gs:1        │
│                   │  builds ALL utterances + ALL HTML panels          │
│                   ▼                                                   │
│           speakTextDialog()                     Lithursan.gs:405      │
│                   │  JSON.stringify → embedded in one HTML string     │
└───────────────────┼───────────────────────────────────────────────────┘
                    ▼   ◄── ONE-WAY. No google.script.run. No callbacks.
┌─ CLIENT (browser modal, self-contained) ──────────────────────────────┐
│                                                                       │
│   const speakTexts = [...]   const displays = [...]   Lithursan.gs:472│
│                   │                                                   │
│      ┌────────────┼─────────────┬──────────────┐                      │
│      ▼            ▼             ▼              ▼                      │
│  SpeechRecognition  Buttons  Keyboard    MediaSession                 │
│    (mic, :858)     (:456)   (:832)      (headset, :802)               │
│      │            │             │              │                      │
│      └────────────┴──────┬──────┴──────────────┘                      │
│                          ▼                                            │
│                  controlSpeech(action)              :579              │
│                          ▼                                            │
│                  changeIndex("next")                :553              │
│                    index = toSpeak[currentSpeakIndex]                 │
│                          ▼                                            │
│                  updateUI()  +  speakLine()         :777 / :723       │
│                          ▼                                            │
│                  SpeechSynthesisUtterance           :752              │
│                          ▼                                            │
│                       Packer hears it                                 │
└───────────────────────────────────────────────────────────────────────┘
```

### Layer-by-layer

| Layer | What it does | Controlled by | Receives | Produces | Can fail | Verified |
|---|---|---|---|---|---|---|
| **Source data** | Raw platform import | `Sheet1` (manual/external) | Marketplace orders | 17 columns × N rows | Missing postcode, blank name | ✅ profiled |
| **Cleaning** | Builds speech queue | `mergeAndCleanSheets()` `cleaned.gs:9` | `Sheet1` + names sheet | `Cleaned Data` | Name lookup miss → silent row; double write leaves stale cols | ✅ read + measured |
| **Name lookup** | Phonetic names | `cleaned.gs:13-15, 30-35, 112-113` | External sheet `16rx5Dz…` | `skuToName` map | `slice(0,-3)` mangles key | ✅ read |
| **Utterance build** | Text + HTML per order | `readRowAndSpeak()` `Lithursan.gs:1` | `Cleaned Data` | `speakTexts[]`, `displays[]` | Group-key collision merges customers | ✅ read + **tested** |
| **Transport** | Serialise into HTML | `speakTextDialog()` `:405-413` | Arrays | One HTML string | Unescaped `</script>` in a title | ✅ read |
| **UI shell** | Modal + controls | `HtmlService` `:948` | HTML string | Rendered dialog | — | ✅ screenshot |
| **Voice input** | Listen for commands | `recognition` `:858-904` | Microphone | Transcript string | `InvalidStateError` kills it permanently | ✅ read |
| **Command match** | Map words → action | `:870-885` | Transcript | Action name | Substring matching; self-trigger | ✅ read |
| **Navigation** | Move the pointer | `changeIndex()` `:553` | Action | New `index` | Wraps forever; no end state | ✅ read |
| **Speech output** | Speak segments | `speakLine()` `:723` | Segment array | Audio | No SSML; `lang` hardcoded | ✅ read |

---

## 3. Google Sheet Analysis

| Spreadsheet | Tab | Purpose | Important fields | Source-of-truth status |
|---|---|---|---|---|
| **`1uN-9zD…`**<br>*"Speak tool feedbacks and correction"*<br>(brief's **Sheet 1**) | `All Stations` | Station registry + order-type definitions | Station names, links, 5 order types | ✅ Canonical for **station registry** |
| | `Unit 3 Others`, `Unit 3 Lampshade`, `Unit 4`, `Schmutter`, `Kronen` | **QA / defect log** — 160 items | Date, Issues, Ref *(empty on all 160)*, status, dev note | ✅ Canonical for **defect tracking** |
| **`1UXra9cm…`**<br>*"Unit 3 Lampshade Person 2"*<br>(brief's **Sheet 2**) | `Sheet1` | Raw platform import — **217 rows**, 17 cols | Title, SKU, Quantity, Combo SKU, Combo Color/Quantity, Price, Link, Customer Info, Address, Selling Platform, Instruction QR, Status, Image URLs, Merge Order, Component, Send Order Instruction | ⚠️ **Contested** — see §9 |
| | `Cleaned Data` | Speech queue — **217 rows**, 18 cols | SKU, **Name** (phonetic), Quantity, Post Code, Instruction QR, Image URLs, Merge Order, Component, Combo SKU, Status, **SKU Combined** | ✅ **The tool's actual source of truth** |
| **`1AMQMzxu…`**<br>*"Unit 3 Lampshade"*<br>(not in brief) | `Sheet1` | Same import — **169 rows** | identical headers | ⚠️ **Contested** — first 169 rows byte-identical to Person 2 |
| | `Cleaned Data` | **140 rows**, 18 cols | identical headers | ⚠️ **Diverged** — see §9 |
| **`16rx5Dz…`**<br>*Names master sheet* | `names` | SKU → phonetic name dictionary | col A = SKU, col B = Name | ✅ Canonical for **pronunciation**. Hardcoded at `cleaned.gs:14`, `sku.gs:53` |

### Answers to the specific field questions

| Question | Answer | Evidence |
|---|---|---|
| **Unique order identifier** | ❌ **There is none.** No order ID, no Amazon order number, no row key. | No such column in either `Sheet1` or `Cleaned Data` |
| Order-related columns | Customer Info, Address, Selling Platform, Status, Merge Order | `Sheet1` header row |
| Product/SKU fields | `SKU`, `Combo SKU`, `SKU Combined` | `Cleaned Data` cols A, M, R |
| Quantity fields | `Quantity`, `Combo Quantity` | `Sheet1` C, F |
| Customer info used | `Customer Info` (unparsed name+address blob), `Address` (**contains only the postcode**) | `Sheet1` I, J |
| Status fields | `Status` — free text, includes `plz cancel this order` | `Sheet1` M |
| Navigation / sequence field | ❌ None. Navigation is **array position** = sheet row order | `Lithursan.gs:481` |
| Packing-specific fields | `Instruction QR`, `Component`, `Merge Order`, `Send Order Instruction` | `Sheet1` L, P, O, Q |
| Do the two sheets represent different stages? | **No.** Both brief-listed sheets serve different *functions* — one is a defect log, one is an order queue. The order data itself is duplicated across ≥2 *other* station spreadsheets. | §9 |
| Which is source of truth for the Speech Tool? | **`Cleaned Data` in whichever station spreadsheet the packer opened.** The tool only ever reads `getSheetByName("Cleaned Data")` on the **active** spreadsheet. | `Lithursan.gs:3` |

> **Correction to the brief's framing:** brief-Sheet 1 (`1uN-9zD…`) is **not an order data source**. It
> is the QA log. The Speech Tool never reads it. Only brief-Sheet 2 carries orders.

---

## 4. Apps Script Analysis

| Function | File:line | Purpose | Reads | Writes | Speech/navigation role |
|---|---|---|---|---|---|
| `onOpen()` | `cleaned.gs:1` | Menu: *Speak All Rows*, *Run Clean and Merge* | — | — | Entry point |
| `onOpen()` | `action.gs:1` | Menu: *Speak All Rows* only | — | — | **⚠️ Duplicate — collides** |
| `mergeAndCleanSheets()` | `cleaned.gs:9` | Master cleaning routine | `Sheet1`, external names sheet | **deletes + recreates `Cleaned Data`** | Builds the speech queue |
| ├ `processRow()` | `cleaned.gs:105` | Per-row projection | row array | pushes to `output` | Name lookup, merge label |
| `mergeAdjacentRowsAndRepeat()` | `Merge SKU.gs:1` | Adds `SKU Combined` | `Sheet1` | **clears + writes 18 cols** to `Cleaned Data` | **Writes the grouping key** |
| `keepOnlyLastOccurrenceInD()` | `cleaned.gs:162` | Dedupe postcode | col D | col D | Blanks duplicate postcodes |
| `keepOnlyLastOccurrenceInE()` | `cleaned.gs:174` | Dedupe platform | col E | col E | — |
| `clearFIfDIsEmptyInSheet()` | `cleaned.gs:186` | Clear QR if no postcode | cols D, F | col F | **Side-effect: deletes QR** |
| `addCombinedSKUSet()` | `cleaned.gs:194` | Build combo/merge SKU sets | `Cleaned Data` | `Combo SKU` col | **Writes the grouping key** |
| `removeRPR44WHAndTransferPostCode()` | `cleaned.gs:266` | Drop `RPR44WH` rows, move postcode up | `Cleaned Data` | **clearContents + rewrite** | Deletes rows |
| `blankDuplicateSKUsInSheet1()` | `sku.gs:1` | — | `Sheet1` | `Sheet1` | ❌ **Never called** |
| `addProductNamesFromSKU()` | `sku.gs:48` | — | `Sheet1`, names sheet | `Sheet1` | ❌ **Never called** |
| `copySKUFromSheet1ToCleanedData()` | `sku.gs:103` | — | both | `Cleaned Data` | ❌ **Never called** |
| `readRowAndSpeak()` | `Lithursan.gs:1` | **Builds every utterance + panel** | `Cleaned Data` | — (read-only) | Core speech builder |
| `speakTextDialog()` | `Lithursan.gs:405` | Serialise + show modal | arrays | — | Transport |

### Client-side functions (inside the HTML string)

| Function | Line | Role |
|---|---|---|
| `controlSpeech(action)` | `:579` | Central command dispatcher — next / back / respeak / postcode / restart |
| `changeIndex(direction)` | `:553` | **The navigation primitive** |
| `speakLine(segments, onEnd)` | `:723` | Sequential segment speaking |
| `updateUI()` | `:777` | Re-render panel, counter, combo images |
| `togglePause()` | `:660` | Pause only — no resume |
| `populateVoiceList()` | `:686` | Voice picker; defaults to `"Google US English"` |
| `recognition.onresult` | `:863` | Transcript → command matching |

### Triggers, services, permissions

| Item | Finding | Evidence |
|---|---|---|
| Triggers | **Only the simple `onOpen`.** No installable triggers, no `onEdit`, no time-based. | `ScriptApp` / `newTrigger` / `onEdit`: **0 occurrences** |
| Web app endpoints | **None.** | `doGet` / `doPost`: **0 occurrences** |
| Frontend → backend calls | **None.** | `google.script.run` / `withSuccessHandler`: **0 occurrences** |
| Services used | `SpreadsheetApp`, `HtmlService`, `Logger` | — |
| Not used | `UrlFetchApp`, `PropertiesService`, `CacheService`, `LockService` | **0 occurrences each** |
| OAuth scope implied | `.../auth/spreadsheets` (**not** `currentonly`) — because `openById()` reaches an external spreadsheet | `cleaned.gs:14`, `sku.gs:53` |
| Manifest | ⚠️ **`appsscript.json` was not exported** — scopes cannot be confirmed, only inferred | not present in `scripts/` |
| Browser permission | Microphone, required at modal open | `recognition.start()` `:903` |
| External network calls | `cdn.jsdelivr.net` (html2canvas), `via.placeholder.com`, `dashboard.digitweblk.com` (images) | `:419`, `:238`, `:370` |
| Credentials / secrets | **None found.** The only embedded identifier is a spreadsheet ID (access-controlled, not a secret). | grep clean |

### Hardcoded values

| Value | Location | Concern |
|---|---|---|
| `"16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M"` | `cleaned.gs:14`, `sku.gs:53` | Names sheet ID, duplicated in two files |
| `"RPR44WH"` | `cleaned.gs:280` | **A single product SKU hardcoded in shared cleaning logic** |
| `"PK"` / `slice(0, -3)` | `cleaned.gs:112` | Off-by-one; strips 3 chars for a 2-char suffix |
| `"CL"` prefix → `" meter"` | `cleaned.gs:118-120` | Cable rule by SKU prefix |
| `"Google US English"`, `"en-US"` | `:697`, `:753` | Locale hardcoded; wrong for Kronen/Schmutter |
| Column numbers `4`, `5`, `6` | `cleaned.gs:163, 175, 188-190` | Positional, not header-based |
| Rate values `0.6/0.7/1.2/1.5` | `:447-450` | Default is **0.7**, labelled "Normal" |
| `padding: 6px 400px` | `:254`, `:386` | Fixed pixel layout |

---

## 5. Voice-Control Analysis

| Voice feature | Current implementation | Evidence | Status |
|---|---|---|---|
| **Speech input** | `window.SpeechRecognition \|\| window.webkitSpeechRecognition`; `continuous = true`, `interimResults = false`, `lang = "en-US"`. Mic permission required. Alerts and disables voice if unsupported (Chrome-only in practice). | `Lithursan.gs:853-861`, `:856` | ⚠️ Working but fragile |
| **Restart after error** | `onend` → `start()` (`:898-901`). **`onerror` does NOT restart** (`:892-896`) — it only logs. `onresult` calls `stop()` then `start()` **synchronously on adjacent lines**, which throws `InvalidStateError`; that error path then does not recover. | `:886-887`, `:892-896` | ❌ **Can die permanently** |
| **Commands supported** | `next` / `forward` / `go on` → next · `back` / `prev` / `previous` → back · `respeak` / `again` / `repeat` → respeak · `postcode` / `post code` → postcode · `restart` / `start` → restart | `:870-885` | ✅ 5 families |
| **Commands NOT supported** | **`stop` — absent. `pause` — absent. `read` — absent.** Pause exists as a *button* only. | `:870-885` (no branch) | ❌ Gap |
| **Matching method** | `spokenText.includes(...)` — **substring, unanchored**. `"start"` matches inside `"restart"`; any sentence containing a keyword fires. | `:870-885` | ⚠️ Over-broad |
| **Self-trigger** | Recognition is **never paused during synthesis**. The tool speaks `":Post Code:"` aloud; the open mic hears it; `:879` matches `"post code"`. | `:186`, `:879`, no gating | ❌ **Feedback loop** |
| **"next"** | `onresult` → `controlSpeech("next")` → `changeIndex("next")` → `index = toSpeak[currentSpeakIndex]` → `updateUI()` + `speakLine()` | `:870-872`, `:584-591`, `:553-577` | ✅ Path intact |
| **Order navigation** | Array-position only. No IDs. Wraps at both ends. | `:553-577` | ⚠️ See §6 |
| **Speech output** | `SpeechSynthesisUtterance` per segment, chained via `onend`. **No SSML.** `utter.lang` hardcoded `"en-US"` regardless of selected voice. | `:723-775`, `:752-753` | ⚠️ Mispronounces codes |
| **Error handling** | `utter.onerror` → shows text, calls `onEnd()`. `recognition.onerror` → logs only. Empty-segment case writes to a **12px grey div** and silently advances. | `:765-769`, `:892-896`, `:728-732` | ❌ Failures are invisible |
| **Other input paths** | Keyboard: ←/→/↑/↓/Enter (`:832-851`). **MediaSession headset controls already wired**: play / pause / nexttrack / previoustrack (`:802-830`). | `:802-851` | ✅ Already present |

> **Note for planning:** the MediaSession handlers at `:814-821` mean a Bluetooth headset's
> next-track button **already** advances the order. Any hardware-fallback proposal should build on
> this, not duplicate it.

---

## 6. Order Navigation Flow

### State variables (`Lithursan.gs:475-483`)

| Variable | Meaning |
|---|---|
| `index` | Row position in the **original** `speakTexts` array — used for display and speech |
| `toSpeak` | Array of indices in play; initialised `[0..n-1]` (`:481`) |
| `currentSpeakIndex` | Cursor **into `toSpeak`** (`:483`) |
| `held` | Deferred rows — **nothing ever pushes into it** |

### Exact "next" path

```text
User says "next"
   └─ recognition.onresult                          :863   transcript → lowercase, trim
   └─ spokenText.includes("next")                   :870   substring match (also "forward", "go on")
   └─ showLoading("next") + controlSpeech("next")   :871-872
   └─ controlSpeech case "next"                     :584   guards: toSpeak & held both empty → abort
   └─ changeIndex("next")                           :555
        ├─ stopRowTimer()                           :554   accrues elapsed into total
        ├─ currentSpeakIndex += 1                   :556
        ├─ if past end && held.length  → swap in held, reset to 0    :557-560
        ├─ else if past end            → currentSpeakIndex = 0       :561-563  ◄ WRAPS
        ├─ index = toSpeak[currentSpeakIndex]       :570
        ├─ startRowTimer()                          :571
        ├─ updateUI()                               :572   panel, counter, combo images
        ├─ if (synth.speaking) synth.cancel()       :573
        └─ speakLine(speakTexts[index], …)          :574
             └─ per-segment SpeechSynthesisUtterance :752  chained on utter.onend :760
```

### Navigation questions answered

| Question | Answer | Evidence |
|---|---|---|
| What is the current index? | `index`, an integer into `speakTexts` | `:475`, `:570` |
| What is the current order ID? | **None exists.** Orders have no identifier anywhere in the system. | no ID column |
| Navigation by row number? | **Yes** — array position, which is `Cleaned Data` row order minus the header | `:481` |
| Navigation by order ID? | **No** | — |
| Based on filtered rows? | **No filter is applied.** Every non-header row enters the queue. | `:40`, `:77` |
| Is sorting applied? | **No.** Sheet order is used verbatim. | — |
| Can duplicate order IDs exist? | N/A — no IDs. But **duplicate grouping keys exist and are harmful** — see §8 R1. | tested |
| What happens at the last order? | **Wraps silently to row 1** (`currentSpeakIndex = 0`). There is **no end-of-queue state** and no completion signal. | `:561-563` |
| What happens before the first? | Wraps to the last row | `:566-568` |
| What if an order is missing? | Empty segments → 12px grey "No valid speech content", then advances silently | `:728-732` |
| What if the sheet changes while open? | **Nothing.** All data was serialised at open time. The dialog is stale until closed and reopened. | `:411-413`, `:472-474` |
| Does "next" skip completed/cancelled? | **No.** `Status` (which can read `plz cancel this order`) is **displayed in red but never filtered**. The packer is read the order regardless. | `:234`, `:366`; no status check in `readRowAndSpeak()` |
| Where is that rule implemented? | **Nowhere. It does not exist.** | — |
| Frontend or backend decides next? | **Frontend, entirely.** Apps Script has no role after the dialog opens. | `google.script.run`: 0 |

---

## 7. Data Flow

```text
Sheet1 ──► mergeAndCleanSheets()  ──► Cleaned Data ──► readRowAndSpeak() ──► HTML string
 raw       cleaned.gs:9                derived tab      Lithursan.gs:1       :415-946
 217 rows  + names sheet (openById)    217 rows         groups + builds      JSON embedded
                                                        speakTexts[]         :472-474
                                                        displays[]
                                                             │
                                                             ▼
                                              showModalDialog()  :948
                                                             │
                    ┌────────────────────────────────────────┘
                    ▼
        Browser modal (self-contained JS)
                    │
        ┌───────────┼────────────┬─────────────┐
        ▼           ▼            ▼             ▼
   mic (:858)  buttons(:456) keys(:832)  headset(:802)
        │           │            │             │
        └───────────┴─────┬──────┴─────────────┘
                          ▼
              controlSpeech(action)  :579
                          ▼
              changeIndex()  :553   ── index = toSpeak[currentSpeakIndex]
                          ▼
        updateUI() :777  ────────►  DOM panel + row counter + combo images
                          ▼
        speakLine() :723 ────────►  SpeechSynthesisUtterance :752 ──► audio
```

**Critical property:** the arrow from the browser back to Apps Script **does not exist**. There is no
write-back, no progress persistence, no "packed" flag. Close the dialog and all position, timing and
held-row state is lost.

---

## 8. Risks / Bugs / Gaps

Evidence-backed only. Ordered by severity.

### R1 — Orders from different customers are merged into one spoken group 🔴 **TESTED — CONFIRMED**

`Lithursan.gs:60-72` groups rows by `SKU Combined ?? Combo SKU` **alone**, with no customer, address
or postcode check, and it scans the **entire sheet** (not adjacent rows). Any two orders that happen
to contain the same combo product collapse into a single spoken group.

I tested this against both live sheets:

| Spreadsheet | Group keys | Keys shared by >1 customer |
|---|---:|---:|
| Person 2 (`1UXra9cm…`) | 45 | **8** |
| Unit 3 Lampshade (`1AMQMzxu…`) | 35 | **4** |

Worst case in the live Person 2 data — key `LSHM400HE+RPR44WH` is shared by **5 different
customers**:

```
Sue Rouse            95 BEVERLEY ROAD HESSLE HU13 9AN
Christopher thomas   10 WERNLYS ROAD PEN Y FAI BRIDGEND CF31 4NS
Mac Callegari Porter 6 PEVERELL GARDENS STEBBING ROAD STEBBING CM6 3ZB
… and 2 more
```

`readRowAndSpeak()` marks all five as processed (`:91`), takes display data from **`group[0]` only**
(`:94`, `:117-124`), and takes the postcode from **the first row in the group that has one**
(`:99-115`). The packer is read one order and shown one customer — for five parcels.

**This is the "can the tool read the wrong order?" question the brief asked. Yes, and it is
happening in current production data.** It is consistent with FB-079
(*"RMI orderum 2-4 1st orderum merge ahh vanthu irukku"*) and FB-075.

### R2 — `Cleaned Data` is written twice; the tool depends on the leftovers 🟠 **REVISED**

> **⚠️ Correction.** This finding originally claimed column R ends up **row-misaligned** and that
> grouping runs off a corrupted column. **Verified false.**
> `removeRPR44WHAndTransferPostCode()` reads with `getDataRange()` — all 18 columns — and rewrites
> all 18 per surviving row, so R travels with its own row. All 8 rows carrying it check out.
> Downgraded from 🔴 to 🟠, and it is **not** a prerequisite for the grouping work.
> Working in [../documentation/03-unit3-lampshade-logic.md](../documentation/03-unit3-lampshade-logic.md).

`Cleaned Data` is written twice with different widths:

- `Merge SKU.gs:58` writes **18** columns
- `cleaned.gs:153` writes **15** columns — overwriting A–O only

Columns P, Q, R survive untouched. Observed in both live sheets: `P = Component` (dup), `Q = Send
Order Instruction` (dup), `R = SKU Combined`. What genuinely follows:

- `Lithursan.gs:25, 34-37` make `SKU Combined` **mandatory** — the tool aborts without it, so it
  formally depends on a column no documented path writes.
- A group can name a component that no longer exists: rows 62–63 carry
  `LDMST64B224+LSUL220BB+RPR44WH`, but the `RPR44WH` row was deleted at `cleaned.gs:288`. The packer
  is told a three-part set and shown two.

**The wrong-parcel risk is R1 above (`Combo SKU`), not this.**

### R3 — Voice recognition can die permanently, silently 🔴 **VERIFIED**

`:886-887` calls `recognition.stop()` then `recognition.start()` on adjacent lines. `stop()` is
asynchronous; the immediate `start()` raises `InvalidStateError`. `onerror` (`:892-896`) logs and
**does not restart**. `onend` also races a `start()` (`:898-901`).

Separately, the mic is never gated during synthesis, so the tool's own `":Post Code:"` output
matches `:879` and fires the postcode command at itself.

Matches FB-046, FB-047, FB-055, FB-132, FB-133 (*"getting tired from it"*).

### R4 — Cancelled orders are read out as normal 🟠 **VERIFIED**

`Status` carries values including `plz cancel this order` (observed in `Sheet1` col M). It is
rendered in red at `:234`/`:366` but **no code path filters or skips on it**. The packer will be
instructed to pack a cancelled order unless they notice the screen — which the whole tool exists to
avoid needing.

### R5 — Postcode dedupe deletes unrelated data 🔴 **VERIFIED**

`keepOnlyLastOccurrenceInD()` (`:162-172`) blanks a postcode when it equals **the row above**,
adjacency only, no customer check. `clearFIfDIsEmptyInSheet()` (`:186-192`) then clears column F —
`Instruction QR` — wherever the postcode is now blank. Deleting a postcode therefore silently
deletes that order's QR instruction. Two ticket threads, one cause (FB-071/FB-116 ⟷ FB-060/070/078).

Live fill rates are consistent: Post Code 109/140, Instruction QR 5/140 (Unit 3 Lampshade).

### R6 — Name lookup off-by-one silences whole orders 🟠 **VERIFIED**

`cleaned.gs:112` — `rawSku.slice(0, -3)` strips **three** characters to remove the **two**-character
`"PK"` suffix. Correct only for single-digit packs. `cleaned.gs:116` — `if (!name) quantity = '';`
blanks the quantity when the lookup fails, so the row speaks nothing at all.

### R7 — Two competing `onOpen()` definitions 🟠 **VERIFIED**

`cleaned.gs:1` and `action.gs:1` both define `onOpen()`. In Apps Script the later definition wins;
file order decides which menu the user actually gets. If `action.gs` wins, **"Run Clean and Merge"
is unreachable from the UI**.

### R8 — Features marked Done that do not exist 🟠 **VERIFIED**

| Feature | Evidence | Ticket |
|---|---|---|
| Quantity-based pause | `pauseTime` computed `:214`/`:349`, passed `:269`/`:397`, **never read** | FB-014 |
| Hold / held rows | `held` array + CSS + render `:785-788`; **nothing pushes into it**, no Hold button | FB-009 |
| Screenshot | `html2canvas` loaded `:419`, **never called** | FB-021 |
| Pause resume | `synth.pause()` at `:662`; **`synth.resume()` appears nowhere** | FB-012 |

### R9 — Stale data while the dialog is open 🟠 **VERIFIED**

All data is serialised at open time (`:411-413`). Sheet edits made while packing have no effect. No
polling, no refresh, no warning.

### R10 — No end-of-queue state 🟡 **VERIFIED**

`changeIndex` wraps to `0` at the end (`:561-563`). The packer is never told the queue is finished;
it silently restarts. The row counter also reads `index + 1` (`:781`) while navigation runs through
`toSpeak[currentSpeakIndex]` — these diverge once `held` is ever populated.

### R11 — HTML/script injection from marketplace text 🟡 **VERIFIED**

`title`, `customerInfo`, `status` are interpolated unescaped into HTML (`:220`, `:245`, `:234`) and
the whole structure is `JSON.stringify`'d into a `<script>` block (`:411-413`). A marketplace title
containing `</script>` or a stray quote breaks the dialog. Not attacker-controlled in the usual
sense, but titles do come from external platforms.

### Tested and found clean ✅

| Hypothesis | Result |
|---|---|
| Same SKU mapped to conflicting image URLs (`skuToImageUrl` is last-write-wins, `:47-52`) | **0 clashes** in both live sheets — not currently a risk |
| Hardcoded credentials or secrets | **None found** |
| Server-side write-back from the UI | **None** — tool is read-only after open |

---

## 9. Duplicate Risk

| Asset / logic | Existing asset | Overlap | Risk | Recommendation |
|---|---|---|---|---|
| **Order data in Person 2 `Sheet1` (217 rows)** | Unit 3 Lampshade `Sheet1` (169 rows) | **First 169 rows byte-identical** | 🔴 **RED** | Two spreadsheets hold the same orders. Decide which is canonical **before** any change. |
| **Person 2 `Cleaned Data` (217 rows)** | Unit 3 Lampshade `Cleaned Data` (140 rows) | Same input, **divergent output** — 136 of first 140 rows differ; `RPR44WH` rows removed in one, retained in the other | 🔴 **RED** | Strong evidence the two stations run **different script versions**. Diff all six before consolidating. |
| **Speech Tool implementation** | 6 station copies (registry §3) | Same script, independently maintained | 🔴 **RED** | Confirmed drift between the 2 sampled. Do not add a 7th copy. |
| `SKU Combined` (col R) | `Combo SKU` (col M) | Two grouping keys for the same purpose; `:64` prefers the stale one | 🔴 **RED** | Pick one. Do not add a third. |
| `Component` cols I **and** P | — | Duplicate headers; `:29` first-match-wins silently ignores P | 🟠 AMBER | Residue of R2. Resolve with R2. |
| `Send Order Instruction` cols O **and** Q | — | As above | 🟠 AMBER | As above |
| Names sheet ID | `cleaned.gs:14` **and** `sku.gs:53` | Same literal in two files | 🟠 AMBER | Single constant. |
| Cleaning logic | `mergeAndCleanSheets()` vs 3 uncalled `sku.gs` functions | `addProductNamesFromSKU()` and `copySKUFromSheet1ToCleanedData()` duplicate live behaviour | 🟠 AMBER | Dead code that reads as live. Do not revive without review. |
| Order identity | — | No ID anywhere; identity inferred from postcode/combo string | 🔴 **RED** | Root enabler of R1 and R5. |
| Defect log | Feedback workbook `1uN-9zD…` | No overlap with order data | 🟢 GREEN | Canonical for QA. |
| Pronunciation dictionary | Names master `16rx5Dz…` | Single shared source, read live | 🟢 GREEN | Canonical. Keep. |

---

## 10. Evidence Register

| # | Finding | Evidence location | Evidence type | Status |
|---|---|---|---|---|
| 1 | Architecture is HTML Service modal + client-side Web Speech API | `Lithursan.gs:948`, `:853`, `:752` | Code read | **VERIFIED** |
| 2 | No frontend→backend communication | `google.script.run`, `withSuccessHandler` = 0 occurrences | Grep | **VERIFIED** |
| 3 | No triggers beyond simple `onOpen`; no web-app endpoints | `ScriptApp`/`newTrigger`/`onEdit`/`doGet`/`doPost` = 0 | Grep | **VERIFIED** |
| 4 | Tool reads only `Cleaned Data` on the active spreadsheet | `Lithursan.gs:3` | Code read | **VERIFIED** |
| 5 | `Cleaned Data` is deleted and recreated each clean run | `cleaned.gs:22-25` | Code read | **VERIFIED** |
| 6 | No unique order identifier exists | Header rows, both spreadsheets | Data profile | **VERIFIED** |
| 7 | Navigation is array position; wraps at both ends | `Lithursan.gs:481`, `:553-577` | Code read | **VERIFIED** |
| 8 | Cancelled orders are not skipped | `Sheet1` col M contains `plz cancel this order`; no filter in `readRowAndSpeak()` | Data + code | **VERIFIED** |
| 9 | **Group keys shared by multiple customers** | Person 2: 8/45 keys; U3: 4/35. `LSHM400HE+RPR44WH` → 5 customers | **Live data test** | **VERIFIED** |
| 10 | Grouping ignores customer/postcode | `Lithursan.gs:60-72` | Code read | **VERIFIED** |
| 11 | `Cleaned Data` written twice; cols P/Q/R are leftovers | `Merge SKU.gs:58` (18 cols) vs `cleaned.gs:153` (15 cols); observed headers | Code + data | **VERIFIED** |
| 12 | Person 2 and Unit 3 `Sheet1` share 169 byte-identical rows | Row-by-row diff | Data test | **VERIFIED** |
| 13 | Their `Cleaned Data` diverges (140 vs 217 rows; 136/140 rows differ) | Row-by-row diff | Data test | **VERIFIED** |
| 14 | Divergence caused by different script versions | Inferred from `RPR44WH` rows present in one, absent in other | Inference | **PARTIAL** — needs both scripts to confirm |
| 15 | Recognition `stop()`+`start()` on adjacent lines | `Lithursan.gs:886-887` | Code read | **VERIFIED** |
| 16 | `onerror` does not restart recognition | `:892-896` | Code read | **VERIFIED** |
| 17 | Mic not gated during synthesis → self-trigger on "post code" | `:186`, `:879`; no gating code | Code read | **VERIFIED** |
| 18 | No SSML; `utter.lang` hardcoded `en-US` | `:752-753` | Code read | **VERIFIED** |
| 19 | Postcode dedupe cascades into QR deletion | `cleaned.gs:167-169`, `:190` | Code read | **VERIFIED** |
| 20 | Fill rates: Post Code 109/140, QR 5/140, Merge Order 6/140 | Column profile, Unit 3 Lampshade | Data profile | **VERIFIED** |
| 21 | `slice(0,-3)` strips 3 chars for a 2-char suffix | `cleaned.gs:112` | Code read | **VERIFIED** |
| 22 | Failed name lookup blanks quantity | `cleaned.gs:116` | Code read | **VERIFIED** |
| 23 | Duplicate `onOpen()` | `cleaned.gs:1`, `action.gs:1` | Code read | **VERIFIED** |
| 24 | 4 "Done" features are inert | `pauseTime`, `held`, `html2canvas`, missing `synth.resume` | Code + grep | **VERIFIED** |
| 25 | Voice commands: 5 families; `stop`/`pause`/`read` absent | `:870-885` | Code read | **VERIFIED** |
| 26 | MediaSession headset controls already wired | `:802-830` | Code read | **VERIFIED** |
| 27 | No credentials or secrets in source | Grep across all 5 files | Grep | **VERIFIED** |
| 28 | OAuth scope must be full `spreadsheets` (not `currentonly`) | `openById()` at `cleaned.gs:14` | Inference | **PARTIAL** — `appsscript.json` not exported |
| 29 | Same SKU → conflicting images | 0 clashes found in both sheets | Data test | **VERIFIED (clean)** |
| 30 | Drift across all six station copies | Only 2 of 6 sampled | — | **UNPROVEN** |
| 31 | Which spreadsheet is operationally canonical for orders | Not determinable from artefacts | — | **UNPROVEN — needs business answer** |
| 32 | Behaviour under live run (mic, timing, actual audio) | Not executed | — | **ASSUMPTION** — all code findings are static-read |

---

## 11. Recommended Next Step

**Do not begin implementation.** Two things must be resolved first, in this order.

**Step 1 — Confirm R1 on a live run (half a day, no code changes).**
Open the Speak Tool on the Person 2 sheet and walk to the `LSHM400HE+RPR44WH` group. Confirm whether
the packer is read one order or five. This is the single highest-consequence finding — it means
parcels going to the wrong customers — and it is currently proven only by static analysis plus a data
test, not by observation. If confirmed, it is an operational incident, not a backlog item.

**Step 2 — Get a business answer on the canonical order source.**
Person 2 and Unit 3 Lampshade hold the same 169 orders with divergent cleaned output. No artefact can
tell us which one the warehouse actually packs from. This is a question for Varmen, and every
downstream decision depends on it.

Then, and only then: export the remaining four station scripts and diff all six, so the drift is
measured before anything is consolidated.

---

## Final Decision

# 🔴 RED

**Justification — three independent stop conditions are met:**

1. **Multiple conflicting order sources.** Two spreadsheets hold the same 169 orders with materially
   different derived output (140 vs 217 rows; 136 of 140 compared rows differ). Evidence #12, #13.
2. **Duplicate implementation with confirmed drift.** Six independent copies of the tool; the two
   sampled produce different `Cleaned Data` from identical input. Evidence #13, #14.
3. **Production risk.** Group-key collisions merge up to five different customers' orders into one
   spoken group, in live data, today. Evidence #9, #10.

RED reflects the **state of the system**, not the state of this discovery — the discovery itself is
complete and evidenced. It means: do not proceed to implementation until Steps 1 and 2 above are
answered.

**Restrictions honoured:** nothing was modified, created in the live system, merged, deleted, or
deployed. Both spreadsheets were read via public export URLs; the Apps Script was read from the
already-exported copy in [`scripts/`](../scripts/). No credentials were encountered or reproduced.
