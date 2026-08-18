# Unit 3 Lampshade — SKUs missing from Sheet1

**Reported:** 2026-08-14 · **Status:** 🟠 cause fixed in code · data still damaged
**Sheet:** [Unit 3 Lampshade speak tool](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) · `Sheet1`

## Symptom

> "If the same SKU appears twice, only the first occurrence is displayed. If it appears six
> times, only one is displayed. This does not occur in the other sheets."

## Measured on the live sheet

| Measure | Value |
|---|---:|
| Sheet1 data rows | 169 |
| Rows with a **blank** SKU | **60** |
| SKUs still appearing more than once | **0** |

Zero duplicates is the decisive signal. In real order data the same product sells to many
customers — `LSHM400HE` alone appears on 5 separate orders. A natural order export cannot have
zero repeated SKUs. Something removed every repeat.

## Cause — `blankDuplicateSKUsInSheet1()` in `sku.gs`

The original body kept the first occurrence of each SKU and **wrote an empty string over every
later one**, then saved that back over Sheet1:

```js
if (!sku || skuCount[sku] < 2) continue;   // only touch SKUs seen 2+ times
if (seen.has(sku)) {
  data[i][skuIndex] = '';                  // blank the repeat — permanent
} else {
  seen.add(sku);                           // keep the first
}
sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
```

"Keep the first, blank the rest" is precisely the reported behaviour, including the six-times case.

**Why only Unit 3 Lampshade.** The function is byte-identical in all six stations, so this is not a
Unit 3 code difference. It is also called by nothing — not `mergeAndCleanSheets()`, not any menu
item. It can only have been run by hand from the Apps Script editor's ▶ Run button, and that was
done on Unit 3 Lampshade only. The other five stations still hold the function but have never
executed it, which is why their data is intact.

## Knock-on effect in the pipeline

`processRow()` in `cleaned.gs` falls back to `Combo SKU` when `SKU` is blank. When both are blank
the row yields no name, and the existing rule `if (!name) quantity = ''` blanks the quantity too.
The row then reads as empty rather than as an error — the loss is silent, which is why it surfaced
as a display complaint rather than a crash.

## Fix applied

`blankDuplicateSKUsInSheet1()` in `scripts/Unit 3 Lampshade/sku.gs` now refuses to run. It logs and
alerts an explanation instead of touching the sheet. Verified: the function returns without
reaching `SpreadsheetApp.getActiveSpreadsheet()`.

Nothing else was changed. The other five stations' `sku.gs` were left exactly as they are, and no
other function in Unit 3's `sku.gs` was modified.

## The 60 blanked SKUs cannot be restored from code

Recovery was measured, not assumed — matching blanked rows against rows that still carry a SKU:

| Match key | Recovers safely | Ambiguous | No match at all |
|---|---:|---:|---:|
| `Title` | 29 | 4 | **27** |
| `Link` (ASIN) | 27 | 9 | 24 |

Neither key covers even half the damage, and the ambiguous rows are combo listings where one Title
legitimately maps to several SKUs:

```
Semi Flush Mount Ceiling Lamp Antique Style ~1238 - Cyan
    -> LDMST64E274 | LHNSE27BM | LSMS320CB | SCRN70YB
```

Writing a guess there would put the **wrong SKU on a real customer's order** — a mispick, which is
worse than a visible blank. I have not written a repair routine.

**Recommended recovery: re-import Sheet1 from the order source.** That restores all 169 rows
correctly. With the function now disabled, the blanking cannot recur.

## Audit — everything in Unit 3 Lampshade that writes to a sheet

| File | Function | Writes to | In the pipeline? | Risk to Sheet1 |
|---|---|---|---|---|
| `cleaned.gs` | `mergeAndCleanSheets` | Cleaned Data | yes | none |
| `cleaned.gs` | `keepOnlyLastOccurrenceInD` | Cleaned Data | yes (`cleanedSheet` passed) | none |
| `cleaned.gs` | `keepOnlyLastOccurrenceInE` | Cleaned Data | yes (`cleanedSheet` passed) | none |
| `cleaned.gs` | `clearFIfDIsEmptyInSheet` | Cleaned Data | yes (`cleanedSheet` passed) | none |
| `cleaned.gs` | `removeRPR44WHAndTransferPostCode` | Cleaned Data | yes | none |
| `cleaned.gs` | `addCombinedSKUSet` | Cleaned Data | yes | none |
| `Merge SKU.gs` | `mergeAdjacentRowsAndRepeat` | Cleaned Data | yes | none — reads Sheet1 only |
| `sku.gs` | `copySKUFromSheet1ToCleanedData` | Cleaned Data | **no** | none — reads Sheet1 only |
| `sku.gs` | **`addProductNamesFromSKU`** | **Sheet1** | **no** | see below |
| `sku.gs` | `blankDuplicateSKUsInSheet1` | — | no | **disabled** |

The three parameterised writers in `cleaned.gs` were checked at their call sites
(`cleaned.gs:205-207`) — all three are passed `cleanedSheet`, never `sheet1`. `Sheet1` is opened in
four places; only `addProductNamesFromSKU` writes to it, the rest read.

**So the whole live pipeline never writes to Sheet1.** Sheet1 is input-only, and Cleaned Data is
fully regenerated on every run.

## `addProductNamesFromSKU()` — writes Sheet1, but does not delete SKUs

`sku.gs:69` and `sku.gs:91`. It appends a `Product Name` column and writes every row back:

```js
row[productNameIndex] = productName;   // only the new column is set
updates.push(row);                     // SKU, Title, Combo SKU all carried through unchanged
sheet1.getRange(2, 1, updates.length, sheet1Headers.length + 1).setValues(updates);
```

Each row is written back with its original values intact, so this is **not** a second cause of the
missing SKUs. Two defects worth noting anyway, since it is still runnable by hand:

- If `Combo SKU` is absent, `comboSkuIndex` is `-1` and every product name comes out blank.
- On a second run `Product Name` already exists, so rows are `headers.length` wide while the range
  is `headers.length + 1` — `setValues` throws a dimension mismatch.

Left untouched: it is not the cause of this issue, and the brief is to change only what was asked.

## Note — the fix was reverted once

The first application of this fix was overwritten when `sku.gs` was opened in the IDE and an older
editor buffer was saved over it. It has been re-applied and re-verified. If `sku.gs` is open in
VS Code with stale content, close or reload it before editing, or the same revert can happen again.
