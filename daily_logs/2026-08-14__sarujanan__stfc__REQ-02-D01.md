date: 2026-08-14
developer: Sarujanan
project: Speech Tool — Warehouse Voice Packing
project_code: STFC
phase: Development — phase 02
requirement_id: REQ-02
deliverable_id: D01
status: In Progress
evidence_location: /capability/unit3-packing-priority-report.md · /capability/unit3-voice-reliability-report.md · /documentation/03-unit3-lampshade-logic.md · /scripts/Unit 3 Lampshade/packing-priority.gs
blos_keys_used:
  - packing_priority_rank
  - lampshade_collection_max
  - product_type_classification
  - colour_code_map
  - voice_duplicate_window
  - mic_speech_watchdog
hardcoded_thresholds:
  - packing_priority_rank: SHADE=1, RECT_ROSE=2, BULB=3, ROSE=4, OTHER=4
  - lampshade_collection_max = 15   (declared PP_MAX_LAMPSHADE_COLLECTION, NOT applied — rule undefined above 15)
  - voice_duplicate_window_ms = 1000
  - voice_max_command_words = 5
  - mic_speech_watchdog_ms = 45000
  - mic_restart_debounce_ms = 250
  - mic_resume_after_speech_ms = 200
  - colour_code_map = 29 two-letter SKU suffixes (BM=Black, WH=White, SN=Satin Nickel, …)
three_am_standard: TRUE
llm_queryable: TRUE
company_knowledge_candidate: TRUE
domain: Warehouse Operations — Order Packing
User: Postage & Warehouse Team (assigned by Varmen)
Benefit status: Partial — packing priority and voice lifecycle implemented and tested; real-microphone validation and the >15 allocation rule outstanding

---

## 1. SYSTEM STATE

Before today, at the Unit 3 Lampshade station:

- `Cleaned Data` carried **no product type and no colour**. `Combo Color` existed in `Sheet1`
  (100/169) but was never copied into `outputHeaders`, so the Speech Tool could not see colour.
- Rows reached the Speech Tool in **raw sheet order** — no packing sequence existed.
- **No product classification of any kind existed in the code.** The only SKU rules were a
  pack-suffix strip, a `CL` cable prefix, and one hardcoded SKU (`RPR44WH`).
- Voice recognition ended every `onresult` with `recognition.stop(); recognition.start();`, and
  `onerror` never restarted recognition.
- The microphone was never muted while the tool spoke.
- There was **no microphone indicator in the DOM** — the only feedback was a 12 px grey text div.
- There was no way to pause or resume the microphone. The existing **Pause** button pauses *speech
  synthesis*, not recognition.

---

## 2. WHAT CHANGED TODAY

### 2.1 Product classification (new file `packing-priority.gs`)

`ppProductType(sku, name)` returns `SHADE` / `RECT_ROSE` / `ROSE` / `BULB` / `OTHER`.

The **order of tests is load-bearing**. Ceiling rose is tested **first**, because some `LS`-prefixed
SKUs are ceiling roses — `LSWD360BG` = *"360 Black gold inner celing rose"*. Testing the `LS` prefix
first would classify a ceiling rose as a lampshade.

Regex patterns accommodate the spellings that actually occur in the reference data:

```
rose      /c[ei]+l[ei]*ng\s*rose/i     — covers "ceiling rose" (316) and "celing rose" (12)
rectangle /re[c]?tangle|rectangular/i  — covers "Retangle" (28), the spelling actually used
bulb      /\bbulbs?\b|\bwats?\b|\bwatts?\b/i
shade     /shade|chandelier|dome|curvy|cone|umbrella|kuduvai|tattai|hemp|cage/i
```

