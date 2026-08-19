date: 2026-08-18
developer: Sarujanan
project: Speech Tool — Warehouse Voice Packing
project_code: STFC
phase: Development — phase 04
requirement_id: REQ-04
deliverable_id: D02
status: In Progress — extension complete and tested on all 13 pack lists; six rule decisions outstanding
evidence_location: /packlist_extension/ · /packlist_extension/README.md · /validation/unit3-lampshade-collection-rule-2026-08-18.md · /Speak-Tool.html
blos_keys_used:
  - packlist_dom_contract
  - ui_untouched_guarantee
  - name_authority_master_only
  - postcode_last
  - size_authority_sot_width_height
  - zoom_follows_speech
  - listen_while_speaking
  - gesture_required_for_speech
hardcoded_thresholds:
  - ui_untouched_guarantee = every added element mounts inside #stx-root
  - lampshade_collection_max = 15   (per prefix list, not shared)
  - recognition_interim_results = TRUE
  - recognition_max_alternatives = 5
  - command_dedupe_ms = 1000
  - command_max_words = 5
  - mic_release_after_speech_ms = 60   (was 200)
  - mic_speech_watchdog_ms = 45000
  - speech_rate_default = 0.7   (Slow 0.6 / Normal 0.7 / Fast 1.2 / Faster 1.5)
  - meter_segments = 6, level curve = min(1, (rms * 7) ^ 0.7)
  - start_card_threshold_ms = 700   (no utterance.onstart by then -> ask for a press)
  - zoom_max_width_px = min(760, 88vw)
  - stx_bar_z_index = 2147483003   (above the collection dialog at 2147483001)
three_am_standard: TRUE
llm_queryable: TRUE
company_knowledge_candidate: TRUE
domain: Warehouse Operations — Order Packing
User: Postage & Warehouse Team (assigned by Varmen)
Benefit status: Delivered — the tool runs on the dashboard's own pack list with that page unchanged, and ships as one file. Three fields the pack list does not carry remain open

---

## 1. SYSTEM STATE

Before today:

- The Speak Tool existed in two places: the **Google Sheets** tool (live, six stations) and
  yesterday's **standalone HTML** build, which reads a pack list but on a page of its own.
- Nothing ran on the dashboard's Order Packing page. The packer had to leave it.
- `order_details/` held **3** saved pack lists. It now holds **13**, and my earlier collection
  figures were measured against a subset — see section 4.
- Size for the collection card was parsed from the SKU digits.
- The microphone was switched **off** for the whole of every utterance.
- Recognition read **final results only**, and only Chrome's **top** guess.
- There was no measurement of microphone input anywhere in either tool.

---

## 2. WHAT CHANGED TODAY

### 2.1 The extension (`packlist_extension/src/speak-extension.js`, 1,075 lines)

Adds the control bar, the collection dialog, the auto-zoom and the order outline to the dashboard's
pack list. Everything mounts inside **one** container, `#stx-root`, so the "nothing else is touched"
guarantee is structural rather than a list a test has to keep up with — one `removeChild` takes the
whole tool off the page.

Proved by comparison, not asserted: the page body is captured before the tool loads, the tool's own
container is removed afterwards, and the two are compared. **Byte-identical on 1, 4, 5, 6, 9, 11,
12 and 13.html.**

### 2.2 The rules are shared, not copied (`speak_tool_html/engine.js`)

`build.js` concatenates `reference-data.js` + `engine.js` + the extension into one deployable file.
The packing rules therefore live in **one** place, shared with yesterday's standalone build. Six
forked station scripts is the failure this project has already paid for; copying the engine would
have re-created it in a new form.

Two additive changes to the engine: `order.node` (the `<li>`, so the page can scroll to it) and
`line.imgEl` (the `<img>`, so the right picture can be zoomed).

### 2.3 Size from the SOT's Width and Height (`packing-priority.gs`, `engine.js`)

