# Issue Analysis — Index & Scoreboard

Every one of the **160 reported issues**, split into one file per station, each analysed
individually to file · function · line — the same depth as the Unit 4 analysis.

---

## Scoreboard

### What was read and mapped

| Station | Issues | Read | Mapped to code line | File |
|---|---:|:---:|:---:|---|
| Unit 4 | 59 | ✅ | ✅ **all 59** | [unit-4.md](./unit-4.md) |
| Unit 3 Others | 58 | ✅ | ✅ **all 58** | [unit-3-others.md](./unit-3-others.md) |
| Unit 3 Lampshade | 23 | ✅ | ✅ **all 23** | [unit-3-lampshade.md](./unit-3-lampshade.md) |
| Schmutter | 14 | ✅ | ✅ **all 14** | [schmutter.md](./schmutter.md) |
| Kronen | 6 | ✅ | ✅ **all 6** | [kronen.md](./kronen.md) |
| All Stations | 12 | ✅ | — registry + order types, not defects | — |
| **Total** | **160** | ✅ | ✅ **160 / 160** | |

### Status — what the sheet claims vs what the code proves

| Station | Issues | Sheet: Done | Sheet: Open | Sheet: Untriaged | ✅ Verified fixed | ⚠️ Unverified | ❌ Proven not fixed |
|---|---:|---:|---:|---:|---:|---:|---:|
| Unit 4 | 59 | 52 | 7 | 0 | **7** | 3 | **49** |
| Unit 3 Others | 58 | 36 | 21 | 1 | **4** | 8 | **46** |
| Unit 3 Lampshade | 23 | 0 | 0 | 23 | **0** | 3 | **20** |
| Schmutter | 14 | 5 | 7 | 2 | **2** | 2 | **10** |
| Kronen | 6 | 4 | 2 | 0 | **2** | 2 | **2** |
| **Total** | **160** | **97** | **37** | **26** | **15** | **18** | **127** |

> **The sheet says 97 issues are Done. The code shows 15 are actually fixed.**
>
> The gap is not dishonesty — it is that closing an item was never verified. "Done" was recorded
> when a change was made, not when the behaviour was confirmed. Several fixes also landed on one
> station's script copy and never reached the other five.

### Status legend

| Mark | Meaning |
|---|---|
| ✅ **Verified fixed** | Confirmed working in the code, or the reporter wrote a confirmation in the Feedback column |
| ⚠️ **Unverified** | Marked Done but no code evidence either way — needs a live run — or blocked on missing sheet data |
| ❌ **Proven not fixed** | The code (or a screenshot in the sheet) shows the behaviour is still broken |

Checkboxes in each file: `- [x]` = verified fixed, `- [ ]` = not fixed.

---

## Root causes across all stations

| RC | Root cause | Issues | Layer | Effort |
|---|---|---:|---|---|
| **C** | No order grouping / grouping keyed wrongly | **43** | Script | L |
| **A** | No SSML — codes and postcodes read as numbers | **17** | Script | M |
| **B** | Recognition dies; mic open during speech → self-trigger | **17** | Script | M |
| **D** | Postcode dedupe by adjacency → cascades to blank QR | **12** | Script | M |
| **E** | `slice(0,-3)` for a 2-char suffix; failed lookup blanks quantity | **10** | Script | **XS** |
| **K** | Features that were never built (hold, screenshot, resume, mic icon) | **10** | Script | S |
| **I** | Mapping never wired + names sheet lacks its columns | **8** | Script + Data | S |
| **L** | Column genuinely absent from `Sheet1` | **9** | **Data** | — |
| **N** | Name + quantity spoken twice | 6 | Script | S |
| **F** | `getValues()` destroys leading zeros | 4 | Script | **XS** |
| **J** | `Status` (`international` / `firstclass`) displayed, never spoken | 4 | Script | **XS** |
| **G** | `merge order total: N : merge order: 1` wording | 4 | Script | **XS** |
| **H** | `RPR44WH` row deleted; postcode moved by backward scan | 5 | Script | M |
| **M** | Name wrong or missing in the names master sheet | 8 | **Data** | — |