An **accessory guard** was required because the shade keywords over-matched by 10 %:
`SCRN70BM` *"Shade **Ring**"*, `PCDO20BM` *"conduit **dome cover**"*, `PHHR1HETHE` *"hemp
**holder**"*. The guard excludes `ring|holder|grip|reducer|adapter|plate|cover|carrier|conduit|full
set`, removing 82 of 759 — of which exactly **one** is `LS`-prefixed (`LSF1HT300HE`, a full-set kit).

### 2.2 Colour derivation

`ppProductColour(sku)` strips any pack suffix, takes the trailing 2-letter code and maps it through
a 29-entry table. The SKU grammar confirmed from the reference data is:

```
CRFF      500        3          SN
prefix    size(mm)   outlets    colour  →  "500 millimeter 3 out let Retangle ceiling rose Satin Nickel"
```

### 2.3 Packing priority

`ppApplyPackingPriority()` performs a **stable sort by rank, within one customer's block only**.
Rows never move between customers, so existing order/customer identity is untouched.

The 8-row priority matrix is not implemented as 8 branches — it **collapses to a single stable sort**
on the rank, because absent types simply do not appear and a stable sort leaves the all-absent case
unchanged.

### 2.4 Pipeline patch

`cleaned.gs` and `clean-1.gs` were patched **identically** (they define the same six functions and
only one wins the load-order collision, so both must carry the change):

- 2 headers appended at the **end** of `outputHeaders` — position matters because
  `keepOnlyLastOccurrenceInD/E` and `clearFIfDIsEmptyInSheet` address columns 4, 5 and 6 by hardcoded
  index.
- `processRow` pushes `ppProductType(...)` and `ppProductColour(...)`.
- `ppApplyPackingPriority(...)` runs immediately before `setValues`.

### 2.5 Voice recognition lifecycle (`Lithursan.gs`)

- **Removed** `recognition.stop(); recognition.start();` from `onresult`.
- Introduced four explicit state flags, where `micPausedByUser` is **the only thing that blocks
  auto-restart**.
- `onerror` now classifies: `no-speech`/`aborted` recover silently; `not-allowed`/`audio-capture` are
  fatal and never retry; everything else is transient.
- `onend` restarts through a single debounced timer, so no two restart paths can race.
- `speakLine()` mutes the microphone before speaking and releases it when the utterance chain
  completes; results arriving while suspended are discarded.
- A **45-second watchdog** releases the microphone if speech never reports completion.
- A `speechToken` generation counter stops an orphaned utterance chain (cancelled by pressing Next
  mid-speech) from un-muting the microphone early.
- Command matching moved from `includes()` to word-boundary regex with a ≤5-word guard. The command
  vocabulary is unchanged; `restart|start` is still tested before `again` so *"start again"* still
  means restart.
- A microphone indicator and a 🎙️ pause/resume toggle were added, driven by real `onstart` /
  `onspeechstart` / `onspeechend` / `onend` events.

---

## 3. POSTGRESQL / MCP FINDING

Not applicable — no database in this project. Structural findings from the reference sheet:

- The names master sheet (`16rx5Dz…`, tab `names`) holds **16,228 rows / 5,548 distinct SKUs** in
  two columns. Column A's header is **blank**; only column B is headed (`Name`). `cleaned.gs` reads
  positionally (`[i][0]`, `[i][1]`), so appending columns C+ is safe.
- SKU → colour correlation measured across 12,392 name rows: consistency **93–100 %** per code
  (`BM`→Black 93 %, `WH`→White 96 %, `YB`→Yellow Brass 99 %, `BC`→Brushed Copper 100 %).
- `CRFF` size segment cleanly separates shape: sizes **400/450/453/500/550 are 100 % rectangle**;
  sizes **100–240 are 0 % rectangle**. Also rectangle: `CRSF110`, `CRSF220`.
- **Correction to a prior finding:** `SKU Combined` (col R) was previously reported as
  row-misaligned after the row-deletion step. This is **false** —
  `removeRPR44WHAndTransferPostCode()` reads via `getDataRange()` (all 18 columns) and rewrites all
  18 per surviving row, so col R travels with its own row. All 8 rows carrying it verify correct.

---

## 4. GAP FOUND

- **The >15 lampshade colour-allocation rule remains undefined.** Live data shows the maximum
  lampshade quantity in any single order is **4**, and the whole sheet totals 53 across 31 orders.
  Therefore 15 can only be a **cross-order collection wave** — and the Speech Tool has **no
  cross-order state**. It builds one queue entry per order. A wave is a new architectural layer, not
  a sequence change.
- **Non-rectangle ceiling roses have no defined rank.** The matrix names only the *Rectangle* rose.
  They currently rank as `OTHER` (the literal reading) — flagged for confirmation.
- **Box selection cannot be implemented here.** No box column exists in `Sheet1`; box names
  (`a5box (12*9*6 in)`, `a1box (5*5*5 in)`) come from the packlist/dashboard system.
- **Validation cases B, C, D and F have no real examples** — no order in the live sheet contains
  multiple lampshade colours, or a lampshade together with a rectangle ceiling rose. The logic covers
  them but is unvalidated against production.
- **The `clean-1.gs` / `cleaned.gs` function collision is still unresolved.** Both define the same
  six functions; one file is dead and which one depends on editor file order.

---

## 5. VALIDATION RULE ADDED OR CHANGED

**Rule — product classification**

```
IF name matches ceiling-rose pattern
   THEN IF name also matches rectangle pattern THEN type = RECT_ROSE ELSE type = ROSE
