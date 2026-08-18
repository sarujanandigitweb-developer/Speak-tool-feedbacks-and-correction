date: 2026-08-13
developer: Sarujanan
project: Speech Tool — Warehouse Voice Packing
project_code: STFC
phase: Discovery — phase 01
requirement_id: REQ-01
deliverable_id: D01
status: Completed
evidence_location: /validation/discovery-report.md · /validation/issues/ · /evidence/feedback-register.csv · /documentation/02-code-walkthrough.md
blos_keys_used:
  - speak_tool_station_count
  - feedback_items_total
  - lampshade_collection_max
hardcoded_thresholds:
  - pack_suffix_strip_length = 3   (WRONG — "PK" is 2 chars; found in cleaned.gs:112)
  - cable_sku_prefix = "CL"        (cleaned.gs:118 → appends " meter")
  - reducer_plate_sku = "RPR44WH"  (cleaned.gs:280 — a product SKU hardcoded in shared logic)
  - names_master_sheet_id = "16rx5Dz…"  (duplicated in cleaned.gs:14 and sku.gs:53)
  - default_voice = "Google US English" / utter.lang = "en-US"  (hardcoded, wrong for DE stations)
  - speech_rate_default = 0.7      (labelled "Normal" but is 0.7×, not 1×)
three_am_standard: TRUE
llm_queryable: TRUE
company_knowledge_candidate: TRUE
domain: Warehouse Operations — Order Packing
User: Postage & Warehouse Team (assigned by Varmen)
Benefit status: Pass — analysis completed, no code changed

---

## 1. SYSTEM STATE

The Speech Tool is a Google Apps Script **HTML Service modal**, opened from a custom spreadsheet
menu, that reads the day's order queue aloud through the **browser Web Speech API** and accepts
voice commands to move through it.

Before this day's work, the following were unknown or assumed:

- Which architecture the tool actually uses.
- Whether all 6 stations run the same code.
- Why issues marked "fixed" kept being re-reported.
- Which layer (sheet data vs Apps Script) each defect belonged to.

Existing behaviour established as-is:

- `Sheet1` (raw platform import, 169 rows × 17 cols) → `Cleaned Data` (140 rows × 18 cols).
- Each product carries **two names**: the marketplace `Title` (never spoken) and a phonetic `Name`
  from the shared names master sheet (spoken).
- Voice commands supported: `next / forward / go on`, `back / prev / previous`,
  `respeak / again / repeat`, `postcode / post code`, `restart / start`.
- No `stop` and no `pause` voice command exists.

---

## 2. WHAT CHANGED TODAY

**No code was changed.** This day produced analysis artefacts only.

What was produced:

- Extracted all **160 feedback items** from the 6 station tabs into a normalised register with
  assigned IDs (`FB-001`…), because the workbook's own `Ref` column is empty on all 160 rows.
- Fingerprinted every station's Apps Script by md5 to measure version drift.
- Profiled column fill rates in `Cleaned Data` to quantify data gaps.
- Extracted all **47 screenshots** embedded in the feedback workbook and read 16 — every image pair
  and every row whose issue text was blank, because on those rows the picture *is* the ticket.
- Tested two "can the tool read the wrong order?" hypotheses against live data.

---

## 3. POSTGRESQL / MCP FINDING

Not applicable — this project has **no database**. The system of record is Google Sheets.

Equivalent structural findings (schema-level understanding of the sheet model):

- `Sheet1.Address` is named "Address" but contains **only the postcode**. The real address sits
  inside the free-text `Customer Info` blob.
- `Cleaned Data` carries **duplicate headers**: `Component` at cols I and P, `Send Order Instruction`
  at cols O and Q. Column resolution is **first-match-wins**, so P and Q are silently ignored.
- Cols P, Q, R are **leftovers from a double write** — `Merge SKU.gs:58` writes 18 columns, then
  `cleaned.gs:153` overwrites only the first 15.
- `SKU Combined` (col R) is a leftover, yet `Lithursan.gs:25` lists it in `neededColumns` and
  **aborts if it is missing** — the tool formally depends on an undocumented side-effect.
- There is **no unique order identifier anywhere in the system.** Order identity is inferred.
- The names master sheet holds 16,228 rows / 5,548 distinct SKUs in only 2 columns (A = SKU,
  B = Name). **Columns C–Z are empty** — free space for future structured attributes.

Measured fill rates (Unit 3 Lampshade `Cleaned Data`, 140 rows):

