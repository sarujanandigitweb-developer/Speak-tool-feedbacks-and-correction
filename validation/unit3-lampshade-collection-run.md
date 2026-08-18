# Unit 3 Lampshade — Live Order Collection Analysis

> **SUPERSEDED 2026-08-18.** This records the previous collection rule, in which every LS-prefixed
> product was collectible and the whole pack list was scanned for all of them. That rule has been
> removed. See [`unit3-lampshade-collection-rule-2026-08-18.md`](unit3-lampshade-collection-rule-2026-08-18.md).

**Source:** [Unit 3 Lampshade speak tool](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) · `Sheet1`, fetched 2026-08-14
**Settings:** `PP_MAX_LAMPSHADE_COLLECTION = 15` · `PP_ALLOW_LINE_SPLIT = true`
**Raw output:** [evidence/unit3-lampshade-order-analysis.txt](../evidence/unit3-lampshade-order-analysis.txt)

| Measure | Value |
|---|---:|
| Line items | 169 |
| Orders | 109 |
| **Orders requiring a lampshade** | **31** |
| Orders with no lampshade | 78 |
| **Total lampshades to collect** | **49** |
| Distinct size buckets | 7 *(one of them blank — see the gap below)* |
| **Collection batches** | **4** |

> **Order code = postcode.** `Sheet1` contains no order-ID column, so the postcode is the only
> order-level identifier available and is what the packer hears. Customer name is shown alongside it
> because two customers can share a postcode.

---

## 🔴 Data gap found — 4 SKUs have no size

Size-first collection needs a size on every lampshade. Four do not have one:

| SKU | Spoken name | Colour | Qty | Orders |
|---|---|---|---:|---|
| `WCDCBM` | diamand cage Black | Black | 4 | LN1 1BE ×2, nn56pl ×1, FY8 2HN ×1 |
| `WCDTRO` | diamand cage Rose Gold | Rose Gold | 3 | H91 W528 ×3 |
| `WCBNRR` | ballon cage Rustic Red | Rustic Red | 2 | G76 7RD ×2 |
| `WCBNBM` | ballon cage Black | Black | 1 | DA8 1AL ×1 |
| | | **Total** | **10** | |

The `WC` prefix carries **no numeric size token** — `WCDCBM` decodes as prefix + colour only, with
nothing in between. They therefore fall into a **blank size bucket**, which is why Batch 2 below
shows a size of `mm` with no number.

Two questions before this can be resolved:

1. **Are wire cages lampshades for collection purposes?** They are classified `SHADE` only because
   their spoken name contains "cage". They are **not in the Lampshade SOT** (which is `LS`-prefixed
   only, 451 SKUs).
2. **If they are**, what is their size? It is not derivable from the SKU.

`WCCYSP160GD` ("Glass Lamp Cage Gold") *does* parse to 160 mm and sits in its own bucket — same
question applies.

**I have not guessed a size for these.** They are shown in the blank bucket so the gap is visible
rather than hidden.

---

## Section 1 — Total quantity per size

Sizes are listed in **order of first appearance in the order queue**, which is the sequence the
collection follows.

| # | Size | Total qty |
|---:|---:|---:|
| 1 | 320 mm | 5 |
| 2 | 400 mm | 14 |
| 3 | **(no size)** | **10** ⚠️ |
| 4 | 220 mm | 11 |
| 5 | 210 mm | 7 |
| 6 | 40 mm | 1 |
| 7 | 160 mm | 1 |
| | **ALL** | **49** |

---

## Section 2 — Colour and quantity within each size, with the orders that need them

### 320 mm — total 5

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Black Gold Inner | `LSMS320BG` | 3 | Sn110bf ×3 |
| Green | `LSMS320GR` | 1 | CT8 8RX ×1 |
| Cyan Blue | `LSMS320CB` | 1 | BS20 7PN ×1 |

