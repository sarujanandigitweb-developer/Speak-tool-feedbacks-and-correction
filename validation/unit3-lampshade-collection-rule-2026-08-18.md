# Unit 3 Lampshade — collection rule of 2026-08-18

**Author:** Sarujanan · **Date:** 2026-08-18 · **Project:** STFC · **Assigned by:** Varmen
**Supersedes:** `validation/unit3-lampshade-collection-run.md`, which records the previous rule
(every LS-prefixed product collectible, whole pack list scanned for all of them). That rule has been
removed, not amended.

---

## 1. The rule as supplied

A lampshade is collected **only** when its SKU starts with one of the prefixes below. The two lists
scan differently.

### List 1 — "these orders only"

`LSBS` `LSSS` `LSWE` `WCCY` `LSCYRO` `LSBG` `LSCG` `LSFG` `LSGD` `LSGG` `LSGL` `WCB` `WCD`

Collect across the run of **consecutive** orders that need the **same SKU family**, stopping at the
first order that does not. Maximum 15 per collection.

> Worked example given: order 3 and order 4 carry that family, order 5 does not — collect order 3 and
> order 4 only.

### List 2 — "whole pack list"

`LSCY2` `LSDM` `LSDO` `LSEL` `LSFT` `LSHH` `LSHM` `LSLC` `LSLT` `LSMS` `LSOL` `LSRP` `LSTF` `LSTL`
`LSTM` `LSUL` `LSWD`

Scan the entire remaining pack list, exactly as the previous logic did. Maximum 15 per collection.

---

## 2. Decisions taken 2026-08-18

| # | Question | Decision |
|---|---|---|
| 1 | Lampshades in neither list | **Not collected at all** — packed straight from the order, like a bulb |
| 2 | An order short on both lists | **Two collections**, 15 each. The limit is per list, not shared |
| 3 | What ends a list-1 run | The first order **without that same SKU family** |

Families falling outside both lists, and therefore never collected: `LSCA` `LSCO` `LSCP` `LSFC`
`LSHQ` `LSBL` `LSBT` `LSMC…` `LSSC` `LSWT` `LSYG` `WCFS` and the rest. Two of them,
**`LSCP150GR2PK`** and **`WCFSDCBM`**, are in today's live orders — their exclusion is the rule
working, not a gap.

---

## 3. Points that needed care

**Longest prefix wins.** The lists are not disjoint by length: `LSCYRO` (list 1) and `LSCY2` (list 2)
both begin `LSCY`. Matching the longest prefix puts `LSCYRO120GD` in list 1 and `LSCY290BM` in list 2.
`LSCY2` is a genuine prefix rather than a size — the SOT also holds `LSCY1C12FG`, which is in neither
list and is correctly not collected.

**Millimetre sizes are an LS convention.** Bringing `WCB`, `WCCY` and `WCD` into the collection put
cage shades through the size parser for the first time. `WCB7BS` read as "7mm" and `WCCYSQBM2PK` as
"2mm" — the first is a cage size, the second a 2-pack code. `ppProductSize()` and `sizeOf()` now
return nothing for a non-LS SKU, and both cards omit the size line rather than printing a wrong one.

**Family is part of the grouping key.** Same size and same colour does not make `LSBS160OR` and
`LSGD160OR` the same product, and a merged card could not say how many of each to take.

**The triggering order is always completed**, even past 15. Stopping mid-order would leave it
unpackable — the pool would not cover its own trigger. The overflow is flagged on the card, not hidden.
Unchanged from the previous rule.

---

## 4. Known inconsistency, not changed

`WCB`, `WCCY` and `WCD` are now collected as lampshades, but `ppProductType()` still ranks them
`OTHER` in the packing-priority sort, because that classification was not part of this change. So a
cage shade is collected first and packed last. Flagged for a decision; no code changed.

---

## 5. Live run — 46 orders from `order_details/1–3.html`

Both builds were run over the same 46 orders and produce **identical batches**:
`scripts/Unit 3 Lampshade/packing-priority.gs` (Google Sheets) and `speak_tool_html/engine.js`
(standalone). 14 collections triggered.

