# Unit 3 Lampshade — Issue Analysis (23 issues)

**Issue tab:** `Unit 3 Lampshade`
**Data sheet:** [`1AMQMzxu…`](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0)
**Script:** [`scripts/Unit 3 Lampshade/`](../../scripts/Unit%203%20Lampshade/) — `Lithursan.gs` **948 L (has grouping)** · `cleaned.gs` **296 L**

> ⚠️ **Every one of the 23 is untriaged.** The tab was opened 01/08/2025 and no status was ever set
> in the "Correction made by Lithurshan" column. They are all outstanding in practice.
>
> ℹ️ This station **can** group orders — but its grouping keys on the combo-SKU string alone, which
> is what causes #13 and #21. See the warning at the end.

| | Count |
|---|---:|
| Total issues | **23** |
| Sheet says Done | 0 |
| Sheet says Open | 0 |
| Sheet untriaged | **23** |
| ✅ **Verified fixed** | **0** |
| ⚠️ Unverified / blocked | 3 |
| ❌ **Proven not fixed** | **20** |

`- [x]` = verified fixed · `- [ ]` = not fixed

---

## 01/08/2025

- [ ] **#01 · Everything changed in Unit 4 must also be changed in Unit 3** — `Untriaged` ❌
  Sheet note: *"Sheet copied from Unit 4."* Six independent script copies, propagated by hand. Confirmed drift: this station runs the **948-line** speak tool while Unit 4 runs the **703-line** one. Fix: one shared Apps Script library with per-station config.

## 06/08/2025

- [ ] **#02 · QR sollanum (must say QR)** — `Untriaged` ❌ **RC-D**
  `cleaned.gs:190` clears column F (**Instruction QR**) wherever the postcode is blank — and `:167-169` blanks postcodes by adjacency. **Deleting a postcode silently deletes the QR.** Live fill rate: QR 5/140.
- [ ] **#03 · Reducer plate sollanum** — `Untriaged` ❌ **RC-H**
  `cleaned.gs:280-288` **deletes the `RPR44WH` row entirely** (`continue`). `RPR44WH` is the white reducer plate. Fix: keep it as a component of its parent order.
- [ ] **#04 · Nextday sticker sollanum** — `Untriaged` ⚠️ **RC-L** — no carrier/sticker column in `Sheet1`. Blocked upstream.
- [ ] **#05 · BB4 4JY — mount must not appear, packlist item must (Mapping)** — `Untriaged` ❌ **RC-I**
  `replaceComboSKUsInPlace()` is never called, and the names sheet has no `SKU.1` / `Mapping SKU` columns → guaranteed no-op.
- [ ] **#06 · Merge order — everything packed before the postcode** — `Untriaged` ❌ **RC-C**
  The postcode must come **last and once** for the whole parcel. Currently `cleaned.gs:167` may blank it entirely.
- [ ] **#07 · BS39 4NN — mount must not appear (Mapping)** — `Untriaged` ❌ **RC-I** — as #05.
- [ ] **#08 · Free bulb shouldn't come first in the packlist** — `Untriaged` ❌ **RC-C**
  No pack-sequence concept exists. Fix: add a `pack_sequence` rank (bulb 10 → accessories 30 → shade 90) and order components by it.

## 08/08/2025

- [ ] **#09 · All colour shades should come together — picking one by one is hard** — `Untriaged` ❌ **RC-C**
  **Screenshot P9** shows a packlist with ~12 colour variants at x1 each (`LSFT220YE / BL / GR / OR / WH`…) scattered across the grid. Fix: group variants of the same base product.
- [ ] **#10 · CRFF2008BM / CBFF200BM accessories should come together** — `Untriaged` ❌ **RC-C** — as #09.

## 13/08/2025

- [ ] **#11 · Bulb first, then shade** — `Untriaged` ❌ **RC-C** — same `pack_sequence` fix as #08.

## 19/08/2025

- [ ] **#12 · QR sollala (QR not being said)** — `Untriaged` ❌ **RC-D** — recurrence of #02. Same cascade.
- [ ] **#13 · Same-postcode customer makes it look like a merge order — (Important)** — `Untriaged` ❌ **RC-D + RC-C-collision**
  Marked **Important** by the reporter. Two faults combine:
  1. `cleaned.gs:167-169` blanks a postcode whenever it matches the row above, with **no customer check**.
  2. `Lithursan.gs:60-72` groups on the combo-SKU string **alone**, so two customers who bought the same combo merge into one spoken order.
  **Proven against live data:** 4 of 35 group keys in this sheet are shared by more than one customer. Fix: composite key — combo SKU **+ customer + postcode**.
- [ ] **#14 · Names master sheet change didn't take effect** — `Untriaged` ❌ **RC-E**
  The sheet **is** read live (`cleaned.gs:13-15`) — nothing was lost that way. The fault is the lookup key one line down: `:112` `slice(0,-3)` strips **3** characters to remove a **2**-character `"PK"`. **Screenshot P11** shows the sheet mid-edit. Fix: `rawSku.replace(/\d+PK$/, '')`.
