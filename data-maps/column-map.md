# Column Map — `Sheet1` → `Cleaned Data`

Profiled from the **Unit 3 Lampshade** speak-tool sheet
([link](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0)),
snapshot 2026-08-13.

- `Sheet1` — **169** data rows, 17 populated columns (A–Q; R–Z empty)
- `Cleaned Data` — **140** data rows, 18 columns (A–R)

The row-count drop (169 → 140) is the combo/merge collapsing step.

---

## `Sheet1` — raw platform import

| Col | Header | Filled | Notes |
|---|---|---:|---|
| A | Title | 169/169 | Marketplace SEO title. **Not spoken.** |
| B | SKU | 169/169 | Internal stock code, e.g. `LDMST64B2286PK` |
| C | Quantity | 169/169 | Units of this line |
| D | Combo SKU | 101/169 | `A+B+C` composite, e.g. `CRSF100BM+PHSH1PBRBM+LSMS320GR` |
| E | Combo Color | 100/169 | Colour variant of this component |
| F | Combo Quantity | 101/169 | Units of this component within the combo |
| G | Price | 169/169 | £ |
| H | Link | 148/169 | Marketplace product URL |
| I | Customer Info | 169/169 | **Unparsed** name + full address in one cell |
| J | Address | 169/169 | Postcode only, despite the header |
| K | Selling Platform | 169/169 | `AMAZON - amazon Ledsone`, `AMAZON - amazon Dcvoltage`, eBay, Wayfair, B&Q, Shopify |
| L | Instruction QR | 16/169 | `Instruction QR Available` |
| M | Status | 19/169 | Free text — includes `plz cancel this order` |
| N | Image URLs | 169/169 | `dashboard.digitweblk.com/Productimages/…` or `/comboproducts/…` |
| O | Merge Order | **9/169** | Merge flag — **badly under-populated, see below** |
| P | Component | 101/169 | `component` / `component, component` |
| Q | Send Order Instruction | 2/169 | |

## `Cleaned Data` — speech-ready queue

| Col | Header | Filled | Source | Notes |
|---|---|---:|---|---|
| A | SKU | 140/140 | `Sheet1.B` | |
| B | **Name** | 134/140 | **Names Master Sheet** | Phonetic spoken name — `S T 6 4 b22 8 wats`. **6 rows blank → those orders speak nothing.** |
| C | Quantity | 134/140 | `Sheet1.C` | 6 blank — matches FB-054, FB-150 *"not speak quantity"* |
| D | Post Code | **109/140** | parsed from `Sheet1.I` | **31 rows blank (22%)** — matches FB-025, FB-028, FB-139 |
| E | Selling Platform | 55/140 | `Sheet1.K` | |
| F | Instruction QR | 5/140 | `Sheet1.L` | |
| G | Image URLs | 140/140 | `Sheet1.N` | |
| H | Merge Order | **6/140** | `Sheet1.O` | |
| I | Component | 72/140 | derived | `Combo: 1`, `Combo: 2` — the component counter |
| J | Title | 140/140 | `Sheet1.A` | Displayed, not spoken |
| K | Price | 140/140 | `Sheet1.G` | |
| L | Customer Info | 140/140 | `Sheet1.I` | |
| M | Combo SKU | 75/140 | `Sheet1.D` | |
| N | Status | 17/140 | `Sheet1.M` | |
| O | Send Order Instruction | 1/140 | `Sheet1.Q` | |
| P | Component *(dup)* | 72/140 | — | **Duplicate of col I header** |
| Q | Send Order Instruction *(dup)* | 1/140 | — | **Duplicate of col O header** |
| R | SKU Combined | 8/140 | derived | |

---

## Findings from the mapping

### F1 — `Post Code` is 22% empty, and it is the field the packer needs most
109 of 140 rows carry a postcode. The postcode is parsed out of the free-text
`Customer Info` blob, which has no consistent format across six selling platforms.
This is the direct cause of the long-running *"post code not shown"* thread
(FB-025, FB-028, FB-098, FB-116, FB-139, FB-056) — the parse silently fails and the
tool speaks nothing rather than flagging it.

**Fix:** ask the platforms' export for a discrete postcode field, and make a failed
parse speak *"postcode missing — check screen"* instead of falling silent.

### F2 — `Merge Order` is populated on 6 of 140 rows
Merge orders are *not* actually being flagged in the data. The tool therefore cannot
group them, which is exactly what every station is asking for (FB-003, FB-140, FB-145,
FB-152, FB-153, FB-159). Merging is currently inferred from a matching postcode — and
that inference breaks when two different customers share a postcode
(FB-116, and the Unit 3 Lampshade note *"same postcode customer varathala merge order
mathiri varuthu (Important)"*).

**Fix:** derive the merge key from **customer name + address**, not postcode alone;
write a real `Merge Group ID` into the data.

### F3 — Duplicate headers (P/Q repeat I/O)
`Cleaned Data` carries `Component` and `Send Order Instruction` twice. Any script
reading by header name will bind to whichever it hits first. Harmless today, a
silent-wrong-value bug tomorrow.

### F4 — `Address` column holds only the postcode
`Sheet1.J` is named `Address` but contains `W3 6HH`. The real address is inside
`Customer Info`. Rename to `Post Code` to stop the next developer guessing.

### F5 — 6 rows have no phonetic `Name`
Blank `Name` = a silent order. The tool should fall back to spelling the SKU and log the
gap for the postage team, rather than skipping.
