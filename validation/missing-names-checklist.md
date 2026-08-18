# Unit 3 Lampshade — SKUs with no spoken name

**Checked:** 2026-08-17 · **Source:** live `Cleaned Data` vs the shared `names` master ([16rx5Dz…](https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M))

These SKUs are **not in the `names` master sheet**, so `processRow()` leaves the name empty, the existing `if (!name) quantity = ''` rule blanks the quantity too, and the Speak Tool says **nothing at all** for the row. The product image still appears in the strip, so the packer sees an item they are never told to pick.

**14 SKUs affected.** Add a name against each one in the `names` sheet to fix it.

---

## Name already available in the Lampshade SOT — 7 SKUs

These can be copied straight across from the SOT's `Product_Name`. No hunting needed.

| ✔ | SKU | Qty | Name to copy from the SOT |
|---|---|---:|---|
| [ ] | `LSGL100145BL` | 1.0 | Glass Bell Jar Lampshade |
| [ ] | `LSGL10014AR` | 1.0 | Glass Bell Jar Lampshade |
| [ ] | `LSGL10014CL` | 1.0 | Clear Cylindrical Glass Easy-Fit Lampshade – Clear Glass |
| [ ] | `LSGL14013AR` | 1.0 | Glass Bell Jar Lampshade – Amber |
| [ ] | `LSGL9015CL` | 4.0 | Clear Cylindrical Glass Easy-Fit Lampshade – Clear Glass |
| [ ] | `LSGLST150AR` | 1.0 | Glass Striped Lampshade |
| [ ] | `LSGLWA140AR` | 1.0 | Glass Bell Jar Lampshade – Amber |

## Not in the SOT either — 7 SKUs, need a manual name

Nothing in either master sheet knows these. The marketplace `Title` and the product image are the only clues, so they are given below.

| ✔ | SKU | Qty | Rows | Marketplace title (clue) | Image |
|---|---|---:|---:|---|---|
| [ ] | `ENC10233` | 1.0 | 3 | Vintage Style 3-Head Cluster Pendant Light, Ribbed Glass Sha | [view](http://dashboard.digitweblk.com/Productimages/SFCR3PBK.jpg) |
| [ ] | `ENC685` | 1.0 | 2 | LEDSone Luminaire Suspendu Steampunk Rétro Métal Noir / 3 Tê | [view](https://dashboard.digitweblk.com/Productimages/4588.jpg) |
| [ ] | `ENC8607` | 1.0 | 2 | Semi Flush Mount | [view](http://dashboard.digitweblk.com/Productimages/1355.jpg) |
| [ ] | `ENC9045` | 2.0 | 2 | E27 Base Semi Flush Mount Ceiling Light Fixture Industrial P | [view](http://dashboard.digitweblk.com/Productimages/1355.jpg) |
| [ ] | `LDMT130E274` | 2.0 | 1 | DC VOLTAGE Industrial Table Lamp Vintage Rustic Red Metal Ca | [view](https://dashboard.digitweblk.com/Productimages/23557.png) |
| [ ] | `WCBSF120FG` | 2.0 | 1 | 2 Pack Modern Sun Flower French Gold Crystal Pendant Light S | [view](https://dashboard.digitweblk.com/Productimages/23707.jpg) |
| [ ] | `WCBTC100FG` | 1.0 | 1 | GULDNÄT Small Crystal Cylindrical Lampshade ~6868 - 1 Pack | [view](https://dashboard.digitweblk.com/Productimages/23703.jpg) |

---

## Which orders are affected

| SKU | Orders |
|---|---|
| `ENC10233` | Linda King 40 Springwell Garde |
| `ENC685` | Pierre BEUNAS 387 rue de la li |
| `ENC8607` | Dr Craig Bird 32 Colchester Cr |
| `ENC9045` | lindsey bain GORE FARM THE TUR |
| `LDMT130E274` | Iain Gordon. 7 Kilpatrick Gard |
| `LSGL100145BL` | ute oliver 1 Ings View Aiskew  |
| `LSGL10014AR` | ute oliver 1 Ings View Aiskew  |
| `LSGL10014CL` | ute oliver 1 Ings View Aiskew  |
| `LSGL14013AR` | Linda King 40 Springwell Garde |
| `LSGL9015CL` | Colleen Podmore 21 Salisbury R |
| `LSGLST150AR` | Linda King 40 Springwell Garde |
| `LSGLWA140AR` | Linda King 40 Springwell Garde |
| `WCBSF120FG` | irfana khan 34 ST PATRICKS COU |
| `WCBTC100FG` | Jamie Tyas 15 Campkin Court En |

---

## Separately — 27 more silent rows that need no name work

Another 27 rows are silent for a different reason: their `SKU` cell in `Sheet1` is **blank**, so `processRow()` falls back to the `Combo SKU` string and ends up with a SKU like `CRSF100BM+LHNSE27BM+SCRN70YB+LSMS320GY`, which naturally has no name.

Those are the rows damaged by `blankDuplicateSKUsInSheet1()` — see [unit-3-sku-blanking.md](issues/unit-3-sku-blanking.md). **Re-importing `Sheet1` fixes all 27 without touching the names sheet.**

| Silent rows | Cause | Fix |
|---:|---|---|
| 14 SKUs / 19 rows | not in the `names` master | add names (this checklist) |
| 27 rows | blanked SKU in `Sheet1` | re-import `Sheet1` |
