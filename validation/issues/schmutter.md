# Schmutter — Issue Analysis (14 issues)

**Issue tab:** `Schmutter` · German packlist station
**Data sheet:** [`1QsxHvee…`](https://docs.google.com/spreadsheets/d/1QsxHveeHDoZE_QJ4aOpRzcuvzAh1MFUZb3xWkmVw1gA/edit?gid=2036049509)
**Script:** [`scripts/Schmutter speak tool/`](../../scripts/Schmutter%20speak%20tool/) — `Lithursan.gs` **948 L (has grouping)** · `cleaned.gs` **263 L (no `RPR44WH` removal)**

> ℹ️ **Schmutter and Kronen file the same tickets but run different speak-tool versions.** Schmutter
> can group orders (948 L); Kronen cannot (703 L). Issue #14 asks for merge-order changes across
> *"all German packlists"* — that is **two different code fixes**, not one.

| | Count |
|---|---:|
| Total issues | **14** |
| Sheet says Done | 5 |
| Sheet says Open | 7 |
| Sheet untriaged | 2 |
| ✅ **Verified fixed** | **2** |
| ⚠️ Unverified | 2 |
| ❌ **Proven not fixed** | **10** |

`- [x]` = verified fixed · `- [ ]` = not fixed

---

## 09/07/2025

- [x] **#01 · Activation process takes time — please simplify** — `Done` ✅
  Now a single menu item → modal (`cleaned.gs:3-6`). Resolved.
- [ ] **#02 · Packlist needs more detail (listing image, listing title)** — `OPEN` *"not possible for this"* ❌ **← should be re-opened**
  **This is possible.** `Title` is populated **140/140** and `Image URLs` **140/140**, and both are already rendered in the modal (`Lithursan.gs:220`, `:238`). This is a packlist-template change, not an impossibility.
- [ ] **#03 · Reducer plate name not mentioned when ordering only a lamp shade** — `Done` ⚠️
  **Different cause here than at Unit 3 Lampshade / Unit 4.** This station's `cleaned.gs` is the **263-line** version, which does **not** contain `removeRPR44WHAndTransferPostCode()` — so the row is not deleted. The likely cause is a missing name in the names master sheet (**RC-M**). Needs a live check.
- [ ] **#04 · Requires speaking twice and takes time — needs one attempt** — `Done` ⚠️ **RC-N**
  Two readings: the *voice command* needing two attempts (**RC-B** — `:886-887` `stop()`+`start()` throws) or the *utterance* being duplicated (**RC-N** — proven in Unit 3 Others by screenshots P6/P8). Both are live. Needs a live run to confirm which the reporter meant.
- [ ] **#05 · Merged orders need to be shown as a single view** — `OPEN` *"not possible for this"* + **"We need to find a way by MD"** ❌ **RC-C**
  Escalated to the managing director. **It is possible.** Grouping exists in this station's script; what is missing is the data — `Merge Order` is populated on **6 of 140 rows**, so there is almost nothing to group by. Fix: compute a merge key from **customer + normalised address** during cleaning.
- [x] **#06 · Two separate buttons — product details and label number** — `Done` ✅
  The `📍Postcode` button exists as a separate control (`Lithursan.gs:459`), correctly separated because the label number is only confirmed after packing.

## 10/07/2025

- [ ] **#07 · Sometimes the label number is not mentioned** — `Done` ❌ **RC-D**
  The postcode/label is blanked by `cleaned.gs:167-169`, which compares only the adjacent cell with no customer check. Live fill rate: Post Code 109/140.

## 01/09/2025

- [ ] **#08 · Postcode first number 0 not showing** — `Untriaged` ❌ **RC-F**
  `cleaned.gs:27` uses `getDataRange().getValues()`. **`getDisplayValues()` appears nowhere in the codebase.** `getValues()` returns a numeric-formatted cell *as a number*, so a German postcode `00049` arrives as `49`. **One-word fix.**
- [ ] **#09 · Sometimes speaks a wrong number like 53881** — `Untriaged` ❌ **RC-F**
  Same cause as #08 — a 5-digit German postcode is coerced to a number and then read as a cardinal.

## 03/09/2025

- [ ] **#10 · Quantity not show** — `OPEN` ❌ **RC-E**
  **Screenshot P13 is direct proof:** the quantity badge renders "**X**" with no number, on combo SKU `CRSF100BM+WSLS155BM`. A combo SKU is not in the names sheet, so the lookup fails, and `cleaned.gs:116` (`if (!name) quantity = '';`) blanks the quantity. Fix: never blank quantity; fall back to spelling the SKU.
- [ ] **#11 · Post code 00049** — `OPEN` ❌ **RC-F**
  **Screenshot P14 is definitive:** an Italian address (Velletri, **00049** Italy) is displayed as **`49`** and spoken "4 9". Exactly the `getValues()` leading-zero bug from #08.

## 04/09/2025

- [ ] **#12 · Merge single order** — `OPEN` ❌ **RC-C** — `Merge Order` 6/140. See #05.
- [ ] **#13 · Not add merge** — `OPEN` ❌ **RC-C** — as #12.

## 15/09/2025

- [ ] **#14 · Merge-order update needed for all German packlists (Kronen & Schmutter)** — `OPEN` ❌ **RC-C**
  ⚠️ **Two different fixes.** Schmutter runs the 948-line script (grouping present, data missing). Kronen runs the 703-line one (**no grouping at all**). Kronen needs the grouping ported first; Schmutter only needs the merge key. Ship them together but do not assume one patch covers both.

---

## Screenshot evidence for this station

| Ref | Row | Shows |
|---|---|---|
| **P13** | r12 | Quantity badge showing "**X**" with no number — issue #10. |
| **P14** | r13 | Italian postcode **`00049` → `49`**, spoken "4 9" — issue #11. Also shows `international` **being spoken** on this station, unlike Unit 3 Lampshade. |

5 further screenshots on this tab are extracted but not yet read.

> **Note from P14:** on Schmutter the word `international` *is* spoken (`international : : 36 wide
> shade Brushed Copper :: 5 : Post Code: 4 9`), while on Unit 3 Lampshade (**P12**) it is only
> displayed. The two stations handle `Status` inconsistently — worth one check when fixing **RC-J**.

---

## Root causes for this station

| RC | Issues | Count |
|---|---|---:|
| **C** — merge data missing | 5, 12, 13, 14 | **4** |
| **F** — leading zeros destroyed | 8, 9, 11 | **3** |
| **E** — quantity blanked | 10 | 1 |
| **D** — postcode dedupe | 7 | 1 |
| **N / B** — spoken twice / two attempts | 4 | 1 |
| **M** — names sheet | 3 | 1 |
| re-open (data already exists) | 2 | 1 |
| resolved | 1, 6 | 2 |

## Fix order for Schmutter

| Step | Fix | Closes | Effort |
|---:|---|---:|---|
| 1 | **RC-F** — `cleaned.gs:27` → `getDisplayValues()` | **3** | **XS** |
| 2 | **RC-E** — `cleaned.gs:116` never blank quantity | 1 | XS |
| 3 | **RC-D** — composite-key postcode dedupe | 1 | M |
| 4 | Re-open #02 — add listing image + title to the packlist template | 1 | S |
| 5 | **RC-C** — merge key from customer + address | **4** | L |
| 6 | Confirm #03 and #04 on a live run | 2 | XS |

**Step 1 is a single word and closes three issues** — the highest-value change available at this
station.