`ppProductSize()` read the SKU digits and never asked the SOT. That cannot work:

| SKU | Digits | SOT |
| --- | ---: | ---: |
| `LSGL10014AR` | 10014 | 140 |
| `LSGL10014CL` | 10014 | 100 |
| `LSGL14013AR` | 14013 | 140 |
| `LSGLWA140AR` | 140 | 150 |

Two SKUs with identical digits have different sizes, so no parser can recover it. The SOT is now
read first, with Width and Height as **separate** columns found by pattern rather than exact name;
the card shows `140 x 130 mm` and the speech says *"140 by 130 millimeter"* — `x` does not read
aloud.

### 2.4 Auto-zoom (`speak-extension.js`)

As each component is spoken its picture opens, with name, SKU and count. This exists because the
page lists products in the **dashboard's** order while the tool speaks them in **packing priority**
order. It replaces the numbered thumbnail strip the sheet build uses, which cannot be added here
without changing the page. The page's own zoom is tried first, decided once.

### 2.5 Voice reliability (`speak-extension.js`)

Three separate causes, all fixed:

- **The microphone was off while the tool spoke.** A packer says "next" the moment the item is in
  hand, which is before the tool finishes. Recognition now stays on and the tool's own words are
  filtered instead — it knows what it is saying, so *"post code"* is ignored while it reads the
  postcode, and next / back / repeat / restart always get through.
- **Only final results were read.** Chrome can take over a second to finalise, and if you speak
  again it may never finalise at all. Commands now act on the interim result, de-duplicated for 1s.
- **Only the top guess was read.** All five alternatives are read, plus the words Chrome actually
  returns instead: next ← nest, necks, neck, text, nexus, net.

### 2.6 Microphone level meter (`speak-extension.js`)

Six segments driven by the RMS of the real waveform, read through Web Audio on its own
`getUserMedia` stream. A **measurement, not an animation**: if the bars do not move when the packer
talks, the headset is the fault. The last segment turns amber when the input is clipping.

### 2.7 Language, voice and speed carried across from the sheet

Grouped by language first, exactly as `Lithursan.gs` does it, because Chrome exposes 20–70 voices in
one flat list. Verified: switching to Tamil re-fills the voice list and the next utterance uses
`Microsoft Ravi - Tamil (India)`.

### 2.8 Three ways in, and one file to send

| File | Purpose |
| ---- | ------- |
| `packlist-speak.js` | One `<script>` tag on the dashboard; every future pack list then has the tool |
| `speak-loader.html` | Drop a saved pack list on it; the page becomes that pack list, tool running |
| `add-speak.js` | Writes `<name>.speak.html` beside a downloaded file, original untouched |
| `serve.js` | Serves over http so the microphone works |
| `Speak-Tool.html` | 509 KB, built, **the single file to send**. Zero external references |

---

## 3. POSTGRESQL / MCP FINDING

No database work today. `daily_task.tbl_stfc_sarujanan` still has no row for 2026-08-18;
`sql/daily_task_insert_2026-08-17.sql` remains superseded, having been written against the wrong
(37-column) schema.

---

## 4. GAP FOUND

**I published wrong figures and had to correct them twice.**

I reported the collection rule verified against **"46 orders, 14 collections"**. Re-running it
produced **16 orders, 5 collections** — the earlier number came from a copy of `order_details/`
that no longer matched. I corrected the validation record and the published rulebook, with a visible
note.

Then, while working on the priority, I found the folder now holds **13 files and 155 orders**, not
the 3 files I had been testing. Both of my earlier figures were measured against a subset.

The lesson is recorded in section 8: a count is only true for the input it was measured on, and the
input has to be re-checked, not assumed.

**Other gaps:**

- The pack list carries **no** `Instruction QR`, `Send Order Instruction` or `Status` field. On the
  sheet these are typed by the team. On this route they have nowhere to come from.
- 25 of 155 orders speak a plain ceiling rose second. That is the conditional rule working as
  specified, not a defect — confirmed with Varmen today.