| Column | Filled | Note |
| --- | ---: | --- |
| Post Code | 109/140 | **22 % blank** |
| Instruction QR | 5/140 | collateral damage from postcode dedupe |
| Merge Order | 6/140 | nothing to group merges by |
| Name | 134/140 | 6 silent rows |

---

## 4. GAP FOUND

- **No product-type, colour or packing-sequence classification exists anywhere in the code.** The
  only SKU rules are a pack-suffix strip, a `CL` cable prefix, and one hardcoded SKU.
- **`Combo Color` never reaches the Speech Tool** — it exists in `Sheet1` (100/169) but is absent
  from `cleaned.gs`'s `outputHeaders`. It is also contaminated with values like
  `"MAPPED FOR ICST64E27"`.
- **The mapping feature is dead twice over.** `replaceComboSKUsInPlace()` in `test.gs` is never
  called from any menu, and even if run manually it looks for columns `SKU.1` and `Mapping SKU`
  which **do not exist** in the names master sheet → `indexOf` returns −1 → the map is always empty
  → the function silently changes nothing.
- **`Status` is displayed but never spoken.** It holds `international` (14 rows) and `firstclass`
  (5 rows) — the exact data several tickets ask for.
- **No carrier / shipping-service / customer-note column exists** in `Sheet1`, so those tickets are
  blocked upstream, not by code.
- **The 15-lampshade collection limit has no allocation rule** for totals above 15.
- **No end-of-queue state** — the queue wraps silently to row 1.
- **Cancelled orders are not skipped.** `Status` can read `plz cancel this order`; it is displayed
  in red but never filtered.

---

## 5. VALIDATION RULE ADDED OR CHANGED

No rule was implemented today. The following rules were **defined for later implementation** from
the evidence:

**Verified-status rule (applied to all 160 items):**

```
IF the code proves the behaviour still fails
THEN verified_status = PROVEN_NOT_FIXED
ELSE IF reporter confirmed OR code proves correct
THEN verified_status = VERIFIED_FIXED
ELSE verified_status = UNVERIFIED
```

Result: the sheet claims **97 Done**; the code proves only **15** are actually fixed.

**Order-identity rule (defined, not yet implemented):**

```
Order identity MUST be derived from customer name + normalised address.
Order identity MUST NOT be derived from postcode alone, and MUST NOT be derived
from the combo-SKU string alone.
```

---

## 6. FAILURE MODE OR EDGE CASE

**F1 — Orders from different customers are merged into one spoken entry.**
`Lithursan.gs:60-72` groups rows by `SKU Combined ?? Combo SKU` **alone** — no customer or postcode
check — and scans the whole sheet, not adjacent rows. Verified against live data:

| Station | Group keys | Keys spanning >1 customer |
| --- | ---: | ---: |
| Unit 3 Lampshade | 35 | **4** |
| Person 2 | 45 | **8** |

Worst case: key `LSHM400HE` is shared by **five different customers** in five different towns. The
packer is read one order and shown one customer — for five parcels. **This is a wrong-parcel risk
present in production data.**

**F2 — Postcode dedupe deletes the QR flag.**
`cleaned.gs:167` blanks a postcode when it equals the row above (adjacency only, no customer check).
`cleaned.gs:190` then clears col F wherever the postcode is blank — and col F is `Instruction QR`.
Two separate ticket threads (*"post code not shown"* and *"QR sollala"*) are **one bug**.

**F3 — A failed name lookup silences the whole row.**
`cleaned.gs:112` strips **3** characters to remove a **2**-character `"PK"` suffix. `cleaned.gs:116`
then blanks the **quantity** when the lookup fails, so the row speaks nothing at all.

**F4 — Voice recognition can die permanently.**
`Lithursan.gs:886-887` calls `stop()` then `start()` on adjacent lines; `stop()` is asynchronous so
`start()` throws `InvalidStateError`, and `onerror` only logs — it never restarts.

**F5 — The tool triggers its own commands.**
The microphone is never muted during synthesis. The tool speaks `":Post Code:"` and the matcher fires
on hearing it.

**F6 — Leading zeros are destroyed before the script sees them.**
`getValues()` is used everywhere; `getDisplayValues()` appears nowhere. A German/Italian postcode
`00049` arrives as `49`. Confirmed by screenshot on the Schmutter station.

---

## 7. DECISIONS MADE TODAY

