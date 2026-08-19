# Unit 3 Lampshade — three rule corrections of 2026-08-19

**Author:** Sarujanan · **Date:** 2026-08-19 · **Project:** STFC · **Assigned by:** Varmen
**Amends:** `validation/unit3-lampshade-collection-rule-2026-08-18.md` (lists and packing ranks only —
everything else in that document still stands).

Reported by the postage team with a screenshot: a "Collection Batch, These orders only, 2 / 15" card
for `WCCYSP160GD2PK`, an order no other order shared.

---

## 1. What changed

### 1.1 `WCWD` is a lampshade

Added to **list 1** ("these orders only") and classified as a **lampshade type** everywhere the
packing sort runs — not only for collection.

Live SKUs: `WCWDBM` `WCWDRO` `WCWDCH` ("v diamand"). They were previously typed `OTHER` and so were
spoken last and never collected.

`WCWD` does **not** collide with the existing `WCD` prefix (they differ at the third character), and
does **not** pull in the neighbouring `WCW*` families — `WCWYBM`, `WCWVBM`, `WCWODVBM`, `WCWBBM` all
remain `OTHER`. `WCB`, `WCCY` and `WCD` are unchanged: still collected, still ranked `OTHER`.

`WCWD` is absent from the Lampshade SOT, so its size token is blank on the card. **Data gap, not a
rule** — the SOT needs the three rows adding.

### 1.2 A plain ceiling rose ranks as "Other" in both types

| | Rect Ceiling Rose | Lampshade | Bulb | Plain Ceiling Rose | Other |
|---|---|---|---|---|---|
| **Type 1** — a rect rose is present | 1 | 2 | 3 | 4 | 4 |
| **Type 2** — no rect rose | — | 1 | 3 | **4** (was 2) | 4 |
| **Type 3** — no lampshade and no rose | no ranking at all — pack list order stands | | | | |

Rose and Other **tie**, and the sort is stable, so a plain rose keeps its position relative to the
other accessories; it only steps behind the bulb. Type 1 already ranked it 4, so the two types now
agree.

**Measured:** 25 of 155 live orders change, every one of them "rose moves after the bulb".

### 1.3 A list-1 collection of ONE order is not shown

> "If there is only one order and the next order is not one of these types, do not mention or apply
> this special logic."

Read as **the same shade family in the next order** (confirmed 2026-08-19, against the alternative of
any list-1 family). A list-1 collection exists to save walks; a run of one saves nothing — the packer
is sent to the shelf for a shade they were fetching with the order anyway.

**List 2 ("whole pack list") is untouched** — it was never about runs.

**Measured:** 16 of 20 list-1 cards disappear, including the one in the screenshot. The 4 that
survive are genuine multi-order runs:

| Trigger order | Family | Items | Orders served |
|---|---|---|---|
| 20 | `WCD` | `WCDC10CH` ×6 | 2 |
| 39 | `LSGL` | 6 shades | 2 |
| 82 | `LSSS` | `LSSS300GR` ×9 | 2 |
| 137 | `WCB` | 5 shades, 11 items | 2 |

### 1.4 Follow-on defect found while verifying (fixed)

Suppressing a card left the trolley pool at **−1** for that shade, because the code subtracted what
an order consumed whether or not a batch had supplied it. The next genuine run of the same shade was
then measured against a debt already paid and produced a **second card for stock the packer was
already holding**. The pool is now clamped at zero — you cannot hold negative stock.

This could not happen before 1.3, because every collectible used to arrive via a batch.

---

## 2. Files changed

| File | Change |
|---|---|
| `scripts/Unit 3 Lampshade/packing-priority.gs` | all three rules + the pool clamp (Google Sheets build) |
| `speak_tool_html_sheet_UI/engine.js` | the same three rules + the pool clamp (HTML build) |
| `packlist_extension/packlist-speak.js` | rebuilt |
| `packlist_extension/speak-loader.html` | rebuilt |
| `packlist_upload/Speak-Tool.html` | rebuilt, 535 KB — the file that goes to the dashboard |
| `packlist_extension/build.js` | now writes the deliverable to `packlist_upload/`, following the 2026-08-19 move |

No UI, speech, microphone, name-lookup or pack list parsing code was touched.

---

## 3. Verification — 13 pack lists, 155 orders, 438 components

Run against the payload decoded **out of the uploaded file**, not the sources.

| Check | Result |
|---|---|
| `WCWDBM` / `WCWDRO` / `WCWDCH` type | `SHADE` ✅ |
| `WCWD*` collection family | `WCWD` / list 1 ✅ |
| Other `WCW*`, `WCB`, `WCCY`, `WCD` still `OTHER` | ✅ unchanged |
| Packing types found | 10 type 1 · 83 type 2 · 62 type 3 |
| Rank inversions | **0** |
| Sort stability inside a rank | **0** breaks |
| Type 3 orders reordered | **0** (pack list order preserved) |
| Plain rose spoken before a bulb | **0** (was 25 orders) |
| List-1 collections | **4** (was 20) |
| List-1 collections spanning one order | **0** |
| List-2 collections | **10** (unchanged) |
| Collections over 15 without the overflow flag | **0** |
| Orders left short by a card that was shown | **0** |
| Sheets engine vs HTML engine, 5,548 SKUs | **0** product-type and **0** collection-family disagreements |

---

## 4. Still open (decisions, not code)

- `WCWD` has no Lampshade SOT row, so its collection card shows no size.
- `WCB`, `WCCY`, `WCD` are collected but still rank `OTHER` in the packing sort. Only `WCWD` was
  named as a lampshade type; the rest were left alone deliberately.
- 3 of the 10 list-2 collections cover a single order. The single-order rule was given under the
  "These Orders Only" heading, so list 2 was not changed — confirm whether it should be.
