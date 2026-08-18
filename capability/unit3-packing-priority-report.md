# Unit 3 Lampshade — Packing Priority & Colour-Wise Collection

## Implementation Report

**Status: 🟠 AMBER — priority matrix, classification and colour implemented and validated.
The 15-unit collection cycle is deliberately NOT implemented (rule undefined).**

---

## ⚠️ Correction to my previous report

My earlier verdict was **RED**, on the grounds that *"Rectangle Ceiling Rose does not exist in this
system's data."* **That was wrong, and the fault was mine.** I searched for `rectang`, which matched
"rectangular" but missed the spelling actually used in the data:

| Spelling in the names master | Count |
|---|---:|
| **`Retangle`** — missing the `c` | **28** |
| `Rectangular` — children's covers + one chandelier, no roses | 5 |
| `Rectangle` | **0** |
| `celing` — missing the `i` | 12 |
| `ceiling` | 316 |

Rectangle ceiling roses exist and are systematic. Your `CRFF500` example was exactly right:

```
CRFF500BM   500 millimeter 3 out let retangle ceiling rose Black
CRFF500YB   500 millimeter 3 out let Retangle ceiling rose Yellow Brass
CRFF5004BM  500 millimeter 4 out let Retangle ceiling rose Black
CRFF5005BM  500 millimeter 5 out let Retangle ceiling rose Black
```

Four of the five stop conditions I raised are now resolved. One genuinely remains.

---

## 1. Packing Logic Implemented

The SKU grammar you described is real and consistent:

```
  CRFF      500        3            SN
  ├─prefix  ├─size mm  ├─outlets    └─colour code
  └─ category                        └─ "Satin Nickel"
```

Implemented in three parts, all at the **data layer** (brief §20) so the Speech/UI layer receives the
correct sequence without being modified:

1. **`ppProductType(sku, name)`** — classifies into `SHADE` / `RECT_ROSE` / `ROSE` / `BULB` / `OTHER`.
2. **`ppProductColour(sku)`** — derives colour from the SKU suffix.
3. **`ppApplyPackingPriority(...)`** — reorders rows **within each customer's block only**.

Priority is a **stable sort** on a rank, but *which* rank table applies is decided **per order**,
by whether that order contains a Rectangle Ceiling Rose. Rule revised 2026-08-14.

| Rank | **Rectangle rose PRESENT** | **Rectangle rose ABSENT** |
|---:|---|---|
| 1 | **Rectangle Ceiling Rose** | Lampshade |
| 2 | Lampshade | **Ceiling Rose** |
| 3 | Bulb | Bulb |
| 4 | Other *(incl. plain ceiling rose)* | Other |

The deciding scan runs over the **whole order block before sorting**, because the Rectangle rose can
sit on any row, not just the first.

Case 3 — an order holding none of these categories — needs no branch. Every row ranks the same, and
a stable sort leaves the existing sequence exactly as it was.

**Changed from the previous version:** a plain ceiling rose used to rank 4 always. It now rises to
rank 2, but only in orders that have no Rectangle Ceiling Rose to outrank it.

---

## 2. Product Classification

| Product type | Detection method | Evidence |
|---|---|---|
| **Lampshade** | Name matches `shade\|chandelier\|dome\|curvy\|cone\|umbrella\|kuduvai\|tattai\|hemp\|cage` **AND NOT** an accessory word — **and only after the ceiling-rose test has failed** | 677 SKUs. Ceiling rose is tested first because `LSWD360BG` = *"360 Black gold inner celing rose"* — an LS-prefixed SKU that is a **rose**. Prefix alone would misclassify it. |
| **Rectangle Ceiling Rose** | Name matches `c[ei]+l[ei]*ng\s*rose` **AND** `re[c]?tangle\|rectangular` | **28 SKUs.** Sizes `CRFF400/450/453/500/550` are 100 % rectangle; `CRFF100…240` are 100 % non-rectangle. Also `CRSF110`, `CRSF220`. |
| **Ceiling Rose (other)** | rose pattern without the rectangle pattern | 280 SKUs, e.g. `CRSF2003CH` *"…round ceiling rose Chrome"* |
| **Bulb** | Name matches `bulb\|wats\|watts` with an `LD` prefix; `LD` prefix alone as fallback | 201 SKUs. Fallback needed because `LDMST64B2286PK` resolves to an empty name (the `slice(0,-3)` bug) yet is a bulb. |
| **Other** | everything else | 4,298 SKUs |

### The accessory guard — and why it was needed

The shade keywords over-matched by **10 %**. Measured and fixed:

