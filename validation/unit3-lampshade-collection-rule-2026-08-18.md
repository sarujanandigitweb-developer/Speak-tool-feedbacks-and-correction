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
`LSHQ` `LSBL` `LSBT` `LSMC…` `LSSC` `LSWT` `LSYG` `WCFS` and the rest. One of them,
**`LSHQ180BG`**, is in the current pack lists — its exclusion is the rule working, not a gap.

> **Corrected 2026-08-18.** An earlier version of this section named `LSCP150GR2PK` and
> `WCFSDCBM` as the live examples, and §5 reported 46 orders and 14 collections. Those figures
> came from an earlier copy of `order_details/`. The files now hold **16 orders**, and the run
> below is the current one. The rule and the code are unchanged; only the sample was stale.

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

## 5. Live run — 16 orders from `order_details/1–3.html`

Both builds were run over the same 16 orders and produce **identical batches**:
`scripts/Unit 3 Lampshade/packing-priority.gs` (Google Sheets) and `speak_tool_html/engine.js`
(standalone). 5 collections triggered.

```
orders parsed: 16

--- classification across the live pack lists ---
  LSCY2 (FULL)         LSCY210BG, LSCY290GY, LSCY290RE, LSCY290BG
  LSFT (FULL)          LSFT320OR, LSFT220WH
  LSMS (FULL)          LSMS320NB
  LSOL (FULL)          LSOL180BB
  LSSS (RUN)           LSSS300CO
  NOT COLLECTED        CRFF500BM, PHCH1BMRBM, PHHT1PBRRO, WCWDRO, PHHT1FBRBM, CRSF100BM, PHRYWP1RBM, CRSF100CO, PHSH1PBRCO, CRSF1202BM, PHHR2HETHE, LDMST64E274, HKR10BM, HK10BM, SPSDCSBM, WSFH1BMYB, PSDS2RBW, SCRN70BM, CRSF100YB, WSLS155YB, SCRN70YB, RPR44WH, PHCH1FBRBM, PHSF1BMTBM3PK, LSHQ180BG, PHSHF1PBRYB, LDMG80E274, PCGZ20MX, CRFF65YB, WSST70GB, RWFG, RWETM4GD
  WCCY (RUN)           WCCYSP160GD2PK, WCCYSP180WH

collections triggered: 5  (orders with 2 batches: 0)

  Order 1 -> batch 1  13/15  [Whole pack list]
      LSCY210BG  210mm  Matte Black  x3   for PR9 8RJ
      LSFT320OR  320mm  Orange  x1   for NW4 1SH
      LSFT220WH  220mm  White  x2   for CF64 1SE
      LSOL180BB  180mm  Brushed Brass  x2   for GL54 2BX
      LSCY290GY  290mm  Grey  x3   for NG31 8GA
      LSCY290RE  290mm  Red  x2   for EH45 8LW

  Order 5 -> batch 2  1/15  [These orders only]
      LSSS300CO  300mm  Copper  x1   for BS4 4BN

  Order 12 -> batch 3  6/15  [Whole pack list]
      LSCY290BG  290mm  Matte Black  x4   for CV1 1EY
      LSMS320NB  320mm  Navy Blue  x2   for NR14 7AW

  Order 13 -> batch 4  2/15  [These orders only]
      WCCYSP160GD2PK  mm  Gold  x2   for NG17 8NL

  Order 15 -> batch 5  2/15  [These orders only]
      WCCYSP180WH  mm  White  x2   for NP23 4RR
```

The `mm` shown against the `WCCY` cage shades is the test harness's own formatting; `size` is
empty for them and both user interfaces omit the line.

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