ELSE IF name matches bulb pattern AND sku starts with 'LD'   THEN type = BULB
ELSE IF name matches shade pattern AND NOT accessory pattern THEN type = SHADE
ELSE IF sku starts with 'LD'                                 THEN type = BULB
ELSE type = OTHER
```

**Rule — packing priority**

```
rank: SHADE=1, RECT_ROSE=2, BULB=3, ROSE=4, OTHER=4
Sort STABLE by rank, WITHIN a contiguous run sharing (Customer Info + Post Code).
IF the run spans more than one customer THEN never reorder across the boundary.
```

**Rule — colour preservation**

```
Colour is written to its own column and is NEVER aggregated.
Rows are only ever reordered, never merged.
THEREFORE Black 6 / Red 4 / White 5 can never collapse into "Lampshades 15".
```

**Rule — voice command dispatch**

```
normalise: lowercase, strip [.,!?;:], collapse whitespace, trim
IF word_count > 5 THEN ignore
IF action = last_action AND (now - last_time) < 1000 ms THEN ignore as duplicate
ELSE dispatch to the EXISTING controlSpeech(action) handler
```

**Rule — microphone lifecycle**

```
IF micPausedByUser        THEN never auto-restart
ELSE IF micSuspendedForTTS THEN stay muted
ELSE IF recognition ended  THEN restart after 250 ms debounce