- [ ] **#15 · Merge order must come fully** — `Untriaged` ❌ **RC-C**
  `Merge Order` is populated on **6 of 140 rows** — there is almost nothing to group by. Fix: compute a real merge key during cleaning.

## 20/08/2025

- [ ] **#16 · Remaining products don't get the free bulb / half-ting holder** — `Untriaged` ❌ **RC-C** — grouping.
- [ ] **#17 · Different postcodes for these 2 combo orders** — `Untriaged` ❌ **RC-H**
  `cleaned.gs:282-287` scans **backwards** for "the nearest row above with an empty Post Code" and writes the deleted row's postcode there — which can attach a postcode to an unrelated earlier order.
- [ ] **#18 · LDMG125E278** — `Untriaged` ⚠️ **RC-M** — name missing from the names master sheet.

## 27/08/2025

- [ ] **#19 · Note speak pannanum (the note must be spoken)** — `Untriaged` ⚠️ **RC-L**
  No customer-note column in `Sheet1`. **⚠️ Conflicts with Unit 4 #55**, which asks for the note to be *shown but not spoken*. Needs a decision from Varmen, or a per-station setting.
- [ ] **#20 · QR said for some, not for others** — `Untriaged` ❌ **RC-D**
  The *"for some but not others"* pattern is exactly the `:190` conditional — QR survives only where the postcode survived.
- [ ] **#21 · RMI order and the 2-4 1st order came merged** — `Untriaged` ❌ **RC-C-collision**
  Two unrelated orders spoken as one. Same root cause as #13 from the opposite direction: #13 falsely merges *different customers*, #21 falsely merges *unrelated orders*. Both are the combo-SKU-only group key.

## 29/08 – 25/09/2025

- [ ] **#22 · Shade must come last** — `Untriaged` ❌ **RC-C** — `pack_sequence`; see #08, #11.
- [ ] **#23 · Activate speak postcode — urgent** — `Untriaged` ❌ **RC-D**
  Postcode blanked by the adjacency dedupe. Live fill rate: **109/140 — 22 % of rows have no postcode at all.**

---

## Screenshot evidence for this station

| Ref | Row | Shows |
|---|---|---|
| **P1** | r52 (pair) | Speak tool says one item + "x 1"; packlist has **two** components (`CRFF75CO` + `HK10CO`). Packlist also carries `250 G LABEL`, `RM Packlist L u3` — none spoken. |
| **P9** | r11 | ~12 colour shades at x1 each, scattered — issue #09. |
| **P10** | r24 | **Two Amazon orders, same customer, same postcode UB8 1LB** — the merge case behind #13 / #15 / #21. |
| **P11** | r28 | Names master sheet mid-edit (`PSDS2RBM`) — issue #14. |
| **P12** | r66 | The tool speaking **`merge order total: 5 : merge order: 1`** — the wording Unit 4 #59 objects to. `international` shown in red but **not spoken**. German address (35781 Weilburg) with an `en-US` voice. |

10 further screenshots on this tab are extracted but not yet read.

---

## Root causes for this station

| RC | Issues | Count |
|---|---|---:|
| **C** — no / wrong grouping | 6, 8, 9, 10, 11, 15, 16, 21, 22 | **9** |
| **D** — postcode dedupe → QR cascade | 2, 12, 13, 20, 23 | **5** |
| **I** — mapping dead | 5, 7 | 2 |
| **H** — `RPR44WH` deletion + backward scan | 3, 17 | 2 |
| **L** — column absent | 4, 19 | 2 |
| **E** — pack-suffix lookup | 14 | 1 |
| **M** — names sheet | 18 | 1 |
| — estate / six copies | 1 | 1 |

## Fix order for Unit 3 Lampshade

| Step | Fix | Closes | Effort |
|---:|---|---:|---|
| 1 | **Triage all 23** — nothing here has ever been given a status | — | XS |
| 2 | **RC-E** — `cleaned.gs:112` pack-suffix regex | 1 | XS |
| 3 | **RC-D** — decouple QR from postcode (`:190`), composite-key dedupe (`:167`) | **5** | M |
| 4 | **RC-I** — wire + guard the mapping | 2 | S |
| 5 | **RC-H** — keep the reducer plate; drop the backward scan | 2 | M |
| 6 | **RC-C** — merge key from customer+address; `pack_sequence` ordering | **9** | L |
| 7 | **RC-L / RC-M** — note column, missing names | 3 | — |

⚠️ **This station already has grouping — do not port it elsewhere as-is.** Its group key is the
combo-SKU string alone, which is precisely what causes #13 and #21. Fix the key here **before**
copying the grouping to Unit 3 Others, Unit 4, Kronen and Person 2.