- `WCB`, `WCCY` and `WCD` are collected as lampshades but ranked `OTHER` by the packing sort:
  collected first, packed last. Flagged, unchanged.

---

## 5. VALIDATION RULE ADDED OR CHANGED

| # | Rule | Where |
| - | ---- | ----- |
| 1 | The pack list body must be byte-identical before and after the tool loads | test harness |
| 2 | Every element the tool creates mounts inside `#stx-root` | `mount()` |
| 3 | A spoken name comes from the names master or is "This one" + colour; the pack-list title is never spoken | `nameFor()` |
| 4 | Every order's last spoken step ends with the postcode | verified 155/155 |
| 5 | Size comes from the SOT's Width and Height; SKU parsing is a fallback and only for `LS` | `ppProductSize()` |
| 6 | A command found in the tool's own current utterance is ignored | echo guard |
| 7 | The queue is published before any presentation code runs | `boot()` |
| 8 | The bundle must contain no literal `</script` | `build.js` |

---

## 6. FAILURE MODE OR EDGE CASE

Nine failures found and fixed today. Every one produced a **working tool that looked broken**, which
is the class of fault that costs the most time.

| # | Symptom | Cause |
| - | ------- | ----- |
| 1 | Loader died, `Unexpected token '<'` | The bundle's own header comment contained `</script>`, closing the tag early |
| 2 | Same, again | A literal `<!--` in a regex, followed by `<script`, drove the parser into script-data **double-escaped** state, where `</script>` stops working |
| 3 | Control bar buttons dead | The collection dialog is `inset:0` at a **higher** z-index — invisible, but catching every click |
| 4 | "The Speak Tool did not start", while it was visibly running | A blob page from `file://` is a different origin, so reading `frame.contentWindow.STX` threw and the catch reported failure |
| 5 | Refresh gave `ERR_FILE_NOT_FOUND`, URL read `blob:null` | A blob URL dies with the page that created it — and `null` is also the origin that blocks the microphone |
| 6 | Tool never started, intermittently | `document.write()` leaves `readyState` at `loading` while `DOMContentLoaded` has already fired, so the listener waited for an event that had gone |
| 7 | Bar drawn, but the tool reported dead | `scrollIntoView` threw, and `focusOrder()` called it **again inside its own catch** — killing `boot()` after the bar was drawn but before the queue was published |
| 8 | "No orders found" on a valid pack list | The **template** was opened instead of the built file. Same name, one folder apart |
| 9 | First SKU silent | Browsers drop `speechSynthesis.speak()` until the page has had a user gesture — accepted, no error, no sound |

Fixes worth carrying: presentation is wrapped so it can never take the tool down; the queue is
published first; the payload is **base64**, so no escaping rule applies to it at all; the template is
renamed and refuses to pretend it works; and speech is confirmed by `utterance.onstart`, which is the
only honest signal that audio began.

---

## 7. DECISIONS MADE TODAY

| # | Decision | Source |
| - | -------- | ------ |
| 1 | Keep the **conditional** packing priority. Rect rose present → RectRose, Shade, Bulb, Other. Rect rose absent → Shade, plain Rose, Bulb, Other | Varmen, today |
| 2 | Merge markers (`zzzmerge_order`, `multi_line`, `merged`) stay **silent** — reading them aloud is meaningless | Varmen, today |
| 3 | The pack-list title is never spoken; it is listing copy, not a picking instruction | Sarujanan |
| 4 | The engine is **shared**, not copied, between the two builds | Sarujanan |
| 5 | Recognition stays on while the tool speaks, with an echo guard | Sarujanan |
| 6 | The document is swapped in place rather than navigated to — keeps the real URL, so refresh works and the origin is not `null` | Sarujanan |
| 7 | Instruction QR and Send Order Instruction are **not** invented on this route | Sarujanan |

---

## 8. COMPANY KNOWLEDGE EXTRACT

