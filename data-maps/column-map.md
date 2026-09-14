# Column Map — `Sheet1` → `Cleaned Data`

**Station:** Unit 3 Lampshade ([sheet](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0))
**Last updated:** 2026-09-14 — column layout re-derived from the current code
(`cleaned.gs` `mergeAndCleanSheets`). Fill counts are from the **2026-08-13 snapshot** (169 → 140
rows) and were not re-measured.

The other five stations run older scripts and produce the **older 15/18-column** `Cleaned Data`; this
map describes Unit 3 Lampshade.

---

## `Sheet1` — raw platform import

Columns are found **by header name**, so their position does not matter.

| Header | Filled (13 Aug) | Notes |
|---|---:|---|
| Title | 169/169 | Marketplace SEO title. Displayed, **never spoken** |
| SKU | 169/169 | Stock code, e.g. `LDMST64B2286PK` |
| Quantity | 169/169 | Units of this line |
| Combo SKU | 101/169 | `A+B+C` composite |
| Combo Color | 100/169 | Not used by the pipeline |
| Combo Quantity | 101/169 | Used instead of `Quantity` when present |
| Price | 169/169 | £ |
| Link | 148/169 | Not used |
| Customer Info | 169/169 | Name + full address in one cell — **the order identity** |
| Address | 169/169 | Holds **only the postcode**, despite the header |
| Selling Platform | 169/169 | `AMAZON - amazon Ledsone`, eBay, Wayfair, B&Q, Shopify … |
| Instruction QR | 16/169 | `Instruction QR Available` |
| Status | 19/169 | Free text, e.g. `international`, `plz cancel this order` |
| Image URLs | 169/169 | `dashboard.digitweblk.com/Productimages/…` |
| Merge Order | 9/169 | Shared value on the rows of one merge |
| Component | 101/169 | Comma-separated tokens; count becomes `Combo: N` |
| Send Order Instruction | 2/169 | |

---

## `Cleaned Data` — written by `mergeAndCleanSheets()`

One full-width write — the old duplicate columns (`Component`, `Send Order Instruction` repeated as P/Q)
no longer exist.

| # | Header | Source | Used by |
|---:|---|---|---|
| A | SKU | `SKU`, else `Combo SKU`, upper-cased | speech, images, collections |
| B | **Name** | Names Master Sheet (live) | **spoken** |
| C | Quantity | `Combo Quantity`, else `Quantity`; `CL*` → `"N meter"` | **spoken** |
| D | **Post Code** | `Address`; duplicates on adjacent rows blanked; `RPR44WH` postcode moved | **spoken last** |
| E | Selling Platform | `Selling Platform`; adjacent duplicates blanked | displayed |
| F | Instruction QR | `Instruction QR`; **blanked where D is blank** | **spoken** as a note |
| G | Image URLs | `Image URLs` | displayed |
| H | Merge Order | label `merge order total: N : merge order: 1`, `merge order : 2` … on the row that opens each sub-order; blank on combo continuation rows. Re-stamped in spoken order by the packing sort | **spoken** as a prefix; marks sub-orders |
| I | Component | `Combo: N` | combo sets |
| J | Title * | `Title` | displayed |
| K | Price * | `Price` | displayed |
| L | Customer Info * | `Customer Info` | **grouping key**, packing-sort runs |
| M | Combo SKU | rebuilt by `addCombinedSKUSet()` | grouping key (fallback) |
| N | Status * | `Status` | displayed, not spoken |
| O | Send Order Instruction * | `Send Order Instruction` | **spoken** as a note |
| P | **SKU Combined** | `mergeAdjacentRowsAndRepeat()` — `SKU1+SKU2+…` across a merge | **grouping key**; identifies a merge |
| Q | **Product Type** | `ppProductType()` — `RECT_ROSE`, `ROSE`, `SHADE`, `CAGE`, `BULB`, `OTHER` | packing sort |
| R | **Colour** | `ppProductColour()` — Lampshade SOT, then SKU suffix | "This one" + colour |
| S | **Lampshade Collection** | `ppStampCollections()` — `BATCH\|…` / `ITEM\|…` lines | collection card |
| T | **Lampshade Collection Speech** | `ppStampCollections()` | spoken collection step |

\* Present only when `Sheet1` has that column; letters shift left if one is missing. Every reader
looks columns up **by header name**, except the three cleaning steps below.

**Hardcoded positions:** `keepOnlyLastOccurrenceInD` (column 4), `keepOnlyLastOccurrenceInE` (5),
`clearFIfDIsEmptyInSheet` (6). The five packing columns are appended **at the end** specifically so
these stay correct — do not insert columns before F.

---

## Data-quality findings (13 Aug), current status

| Finding | Status |
|---|---|
| **F1** — Post Code 22% blank; the parse falls silent | 🔴 Open. Still blanked by adjacent-duplicate removal |
| **F2** — Merge Order under-populated (9/169) | 🟠 Data issue upstream. Merges that *are* flagged are now grouped by `SKU Combined` + customer and sequenced by priority |
| **F3** — Duplicate headers P/Q | ✅ Fixed — single full-width write |
| **F4** — `Address` holds only the postcode | 🔴 Open (naming only) |
| **F5** — Rows with no spoken Name are silent | ✅ Fixed — spoken as "This one" + colour; quantity kept. Missing names still need adding to the Names Master Sheet ([missing-names-checklist.md](../validation/missing-names-checklist.md)) |