IF error IN (not-allowed, service-not-allowed, audio-capture) THEN fatal, stop retrying
IF error IN (no-speech, aborted)                              THEN normal, recover silently
IF speech has not reported completion within 45 000 ms        THEN force-release the microphone
```

---

## 6. FAILURE MODE OR EDGE CASE

**E1 — Speech synthesis that never reports completion.** Chrome does not always fire utterance
`onend`, notably after `synth.cancel()` or when the tab is backgrounded. Without a watchdog this
leaves the microphone muted for the rest of the session — recreating the original "voice stopped
working" bug from the opposite direction. **This was found by the test harness, not by code
inspection**, and would otherwise have shipped.

**E2 — Orphaned utterance chain.** Pressing Next mid-speech cancels the current chain. Without the
`speechToken` guard the orphaned chain would un-mute the microphone while the new order is still
being read, re-opening the self-trigger path.

**E3 — Accessory over-matching.** Shade keywords matched `Shade Ring`, `conduit dome cover` and
`hemp holder`. Untreated, accessories would have been picked before the real lampshade.

**E4 — Ceiling roses hidden behind the `LS` prefix.** `LSWD360BG` is a ceiling rose. Prefix-first
classification would misrank it.

**E5 — Pre-existing wrong-parcel risk is unchanged and still live.** `Lithursan.gs:64` still keys
groups on the combo-SKU string alone; 4 of 35 keys span more than one customer. Today's change does
not worsen it, but **the new packing sequence will be applied inside those wrongly-merged groups
until that key is fixed.**

**E6 — Recognition remains cloud-backed.** Chrome transcribes via Google servers; poor warehouse wifi
still costs accuracy. The fix removes the *dead microphone* failure, not network latency.

---

## 7. DECISIONS MADE TODAY

1. **Classification is derived from evidence, not assumed.** Every rule was measured against the
   5,548-SKU reference sheet before being written.
2. **The 15-unit allocation rule was NOT invented.** No FIFO, alphabetical, highest-quantity or
   SKU-order rule was introduced. `PP_MAX_LAMPSHADE_COLLECTION = 15` is declared for reference and
   deliberately **not applied**.
3. **Both `cleaned.gs` and `clean-1.gs` were patched identically**, so the feature works whichever
   file wins the load-order collision. Resolving the collision is a separate decision for the owner.
4. **New columns were appended at the end**, never inserted, because three downstream functions
   address columns 4/5/6 by hardcoded index.
5. **`Lithursan.gs` was not modified for the packing change.** It reads `Cleaned Data` in row order,
   so it inherits the new sequence automatically — priority lives in the data layer, not the UI.
6. **The existing speech-playback Pause button was left alone.** The new 🎙️ button is a separate
   microphone control; merging the two concepts would change the meaning of an existing control.
7. **A truthful listening indicator was built, not a simulated volume meter.** The Web Speech API
   does not expose amplitude; `onspeechstart`/`onspeechend` are real signals and were used instead.
8. **A prior finding was retracted.** The claim that `SKU Combined` becomes row-misaligned was tested
   and disproved; the affected reports were corrected rather than left standing.

---

## 8. COMPANY KNOWLEDGE EXTRACT

**K1 — Warehouse reference data contains systematic misspellings; classifiers must accommodate them.**
Searching for `rectang` returned no ceiling roses and produced an incorrect "this product type does
not exist" conclusion. The data spells it **`Retangle`** (28 SKUs) and also uses `celing` for
ceiling. **Before concluding a category is absent, search for spelling variants.**

**K2 — SKU grammar is a more reliable classifier than a free-text attribute column.**
`PREFIX + SIZE + COLOUR CODE` yielded 93–100 % colour consistency across 12,392 rows, while the
dedicated `Combo Color` column was only 59 % populated and contaminated with values like
`MAPPED FOR WCDTBM`. **Where a coding convention exists, derive from the code, not the label.**

**K3 — Test the category test order, not just the category test.**
`LS` means lampshade *except* when the product is a ceiling rose. Classification rules need an
explicit precedence order, and that order must be regression-tested with known trap cases.

**K4 — Keyword classifiers need an exclusion guard.** Positive keywords alone over-matched by 10 %,
because accessories are named after the product they attach to (Shade **Ring**, dome **cover**,
hemp **holder**). **Measure the false-positive rate before shipping a keyword classifier.**

**K5 — A decision matrix with a consistent ordering collapses to a stable sort.** The 8-row priority
matrix needed no branching — ranking present types and using a stable sort reproduces all 8 rows,
including the "nothing present → leave unchanged" row. Less code, and provably complete.

**K6 — In an async speech/recognition system, always add a completion watchdog.** Any state that is
entered on "start speaking" and exited on "finished speaking" will eventually leak, because the
browser does not guarantee the completion event. **A stuck mute is indistinguishable to the user
from the original bug.**

**K7 — Where two subsystems share a device, ownership must be explicit.** Speech synthesis and speech
recognition both use audio. Without an explicit `micSuspendedForTTS` flag the tool heard itself and
issued its own commands. **Model the device as owned state, not as two independent features.**

**K8 — Patch every copy when a codebase has been forked per site.** Six station copies exist and two
files in one station define the same six functions. Any single-file fix has a real chance of landing
in the dead copy.

**K9 — Simulate the external API to test a lifecycle you cannot run.** Extracting the generated
client JavaScript and running it against a simulated Web Speech API produced 24 executable
regression tests and surfaced a real defect (K6) that inspection missed.

---

## 9. LLM STANDARD CHECK

```
LLM Queryable: TRUE
Operational reasoning documented: TRUE
Edge cases documented: TRUE   (E1–E6)
Evidence linked: TRUE
Terminology consistent: TRUE  (product type, group key, Cleaned Data, names master sheet, station)
Another developer can continue independently: TRUE
Thresholds surfaced for BLOS governance: TRUE (8 entries in hardcoded_thresholds)
```

**BLOS governance note — thresholds introduced today that should move to BLOS:**

| Threshold | Value | Why it must be governed |
| --- | --- | --- |
| `packing_priority_rank` | Shade 1, RectRose 2, Bulb 3, Other 4 | A business picking rule, not a technical constant. Will change if picking policy changes. |
| `lampshade_collection_max` | 15 | Declared, deliberately not applied. Allocation rule above 15 still undefined. |
| `colour_code_map` | 29 SKU suffixes | New colours will be added as products are introduced. |
| `voice_duplicate_window_ms` | 1000 | Operator-experience tuning value. |
| `voice_max_command_words` | 5 | Controls how conversational speech may be before it is ignored. |
| `mic_speech_watchdog_ms` | 45000 | Must exceed the longest possible spoken order. |

None of these are hidden — each is a named constant with a comment explaining its origin — but all
six are business-tunable and belong in a BLOS table rather than in `.gs` source.

---

## 10. DAY OUTCOME

| Metric | Value |
| --- | ---: |
| New files created | 1 (`packing-priority.gs`) |
| Files patched | 3 (`cleaned.gs`, `clean-1.gs`, `Lithursan.gs`) |
| Rectangle ceiling rose SKUs identified | 28 |
| Colour codes mapped | 29 |
| Accessory false positives removed | 82 of 759 |
| Orders whose sequence changes | 9 of 109 (30 rows) |
| Voice lifecycle tests passing | **24 / 24** |
| Prior findings retracted after testing | 1 |
| Business rules invented | **0** |

**Status: AMBER on both deliverables.**
Packing priority — implemented and validated; the >15 allocation rule remains undefined.
Voice reliability — implemented and tested in simulation; real-microphone warehouse validation
outstanding.
