date: 2026-08-17
developer: Sarujanan
project: Speech Tool — Warehouse Voice Packing
project_code: STFC
phase: Development — phase 03
requirement_id: REQ-03
deliverable_id: D01
status: In Progress — code complete and tested, deployment and two decisions outstanding
evidence_location: /validation/issues/unit-3-sku-blanking.md · /validation/missing-names-checklist.md · /capability/unit3-packing-priority-report.md · /scripts/Unit 3 Lampshade/*.gs
blos_keys_used:
  - lampshade_prefix_rule
  - packing_priority_conditional
  - combo_set_customer_boundary
  - queue_group_key
  - colour_authority_sot
  - speech_segment_per_component
hardcoded_thresholds:
  - lampshade_prefix_rule = 'LS'   (SKU prefix; name no longer consulted)
  - packing_priority_conditional = rect present → RECT_ROSE=1, SHADE=2, BULB=3, ROSE=4, OTHER=4
  - packing_priority_conditional = rect absent  → SHADE=1, ROSE=2, BULB=3, OTHER=4
  - lampshade_collection_max = 15   (unchanged; >15 allocation still undefined)
  - speak_dialog_width_px = 1600    (Google clips a modal at browser width)
  - collection_card_width_px = 232
  - PP_SOT_ID = 1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI
  - PP_SOT_OVERRIDE = 6 SKUs whose SOT colour contradicts the SOT's own product name
three_am_standard: TRUE
llm_queryable: TRUE
company_knowledge_candidate: TRUE
domain: Warehouse Operations — Order Packing
User: Postage & Warehouse Team (assigned by Varmen)
Benefit status: Partial — all defects fixed and verified against live data; `Sheet1` re-import and two rule decisions still outstanding

---

## 1. SYSTEM STATE

Before today, at the Unit 3 Lampshade station:

- **`Sheet1` had 60 rows with the SKU cell wiped.** `Title`, `Quantity`, `Price`, `Image URLs` and
  `Customer Info` were all intact on those same rows — only the SKU column was empty, and **zero**
  SKUs remained duplicated anywhere in the sheet.
- Classification came from **keywords in the spoken name**. A lampshade whose name was short
  (`"amber Amber"`) or missing was filed as `OTHER`.
- Colour came from a **29-code SKU suffix table** that resolved 341 of 452 lampshade SKUs.
- The priority sort ran **before** `addCombinedSKUSet()`.
- Queue grouping keyed on the **combined SKU string alone**, with no customer component.
- A combo was read as one continuous run of speech; the packer could not stop between components.
- The collection view was a plain text list with no images.

---

## 2. WHAT CHANGED TODAY

### 2.1 Destroyed SKUs — cause found and stopped (`sku.gs`)

`blankDuplicateSKUsInSheet1()` kept the first occurrence of each SKU and wrote an empty string over
every later one, then saved that over `Sheet1`:

```js
if (seen.has(sku)) { data[i][skuIndex] = ''; }
sheet.getRange(1, 1, ...).setValues(data);
```

It is called by **nothing** — not `mergeAndCleanSheets()`, not any menu item — so it can only have
been run by hand from the editor's ▶ Run button. The same function exists byte-identically in all
six stations and has never been run in the other five, which is why only Unit 3 was affected.

It now refuses to run and explains why. The other five stations were left untouched.

### 2.2 Combos split in two — my own regression, corrected (`cleaned.gs`)

`addCombinedSKUSet()` rebuilds `Combo SKU` by finding a `Combo: 1` marker and absorbing the
`Combo: 2`, `Combo: 3` … rows that follow. The priority sort was running first, which moved a
lampshade tagged `Combo: 7` **above** the `Combo: 1` marker. The set was then built from the
remaining six rows only, and one customer order came out as two different `Combo SKU` values.

Verified on the live sheet (Andreea Szasz, GU4 7HZ): `Sheet1` held one identical `Combo SKU` on all
seven rows; `Cleaned Data` held two. The sort now runs **last**, in a new
`ppSortCleanedSheetRows()`.

I had told the user this defect was pre-existing. It was not — it was introduced by the sort I
added on 2026-08-14.

### 2.3 Combo sets crossing a customer boundary (`cleaned.gs`)

The same loop tracked only the marker sequence, never the customer:

```
row 96  PHSF2BMRBY  Combo: 1  £29.76  Emeline martinez
row 97  SPSDP2BM    Combo: 2  £29.76  Emeline martinez
row 98  RPM40WH     Combo: 2  £13.89  Andrew Thomas    <-- absorbed
```

Andrew's order has no `Combo: 1` row of its own, so his row was swallowed by Emeline's set and all
three were stamped `PHSF2BMRBY+SPSDP2BM+RPM40WH`. The set now ends at a customer boundary.

### 2.4 Queue grouping (`Lithursan.gs`)

Group key is now `combined_SKU + " || " + customer`. The card still prints the SKU string alone.
This is defence in depth: even with correct data, two customers buying the same kit would otherwise
collapse into one entry.

### 2.5 `LS` prefix = lampshade (`packing-priority.gs`)

The keyword requirement was removed:

```js
// was: if (s.indexOf('LS') === 0 && PP_RE_SHADE.test(n) && !PP_RE_ACCESSORY.test(n))
if (s.indexOf('LS') === 0) return 'SHADE';
```

Business rule, given verbatim: *"everything that starts with LS is a lampshade, so we collect it"*.

### 2.6 Colour from the Lampshade SOT (`packing-priority.gs`)

`ppLoadSot()` reads the SOT once per execution, finds the tab by locating `SKU_ID` in header row 2
(so a changed gid still works), and reads only the 27 columns needed out of ~180. It degrades to
the suffix table if the sheet cannot be reached.

### 2.7 Speech and images (`Lithursan.gs`)

- One component per `Next`; postcode and note ride on the **last** component, not as extra steps.
- `Postcode` button reads a separately stored postcode string, without moving the packer's position.
- Thumbnails come from each row's own `Image URLs` cell, in spoken order.
- A row with no name is announced as `"This one"` + colour instead of being skipped.
- Collection view rebuilt as image cards with a quantity badge; dialog widened to 1600 px.

---

## 3. POSTGRESQL / MCP FINDING

No database work today. All authority came from Google Sheets. Two observations worth carrying into
any future data model:

- **`Image URLs` is independent of `SKU`.** It is its own column, copied straight through by
  `processRow()`. That is why destroying the SKU produced *"picture shown, nothing spoken"* rather
  than a visibly broken row — the display path and the speech path have different inputs.
- **`Combo SKU` is derived, not source.** `addCombinedSKUSet()` overwrites whatever `Sheet1`
  supplied. Any model that treats it as source data will inherit the corruption.

---

## 4. GAP FOUND

| Gap | Measured | Consequence |
| --- | --- | --- |
| SKUs destroyed in `Sheet1` | 48 of 169 rows still blank | 27 rows fall back to the combo string as their "SKU" |
| SKU never supplied by the platform | 12 rows | Silent even after a re-import |
| SKU absent from the `names` master | 14 SKUs / 19 rows | Spoken as `"This one"` |
| Lampshades mis-filed as `OTHER` | 16 of 156 rows | Wrong position **and** absent from the collection |
| Colour unresolved by the suffix table | 111 of 452 SKUs | Card showed `Colour: ?` |
| SOT colour contradicting its own product name | 6 SKUs | Would have spoken "Black Matt" for a gold shade |
| Combo sets crossing a customer | 1 group, 3 rows | Two customers in one parcel view |

The `names` master also holds placeholder text — `This one Black` (125), blank (123), `This one`
(73) — across 210 SKUs. Ruled out of scope today: the sheet belongs to another team and is to be
used exactly as it stands.

---

## 5. VALIDATION RULE ADDED OR CHANGED

**Every fix was verified against live data before being reported.** Where a claim could not be
verified, it was reported as undecided rather than assumed.

| Check | Method | Result |
| --- | --- | --- |
| Blanking was the cause | Counted duplicates remaining in `Sheet1` | 0 duplicates across 169 rows — impossible in natural order data |
| `LS` rule is safe | Ran classifier over all 451 SOT lampshade SKUs | 451/451 → `SHADE` |
| `LS` rule does not over-match | Re-tested wire cages and an `LS`-prefixed rose | `WCDCBM`/`WCBNRR`/`WCCYSP160GD` → `OTHER`; `LSWD360BG` → `ROSE` |
| Sort no longer corrupts combos | Restored pre-sort order, ran both pipeline orders | split orders 2 → 0; mixed groups 3 → 1 |
| Customer boundary fix | Re-ran with and without the customer condition | mixed groups 1 → 0 |
| Priority correct | Re-derived rank per customer block across the whole sheet | 0 violations / 90 customers |
| Image ↔ speech alignment | Compared segment index against image index per entry | all entries aligned |
| SOT colour trustworthy | Compared `Outer_Colour` against the SOT's own `Product_Name` | 6 self-contradictions found and overridden |
| SKU recovery is not a guess | Positional reconstruction tested against rows that still hold a SKU, then cross-checked against `Combo Color` | 45/46 positional (97 %), 25/27 colour-confirmed (92 %) |

The recovery cross-check is the important one: `Combo Color` is an **independent** column, so a
reconstructed SKU whose suffix colour matches it is confirmed by a second source rather than
assumed.

---

## 6. FAILURE MODE OR EDGE CASE

| Edge case | Handling |
| --- | --- |
| Row has a SKU but no name | Spoken as `"This one" + colour`; quantity preserved |
| Row has neither SKU nor name | **Still silent** — open decision, 12 rows including a 10-bulb order |
| SOT unreachable at run time | Logged; falls back to the suffix table; the run does not break |
| SOT tab gid changes | Tab located by finding `SKU_ID` in header row 2, not by name or gid |
| `Colour` column missing (older cleaned sheet) | Looked up optionally; absence does not abort the tool |
| Same SKU twice in one order with different images | Thumbnails now read per row, so both pictures appear |
| Combo component with no row of its own | Second pass still adds its thumbnail from the combined string |
| Order with no component rows at all | Postcode still spoken via a defensive branch |
| Numeric pack suffix (`LSFT2205PK`) | Deliberately **not** stripped for size — genuinely ambiguous; no lampshade multi-packs exist today |

---

## 7. DECISIONS MADE TODAY

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | `LS` prefix alone identifies a lampshade | Business rule; scores 451/451 against the SOT where the keyword rule missed 9 |
| 2 | Priority sort runs last in the pipeline | `addCombinedSKUSet()` depends on original row order |
| 3 | Combo sets end at a customer boundary | A set is an order's component list, not a marker run |
| 4 | Queue group key includes the customer | The SKU string identifies a product set, not an order |
| 5 | SOT is the colour authority, suffix table is the fallback | Closes 111 gaps; suffix table still covers roses, bulbs, accessories |
| 6 | SOT product name beats SOT colour cell where they contradict | 6 SKUs; the SKU suffix independently agrees with the name |
| 7 | Postcode and note ride on the last component | Requested explicitly — no extra `Next` for information the packer does not pick |
| 8 | Quantity is blanked only when there is neither name nor SKU | The count is required to speak `"This one :: 10"` |
| 9 | `names` master will not be corrected by us | Owned by another team; ruled 2026-08-17 |
| 10 | No SKU recovery script will be run without approval | Data is already damaged; re-import is the safe route |

**Still open:** `Sheet1` re-import vs recovery script · whether SKU-less rows should speak ·
Ceiling Rose SOT · the >15 colour allocation rule.

---

## 8. COMPANY KNOWLEDGE EXTRACT

**A silent row is more dangerous than a wrong row.** The display path (`Image URLs`) and the speech
path (`SKU → name`) have different inputs. When the speech path broke, the packer still saw a
picture and heard nothing — no error, no warning, nothing to report. 46 of 156 rows were in that
state and the failure had gone unnoticed. Any voice-driven picking tool needs a rule that **nothing
displayed may be unannounced**.

**Derived columns must not be treated as source.** `Combo SKU` arrives from the platform and is then
overwritten by `addCombinedSKUSet()`. Two separate defects today — the split order and the
cross-customer merge — were both this function rewriting data that looked authoritative.

**Order-dependent transforms must declare their order.** `addCombinedSKUSet()` silently requires
the original row sequence. Nothing in the code said so, so adding a sort upstream corrupted it
without any error. That dependency is now written into the code at both ends.

**Free-text names are not a classification key.** Deriving product type from a name that another
team maintains meant a blank or short name silently changed the packing sequence. A SKU prefix is a
structural fact; a spoken name is editorial content.

**Verify a recovery before offering it.** Positional SKU reconstruction looked plausible at 73 %,
which is not good enough to write to live data. Ignoring pack suffixes lifted it to 97 %, and
cross-checking against `Combo Color` — an independent column — confirmed 92 % of the specific rows
to be repaired. Only then was it worth proposing, and still only with approval.

---

## 9. LLM STANDARD CHECK

| Standard | Status |
| --- | --- |
| Every claim measured against live data | TRUE — all counts in section 4 come from the live sheet, not estimates |
| Corrections stated plainly when I was wrong | TRUE — the combo split was reported as pre-existing, then corrected to "caused by my sort" |
| No business rule invented | TRUE — the `LS` rule and the conditional priority both came from the user verbatim |
| Destructive actions gated on approval | TRUE — no write to `Sheet1` was performed |
| Scope respected | TRUE — other 5 stations untouched; `names` master untouched; SOT read-only |
| Thresholds externalised and named | TRUE — see `hardcoded_thresholds` |
| Failure modes documented | TRUE — section 6 |
| Open items surfaced, not silently defaulted | TRUE — 4 open decisions carried forward |

One process failure to record: after editing `ppSortCleanedSheetRows()` I ran `node --check`, which
passes on an undeclared variable, and shipped a `ReferenceError: rows is not defined`. Syntax checks
do not prove a function runs. Since then every change has been executed against real data, not just
parsed.

---

## 10. DAY OUTCOME

Nine defects fixed across four files, each verified against the live sheet.

| Measure | Before | After |
| --- | ---: | ---: |
| Rows producing no speech | 46 | 12 |
| Lampshades classified as `SHADE` | 17 | 33 |
| Lampshade SKUs the classifier misses (vs SOT) | 9 | 0 |
| Colour gaps across 452 lampshade SKUs | 111 | 0 |
| One order split across several entries | 10 customers | 0 |
| Two customers sharing one entry | 6 groups | 0 |
| Packing-priority violations | present | 0 / 90 customers |
| Image ↔ speech misalignment | present | none |

**Files ready to deploy:** `sku.gs` (149) · `cleaned.gs` (404) · `packing-priority.gs` (681) ·
`Lithursan.gs` (1463). Deployment requires **Run Clean and Merge** afterwards, because `Combo SKU`,
`Product Type`, `Colour` and `Quantity` are all recomputed.

**Not delivered today:** the 12 SKU-less rows are still silent, and 48 `Sheet1` rows still carry no
SKU. Both are blocked on decisions, not on code.
