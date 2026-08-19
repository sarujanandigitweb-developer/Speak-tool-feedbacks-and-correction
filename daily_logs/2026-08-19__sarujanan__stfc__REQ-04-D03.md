date: 2026-08-19
developer: Sarujanan
project: Speech Tool — Warehouse Voice Packing
project_code: STFC
phase: Development — phase 04
requirement_id: REQ-04
deliverable_id: D03
status: Delivered — microphone, multi-file, refresh and the three rule corrections all shipped and verified; the Google Sheet still needs a manual paste
evidence_location: /packlist_upload/Speak-Tool.html · /validation/unit3-lampshade-rules-2026-08-19.md · /packlist_extension/src/ · /scripts/Unit 3 Lampshade/packing-priority.gs
blos_keys_used:
  - mic_permission_needs_secure_origin
  - recognition_matches_unit4
  - transcript_has_no_word_limit
  - collection_run_minimum_two_orders
  - plain_ceiling_rose_ranks_as_other
  - lampshade_prefix_rule_ls_plus_wcwd
  - trolley_pool_floor_zero
  - session_survives_refresh
hardcoded_thresholds:
  - recognition_continuous = TRUE
  - recognition_interim_results = FALSE          (was TRUE — reverted to the Unit 4 setting)
  - recognition_max_alternatives = 1             (was 5 — reverted)
  - command_max_words = NONE                     (was 5 — REMOVED, this was the defect)
  - command_dedupe_ms = 1000
  - mic_restart_after_end_ms = 120
  - lampshade_collection_max = 15                (per prefix list, not shared)
  - collection_run_minimum = 2 consecutive orders needing the same family
  - trolley_pool_floor = 0
  - rank_no_rect = SHADE 1, BULB 3, ROSE 4, OTHER 4
  - rank_with_rect = RECT_ROSE 1, SHADE 2, BULB 3, ROSE 4, OTHER 4
  - speech_rate_default = 0.7                    (Slow 0.6 / Normal 0.7 / Fast 1.2 / Faster 1.5)
  - stx_bar_z_index = 2147483003                 (above the collection dialog at 2147483001)
  - zoom_max_width_px = min(760, 88vw)
  - session_store = IndexedDB 'stxSpeakTool' / 'session'
  - position_store = sessionStorage 'stxPos'
  - theme_store = localStorage 'stxTheme'        (system / light / dark)
  - base64_payload_wrap = 120 columns
three_am_standard: TRUE
llm_queryable: TRUE
company_knowledge_candidate: TRUE
domain: Warehouse Operations — Order Packing
User: Postage & Warehouse Team (assigned by Varmen)
Benefit status: Delivered — the microphone is asked for once, thirteen pack lists open as one, a refresh keeps the place, and the three reported rules now match how the team packs

---

## 1. SYSTEM STATE

One deliverable: `packlist_upload/Speak-Tool.html`, 535 KB, self-contained — zero external scripts,
stylesheets, fonts or network calls. It opens the dashboard's own Order Packing HTML files and adds
the Speak Tool on top without changing a byte of them.

Rules live in exactly two places, and they are cross-checked against each other:

| Engine | File | Used by |
| ------ | ---- | ------- |
| Google Sheets | `scripts/Unit 3 Lampshade/packing-priority.gs` | the Sheets tool |
| HTML | `speak_tool_html_sheet_UI/engine.js` | the pack list tool, via the build |

Verified today across **5,548 SKUs**: 0 product-type and 0 collection-family disagreements between
them.

**The Google Sheet is not yet updated.** There is no `.clasp.json` in the project and `clasp` is not
installed, so nothing pushes automatically. Until `packing-priority.gs` is pasted into the Apps
Script editor, the Sheet and the HTML tool will give different answers for the same order.

---

## 2. WHAT CHANGED TODAY

### 2.1 Recognition rebuilt to match Unit 4 (`speak-extension.js`)

Unit 4's Sheets tool works on the floor, so its design became the specification rather than a
reference. Ported exactly: always-on microphone, `continuous`, `interimResults = false`,
`maxAlternatives = 1`, whole-transcript scan with last-match-wins, and `micFlush()` — a deliberate
`stop()` after every accepted command to discard the audio it came out of.

