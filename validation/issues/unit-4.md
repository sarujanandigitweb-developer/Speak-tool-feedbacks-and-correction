# Unit 4 — Issue Analysis (59 issues)

**Data sheet:** [`1XPvIv32…`](https://docs.google.com/spreadsheets/d/1XPvIv32Fcj6zWABZRfx1u7h2TJ8px1VrJpqqyC9QCF8/edit?gid=0)
**Issue tab:** [`gid=1959868645`](https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=1959868645)
**Script:** [`scripts/Unit 4 speak tool/`](../../scripts/Unit%204%20speak%20tool/) — `Lithursan.gs` **703 L (no grouping)** · `cleaned.gs` **296 L**

| | Count |
|---|---:|
| Total issues | **59** |
| Sheet says Done | 52 |
| Sheet says Open | 7 |
| ✅ **Verified fixed** | **7** |
| ⚠️ Unverified / blocked | 3 |
| ❌ **Proven not fixed** | **49** |

`- [x]` = verified fixed · `- [ ]` = not fixed

---

## 02/06/2025 — Janarththan

- [x] **#01 · Skip issue** — `Done` ✅
  *Reporter confirmed: "did not skip while testing in our own device but skipping in remote PC."* Remote-PC skipping is **RC-B** (self-trigger advancing a row). Recognition instability remains.
- [ ] **#02 · Mic icon disappear** — `Done` ❌ **RC-K**
  **There is no mic indicator in the DOM at all.** Only `#voiceFeedback`, a 12px grey text div (`Lithursan.gs:217`). Fix: add a mic-state dot bound to `recognition.onstart/onend/onerror`.
- [ ] **#03 · GB → "Gigabyte" acronym** — `Done` ❌ **RC-A**
  `Lithursan.gs:517` plain `SpeechSynthesisUtterance`, no SSML. Fix: `<say-as interpret-as="characters">`.
- [x] **#04 · While speaking, listen to our commands** — `Done` ✅
  Reporter wrote *"Works"*. `recognition.continuous = true` (`:619`). **But** this is also why the tool hears itself — see #16.
- [x] **#05 · Back and stop command issue** — `Done` ✅ *(partial)*
  Reporter wrote *"Back command works"*. **`stop` is still not a voice command** — no `includes("stop")` branch at `:630-645`. See #10.
- [ ] **#06 · Naming issue** — `Done` ⚠️ **RC-M**
  Names master sheet col B. Data fix; cannot verify from code.
- [ ] **#07 · Colour code not added** — `Done` ❌ **RC-C**
  `Combo Color` is **not in `neededColumns`** (`Lithursan.gs:21-26`) — the colour never reaches the tool. Fix: add the column and speak it.

## 04/06/2025 — Janarththan

- [ ] **#08 · Acronym — "st" for street** — `Done` ❌ **RC-A** — `:517`, no SSML.
- [ ] **#09 · Mic icon disappear** — `Done` ❌ **RC-K** — duplicate of #02.
- [ ] **#10 · Stop and Run command not working** — `Done` ❌ **RC-B**
  Verified: **no `stop` / `run` / `pause` branch exists** at `:630-645`. Only next / back / respeak / postcode / restart. Fix: add the branches.
- [ ] **#11 · Stopped speaking until next used** — `Done` ❌ **RC-B** — `:646-647` `stop()`+`start()` throws; `onerror` (`:652`) never restarts.
- [ ] **#12 · Order time delay with quantity** — `Done` ❌ **RC-K**
  `pauseTime` computed `:136`, passed `:184`, **never read by the client**. Dead code.
- [ ] **#13 · Combo and multi-line product packlist** — `Done` ❌ **RC-C**
  `Lithursan.gs:56` is a flat `dataRange.forEach` — no grouping exists.

## 19/06/2025 — Janarththan

- [ ] **#14 · Mapping full set image should be shown** — `Done` ❌ **RC-I**
  `replaceComboSKUsInPlace()` (`test.gs:1`) is **never called**, and the names sheet has **no `SKU.1` / `Mapping SKU` columns** — `indexOf` returns −1, so `skuMap` is always empty. Guaranteed no-op. **Screenshot P3** shows the packlist doing mapping correctly (`MAPPED FOR ICST64E27`) while the tool shows one thumbnail.
- [x] **#15 · Reducer plate shouldn't be shown separate** — `Done` ✅ *(but caused #34 and #37)*
  Implemented by **deleting the row** — `cleaned.gs:280-288`. Over-correction.
- [ ] **#16 · When postcode, voice command not working** — `Done` ❌ **RC-B**
  The tool speaks `":Post Code:"` (`:116`), the open mic hears it, and `:639` matches `includes("post code")` — **the tool fires its own postcode command.** Fix: gate the mic during synthesis.
- [ ] **#17 · Postcode took long time** — `Done` ❌ **RC-N** — `:513-517` joins all segments into one utterance.

## 23/06/2025 — Janarththan

- [ ] **#18 · Speech gap between quantity and postcode** — `Done` ❌ **RC-N**
  `:513` `segments.join(". ")` → one utterance, no real pause. The 948-line version speaks segments separately; that fix never reached Unit 4.
- [ ] **#19 · Mention First class / International** — `Done` ❌ **RC-J** *(reclassified — data exists)*
  `Status` holds `international` (14 rows) and `firstclass` (5). Rendered in red at `:153`, **never spoken**. Fix: prepend `Status` to the utterance. **Not blocked upstream.**
- [ ] **#20 · Speak quantity first then product name** — `Done` ❌
  `:97-105` pushes mergeOrder → **name** → quantity. Order is name-then-quantity. Fix: swap `:100-105`.
- [x] **#21 · Orders auto moving to next order** — `Done` ✅
  No auto-advance in this version — `utter.onend` only calls `hideLoading()` (`:525-527`).
- [ ] **#22 · Merge orders — speak Component 1, 2…** — `Done` ❌ **RC-C**
  `component` is read at `:70` and **never used again**. The data is loaded then discarded.
- [ ] **#23 · Multi/merge components shown in front of the order** — `Done` ❌ **RC-C** — no grouping.

## 04/07/2025 — Janarththan

- [ ] **#24 · Z → "Zee" pronunciation** — `Done` ❌ **RC-A** — `:517`.
- [ ] **#25 · Combo image showing but not for one order** — `Done` ❌ **RC-C**
  `:80-94` only finds an image when each component SKU also exists as its own row.
- [ ] **#26 · "Combo 1:" for single product — don't say** — `Done` ❌ **RC-C** — `cleaned.gs:122-129`.
- [ ] **#27 · Speed up the speech** — `Done` ❌ **RC-speed** — see #38.
- [ ] **#28 · Post code not shown / speak issue** — `Done` ❌ **RC-D** — `cleaned.gs:167-169`.
- [ ] **#29 · Next command not working twice** — `Done` ❌ **RC-B** — `:646-647`.

## 08/07/2025 — Janarththan

- [ ] **#30 · Quantity varela (quantity missing)** — `Done` ❌ **RC-E**
  `cleaned.gs:112` `slice(0,-3)` strips **3** chars for a **2**-char `"PK"`; `:116` then blanks the quantity when the lookup fails. **Screenshot P13** shows the badge rendering "X" with no number.
- [ ] **#31 · Single product — don't speak twice** — `Done` ❌ **RC-N** — `:513`.
- [ ] **#32 · Combo products image not shown** — `Done` ❌ **RC-C** — `:80-94`.
- [ ] **#33 · Not all combo images shown** — `Done` ❌ **RC-C** — `:82-91`.

## 09/07/2025 — Janarththan

- [ ] **#34 · Reducer plate name not shown** — `Done` ❌ **RC-H**
  Direct consequence of #15 — `cleaned.gs:288 continue` drops the `RPR44WH` row entirely.
- [ ] **#35 · Post code not shown when 2 postcode same** — `OPEN` ❌ **RC-D**
  `cleaned.gs:167-169` compares only the adjacent cell, no customer check.
- [x] **#36 · Do back command works?** — `Done` ✅ — `:633` → `:384` → `changeIndex("prev")`. Works.

## 10–11/07/2025 — Janarththan

- [ ] **#37 · Reducer Plate not said** — `Done` ❌ **RC-H** — as #34.
- [ ] **#38 · Speed Normal ×1, Fast ×1.25, Very fast ×1.5** — `Done` ❌
  `:233-236` implements `0.6 / 0.7 / 1.2 / 1.5`, and **"Normal" is 0.7** — 30 % slower than ×1. Default `speechRate = 0.7` (`:496`). Fix: `1.0 / 1.25 / 1.5`.
- [ ] **#39 · Amazon 2-Day — speak "S label 2 kilos"** — `OPEN` ⚠️ **RC-L** — no label-weight column in `Sheet1`. Blocked upstream.
- [ ] **#40 · Next command not fast enough** — `Done` ❌ **RC-B** — `:646-647`.
- [ ] **#41 · Mapping bulb is not shown** — `Done` ❌ **RC-I** — as #14.

## 14/07/2025 — Janarththan

- [ ] **#42 · Mapping bulb is not shown** — `Done` ❌ **RC-I** — as #14.
- [ ] **#43 · Mapping not shown in combo** — `Done` ❌ **RC-I + RC-C** — mapping dead *and* no grouping.
- [ ] **#44 · Merge order said once instead of number of total orders** — `Done` ❌ **RC-G** — `cleaned.gs:92-94`.
- [ ] **#45 · Mapping bulb is not shown** — `Done` ❌ **RC-I** — as #14.

## 17/07/2025 — Janarththan

- [ ] **#46 · Mapping bulb is not shown** — `Done` ❌ **RC-I** — **fifth report of the same defect.**
- [ ] **#47 · Change the speaking speed to default** — `Done` ❌ — see #38; default is 0.7, not 1.0.
- [ ] **#48 · Next command not fast enough** — `Done` ❌ **RC-B**.
- [ ] **#49 · Merge order said once — "merge order endu orukka sonna OK"** — `Done` ❌ **RC-G** — `cleaned.gs:92-94`.

## 18–23/07/2025

- [ ] **#50 · Same postcode — 1st order can't speak postcode** — `Done` ❌ **RC-D** — `cleaned.gs:167-169`.
- [ ] **#51 · Next command is not listening enough** — `OPEN` ❌ **RC-B**.
- [ ] **#52 · Next not listening — "getting tired from it"** — `OPEN` ❌ **RC-B**
  The worst morale item in the backlog. Fix: remove `stop()` at `:646`, restart from `onerror`, gate the mic during speech.
- [ ] **#53 · Combo image not shown** — `Done` ❌ **RC-C**.
- [ ] **#54 · For merge orders all components need to be shown** — `Done` ❌ **RC-C**
  **Screenshot P3**: packlist lists **5 components**, the tool shows **1**.

## 24/07 – 12/09/2025

- [ ] **#55 · Make the note available but don't speak** — `OPEN` ⚠️ **RC-L** — no customer-note column. **Conflicts with Unit 3 Lampshade #19**, which wants it spoken. Needs a decision.
- [x] **#56 · Create one names sheet linked to all speak tools** — `Done` ✅ — `cleaned.gs:13-15` opens `16rx5Dz…` live on every run. 19,739 rows.
- [ ] **#57 · IP 20 Thousand issue** — `OPEN` ❌ **RC-A**
  Dev note: *"I changed the name for IP20 transformers"* — patched one product at a time. Cannot scale. `:101-102` `split(" ").join(" ")` is a **no-op that looks like normalisation**.
- [ ] **#58 · Postcode button not working** — `Done` ❌ **RC-postcode-button**
  `:407` hardcodes `speakTexts[index][1]`. No postcode → empty string → "No valid speech content" in a 12px grey div. Press the button, hear nothing.
- [ ] **#59 · Not need "merge order total 2: merge order 1"** — `OPEN` ❌ **RC-G**
  The exact string is generated at `cleaned.gs:92-94`. **One-line fix.**

---

## Defects found in the code that are **not** on the issue sheet

- [ ] **U1 · `Cleaned Data` written twice with different widths** — `merged.gs:58` writes 18 cols, `cleaned.gs:153` overwrites 15. Cols P/Q/R survive as leftovers, and `Lithursan.gs:25` **requires** `SKU Combined`, so the tool depends on a column no documented path writes. *(Correction: I previously called col R row-misaligned. Verified false — `getDataRange()` carries all 18 cols per surviving row. Hygiene, **not** a blocker.)*
- [ ] **U2 · Two competing `onOpen()`** — `action.gs:1` and `cleaned.gs:1`. If `action.gs` wins, **"Run Clean and Merge" is unreachable**. **Blocker.**
- [ ] **U3 · No `synth.resume()`** — `togglePause()` (`:439-448`) pauses one-way.
- [ ] **U4 · No end-of-queue state** — `:347-349` wraps silently to row 1.
- [ ] **U5 · Cancelled orders not skipped** — `Status` can read `plz cancel this order`; shown but never filtered.
- [ ] **U6 · `sku.gs` — all 3 functions dead**, including one that duplicates live name-lookup logic.
- [ ] **U7 · Dead code** — `previousPostCodeRaw` (`:55`, `:78`) never read; ternary at `:120` returns `char` in both branches.
- [ ] **U8 · Unescaped interpolation** — `title` / `customerInfo` / `status` go raw into HTML and into a `<script>` block.

---

## Fix order for Unit 4

| Step | Fix | Closes | Effort |
|---:|---|---:|---|
| 1 | U1 — remove the double write | blocker | S |
| 2 | U2 — delete the duplicate `onOpen()` | blocker | XS |
| 3 | RC-I — wire + guard mapping; add names-sheet columns | **6** | S |
| 4 | RC-E — `cleaned.gs:112` regex, `:116` keep quantity | 1 | XS |
| 5 | #38/#47 — correct the speed values | 3 | XS |
| 6 | #19 — speak `Status` | 1 | XS |
| 7 | #59/#44/#49 — drop the merge-order prefix | 3 | XS |
| 8 | #58 — look up the postcode segment by content | 1 | S |
| 9 | RC-B — recognition restart, mic gating, `stop` command | **11** | M |
| 10 | RC-N — sequential utterances | 3 | S |
| 11 | RC-A — token classifier + SSML | 4 | M |
| 12 | RC-D — composite-key dedupe; decouple QR | 3 | M |
| 13 | RC-H — keep the reducer plate as a component | 3 | M |
| 14 | RC-C — grouping pass, **customer-safe key** | **12** | L |
| 15 | RC-L — blocked on new sheet columns | 2 | — |

Steps 1–8 are small and independently shippable, closing **15 issues** plus both blockers.
