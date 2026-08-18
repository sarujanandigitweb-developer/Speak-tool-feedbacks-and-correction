# Lampshade SOT — Complete Verification Against Unit 3 Speech Tool Logic

**Spreadsheet:** [`1b9n4Rhy…`](https://docs.google.com/spreadsheets/d/1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI/edit?gid=736349891)
*LEDsone — SOURCE OF TRUTH, EASY FIT LAMPSHADES · Version 8.0 · Updated 06 Aug 2026 · Status ACTIVE*
**Purpose:** verify SKU → Product Name → Colour → Product Type → Packing logic.
**Status:** Analysis only. **No code changed. No new logic created.**

---

## ⚠️ Headline finding — read first

**This spreadsheet contains lampshades only.** All 451 MASTER rows have
`Product_Subtype = "Lampshade"`. A keyword sweep across `Product_Name`, `Product_Type` and
`Product_Subtype` returns:

| Searched for | Rows found |
|---|---:|
| `ceiling rose` / `celing rose` | **0** |
| `retangle` / `rectangle` | **0** |
| `bulb` | **0** |
| `holder` | **0** |
| `reducer` | **0** |

So of the four packing-priority classes, this file can authoritatively identify **one**.

`Build_Notes` confirms other SOT files exist:

> *"Field groups reordered … This now differs from the v4 benchmark used by other SOTs
> (**Ceiling Rose**, L…)"*

**There is a separate Ceiling Rose SOT.** I have not been given its link. Bulbs presumably have one
too. Both are required before the priority matrix can be verified end to end.

---

## 1. Complete Tab Inventory

| # | Tab | Rows | Purpose | SKU col | Name col | Colour col | Type col | Qty col | Combo/Component col |
|---|---|---:|---|---|---|---|---|---|---|
| 1 | **COVER** | 44 | Navigation, version, tab manifest, field-group colour key | — | — | — | — | — | — |
| 2 | **SKU Index** | 469 data | Flat index of every SKU with image link | `SKU` | — | — | `Product Type`, `Shape`, `Category Tab` | `Stock_Count` | — |
| 3 | **MASTER** | **451 data** | **The only data-editing surface.** 208 columns in 24 field groups | `SKU_ID` (A) | `Product_Name` (H) | `Colour_Family` (Z), `Outer_Colour` (AA), `Inner_Colour` (AB) | `Product_Type` (E), `Product_Subtype` (F), `Shade_Shape` (J) | `Stock_Count` (D), `Qty_Per_Pack` (CX) | **none** |
| 4 | **SOT Data Fields Guide** | 177 | Field-by-field definition, owner, source, example, benefit | documents `SKU_ID` | — | — | — | — | — |
| 5 | **Creative Assets Tracker** | 522 | 3D files, hero photos, PNG cutouts, 360 spins | `SKU_ID` | `Product_Name` | — | `Product_Subtype` | — | — |
| 6 | **SKU Decoder** | 30 | **Authoritative SKU naming convention** — 27 documented prefix patterns | pattern col | decode col | colour is the SKU suffix | family = prefix | — | — |
| 7 | **Taxonomy_Review** | 28 | Finish-taxonomy cross-check results, 06 Aug 2026 | example SKUs | — | **19 unresolved colour codes** | — | — | — |
| 8 | **Build_Notes** | 29 | Provenance of v8, what was applied, what is still open | — | — | — | — | — | — |
| 9 | **Needs_Verify_Removed_SKUs** | 48 data | 48 SKUs removed from MASTER on 06 Aug 2026 | `SKU` | — | — | — | `Stock_Count` | — |

### Tab relationships

```
SKU Decoder ──(defines the naming convention)──► MASTER.SKU_ID
Taxonomy_Review ──(flags unresolved colour codes)──► MASTER.Colour_Family / Outer_Colour
SOT Data Fields Guide ──(defines every field)──► MASTER columns
MASTER ──(subset, +IMG)──► SKU Index          468 SKUs, 17 in Index but not MASTER
MASTER ──(subset, +assets)──► Creative Assets Tracker
Needs_Verify_Removed_SKUs ◄──(48 removed)──── MASTER   [verified: 0 still present ✅]
Build_Notes ──(provenance + open issues)──► whole workbook
```

**Referential integrity checks:**

| Check | Result |
|---|---|
| SKUs in `Needs_Verify_Removed_SKUs` still present in MASTER | **0** ✅ correct |
| SKUs in MASTER but missing from SKU Index | **0** ✅ |
| SKUs in SKU Index but missing from MASTER | **17** ⚠️ (Index 468 vs MASTER 451) |
| COVER claims | "469 lampshade SKUs" and "all 517 SKUs" — **neither matches the 451/468 actually present** ⚠️ |

---

## 2. SKU → Name Mapping Logic

**Relationship: MANY-TO-ONE. It is *not* one-to-one.**

| Measure | Value |
|---|---:|
| Distinct SKUs | 451 |
| Distinct `Product_Name` values | 338 |
| **Product names shared by more than one SKU** | **77 of 338 (23 %)** |

Worked example — one name, five SKUs, **different shapes and different sizes**:

| SKU | Shade_Shape | Diameter | Colour_Family |
|---|---|---:|---|
| `LSDO210YE` | Dome | 210 | Yellow |
| `LSDO300YE` | Dome | 300 | Yellow |
| `LSDO400YE` | Dome | 400 | Yellow |
| `LSTB360YE` | **Bell** | 360 | Yellow |
| `LSWE315YE` | **Mosque** | 315 | Yellow |

All five are `"Industrial Dome Metal Lampshade – Yellow"` — including two that are **not domes**.

**Conclusion:** `Product_Name` cannot identify a product. Only `SKU_ID` can. Any picking or
speaking logic keyed on the product name will collapse distinct products together.

---

## 3. SKU → Colour Mapping Logic

Colour lives in **three** MASTER columns at different granularity:

| Column | Meaning | Example |
|---|---|---|
| `Colour_Family` (Z) | Coarse family | `Black`, `Amber / Warm Tone` |
| `Outer_Colour` (AA) | Specific finish | `Matte Black`, `Amber (Light Honey Brown)` |
| `Inner_Colour` (AB) | Inner surface | — |

The colour is encoded as the **trailing 2–3 letter SKU suffix**, per `SKU Decoder`:

```
LSFT      220       RE
family    diameter  colour   →  "Cone shade, 220mm diameter, Red"
```

### Is SKU → Colour one-to-one?

**Yes, with one exception.** 450 of 451 SKUs map to exactly one `Outer_Colour`. The exception is
the duplicate row (§9).

### Is Name → Colour reliable?

**Mostly, but not guaranteed** — 2 of 338 names span multiple colour families:

| Product Name | Colour families |
|---|---|
| `Glass Bell Jar Lampshade` | (blank), Amber / Warm Tone, Blue, White — **4** |
| `Glass Cylinder Lampshade` | Amber / Warm Tone, Clear / Transparent — **2** |

### 🔴 Conflicts against the colour map implemented in `packing-priority.gs`

I derived that map from the **Speech Tool names master sheet**. The SOT disagrees:

| Code | SOT `Colour_Family` | My implemented map | Verdict |
|---|---|---|---|
| `GD` | **Black** | Gold | 🔴 **CONFLICT** |
| `HE` | **Black & Natural** | Hemp | 🔴 **CONFLICT** |
| `BG` | **Black** (19 SKUs) | Black Gold Inner | 🟠 different granularity; also **unresolved in taxonomy** |
| `BY` | **Black** (5 SKUs) | Shiny Black | 🟠 but `SKU Decoder` says `LSDO400BY` = **Buttermilk Yellow** — **SOT self-conflict** |
| `BU` | Burgundy | Burgandy | 🟡 spelling only |

**16 codes are used in the SOT and absent from my map entirely**, including the largest gap:

| Code | SKUs | SOT colour |
|---|---:|---|
| `AR` | **24** | Amber / Warm Tone |
| `BI` | 12 | Black |
| `NB` | 9 | Navy Blue |
| `BT` | 8 | Blue |
| `CL` | 8 | Clear / Transparent |
| `DG`, `AZ`, `BR`, `BW`, `GS`, `WS`, `PU`, `SY`, `YC`, `AS`, `OW` | 1–3 each | various |

**Score: 24 agree · 3 conflict · 16 missing.**

### 🔴 Colour codes with no taxonomy definition at all

`Taxonomy_Review` records **19 Metal codes not present in `Finish_Taxonomy.xlsx`**, covering
**61 SKUs**: `BG`(23), `BY`(7), `BT`(6), `DG`(4), `BW`(3), `AZ`(3), `GS`(2), `BD`(2), and 11 more
with 1 each. Glass, Fabric and Natural Rope have **only a "TBD / PENDING" placeholder** — so `AR`
(Amber), used on most Glass SKUs, is formally undefined.

---

## 4. Product Type Identification Logic

| Field | Distinct values across all 451 rows |
|---|---|
| `Product_Type` (E) | **`Lighting Accessory` — 451/451** |
| `Product_Subtype` (F) | **`Lampshade` — 451/451** |
| `Shade_Shape` (J) | Dome 59, Cone 55, Curvey 40, Bowel 31, Barn Slot 27, Temple Dome 16, Teardrop 13, Cylinder 13, Tapered Drum 13, Flat 12, Half Round 12, Wide/Truncated Cone 12, Mug 10, Mosque 9, … |
| `Category Tab` (SKU Index) | Metal 364, Glass 78, Fabric 13, Crystal Glass 9, Natural Rope 5 |

**🔴 `Product_Type` is useless as a classifier** — it is a single constant. It says *"Lighting
Accessory"*, which would also be true of a ceiling rose or a lampholder.

**`Product_Subtype` is the field that says "Lampshade"** — but since every row in this file is a
lampshade, it is unproven whether other SOT files use the same vocabulary (`Ceiling Rose`? `Bulb`?).

⚠️ `Shade_Shape` has **unmerged duplicates**, flagged as still-open in `Build_Notes`:
`Curvey`/`Curvy`, `Bell`/`Bell Jar`/`Bell shape`, `Striped`/`Stripped`. Also note misspellings
`Bowel` (Bowl) and `Curvey`.

---

## 5. Lampshade Mapping

**Identification is VERIFIED for lampshades.** Three independent, agreeing signals:

1. `Product_Subtype = "Lampshade"` — 451/451
2. SKU prefix `LS…` — 27 documented families in `SKU Decoder`
3. Presence in this SOT at all

### Live Unit 3 order coverage

| Measure | Value |
|---|---:|
| Distinct SKUs in live Unit 3 orders | 109 |
| Found in this SOT | 22 (20 %) |
| **LS-prefixed order SKUs** | **23** |
| **Of those, found in SOT** | **22 (96 %)** ✅ |
| LS order SKU missing from SOT | `LSMCP1PBWB` |

The 20 % overall figure is expected — 86 of the 109 order SKUs are ceiling roses, bulbs, holders and
cables, which this lampshade-only file does not cover. **Lampshade coverage is 96 %.**

### Real lampshade examples from live Unit 3 orders

| SKU | SOT Product_Name | SOT Colour_Family | Order Qty | Qty_Per_Pack | Sheet1 `Combo Color` |
|---|---|---|---:|---|---|
| `LSMS320GR` | Industrial Temple Metal Lampshade 32cm – Green | Green | 1 | `[VERIFY]` | Green ✅ |
| `LSDO210BB` | Industrial Dome Metal Lampshade – Brushed Brass | Brushed Brass | 3 | `[VERIFY]` | Brushed Brass ✅ |
| `LSEL400BM` | Industrial Pluto Metal Lampshade 40 cm – Black | Black | 3 | `[VERIFY]` | Black ✅ |
| `LSUL220BB` | Vintage Fluted Metal Lampshade – Brushed Brass | Brushed Brass | 4 | `[VERIFY]` | Brushed Brass ✅ |
| `LSMS320CB` | Industrial Temple Metal Lampshade 32cm – Cyan | Cyan Blue | 1 | `[VERIFY]` | Cyan blue ✅ |
| `LSCYRO120GD` | Metal Drum Lampshade – Gold | **Black** | 2 | `[VERIFY]` | **Gold** 🔴 |
| `LSFT220BG` | Industrial Metal Cone Lampshade – Matte Black | **Black** | 2 | `[VERIFY]` | **Black Gold Inner** 🟠 |
| `LSCY290DBI` | Industrial Dome /Curvy Metal Lampshade – Black | **Black** | 2 | `[VERIFY]` | **Black Inner White** 🟠 |
| `LSHM400HE` | Natural Rope Basket Pendant Lampshade – Matte… | **Black & Natural** | 1 | `[VERIFY]` | **Hemp** 🟠 |

`LSCYRO120GD` is the clearest contradiction: the SOT's own `Product_Name` says **"– Gold"** while its
`Colour_Family` says **Black**.

---

## 6. Rectangle Ceiling Rose Mapping

# 🔴 NOT PRESENT IN THIS SPREADSHEET

Zero rows. Zero matches for `ceiling rose`, `celing rose`, `rectangle`, `retangle` in any name or
type field, across all 9 tabs.

**Where the data actually lives:** `Build_Notes` names a separate **Ceiling Rose SOT**. Separately,
the Speech Tool's own names master sheet (`16rx5Dz…`) contains **308 ceiling roses, of which 28 are
`Retangle`** — sizes `CRFF400/450/453/500/550` and `CRSF110/220`.

**Cannot be verified from this file.** The Ceiling Rose SOT link is required.

---

## 7. Bulb Mapping

# 🔴 NOT PRESENT IN THIS SPREADSHEET

Zero rows matching `bulb` in any name or type field.

The file does contain **bulb-compatibility** attributes for lampshades — `Bulb_Base_Type` (AF),
`Bulb_Base_Compat` (AG), `Max_Bulb_Diameter_mm` (AT), `Max_Bulb_Wattage_W` (AZ),
`Recommended_Bulb_Type` (AV). **These describe which bulb fits a shade; they are not bulb products.**

Bulb SKUs (`LD…` prefix) live in the Speech Tool names sheet (201 entries) and presumably in a
separate Bulb SOT.

---

## 8. Combo / Pack Mapping

# 🔴 NO COMBO OR COMPONENT DATA EXISTS IN THIS FILE

| Looked for | Result |
|---|---|
| Combo SKU column | **none** |
| Component SKU column | **none** |
| Parent/child SKU column | **none** |
| Pack-size column | `Qty_Per_Pack` (CX) exists — **set to `[VERIFY]` on all 451 rows** |
| Multi-pack SKUs (`…3PK`, `…5PK`) | **none in MASTER** |

The closest fields are `Rel_1_Type` / `Rel_1_Target` / `Rel_2_Type` / `Rel_2_Target` (RELATIONSHIPS
group). `Build_Notes` states `Rel_2` has **real data on one row only** (`LSFT220BB`) and is being
held pending owner input.

**Consequence:** pack size and combo composition must continue to come from the order sheet
(`Sheet1.Combo SKU`, `Combo Quantity`, `Component`), not from this SOT.

---

## 9. Duplicate / Conflict Findings

| # | Finding | Detail |
|---|---|---|
| **D1** | **Duplicate SKU** | `LSGLWA140AR` appears **twice** with different names *and* different colours: `"Glass Bell Jar Lampshade"` / `Amber (Light Honey Brown)` **vs** `"Glass Bell Jar Lampshade – Amber"` / `Amber`. Same stock (120). |
| **D2** | Same SKU, >1 Outer_Colour | 1 (the D1 duplicate) |
| **D3** | **Same name, different SKUs** | **77 of 338 names** — up to 6 SKUs per name, differing by size *and* shape |
| **D4** | **Same name, different colours** | 2 names — `Glass Bell Jar Lampshade` (4 colours), `Glass Cylinder Lampshade` (2) |
| **D5** | Name vs Colour_Family contradiction | `LSCYRO120GD` — name says "Gold", `Colour_Family` says "Black" |
| **D6** | **Undefined colour codes** | **19 codes / 61 SKUs** not in `Finish_Taxonomy.xlsx`; Glass/Fabric/Rope taxonomy is placeholder-only, so `AR` (Amber) is formally undefined |
| **D7** | Inconsistent shape naming | `Curvey`/`Curvy`, `Bell`/`Bell Jar`/`Bell shape`, `Striped`/`Stripped`; misspellings `Bowel`, `Curvey` — open in `Build_Notes` |
| **D8** | SKU Index ⊅ MASTER | 17 SKUs in Index absent from MASTER |
| **D9** | COVER counts wrong | Claims 469 and 517; actual 451 (MASTER) / 468 (Index) |
| **D10** | `Qty_Per_Pack` unusable | `[VERIFY]` on 451/451 |
| **D11** | **Spoken name omits colour** | **50 of 361 (14 %)** SOT SKUs present in the names sheet have a spoken name with no colour — e.g. `LSDO300BU` (Burgundy) **and** `LSDO300NB` (Navy Blue) are **both spoken as "30 Dome"** |
| **D12** | 90 SOT SKUs missing from names sheet | Those lampshades have **no spoken name** in the Speech Tool |

**D11 is the most operationally dangerous finding for the colour-wise requirement.** Two different
colours of the same shade are announced with an identical utterance.

---

## 10. Source-of-Truth Determination

| Attribute | Authoritative source | Confidence |
|---|---|---|
| Lampshade SKU existence & status | **This SOT — MASTER tab** | ✅ High |
| Lampshade product name (marketing) | **This SOT — `Product_Name`** | ✅ High |
| Lampshade shape / size | **This SOT — `Shade_Shape`, `Diameter_mm`** | 🟠 shape vocabulary unmerged |
| Lampshade colour family | **This SOT — `Colour_Family` / `Outer_Colour`** | 🟠 61 SKUs undefined in taxonomy |
| SKU naming convention | **This SOT — `SKU Decoder` tab** | ✅ High |
| **Spoken name (what the packer hears)** | **Speech Tool names sheet `16rx5Dz…`** — *not this file* | ✅ separate concern |
| Ceiling rose / bulb / accessories | **Separate SOT files — not provided** | 🔴 Missing |
| Order quantity, combo, component | **Order sheet `Sheet1`** — not this file | ✅ |
| Pack size | **Nowhere** — `[VERIFY]` here, absent from order sheet | 🔴 Missing |

**Two distinct roles must not be conflated.** This SOT is the **product master** (what a product
is). The names sheet is the **operational pronunciation dictionary** (what the packer hears). They
serve different purposes and currently disagree on colour for at least 3 codes.

---

## 11. Validation of the Proposed Packing Logic

Proposed: **Lampshade (colour-wise) → Rectangle Ceiling Rose → Bulb → Other SKU Products**

| # | Rule | Verdict | Evidence |
|---|---|---|---|
| 1 | Lampshade can be reliably identified | ✅ **VERIFIED** | `Product_Subtype = "Lampshade"` on 451/451; `LS` prefix documented across 27 families in `SKU Decoder`; 22 of 23 LS order SKUs present |
| 2 | Lampshade colour can be reliably identified | 🟠 **PARTIAL** | Colour is a documented SKU suffix and 450/451 SKUs map to one colour — **but** 19 codes / 61 SKUs are undefined in the taxonomy, and Glass/Fabric/Rope taxonomy is placeholder-only |
| 3 | Colour values agree across systems | 🔴 **CONFLICT** | `GD` → SOT *Black* vs map *Gold*; `HE` → *Black & Natural* vs *Hemp*; `BY` → SOT *Black* vs SKU Decoder *Buttermilk Yellow* (**SOT contradicts itself**) |
| 4 | Different colour SKUs must not be merged | ✅ **VERIFIED** (as data) | Each colour has its own SKU; 450/451 are 1:1 SKU→colour |
| 5 | Colour survives to the packer | 🔴 **CONFLICT** | **14 % of spoken names omit the colour.** `LSDO300BU` (Burgundy) and `LSDO300NB` (Navy Blue) are **both** spoken as *"30 Dome"* |
| 6 | Rectangle Ceiling Rose can be identified | 🔴 **UNVERIFIED** | **Zero ceiling roses in this file.** A separate Ceiling Rose SOT is referenced in `Build_Notes` but not provided |
| 7 | Bulb can be identified | 🔴 **UNVERIFIED** | **Zero bulbs in this file.** Only bulb-*compatibility* attributes exist |
| 8 | "Other SKU Products" can be identified | 🔴 **UNVERIFIED** | Requires the other three classes to be defined first |
| 9 | Max collection = 15 | 🔴 **UNVERIFIED** | No collection, wave or batch concept exists in this file |
| 10 | Collect only the required quantity below 15 | 🔴 **UNVERIFIED** | Requires order-level data; this is a product master |
| 11 | Pack-size handling | 🔴 **UNVERIFIED** | `Qty_Per_Pack = [VERIFY]` on 451/451 |
| 12 | Product name identifies a product | 🔴 **CONFLICT** | 77 of 338 names shared by multiple SKUs, including across different shapes and sizes |

**Score: 2 VERIFIED · 1 PARTIAL · 4 CONFLICT · 5 UNVERIFIED.**

---

## 12. Required Changes to Existing Unit 3 Logic

Evidence-based only. **Nothing has been changed.**

### 🔴 Required — the colour map is wrong

`packing-priority.gs` → `PP_COLOUR_CODES` was derived from the names sheet and is contradicted by
the SOT.

| Change | Evidence |
|---|---|
| `GD` currently returns *Gold*; SOT says **Black** | `LSCYRO120GD`: `Colour_Family = Black`, but `Product_Name` says "– Gold" — **the SOT itself is inconsistent; do not change until the owner rules** |
| `HE` currently returns *Hemp*; SOT says **Black & Natural** | `LSHM400HE` |
| **Add 16 missing codes**, above all `AR` (Amber, 24 SKUs) | Currently `ppProductColour` returns `""` for every Glass amber shade |
| `BG`, `BY`, `BT` are **taxonomy-unresolved** — do not harden | `Taxonomy_Review`, 61 SKUs affected |

### 🔴 Required — decide which colour field is authoritative

Three sources disagree at different granularity:

```
SOT Colour_Family   coarse   "Black"
SOT Outer_Colour    specific "Matte Black"
Sheet1 Combo Color  operational "Black Gold Inner"   (also contaminated with "MAPPED FOR …")
names sheet suffix  operational "Black Gold Inner"
```

Picking colour-wise needs the **operational** granularity — a packer must distinguish
`Black Gold Inner` from plain `Black`. `Colour_Family` is **too coarse for picking**.

### 🔴 Required — 50 spoken names must gain their colour

`LSDO300BU` and `LSDO300NB` are both announced as *"30 Dome"*. Until fixed, colour-wise picking
**cannot work by voice** regardless of what the data layer does. Fix in the names sheet, not in code.

### 🟠 Required — 90 SOT lampshades have no spoken name

Those orders would be silent (compounded by the existing `cleaned.gs:116` bug that also blanks the
quantity when the name lookup fails).

### 🟢 No change required

| Area | Why |
|---|---|
| `ppProductType` lampshade detection | Independently confirmed — `Product_Subtype = "Lampshade"` on 451/451 aligns with the `LS`-prefix approach |
| Rectangle-rose and bulb detection | This file offers no basis to change them; the existing name-pattern rules stand until the other SOTs arrive |
| Packing priority sort | Unaffected by this file |
| Combo/pack handling from `Sheet1` | This SOT has no combo or pack data, so the order sheet remains correct |

### ⛔ Blocked

| Item | Blocker |
|---|---|
| Verify Rectangle Ceiling Rose | **Ceiling Rose SOT link needed** |
| Verify Bulb | **Bulb SOT link needed** |
| 15-unit collection rule | No collection/wave concept in any file; allocation rule above 15 still undefined |
| Pack-size logic | `Qty_Per_Pack = [VERIFY]` on every row |

---

## Final Evidence Table

| SKU | Product Name | Colour | Product Type | Pack/Combo | Source Tab | Evidence |
|---|---|---|---|---|---|---|
| `LSFT220BB` | Industrial Metal Cone Lampshade | Brushed Brass | Lighting Accessory / **Lampshade** | `[VERIFY]` | MASTER | Cone family, `SKU Decoder` row 1 |
| `LSMS320GR` | Industrial Temple Metal Lampshade 32cm – Green | Green | Lampshade | `[VERIFY]` | MASTER | In live Unit 3 order, `Combo Color` agrees |
| `LSDO210BB` | Industrial Dome Metal Lampshade – Brushed Brass | Brushed Brass | Lampshade | `[VERIFY]` | MASTER | Live order qty 3 |
| `LSUL220BB` | Vintage Fluted Metal Lampshade – Brushed Brass | Brushed Brass | Lampshade | `[VERIFY]` | MASTER | Live order qty 4 |
| `LSCYRO120GD` | Metal Drum Lampshade – **Gold** | **Black** | Lampshade | `[VERIFY]` | MASTER | 🔴 name vs Colour_Family contradiction |
| `LSHM400HE` | Natural Rope Basket Pendant Lampshade | **Black & Natural** | Lampshade | `[VERIFY]` | MASTER | 🟠 vs `Combo Color` = Hemp |
| `LSDO300BU` | Industrial Dome Metal Lampshade | Burgundy | Lampshade | `[VERIFY]` | MASTER + names sheet | 🔴 spoken as *"30 Dome"* — colour lost |
| `LSDO300NB` | Industrial Dome Metal Lampshade | Navy Blue | Lampshade | `[VERIFY]` | MASTER + names sheet | 🔴 **also** spoken as *"30 Dome"* |
| `LSGLWA140AR` | Glass Bell Jar Lampshade *(×2 rows)* | Amber *(2 variants)* | Lampshade | `[VERIFY]` | MASTER | 🔴 duplicate SKU |
| `LSDO210YE` / `LSTB360YE` / `LSWE315YE` | *all* "Industrial Dome Metal Lampshade – Yellow" | Yellow | Lampshade | `[VERIFY]` | MASTER | 🔴 one name, 3 shapes (Dome/Bell/Mosque) |
| `LSGL10014CL` … ×6 | *all* "Clear Cylindrical Glass Easy-Fit Lampshade" | Clear / Transparent | Lampshade | `[VERIFY]` | MASTER | 🔴 6 SKUs, 4 diameters, one name |
| **Rectangle Ceiling Rose** | — | — | — | — | **ABSENT** | 0 rows across all 9 tabs |
| **Bulb** | — | — | — | — | **ABSENT** | 0 rows across all 9 tabs |

---

## What I need to complete this verification

1. **The Ceiling Rose SOT link** — named in `Build_Notes`, required for priority class 2.
2. **The Bulb SOT link** — required for priority class 3.
3. **A ruling on colour authority** — `Colour_Family` (coarse) vs `Outer_Colour` (specific) vs the
   operational `Combo Color` / names-sheet suffix. Picking needs the specific one.
4. **A ruling on `GD`, `HE`, `BY`** — the SOT contradicts both the names sheet and, for `BY`, itself.
5. **Confirmation that the 15-unit limit is a cross-order collection wave**, and the allocation rule
   above 15.