**A count is only true for the input it was measured on.** I reported 46 orders and 14 collections;
the real figures for those files were 16 and 5, and the folder had meanwhile grown to 13 files and
155 orders. Nothing about the rule was wrong — only the sample. Re-measure the input before quoting
a number a second time.

**A test that passes in the harness can still be false.** The dead-button bug passed every test,
because jsdom dispatches events straight onto the element and does no layout, so it never saw the
overlay sitting on top. The boot bug passed for the mirror-image reason: jsdom reports `readyState:
complete` where Chrome reports `loading`. Where a browser behaviour is the thing under test, the
test has to reproduce that behaviour, not the library's convenience.

**Presentation must never be able to kill the work.** `scrollIntoView` throwing took down the whole
tool, after the bar had already been drawn — so it looked alive and was dead. Publish the working
state first; wrap everything cosmetic.

**Silence is the worst failure mode, and browsers produce it deliberately.** `speechSynthesis.speak()`
is accepted and discarded until a user gesture, with no error. Anything that depends on audio must
confirm the audio actually started.

**Escaping rules you have to remember are a defect waiting to happen.** Two separate outages came
from `</script` and `<!--` inside embedded JavaScript. Base64 removes the entire class: the payload
cannot contain a character the parser cares about.

**Two files with the same name will be confused, and the confusion will cost an hour.** The template
and the built loader were both `speak-loader.html`. Renaming was half the fix; making the template
say what it is was the other half.

---

## 9. LLM STANDARD CHECK

| Standard | Status |
| --- | --- |
| Every claim measured against live data | TRUE — 13 pack lists, 155 orders; the UI comparison run on 8 of them |
| Corrections stated plainly when I was wrong | TRUE — the 46/14 figures were corrected in the validation record and the published rulebook, twice |
| No business rule invented | TRUE — the priority and the merge-marker questions were put to Varmen rather than assumed |
| Destructive actions gated on approval | TRUE — no write to any sheet, order or dashboard record; the extension only reads |
| Scope respected | TRUE — the pack list markup is unchanged, proved by comparison; the Google Sheets tool untouched |
| Thresholds externalised and named | TRUE — see `hardcoded_thresholds` |
| Failure modes documented | TRUE — section 6, nine of them |
| Open items surfaced, not silently defaulted | TRUE — six carried forward |

One process failure to record: I twice diagnosed by rewriting rather than by measuring. The dead
buttons and the "did not start" message were both explained by a single line each — a z-index and a
cross-origin read — but I had already begun replacing the mechanism before finding them. Measure
first; the fix is usually smaller than the rewrite.

---

## 10. DAY OUTCOME

The Speak Tool now runs on the dashboard's own Order Pack List page, with that page unchanged.

| Measure | Result |
| --- | ---: |
| Pack lists tested | 13 |
| Orders tested | 155 |
| Pack list body altered | **0 bytes**, on every file checked |
| Elements added to the page | **0** outside `#stx-root` |
| Orders whose last spoken step ends with the postcode | 155 / 155 |
| Pack-list titles reaching the speech | 0 |
| Mis-heard words for "next" now accepted | 6 |
| Microphone level segments | 6, driven by real audio |
| External files needed by the deliverable | **0** |

**Delivered:** `packlist_extension/` — `packlist-speak.js` (372 KB built) · `speak-loader.html` ·
`add-speak.js` · `build.js` · `serve.js` · `src/speak-extension.js` (1,075) ·
`src/speak-loader.template.html` · `README.md` (292) · 13 demo pack lists.
**`Speak-Tool.html` (509 KB) is the single file to send** — it carries the names master, the
Lampshade SOT, the packing engine and the tool, and needs nothing else present.

**Not delivered today:** `Instruction QR`, `Send Order Instruction` and `Status` have no source on
this route; the 12 SKU-less rows on the sheet route are still silent; cage shades are still
collected first and packed last. All three are blocked on decisions, not on code.
