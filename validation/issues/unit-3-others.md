# Unit 3 Others — Issue Analysis (58 issues)

**Issue tab:** `Unit 3 Others` — *Copy of jana speak*
**Data sheet:** [`1KyC8ION…`](https://docs.google.com/spreadsheets/d/1KyC8IONfHAlufQvsRKUfqDAUran0EQ3OC0MOHanRRfY/edit?gid=0)
**Script:** [`scripts/Copy of jana speak/`](../../scripts/Copy%20of%20jana%20speak/) — `Lithursan.gs` **1288 L (no grouping)** · `cleaned.gs` **345 L**

> ⚠️ **Largest script of the six stations (1,288 lines) and still has no grouping.** Verified:
> `combinedGroups`, `groupKey`, `processedIndices` are absent. It is a different lineage, not a newer
> version — so every "merge order / component" ticket here was never buildable.

| | Count |
|---|---:|
| Total issues | **58** |
| Sheet says Done | 36 |
| Sheet says Open | 21 |
| Sheet untriaged | 1 |
| ✅ **Verified fixed** | **4** |
| ⚠️ Unverified / blocked | 8 |
| ❌ **Proven not fixed** | **46** |

`- [x]` = verified fixed · `- [ ]` = not fixed

---

## 24/06/2025 — Janarththan

- [ ] **#01 · 12 IP20 120 speech gap** — `OPEN` ❌ **RC-A**
  Dev note: *"i can't do for single one, can do it for every think."* **He is right** — this needs a rule, not a per-product patch. No SSML anywhere. Fix: token classifier with `<break>` between digit groups.
- [x] **#02 · Next order moving auto** — `Done` ✅ — no auto-advance; `utter.onend` only hides the loader.
- [ ] **#03 · Merge order shown fully, each component mentioned** — `Done` ❌ **RC-C**
  **No grouping exists in this station's script.** Marked Done, never buildable.
- [ ] **#04 · International showing as UK** — `Done` ❌ **RC-J**
  `Status` holds `international` (14 rows) but is **displayed, never spoken**. `utter.lang` also hardcoded `en-US`. Fix: speak `Status`; set lang from the selected voice.
- [ ] **#05 · 3 types of pipe (not painted / black / galvanized)** — `OPEN` ⚠️ **RC-M** — finish must be added to the spoken name in the names master sheet.

## 25/06/2025 — Matheesan

- [ ] **#06 · Next day sticker speak** — `OPEN` ⚠️ **RC-L**
  Dev note *"not found in the packlist"* is **correct** — no such column. **Screenshot P1** shows the packlist carrying `250 G LABEL` and `RM Packlist L u3`, so the data exists upstream but was never imported.
- [ ] **#07 · Hold button create** — `Done` ❌ **RC-K**
  `held[]` array, CSS and render logic exist — **nothing ever writes to it, and there is no Hold button.** Never built.
- [ ] **#08 · Services telling — evri, royal mail** — `OPEN` ⚠️ **RC-L** — no carrier column. See **P1**.
- [ ] **#09 · 2 times speak** — `Done` ❌ **RC-N**
  **Screenshots P6 and P8 both show it still duplicating**: `:: 3 Core Twisted Cream :: 1 meter: 3 Core Twisted Cream :: 1 meter:`.
- [x] **#10 · Re-speak button** — `Done` ✅ — `controlSpeech("respeak")` works.
- [ ] **#11 · Prime / cable / transformer telling speak then continue** — `OPEN` ❌ **RC-A + RC-J**
  Needs a product-category rule plus speaking `Status`.
- [ ] **#12 · Pause button not complete** — `Done` ❌ **RC-K**
  **`synth.resume()` appears in no station copy.** Pause is one-way. Never fixed.

## 26/06/2025 — Janarththan

- [ ] **#13 · Cable 10 meter speak** — `Done` ❌ **RC-E** — see #45, **P7/P8**.
- [ ] **#14 · Total component** — `Done` ❌ **RC-C** — no grouping, so no component count.
- [ ] **#15 · 3 CORE BROWN 10 METER** — `Done` ⚠️ **RC-E / RC-M** — pack-suffix stripping returns the base (1 m) product's name.
- [x] **#16 · SLOW DOWN SPEAK** — `Done` ✅ — `rateSelect` dropdown works.
- [ ] **#17 · NAME QUANTITY NOT** — `Done` ❌ **RC-E**
  `cleaned.gs:116` `if (!name) quantity = '';` — a failed lookup blanks the quantity too. **Screenshot P13.**
- [ ] **#18 · After postcode free gap needed** — `Done` ❌ **RC-N** — segments joined into one utterance.
- [ ] **#19 · Telling combo start & end** — `Done` ❌ **RC-C** — no grouping.
- [ ] **#20 · Hold screen shot** — `Done` ❌ **RC-K** — `html2canvas` loaded from CDN, **never called**.
- [ ] **#21 · Mapping merge** — `Done` ❌ **RC-I** — mapping function never wired; names sheet lacks its columns.

## 29/06/2025 — Janarththan

- [ ] **#22 · 24 IP67 150 Watts → "sixty seven thousand"** — `Done` ❌ **RC-A** — no SSML.
- [ ] **#23 · Sometimes next not working** — `Done` ❌ **RC-B** — `stop()`+`start()` throws; `onerror` never restarts.
- [x] **#24 · Don't auto-move to next order** — `Done` ✅ — confirmed no auto-advance.

## 07/07/2025 — Atisraj

- [ ] **#25 · Address issue can't show** — `Done` ❌ **RC-D** — postcode blanked by adjacency dedupe.
- [ ] **#26 · IP20 000 issue** — `Done` ❌ **RC-A** — recurs at #48.
- [ ] **#27 · "z" spoken as "c"** — `Done` ❌ **RC-A** — needs `say-as interpret-as="characters"`.
- [ ] **#28 · Automatic hold issue** — `Done` ❌ **RC-K** — hold was never built (#07).
- [ ] **#29 · Quantity should be with meters for cables** — `Done` ⚠️
  `cleaned.gs:118-120` appends `" meter"` for `CL*` SKUs — works, **but** the quantity it appends is wrong. See #31, #45.

## 08/07/2025 — Atisraj

- [ ] **#30 · UK English voice better than US female** — `Done` ⚠️
  Voice dropdown exists, but the default is hardcoded `"Google US English"` (`:697`) and `utter.lang` is hardcoded `en-US`. Fix: make both configurable per station.
- [ ] **#31 · Cable quantity 5 should say "5 Meter"** — `Done` ❌ **RC-E**
  **Screenshot P8 proves it still says "1 meter" for a 5-Meter product.**
- [ ] **#32 · 12 voltage must be added** — `OPEN` ⚠️ **RC-M** — dev note confirms: names sheet.
- [ ] **#33 · "12 ip20 20" needs a gap** — `Done` ❌ **RC-A** — no SSML break.
- [ ] **#34 · Automatic hold issue** — `Done` ❌ **RC-K** — duplicate of #28.

## 09–13/07/2025 — Matheesan / Janarththan

- [ ] **#35 · Merge & combo orders — speak both names** — `OPEN` *"not possible for this"* ❌ **RC-C**
  **It is possible** — it is not possible while the script iterates a flat row list. Needs grouping.
- [ ] **#36 · (repeat of #35)** — `OPEN` *"not possible"* ❌ **RC-C** — as above.
- [ ] **#37 · Post code not shown when 2 postcode same** — `Done` ❌ **RC-D**
  `cleaned.gs:167-169` blanks the **earlier** row's postcode when it matches the row above — adjacency only, no customer check.
- [ ] **#38 · Merge and combo should speak auto one after other** — `OPEN` ❌ **RC-C** — no grouping.
- [ ] **#39 · Colour code issue** — `Done` ❌ **RC-I**
  **Screenshot P8**: the tool says **"Cream"** for a **Light Gold** product. The mapping swapped the SKU and the name lookup returned the *mapped* product's name.

## 15–16/07/2025 — Matheesan / Pirakasana

- [ ] **#40 · PE11 3TY spoken "20 thousand"** — `Done` ❌ **RC-A**
  The postcode splitter drops the internal space (`char.trim() !== ""`), so the engine re-groups the digits. Fix: preserve the space and add a `<break>`.
- [ ] **#41 · Combo orders like speak merge** — `Done` ❌ **RC-C** — no grouping.
- [ ] **#42 · 2625-717 international address showing UK name** — `Done` ❌ **RC-J** — `Status` not spoken.
- [ ] **#43 · SPSDP2BMY — add name "black cord grip gold top"** — `Done` ⚠️ **RC-M** — **Screenshot P11** shows the names sheet mid-edit.
- [ ] **#44 · Accessories image should come together** — `Done` ❌ **RC-C** — needs grouping.
- [ ] **#45 · Cable 5m says 1m (CT20 2ED)** — `Done` ❌ **RC-E**
  Root cause proven by **P7 + P8**: `cleaned.gs:112` strips `5PK` from `CL3TCR5PK` → `CL3TCR`, whose master-sheet name is the **1-metre** variant. `:118-120` then appends `" meter"` to quantity 1.

## 18/07 – 19/08/2025 — Pirakasana

- [ ] **#46 · HG4 1JR, CR0 8TA, TQ2 8NE, KT11 1HW — next didn't play** — `OPEN` ❌ **RC-B**
  Dev note guesses *"network error"*. The real cause is `:646-647` throwing `InvalidStateError`, and `onerror` not restarting.
- [ ] **#47 · Prime speak tool — next didn't play** — `OPEN` ❌ **RC-B** — as #46.
- [ ] **#48 · IP20 000 issue** — `OPEN` ❌ **RC-A** — recurrence of #26.
- [ ] **#49 · Transformer speak tool wrong** — `OPEN` ❌ **RC-A** — Kronen #03 specifies the required order: **type → voltage → wattage**.
- [ ] **#50 · M22 9A2 000 issue** — `OPEN` ❌ **RC-A** — postcode read as a number.
- [ ] **#51 · RH19 1SE don't tell colour** — `OPEN` ❌ **RC-I** — the mapping swaps colour. See **P8**.
- [ ] **#52 · TF2 8NP speak "goldtop"** — `OPEN` ⚠️ **RC-M / RC-I** — names sheet + mapping.
- [ ] **#53 · LU1 4EL speak 1M** — `OPEN` ❌ **RC-E**
  **Screenshot P4** shows a 5-pack mapped with quantity **5 → 1**.
- [ ] **#54 · SP11 6TQ not speak quantity** — `OPEN` ❌ **RC-E** — `cleaned.gs:116`. **P13.**
- [ ] **#55 · Next didn't play** — `OPEN` ❌ **RC-B** — third report of the same defect.

## 15/09 – 07/10/2025 — Matheesan

- [ ] **#56 · Customer note not shown; activate speak postcode urgently** — `OPEN` ⚠️ **RC-L + RC-D**
  **Screenshot P5** shows the note on the packlist: *"One continuous length of 15m if you can please"*. No note column in `Sheet1`. The postcode half is **RC-D**.
- [ ] **#57 · Not add note in packlist** — `Untriaged` ⚠️ **RC-L**
  **Screenshot P6** shows the note *"Please can I have it all in one length. Thanks"* on the packlist and absent from the tool.
- [ ] **#58 · Mapping issue — see above picture** — `OPEN` ❌ **RC-I**
  **Screenshot P7** — `CL3TCR5PK` carries a "1 meter" quantity while its Title reads "5 Meter Vintage".

---

## Root causes for this station

| RC | Issues | Count |
|---|---|---:|
| **C** — no grouping | 3, 14, 19, 35, 36, 38, 41, 44 | **8** |
| **A** — no SSML | 1, 22, 26, 27, 33, 40, 48, 49, 50 | **9** |
| **B** — recognition dies | 23, 46, 47, 55 | 4 |
| **E** — pack-suffix / quantity blanking | 13, 15, 17, 31, 45, 53, 54 | **7** |
| **I** — mapping dead | 21, 39, 51, 52, 58 | 5 |
| **K** — never built | 7, 12, 20, 28, 34 | 5 |
| **D** — postcode dedupe | 25, 37 | 2 |
| **L** — column absent | 6, 8, 56, 57 | 4 |
| **J** — `Status` not spoken | 4, 11, 42 | 3 |
| **M** — names sheet | 5, 32, 43 | 3 |
| **N** — spoken twice | 9, 18 | 2 |

## Fix order for Unit 3 Others

| Step | Fix | Closes | Effort |
|---:|---|---:|---|
| 1 | **RC-E** — `cleaned.gs:112` regex, `:116` keep quantity | **7** | XS |
| 2 | **RC-J** — speak `Status` | 3 | XS |
| 3 | **RC-K** — add `synth.resume()`, mic indicator | 5 | S |
| 4 | **RC-B** — recognition restart + mic gating | 4 | M |
| 5 | **RC-I** — wire + guard mapping | 5 | S |
| 6 | **RC-N** — sequential utterances | 2 | S |
| 7 | **RC-D** — composite-key dedupe | 2 | M |
| 8 | **RC-A** — token classifier + SSML | **9** | M |
| 9 | **RC-C** — port grouping (customer-safe key) | **8** | L |
| 10 | **RC-L** — add note / carrier columns | 4 | — |

Steps 1–3 are small and close **15 issues**.