### 400 mm — total 14

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Hemp | `LSHM400HE` | 6 | CM6 3ZB ×1, KA30 9BY ×1, HU13 9AN ×1, CF31 4NS ×1, WA8 7LR ×2 |
| Black | `LSEL400BM` | 3 | 54300 ×3 |
| White | `LSDO400WH` | 3 | WR9 0NU ×3 |
| White | `LSEL400WH` | 2 | SK4 5JD ×1, IP7 7HX ×1 |

⚠️ **Two different White SKUs at 400 mm** — `LSDO400WH` (dome) and `LSEL400WH` (curvy). They are
**not** merged into "White 5". Different SKU = different product.

### (no size) — total 10 ⚠️

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Black | `WCDCBM` | 4 | LN1 1BE ×2, nn56pl ×1, FY8 2HN ×1 |
| Rose Gold | `WCDTRO` | 3 | H91 W528 ×3 |
| Rustic Red | `WCBNRR` | 2 | G76 7RD ×2 |
| Black | `WCBNBM` | 1 | DA8 1AL ×1 |

⚠️ **Two different Black SKUs** — `WCDCBM` (diamond cage) and `WCBNBM` (balloon cage). Not merged.

### 220 mm — total 11

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Brushed Brass | `LSUL220BB` | 6 | DN15 7BA ×4, PR2 6EU ×2 |
| Black Gold Inner | `LSFT220BG` | 2 | WF14 0JD ×2 |
| Blue | `LSFT220BL` | 1 | PL25 3SP ×1 |
| Navy Blue | `LSFT220NB` | 1 | ME9 7JL ×1 |
| Brushed Silver | `LSUL220BS` | 1 | NG21 9QA ×1 |

### 210 mm — total 7

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Brushed Brass | `LSDO210BB` | 3 | 12437 ×3 |
| Black Gold Inner | `LSCY210BG` | 3 | CV23 1AQ ×1, BN2 4BF ×1, PH11 8DZ ×1 |
| Green | `LSDO210GR` | 1 | GU30 7SH ×1 |

### 40 mm — total 1

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Black | `LSTF40BM` | 1 | EH13 0JT ×1 |

### 160 mm — total 1

| Colour | SKU | Qty | Orders |
|---|---|---:|---|
| Gold | `WCCYSP160GD` | 1 | DH5 9BX ×1 |

---

## Section 3 — Collection batches

Max 15 per batch, sizes taken in order of first appearance, line splitting enabled.

### 🧺 BATCH 1 — 15/15 FULL · sizes 320 mm, 400 mm

| Size | Colour | SKU | Take | For |
|---:|---|---|---:|---|
| 320 mm | Green | `LSMS320GR` | 1 | CT8 8RX |
| 320 mm | Cyan Blue | `LSMS320CB` | 1 | BS20 7PN |
| 320 mm | Black Gold Inner | `LSMS320BG` | 3 | Sn110bf |
| 400 mm | Hemp | `LSHM400HE` | 6 | CM6 3ZB, KA30 9BY, HU13 9AN, CF31 4NS, WA8 7LR ×2 |
| 400 mm | Black | `LSEL400BM` | 3 | 54300 |
| 400 mm | White | `LSDO400WH` | **1 of 3** ✂️ | WR9 0NU *(2 carried to Batch 2)* |

320 mm is exhausted first (5), then 400 mm fills the remaining 10 — rule 6 working as specified.

### 🧺 BATCH 2 — 15/15 FULL · sizes 400 mm, (no size), 220 mm

| Size | Colour | SKU | Take | For |
|---:|---|---|---:|---|
| 400 mm | White | `LSDO400WH` | **2 of 3** ✂️ | WR9 0NU *(carried from Batch 1)* |
| 400 mm | White | `LSEL400WH` | 2 | SK4 5JD, IP7 7HX |
| ⚠️ — | Black | `WCDCBM` | 4 | LN1 1BE ×2, nn56pl, FY8 2HN |
| ⚠️ — | Rose Gold | `WCDTRO` | 3 | H91 W528 |
| ⚠️ — | Rustic Red | `WCBNRR` | 2 | G76 7RD |
| ⚠️ — | Black | `WCBNBM` | 1 | DA8 1AL |
| 220 mm | Black Gold Inner | `LSFT220BG` | **1 of 2** ✂️ | WF14 0JD *(1 carried to Batch 3)* |