```
orders parsed: 46

--- classification across the live pack lists ---
  LSBS (RUN)           LSBS160GY, LSBS160OR
  LSCY2 (FULL)         LSCY210BG, LSCY290BM, LSCY290GB, LSCY290GY, LSCY290YB
  LSDM (FULL)          LSDM220CO
  LSDO (FULL)          LSDO210BM, LSDO210BI, LSDO210BB, LSDO210BC, LSDO210BG, LSDO210OR, LSDO210GR
  LSFT (FULL)          LSFT220BC, LSFT220RR
  LSHH (FULL)          LSHH240BM
  LSOL (FULL)          LSOL180BC, LSOL220YB
  LSTF (FULL)          LSTF40BG
  LSWE (RUN)           LSWE315OR
  NOT COLLECTED        LDCWGU105, BLOB1GU300, LDCWGU107, BLOB1GU400, CRFF140BM, WSWH135BM, CRFF500BM, PHCH1BMRBM, PHHN1PBRCO, CRFF500CH, LDMT45E274, PHCH1FBRBM, CRSF100BM, PHRYWP1RBM, CRSF100GB, PHCHPBRGB, CRSF100OR, PHRB1PWRPW, CGWDWO, CRSF2003BM, PHRB1PBR45BM, CRFF2008BM, RWWD, RWWP, CO532AGY, CBSFEARTH, PHFMHT2BRBM, WSFH1BMYB, LDMST64E274, PSDS2BPB, SCRN70BM, LHNSE27YB, LDMST64E278APK, LSCP150GR, RPR44WH, PLHCBC, PHTT1PBRBM, WSCH135BM, WSHR135BM, PHRI1PBRBY, LDMT185B2245PK, PLADBM, PLWSBM, CRSF100SN, PHCHPCRSN, PHHN1PBRGD, CRFF500YB, PHCHPCRYB, PLADRR, WCFSDCBM, PHCT1BMRBM, PHDO1PBRBM, PLADBC, PHSH2PBRYB, SPUWBM, SPWRBM, CRFF140YB, WSNW170YB, CBFF140BM, PHSF2BMRBM, SPSDP2BM, LHNDE27BM, LHNSE27BM
  WCB (RUN)            WCBCBB, WCB7BS, WCB7WH, WCB7BM
  WCCY (RUN)           WCCY1ROCH, WCCYSQBM2PK, WCCYSQCH

collections triggered: 14  (orders with 2 batches: 0)

  Order 3 -> batch 1  12/15  [Whole pack list]
      LSDO210BM  210mm  Black Matt  x2   for DA9 9EW
      LSCY210BG  210mm  Matte Black  x3   for FK42AU
      LSDO210BI  210mm  Black Glossy  x3   for L40 9QJ
      LSCY290BM  290mm  Black Matt  x1   for IV6 7UL
      LSCY290GB  290mm  Green Brass  x3   for NW2 3PG

  Order 6 -> batch 2  3/15  [These orders only]
      WCCY1ROCH  mm  Chrome  x3   for HU12 0PJ

  Order 10 -> batch 3  1/15  [These orders only]
      LSWE315OR  315mm  Orange  x1   for CT8 8QE

  Order 11 -> batch 4  9/15  [These orders only]
      LSBS160GY  160mm  Grey  x3   for B98 8QG
      LSBS160OR  160mm  Orange  x6   for BN14 8QP, ST6 5LN

  Order 14 -> batch 5  15/15 FULL  [Whole pack list]
      LSDO210BB  210mm  Brushed Brass  x4   for NR26 8HY
      LSOL180BC  180mm  Brushed Copper  x4   for NR26 8HY
      LSFT220BC  220mm  Brushed Copper  x2   for CH7 6XP
      LSTF40BG  220mm  Matte Black  x2   for PH22 1TH
      LSDO210BC  210mm  Brushed Copper  x3   for DN15 9DE

  Order 20 -> batch 6  3/15  [These orders only]
      WCBCBB  mm  Brushed Brass  x3   for RM3 0XX

  Order 21 -> batch 7  13/15  [Whole pack list]
      LSHH240BM  240mm  Black Matt  x2   for SA38 9JP
      LSDM220CO  220mm  Copper  x2   for BT62 3SG
      LSDO210BG  210mm  Matte Black  x3   for MK2 3PD
      LSCY290GY  290mm  Grey  x3   for Y14 VY44
      LSCY290GB  290mm  Green Brass  x3   for WD24 5BJ

  Order 27 -> batch 8  2/15  [These orders only]
      WCB7BS  mm  Brushed Silver  x2   for NP19 9HR

  Order 30 -> batch 9  13/15  [Whole pack list]
      LSDO210OR  210mm  Orange  x3   for LN8 3BJ
      LSCY290YB  290mm  Yellow Brass  x3   for IG7 6ES
      LSDO210GR  210mm  Green  x3   for EH22 4HQ
      LSCY290BM  290mm  Black Matt  x3   for BL3 1PS
      LSDO210BC  210mm  Brushed Copper  x1   for EH75FD

  Order 31 -> batch 10  2/15  [These orders only]
      WCCYSQBM2PK  mm  Black  x2   for WF12 7EF

  Order 38 -> batch 11  2/15  [These orders only]
      WCCYSQCH  mm  Chrome  x2   for CO15 1NF

  Order 41 -> batch 12  6/15  [Whole pack list]
      LSOL220YB  220mm  Yellow Brass  x3   for CB2 0BA
      LSFT220RR  220mm  Rustic Red  x3   for IP6 0EY

  Order 42 -> batch 13  2/15  [These orders only]
      WCB7WH  mm  White  x2   for EX34 9NB

  Order 46 -> batch 14  2/15  [These orders only]
      WCB7BM  mm  Black  x2   for GL20 6BD
```

The `mm` shown above is the test harness's own formatting; `size` is empty for the cage shades and
both user interfaces omit the line.

---

## 6. Files changed

| File | Change |
|---|---|
| `scripts/Unit 3 Lampshade/packing-priority.gs` | Previous collection section replaced: two prefix lists, `ppCollectionFamily()`, per-list batches, `ppProductSize()` guarded to LS |
| `scripts/Unit 3 Lampshade/Lithursan.gs` | `buildCollectionView()` renders several batches per order, with a scope chip; size line hidden when empty |
| `speak_tool_html/engine.js` | Same rule; `buildCollections()` now returns an array of collections per order |
| `speak_tool_html/app.js` | Queue pushes one entry per collection; scope chip on the card |

Backups of the previous versions: `packing-priority.gs.bak`, `engine.js.bak`, `Lithursan.gs.bak2`.

Untouched: name lookup, `skuToName`, quantity handling, `keepOnlyLastOccurrenceInD`, postcode and
name speech building, the packing-priority sort itself, and the other five stations.