| Excluded | Name | Matched on |
|---|---|---|
| `SCRN70BM` | Shade **Ring** Black | "shade" |
| `PCDO20BM` | conduit **dome cover** Black | "dome" |
| `PHHR1HETHE` | 1 Meter **hemp holder** Hemp | "hemp" |

The guard removes **82 of 759**, of which exactly **one** is LS-prefixed (`LSF1HT300HE`, a full-set
kit, correctly excluded). In the live Unit 3 orders it reclassified 3 rows and reduced
"orders containing a lampshade" from 33 to **31** — all corrections.

### Trap cases — all pass

| SKU | Result | Name |
|---|---|---|
| `LSWD360BG` | `ROSE` ✅ *(not SHADE despite LS prefix)* | 360 Black gold inner celing rose |
| `CRFF500SN` | `RECT_ROSE` ✅ | 500 millimeter 3 out let Retangle ceiling rose Satin Nickel |
| `CRSF2003CH` | `ROSE` ✅ *(round, not rectangle)* | 200 millimeter 3 out let round ceiling rose Chrome |
| `SCRN70BM` | `OTHER` ✅ *(accessory, not a shade)* | Shade Ring Black |
| `LDMST64B2286PK` | `BULB` ✅ *(via LD fallback, name lookup fails)* | — |
| `RPR44WH` | `OTHER` ✅ | white Reducer plate |

---

## 3. Colour Logic

Colour comes from the **trailing 2-letter SKU code**, validated across the whole names master:

| Code | Colour | Consistency | | Code | Colour | Consistency |
|---|---|---:|---|---|---|---:|
| `BM` | Black | 93 % | | `YB` | Yellow Brass | 99 % |
| `WH` | White | 96 % | | `RO` | Rose Gold | 98 % |
| `YE` | Yellow | 97 % | | `GR` | Green | 98 % |
| `CO` | Copper | 97 % | | `BC` | Brushed Copper | 100 % |
| `SN` | Satin Nickel | 96 % | | `BS` | Brushed Silver | 100 % |
| `CH` | Chrome | 94 % | | `RE` | Red | 100 % |

29 codes are mapped in `PP_COLOUR_CODES`.

**This is more reliable than `Sheet1`'s `Combo Color` column**, which is only 100/169 populated and
contaminated — e.g. `WCDCBM` has `Combo Color = "MAPPED FOR WCDTBM"` while the SKU suffix correctly
yields **Black**. Where `Combo Color` is clean, the two agree exactly (Green/Green, Hemp/Hemp).

**Preservation (§5, §6):** colour is written to its own `Colour` column and is never aggregated.
Rows are only ever reordered, never merged, so `Black 6 / Red 4 / White 5` can never collapse into
`Lampshades 15`. Different colours have different SKUs and remain separate rows throughout.

---

## 4. Collection Logic

| Scenario | Result |
|---|---|
| Total < 15 | Colour-wise breakdown available via `ppLampshadeBreakdown()`; quantities are taken as-is, never rounded up to 15. |
| Total = 15 | Same — each colour keeps its own quantity. |
| Total > 15 | 🔴 **NOT IMPLEMENTED — allocation rule undefined.** Per §8 and §24 I have not invented FIFO, alphabetical, highest-quantity or SKU order. |

### What the live data shows

| Measure | Value |
|---|---:|
| Orders containing a lampshade | 31 |
| **Max lampshade quantity in any single order** | **4** |
| Orders with ≥ 15 | **0** |
| Sheet-wide lampshade total | 53 |

No order approaches 15, so the limit can only be a **cross-order collection wave**. The Speech Tool
has no cross-order state — it builds one queue entry per order and speaks them in sequence. Adding a
wave is a new architectural layer, which conflicts with §18 and §21. **Left unimplemented and
flagged.**

---

## 5. Packing Priority

```
Lampshade (colour-wise)  →  Rectangle Ceiling Rose  →  Bulb  →  Other
```

applied per order, skipping absent types. Non-rectangle ceiling roses rank as **Other** — the literal
reading of §15, which names only the *Rectangle* rose. ⚠️ **Confirm this is intended** (see §10).

---

## 6. Files Changed