### 2.2 The five-word limit removed — this was the defect

```
if (t.split(' ').length > 5) return null;
```

With the microphone open while the tool speaks, Chrome glues its own speech to the packer's command
into one final result:

```
"s t 6 4 b22 8 wats 6 post code w 3 6 h h next"
```

Fifteen words. Every one of these was thrown away. Unit 4 has no such guard. **This is why "Next"
worked at first and then stopped** — it only failed once the tool was speaking over itself, which is
exactly when a packer says "next".

### 2.3 Everyday words removed from the command table

`stop`, `wait`, `text` and `bag` had been added as commands. They are spoken during ordinary packing
and were moving the queue. Removed, together with `interimResults` and the five alternatives, after
the floor reported the accuracy had got **worse**, not better.

The surviving table is Unit 4's, seven entries:

| Action | Matches |
| ------ | ------- |
| restart | `restart`, `start` (plus "start again" rewritten to "restart") |
| next | `next`, `forward`, `go on`, `go next` |
| back | `back`, `previous`, `prev` |
| repeat | `respeak`, `again`, `repeat` |
| postcode | `post code`, `postcode` |
| pause | `pause` |
| resume | `resume`, `unpause` |

`again` is kept deliberately: it is Unit 4's wording for repeat and the packers already use it.

### 2.4 Microphone permission asked once, not per command

Three separate causes, all fixed:

1. **`micMuted` blocked restarts.** If recognition ended while the tool was speaking, nothing revived
   it for 45 seconds — the "I said Next ten times" report.
2. **Recognition waited on the level meter's `getUserMedia`.** With the prompt open that promise
   never settles, so the chip sat on "Starting" forever. Recognition now starts first,
   unconditionally; the meter starts alongside it.
3. **The chip said "Allow the microphone" on ordinary restarts**, training packers to expect a
   prompt. Guarded with `micEverRan`.

### 2.5 Several pack lists open as one (`speak-loader.template.html`)

Multi-file input, natural numeric sort (`1, 2, … 13`, not `1, 10, 11, 2`), then the `li.bg-white`
orders from files 2..N are appended into the first file's `<ul class="col">`, tagged with
`data-stx-file`, and the page's own "Total Orders: N" is corrected. Thirteen pack lists →
**155 orders** in their original sequence, each labelled "· file N".

### 2.6 A refresh no longer loses the place

The merged pack list is stored in **IndexedDB** and the position in **sessionStorage**. IndexedDB
rather than localStorage because 13 merged pack lists are ~4.8 MB of text, ~9.6 MB as UTF-16, against
a ~5 MB localStorage budget per origin.

Replaced the blob-URL approach entirely: a blob dies with the document that created it, so a refresh
gave `ERR_FILE_NOT_FOUND`, and its `null` origin also killed the microphone. The document is now
swapped in place with `DOMParser` + `document.documentElement.replaceWith()`, with inert scripts
re-created so they run.

### 2.7 Dark / light / system, and "← Open another"

Three-state theming: bare `:root` for light, `@media (prefers-color-scheme:dark)
:root:not([data-theme="light"])` for the system default, `:root[data-theme="dark"]` so the toggle
wins in both directions. Stored in `localStorage.stxTheme`.

### 2.8 Three packing rules corrected (`packing-priority.gs`, `engine.js`)

Reported from the floor with a screenshot: a "Collection Batch, These orders only, 2 / 15" card for
`WCCYSP160GD2PK`, an order nothing else shared.

| # | Rule | Measured effect |
| - | ---- | --------------- |
| 1 | `WCWD` is a lampshade — list 1, and the lampshade type | 3 SKUs, previously `OTHER` and never collected |
| 2 | Plain ceiling rose packs as "Other" in both types | **25 of 155 orders** change |
| 3 | No list-1 card when the run is a single order | **20 cards → 4** |

### 2.9 Build and path corrections

- `Speak-Tool.html` was moved to `packlist_upload/` in commit `8610a66`; the build was still writing
  it to the project root, leaving a stale duplicate. `build.js` now writes to `packlist_upload/`.