### By layer

| Layer | Issues |
|---:|---|
| **Apps Script logic** | **136** |
| Apps Script **+** sheet data | 8 |
| Sheet data only | 16 |

**No issue is caused by spreadsheet formatting or formulas** — neither `Sheet1` nor `Cleaned Data`
contains any formula. Both are static values written by the script.

---

## Which station runs which code

Grouping is what allows the tool to speak "Component 1 of 3". **Four of six stations cannot do it.**

| Station | `Lithursan.gs` | Groups? | `cleaned.gs` | Deletes `RPR44WH`? |
|---|---|:---:|---|:---:|
| Unit 3 Lampshade | 948 L `cf36959f` | ✅ | 296 L `7a19fd3f` | ✅ |
| Schmutter | 948 L `cf36959f` | ✅ | 263 L `af9a549b` | ❌ |
| Unit 3 Others | **1288 L** `086c35e6` | ❌ | 345 L `00b8cedb` | — |
| Unit 4 | 703 L `625c098a` | ❌ | 296 L `7a19fd3f` | ✅ |
| Kronen | 703 L `625c098a` | ❌ | 263 L `af9a549b` | ❌ |
| Person 2 | 703 L `cea32a68` | ❌ | 263 L `af9a549b` | ❌ |

Unit 3 Others has the **largest** file of the six and still no grouping — a different lineage, not a
newer version.

---

## Recommended fix order

Cheapest and most provable first. Steps 1–5 are **five small changes closing 35 issues** across all
five stations.

| Step | Fix | RC | Closes | Effort |
|---:|---|---|---:|---|
| 1 | `cleaned.gs:112` pack-suffix regex · `:116` stop blanking quantity | E | **10** | XS |
| 2 | `cleaned.gs:27` → `getDisplayValues()` | F | 4 | XS |
| 3 | `cleaned.gs:92-94` drop the `merge order total: N` prefix | G | 4 | XS |
| 4 | Speak `Status` (`international` / `firstclass`) | J | 4 | XS |
| 5 | Fix the double write; remove the duplicate `onOpen()` | — | blockers | XS |
| 6 | Recognition: remove `stop()`, restart on error, gate mic while speaking | B | **17** | M |
| 7 | Add `synth.resume()`, a real mic indicator | K | 10 | S |
| 8 | Wire + guard the mapping; add `SKU.1` / `Mapping SKU` to names sheet | I | 8 | S |
| 9 | Decouple QR from postcode; composite-key dedupe | D | 12 | M |
| 10 | Token classifier + SSML | A | **17** | M |
| 11 | Port grouping to the 4 stations lacking it — **customer-safe key** | C | **43** | L |
| 12 | Add customer-note / carrier columns to the import | L | 9 | — |

⚠️ **Step 11 warning.** The 948-line grouping keys on the combo-SKU string **alone**. Live data shows
8 of 45 keys in one station are shared by more than one customer. Porting it unchanged to Unit 3
Others, Unit 4, Kronen and Person 2 would spread a wrong-parcel risk to four more stations. Group on
**combo SKU + customer + postcode**.

---

## Screenshot evidence

The workbook embeds **47 screenshots**; **16 read** so far — every image pair and every row whose
issue text was blank. Referenced as **P1–P14** inside the station files. Extracted copies and a
manifest are available on request.

| Station | Screenshots | Read |
|---|---:|---:|
| Unit 4 | 20 | 6 |
| Unit 3 Lampshade | 14 | 4 |
| Schmutter | 7 | 2 |
| Unit 3 Others | 6 | 4 |

---

## Related documents

- [../discovery-report.md](../discovery-report.md) — architecture, data flow, source-of-truth analysis
- [../open-defects.md](../open-defects.md) — the original thematic grouping
- [../../capability/upgrade-proposal.md](../../capability/upgrade-proposal.md) — the upgrade plan
- [../../documentation/02-code-walkthrough.md](../../documentation/02-code-walkthrough.md) — line-level code review