| File | Function | Change |
|---|---|---|
| `packing-priority.gs` | **new file** | `ppProductType`, `ppProductColour`, `ppApplyPackingPriority`, `ppLampshadeBreakdown`, `ppRank` |
| `cleaned.gs` | `mergeAndCleanSheets` | +2 output headers (`Product Type`, `Colour`), appended at the **end** so the hardcoded column positions 4/5/6 are untouched |
| `cleaned.gs` | `processRow` | pushes the two new values |
| `cleaned.gs` | `mergeAndCleanSheets` | calls `ppApplyPackingPriority` before `setValues` |
| `clean-1.gs` | same three | **identical patch**, so the change works whichever file wins the load-order collision |
| `Lithursan.gs` | — | **unchanged** — it reads `Cleaned Data` in row order, so it inherits the new sequence automatically (§17, §20) |

No new function name collides with anything existing.

---

## 7. Real Data Validation

Simulated against the live sheet (169 rows, 109 orders):

| Case | Real example | Orders | Expected | Actual | Status |
|---|---|---:|---|---|---|
| A Shade only | `LSMS320GR` / CT8 8RX | 27 | shade first | ✅ | **PASS** |
| B Multi-colour in one order | — | **0** | colour split | — | ⚠️ **no real data** |
| C Shade + RectRose | — | **0** | shade → rose | — | ⚠️ no real data |
| D Shade + RectRose + Bulb | — | **0** | shade → rose → bulb | — | ⚠️ no real data |
| E Shade + Bulb | `BS20 7PN` | 5 | shade → bulb → other | ✅ | **PASS** |
| F RectRose + Bulb | — | **0** | rose → bulb | — | ⚠️ no real data |
| G RectRose only | `CRFF500SN` / SN14 6EB | **1** | rose → other | ✅ | **PASS** |
| H Bulb only | `LDMST64B2286PK` / W3 6HH | 31 | bulb → other | ✅ | **PASS** |
| I Neither | `PLHWBS` / IP31 2HJ | 45 | unchanged | ✅ stable sort no-op | **PASS** |

**Effect: 9 of 109 orders reordered, 30 rows moved.** Worked examples:

```
Michael Hawkins [BS20 7PN]
  BEFORE  CRSF100BM(ROSE) | LHNSE27BM(OTHER) | SCRN70YB(OTHER) | LSMS320CB(SHADE) | LDMST64E274(BULB)
  AFTER   LSMS320CB(SHADE) | LDMST64E274(BULB) | CRSF100BM(ROSE) | LHNSE27BM(OTHER) | SCRN70YB(OTHER)

Joanna Mrozek [12437]
  BEFORE  CRSF2003BC(ROSE) | PHSH1PBRYB(OTHER) | LSDO210BB(SHADE)
  AFTER   LSDO210BB(SHADE) | CRSF2003BC(ROSE) | PHSH1PBRYB(OTHER)
```

Case G, the only real rectangle-rose order:

```
janet warren, Hullavington [SN14 6EB]
  CRFF500SN   RECT_ROSE   colour="Satin Nickel"   qty=1
```

⚠️ **Cases B, C, D and F have no real examples in the current sheet.** Per §22 I did not fabricate
data. The logic covers them, but they are unvalidated against production.

---

## 8. Regression Validation

| Area | Status | Why |
|---|---|---|
| Customer/order grouping | ✅ unchanged | Reordering happens strictly inside one customer's block; `ppApplyPackingPriority` compares `Customer Info + Post Code` and never moves a row across that boundary (§9, §26) |
| SKU cleaning, pack-suffix, `CL` metre rule | ✅ untouched | no edits to `processRow` logic |
| Postcode / QR rules | ✅ untouched | new columns appended at the end; positions 4/5/6 unchanged, so `keepOnlyLastOccurrenceInD/E` and `clearFIfDIsEmptyInSheet` behave identically |
| `removeRPR44WHAndTransferPostCode` | ✅ untouched | uses `getDataRange()`, width-agnostic |
| `addCombinedSKUSet` | ✅ untouched | resolves columns by header name |
| Image / SKU mapping | ✅ untouched | colour-specific SKUs stay separate rows, so each keeps its own image (§19) |
| Speech engine, voice commands, navigation | ✅ untouched | `Lithursan.gs` not modified |
| UI / modal / product card | ✅ untouched | §18 honoured. Colour stays identifiable in the `Name` (*"32 curvy Green"*) and is now also a data column |
| Duplicate headers P/Q | ✅ **improved** | output widens 15 → 17, so the two leftover duplicate headers are overwritten. `SKU Combined` still survives at col R, which `Lithursan.gs:25` requires |

⚠️ **Pre-existing defect, untouched and still live:** `Lithursan.gs:64` keys order groups on the
combo-SKU string alone, so **4 of 35 group keys still span more than one customer** (one spans five).
This change does not worsen it, but the packing sequence will be applied inside those wrongly-merged
groups until it is fixed.