- The base64 payload was one **521,815-character line**. Every editor's language server gives up on
  that and marks the whole file red although it parses and runs cleanly. Now wrapped at 120 columns
  — 566 lines → 4,914 lines, longest line 162. Safe because the loader already strips whitespace
  before `atob`, and the HTML spec's forgiving-base64 decode ignores whitespace anyway.

---

## 3. POSTGRESQL / MCP FINDING

None today. The Postgres connection string in `~/.claude.json` was not used and no credentials were
extracted.

---

## 4. GAP FOUND

### 4.1 The five-word limit (fixed) — see 2.2

A guard added for a good reason (ignore rambling) that silently deleted the majority of real
commands. **Lesson: a filter on input length is a filter on the cases you did not imagine.** The
symptom ("works at first, then stops") pointed at a resource leak or a timeout; the cause was a
one-line length test.

### 4.2 The trolley pool went negative (fixed) — found while verifying 2.8

Suppressing a card left the collected pool at **−1** for that shade, because the code subtracted what
an order consumed whether or not a batch had supplied it. The next genuine run of the same shade was
then measured against a debt already paid, and produced **a second card for stock the packer was
already holding**.

This could not happen before today: every collectible used to arrive via a batch. **A new rule
created a defect in code that had been correct for a week.** Fixed by clamping the pool at zero.

### 4.3 `saveSession()` returned a Promise inside a `try/catch` (fixed)

A `try/catch` cannot catch a rejected Promise. On a browser without IndexedDB — private browsing, a
locked-down corporate profile — the packer got an uncaught error instead of a working tool. Now
`.catch()`ed: losing the saved session only means a refresh returns to the chooser.

### 4.4 `bar.insertBefore(b, bar.querySelector('button'))` threw (fixed)

The control bar's buttons are nested inside `<span style="display:contents">`, so the queried button
was not a child of the bar and `insertBefore` threw `NotFoundError`. That killed `mountPage()` **and**
the session save. Fixed to `bar.firstChild`, wrapped in `try/catch`.

### 4.5 Still open

- `WCWD` has no Lampshade SOT row, so its collection card shows no size.
- `WCB`, `WCCY`, `WCD` are collected but rank `OTHER`. Only `WCWD` was named.
- 3 of the 10 list-2 collections cover a single order; list 2 was deliberately not changed.
- 14 SKUs missing from the names master; the Ceiling Rose SOT link not supplied.

---

## 5. VALIDATION RULE ADDED OR CHANGED

| Rule | Before | After |
| ---- | ------ | ----- |
| Transcript length | commands ignored above 5 words | **no limit** |
| `interimResults` | TRUE | **FALSE** |
| `maxAlternatives` | 5 | **1** |
| Command vocabulary | included `stop`, `wait`, `text`, `bag` | those four **removed**; Unit 4's seven actions remain |
| Recognition start | waited on the meter's `getUserMedia` | starts **first**, unconditionally |
| List-1 collection | shown for any triggering order | shown only for a run of **2+** orders |
| Plain ceiling rose, no rect rose | rank 2, before the bulb | rank **4**, ties with Other |
| `WCWD` | `OTHER`, not collected | **`SHADE`**, list 1 |
| Trolley pool | could go negative | **floored at 0** |

---

## 6. FAILURE MODE OR EDGE CASE

| Mode | Behaviour |
| ---- | --------- |
| Opened from disk (`file://`) | Speech and every button work; **voice commands cannot** — Chrome will not attach a permission to the `null` origin. Must be served over https or localhost |
| No IndexedDB | Tool works; a refresh returns to the chooser |
| Two packers share one computer | The second sees the first's pack list until **← Open another** is pressed |
| Dashboard team restyles the pack list | The DOM contract (`li.bg-white`, `div.p-1[id$='-li']`, `span[onclick^='copyText']`) breaks **silently** — the tool finds no orders |
| Triggering order needs more than 15 | Always completed past the cap, `overflow` flagged rather than hidden — stopping mid-order would leave it unpackable |
| A SKU in neither prefix list | Invisible to the collection; travels with its order like a bulb |

---

## 7. DECISIONS MADE TODAY