1. **No code will be changed during discovery.** Analysis is completed and evidenced first, so that
   fixes target the correct layer.
2. **Every feedback item is given an ID** (`FB-001`…) because the workbook's `Ref` column is empty on
   all 160 rows and nothing can otherwise be closed or de-duplicated.
3. **"Done" is not trusted.** Each item is re-verified against the code, because four items marked
   Done are provably not built at all.
4. **Two "not possible" verdicts are re-opened** — merged single-view (blocked by data, not by
   feasibility) and listing image/title (the fields are already 100 % populated and already
   rendered).
5. **Station drift is measured, not assumed** — by md5 fingerprint, because tickets suggested fixes
   were landing on one station only.

---

## 8. COMPANY KNOWLEDGE EXTRACT

**K1 — "Done" without a verification step carries no information.**
Across 160 items the team recorded 97 as Done; the code proves 15. Four features (hold button,
screenshot, quantity pause, pause-resume) have complete scaffolding — variables, CSS, a loaded CDN
library — and are wired to nothing. **Any defect register must record *which version* a fix landed
in and *who verified* it, or the same defect returns.**

**K2 — A single status column that means both "not done yet" and "refused" guarantees re-reporting.**
The workbook uses `False` for both. Recommended states: Open / In progress / Fixed / Won't fix /
Blocked upstream.

**K3 — Copy-per-station is the root cause of recurring defects.**
Six independent script copies exist. Measured drift:

| File | Distinct versions |
| --- | ---: |
| `Lithursan.gs` | **4** (703 / 948 / 1288 lines) |
| `cleaned.gs` | **3** (263 / 296 / 345 lines) |

**Only 2 of 6 stations can group combo/merge orders at all.** Unit 3 Others has the *largest* file
(1,288 lines) and still has no grouping — it is a different lineage, not a newer version. This is
why "merge order should be shown fully" keeps returning marked Done: on four stations it was never
buildable.

**K4 — Two `cleaned.gs` versions differ by exactly one function.** The 296-line version contains
`removeRPR44WHAndTransferPostCode()`; the 263-line version does not. That single function explains
why identical input produces 140 cleaned rows at one station and 217 at another.

**K5 — Product identity must never be inferred from a shared attribute.** Postcode is not identity
(two customers share one). A combo-SKU string is not identity (it is a *product shape*, so every
customer who buys the same combo collides). This pattern applies to any picking or batching system.

**K6 — Search reference data for spelling variants before concluding something does not exist.**
A search for `rectang` returned no ceiling roses and led to an incorrect "does not exist" conclusion.
The data actually spells it **`Retangle`** (28 SKUs) and also uses `celing` for ceiling. **Warehouse
reference data contains systematic misspellings; classification logic must accommodate them.**

**K7 — Free columns in a shared reference sheet are the cheapest place to add governed attributes.**
The names master sheet is read live by all 6 stations on every run and uses only columns A and B.
Columns C–Z are empty and are read positionally, so appending `Product Type` and `Colour` would add
structured attributes to every station at once with no code risk.

---

## 9. LLM STANDARD CHECK

```
LLM Queryable: TRUE
Operational reasoning documented: TRUE
Edge cases documented: TRUE   (F1–F6)
Evidence linked: TRUE
Terminology consistent: TRUE  (station, group key, Cleaned Data, names master sheet)
Another developer can continue independently: TRUE
Thresholds surfaced for BLOS governance: TRUE (see hardcoded_thresholds — all pre-existing)
```

**BLOS governance note:** every threshold listed in the metadata block is **pre-existing hidden
business logic found inside code**, not introduced by this work. All six are candidates for BLOS
migration; `pack_suffix_strip_length = 3` is additionally **wrong** and is a live defect.

---

## 10. DAY OUTCOME

| Metric | Value |
| --- | ---: |
| Feedback items catalogued | 160 |
| Sheet says Done | 97 |
| **Code proves fixed** | **15** |
| Proven not fixed | 127 |
| Distinct root causes | 14 |
| Stations analysed | 6 |
| Script versions found | 4 (`Lithursan.gs`) / 3 (`cleaned.gs`) |
| Screenshots extracted / read | 47 / 16 |
| Defects found in code but never reported | 8 |
| **Files modified** | **0** |

**Discovery verdict: RED** — duplicate order sources, confirmed implementation drift, and a live
wrong-parcel risk. Implementation must not begin until the canonical order source is confirmed.