### 🧺 BATCH 3 — 15/15 FULL · sizes 220 mm, 210 mm

| Size | Colour | SKU | Take | For |
|---:|---|---|---:|---|
| 220 mm | Black Gold Inner | `LSFT220BG` | **1 of 2** ✂️ | WF14 0JD *(carried from Batch 2)* |
| 220 mm | Brushed Brass | `LSUL220BB` | 6 | DN15 7BA ×4, PR2 6EU ×2 |
| 220 mm | Blue | `LSFT220BL` | 1 | PL25 3SP |
| 220 mm | Navy Blue | `LSFT220NB` | 1 | ME9 7JL |
| 220 mm | Brushed Silver | `LSUL220BS` | 1 | NG21 9QA |
| 210 mm | Brushed Brass | `LSDO210BB` | 3 | 12437 |
| 210 mm | Black Gold Inner | `LSCY210BG` | **2 of 3** ✂️ | CV23 1AQ, BN2 4BF *(1 carried to Batch 4)* |

### 🧺 BATCH 4 — 4/15 · 11 space left · sizes 210 mm, 40 mm, 160 mm

| Size | Colour | SKU | Take | For |
|---:|---|---|---:|---|
| 210 mm | Black Gold Inner | `LSCY210BG` | **1 of 3** ✂️ | PH11 8DZ *(carried from Batch 3)* |
| 210 mm | Green | `LSDO210GR` | 1 | GU30 7SH |
| 40 mm | Black | `LSTF40BM` | 1 | EH13 0JT |
| 160 mm | Gold | `WCCYSP160GD` | 1 | DH5 9BX |

Batch 4 is not filled to 15 — correct per rule 5: collect only what the orders require.

**Four lines split across batches** (✂️), which is `PP_ALLOW_LINE_SPLIT = true` behaving as you set
it: `LSDO400WH` 1+2, `LSFT220BG` 1+1, `LSCY210BG` 2+1.

---

## Section 4 — The 78 orders with no lampshade

Each is packed normally, with the priority applied to whatever it does contain.

| Composition | Orders |
|---|---:|
| OTHER only | 40 |
| BULB only | 30 |
| ROSE only | 3 |
| OTHER + ROSE | 2 |
| BULB + OTHER | 1 |
| BULB + OTHER + ROSE | 1 |
| **RECT_ROSE** | **1** |

Worked examples:

| Order code | Customer | Contains | Pack sequence |
|---|---|---|---|
| `W3 6HH` | Thomas Haynes | BULB | `LDMST64B2286PK` |
| `NG16 1AT` | Griffiths | OTHER, ROSE | `CRFF100BM` → `LHNSE27BM` |
| `15057` | Marco Bianco | BULB, OTHER, ROSE | `LDMST64E274` → `CRSF100BM` → `PHSH2BMTYB` → `SPUPBM` |
| `cb6 2lf` | Alan Robinson | OTHER, ROSE | `CRFF100BM` → `LHNSE27BM` → `CRFF100CO` → `LHNSE27CO` |

These are packed in queue position as they come — no look-ahead, per the rule confirmed earlier.

---

## Points to confirm

1. **🔴 The 4 `WC` SKUs (10 units) have no size.** Are wire cages lampshades for collection, and if
   so what size? They are not in the Lampshade SOT.
2. **`WCCYSP160GD`** parses to 160 mm — same question, is a glass lamp cage a lampshade?
3. **International order codes** — `12437` (DE), `54300` (FR), `15057` (IT), `H91 W528` (IE),
   `31319`, `75017`. The postcode is the only order identifier available; `Sheet1` has no order-ID
   column.
4. **`LSHM400HE` colour** — shown as **Hemp** from the SKU suffix, but the Lampshade SOT records
   `Colour_Family = "Black & Natural"`. Outstanding colour-authority question.
5. **Lowercase postcodes** — `Sn110bf`, `nn56pl`, `cb6 2lf` appear as typed. Matching is
   case-sensitive today; worth normalising if postcodes ever become a grouping key.