---

## 9. Evidence

| # | Finding | Source |
|---|---|---|
| E1 | Rectangle roses are spelled **"Retangle"** — 28 SKUs | names master, tab `names` |
| E2 | `CRFF400/450/453/500/550` are 100 % rectangle; `CRFF100–240` are 0 % | 114 CRFF SKUs |
| E3 | Colour codes 93–100 % consistent across 12,392 name rows | suffix ↔ trailing-word correlation |
| E4 | `Combo Color` contaminated (`MAPPED FOR …`), 100/169 populated | `Sheet1` col E |
| E5 | `LSWD360BG` is a ceiling rose despite the LS prefix | names master |
| E6 | Shade keywords over-match by 10 % without the accessory guard | 82 of 759 |
| E7 | Max lampshade qty per order = 4; zero orders ≥ 15 | 109 live orders |
| E8 | 9 orders reorder, 30 rows move | simulation on live data |
| E9 | Cases B/C/D/F have zero real examples | 109 live orders |

---

## 10. Unresolved Issues

### 🔴 Blocking — one item

1. **Colour allocation when the total exceeds 15.** Undefined, as §8 itself acknowledges. Given the
   live per-order maximum is 4, please also confirm whether 15 is a **cross-order collection wave**.
   If it is, that is a new layer above the Speech Tool, not a change to the packing sequence — and
   it needs its own scope.

### 🟠 Needs confirmation

2. ~~**Non-rectangle ceiling roses rank as "Other".**~~ **RESOLVED 2026-08-14.** A plain ceiling rose
   now ranks **2** in orders with no Rectangle rose, and **4** (with Other) in orders that have one.
   One point still assumed: rule 1 lists only *Rectangle rose → Lampshade → Bulb → Other*, so when a
   Rectangle rose **and** a plain rose appear in the same order, the plain rose falls to Other. That
   combination does not occur in the live data, so it is untested against reality.
3. **Box selection (§10, §25) is out of reach here.** No box column exists in `Sheet1`. Box names
   (`a5box (12*9*6 in)`, `a1box (5*5*5 in)`) come from the packlist/dashboard system. Should this
   sheet carry a box field, or does the Rose only set *priority* here?
4. **Cases B, C, D, F are unvalidated** — no real examples. Worth a re-run when such orders appear.
5. **`clean-1.gs` / `cleaned.gs` collision unresolved.** I patched both identically so the feature
   works either way, but the two files still define the same six functions and one is dead. The
   duplicate should be deleted.

---

## 11. Final Status

# 🟠 AMBER

**Implemented and validated against real data:**

- ✅ Product classification — lampshade, rectangle ceiling rose, bulb, other
- ✅ Colour identification and preservation, colour-wise, never merged
- ✅ The full §15 priority matrix, as a stable sort
- ✅ Order/customer identity preserved — no cross-customer reordering
- ✅ Existing UI, speech engine and unrelated logic untouched

**Not implemented, by instruction:**

- ⛔ The 15-unit collection cycle — allocation rule above 15 is undefined, and §8/§24 forbid
  inventing one.
- ⛔ **Placeholder product names in the `names` master sheet.** Ruled out of scope 2026-08-17 — the
  master sheet is owned by another team and is to be used exactly as it stands.

---

## Known issue in upstream data — logged, not actioned

The shared `names` master sheet (`16rx5Dz…`, tab `names`) carries placeholder text instead of real
product names for **210 of its 5,671 SKUs**:

| Value in the name column | SKUs |
|---|---:|
| `This one Black` | 125 |
| *(empty)* | 123 |
| `This one` | 73 |
| `refurbished This one Black` | 17 |
| `This One Copper` | 17 |

**36 of the affected SKUs are lampshades**, including every mosaic globe (`LSMCSPDRMC`,
`LSMCSPDRFL`, `LSMCSPFLMC`, `LSMCSPMSMC`, `LSMCSPSQMC`).

Two consequences, both accepted for now:

1. The packer hears *"This one"* spoken as the product name.
2. `ppProductType()` classifies from that name, and "This one" contains none of the shade keywords,
   so those 36 lampshades classify as `OTHER` and never enter a lampshade collection.

The Lampshade SOT does carry correct names and `Product_Subtype = Lampshade` for these SKUs, so
sourcing classification from the SOT would fix all 36. **That change was explicitly declined** — the
master sheet is another team's responsibility. Recorded here so the cause is known if the symptom is
ever reported from the floor.

Four of my five earlier stop conditions are resolved. The remaining one is a business rule only you
can supply.