| # | Decision | Reason |
| - | -------- | ------ |
| 1 | Copy Unit 4's recognition design exactly rather than tune this one | It works on the floor; tuning had already made accuracy worse once |
| 2 | Plain ceiling rose ranks as "Other" in **both** types | The business restated it three ways in one message, and it makes the two rank tables agree |
| 3 | "Run of one" read as the **same family** in the next order, not any list-1 family | Confirmed with the business against the measured alternative (4 cards vs 6) |
| 4 | Leave list 2 alone | The single-order rule was given under the "These Orders Only" heading |
| 5 | Do **not** extend the lampshade type to `WCB` / `WCCY` / `WCD` | Only `WCWD` was named. Inventing the rest would be inventing a business rule |
| 6 | IndexedDB, not localStorage | 13 pack lists are ~9.6 MB as UTF-16 against a ~5 MB budget |
| 7 | In-place document swap, not a blob URL or an iframe | A blob dies on refresh and carries origin `null`; a blob iframe from `file://` is cross-origin |
| 8 | Ask before shipping rules 2 and 3 | Both changed what 25 and 16 real cases do; one contradicted a rule confirmed two days earlier |

---

## 8. COMPANY KNOWLEDGE EXTRACT

1. **A microphone permission belongs to an origin.** `file://` is origin `null` and Chrome will not
   persist a grant against it. Any voice tool must be served over https or `http://localhost`. No
   setting changes this.
2. **A speech recogniser left open during speech will hear the speaker.** Chrome merges the tool's own
   voice and the operator's command into one transcript. Any rule about transcript length or shape
   will discard real commands.
3. **Everyday words make bad commands.** `stop`, `wait` and `bag` are spoken constantly on a packing
   bench. "Next" is itself a poor wake word; a distinctive phrase would be far more reliable.
4. **A collection exists to save a walk.** If it does not shorten the route, it is overhead wearing
   the costume of an optimisation.
5. **Rank tables that disagree between branches are a defect waiting to be reported.** The plain
   ceiling rose sat at 4 in one branch and 2 in the other for five days.
6. **A new rule can break code that was correct.** The pool subtraction had been right for a week; it
   became wrong the moment a card could be suppressed. Re-verify the invariants around a change, not
   only the change.
7. **A generated file with a half-megabyte line will be reported as broken.** It parses and runs, but
   every editor marks it red, and the next person will "fix" it.

---

## 9. LLM STANDARD CHECK

| Check | Result |
| ----- | ------ |
| Rules in one place per engine, cross-checked | ✅ 5,548 SKUs, 0 disagreements |
| No rule invented | ✅ two ambiguous readings were put to the business, not guessed |
| No unrelated refactor | ✅ UI, speech, name lookup and pack list parsing untouched |
| Every threshold recorded | ✅ see header |
| Every measured claim reproducible | ✅ 13 pack lists in `/order_details/` |
| Secrets | ✅ `service-account-file.json` and `.clasprc.json` remain gitignored, uncommitted, unmoved |

---

## 10. DAY OUTCOME

Verified against the payload decoded **out of the file that gets uploaded**, not the sources —
13 pack lists, 155 orders, 438 components:

| Check | Result |
| ----- | ------ |
| Loader page scripts | no errors |
| Pack list markup untouched | **13/13** files |
| `WCWD` type / family | `SHADE` / `WCWD` list 1 |
| Packing types | 10 type 1 · 83 type 2 · 62 type 3 |
| Rank inversions | **0** |
| Sort stability inside a rank | **0** breaks |
| Type 3 orders reordered | **0** |
| Plain rose spoken before a bulb | **0** (was 25) |
| List-1 collections | **4** (was 20) |
| List-1 cards for a single order | **0** |
| List-2 collections | **10** (unchanged) |
| Cards over 15 without the overflow flag | **0** |
| Orders left short by a card that was shown | **0** |
| Orders that build speech | **155/155** |
| Postcode spoken last | **155/155** |
| Sheets vs HTML engine | **0** disagreements across 5,548 SKUs |

**Delivered.** Two things must happen outside this repository before the floor sees the benefit:
paste `packing-priority.gs` into the Apps Script editor, and add the three `WCWD` rows to the
Lampshade SOT.
