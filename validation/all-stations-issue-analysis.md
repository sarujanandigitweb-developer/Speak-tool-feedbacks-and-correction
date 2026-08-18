# Unit 3 Others · Unit 3 Lampshade · Schmutter · Kronen — Issue-by-Issue Analysis

**101 issues** analysed individually, with status, root cause, responsible file/function/line, and
screenshot evidence where the sheet contains one.
Companion to [unit4-issue-analysis.md](./unit4-issue-analysis.md) (Unit 4's 59). **Total: 160.**

**Status:** Analysis only. No code changed.

---

## 0. Two corrections to my earlier reports

**Correction 1 — the shipping-class data DOES exist.** I previously said First-class/International
was blocked upstream because no column carried it. That was wrong. The `Status` column holds it:

| Value | Rows |
|---|---:|
| `international` | 14 |
| `firstclass` | 5 |

Identical in all three station sheets checked. The tool **renders `Status` in red** but never speaks
it — visible in screenshot **P12**, where "international" appears on screen while the spoken line is
`merge order total: 5 : merge order: 1 :: 1 Meter hemp holder Yellow Brass :: 1:`. So Unit 3 Others
#04/#42 and Unit 4 #19 are a **code fix, not an upstream blocker**.

**Correction 2 — the station drift is now proven, not inferred.** Evidence #14 in
[discovery-report.md](./discovery-report.md) was marked PARTIAL. Diffing the two `cleaned.gs`
versions shows the only difference is one function:

```
263-line (Kronen, Schmutter, Person 2)  ── no removeRPR44WHAndTransferPostCode()
296-line (Unit 3 Lampshade, Unit 4)     ── has it, called at :158
```

That single function deletes the `RPR44WH` rows, which is exactly why Person 2's `Cleaned Data` has
217 rows and Unit 3 Lampshade's has 140 from identical input. **Now VERIFIED.**

---

## 1. Which stations can group orders at all

Grouping is what lets the tool speak "Component 1 of 3". Checked for `combinedGroups` / `groupKey` /
`processedIndices` in every station's `Lithursan.gs`:

| Station | Version | Groups combo/merge? |
|---|---|---|
| Unit 3 Lampshade | 948 L | ✅ **Yes** |
| Schmutter | 948 L | ✅ **Yes** |
| **Unit 3 Others** (*Copy of jana speak*) | **1288 L** | ❌ **No** |
| Unit 4 | 703 L | ❌ No |
| Kronen | 703 L | ❌ No |
| Person 2 | 703 L | ❌ No |

**Four of six stations cannot assemble a multi-component order.** Unit 3 Others is the largest file
of the six (1,288 lines) yet still has no grouping — it is a different lineage, not an upgrade.

---

## 2. Screenshot evidence

I extracted all **47 images** embedded in the workbook and read **16** — every image pair, and every
row whose issue text was blank (where the picture *is* the ticket). Findings referenced as **P1–P14**
below.

### P8 — the decisive pair (Unit 3 Others, rows 81 + 82)

Same order, packlist vs speak tool:

| | Packlist (truth) | Speak Tool (spoken) |
|---|---|---|
| Product | **5 Meter** Vintage 3 Core, **Light Gold** | "3 Core Twisted **Cream**" |
| SKU | `CL3TGL5PK` → *MAPPED FOR* `CL3TCR5PK` | `CL3TCR5PK` |
| Quantity | 1 × **5 pack** | "**x 1 meter**" |
| Utterance | — | `Combo: 1 :: 3 Core Twisted Cream :: 1 meter: 3 Core Twisted Cream :: 1 meter: :Post Code: K Y 1 0 3 U J` |

**Four separate defects in one screen:**
1. **Wrong colour spoken** — "Cream" for a Light Gold product. The mapping swapped the SKU, and the
   name lookup then returned the *mapped* product's name.
2. **Wrong length spoken** — "1 meter" for a 5 Meter product. `cleaned.gs:112` strips `5PK` from
   `CL3TCR5PK` → `CL3TCR`, whose name in the master sheet is the **1-metre** variant. `:118-120` then
   appends `" meter"` to quantity `1`.
3. **Everything spoken twice** — the name and quantity repeat within one utterance.
4. **"Combo: 1" announced for a single product.**

### The other screenshots

| Ref | Where | What it shows |
|---|---|---|
| **P1** | U3L r52 (pair) | Speak tool says one item + "x 1"; packlist has **two** components (`CRFF75CO` + `HK10CO`), each x1. Packlist also carries `250 G LABEL`, `RM Packlist L u3` — none spoken. |
| **P2** | U4 r85 (pair) | Packlist header name **"Amazon Shipping Prime L u4"**; second image points at the `Status` column in `Cleaned Data`. |
| **P3** | U4 r86 (pair) | Packlist lists **5 components** incl. `LDMST64E274 MAPPED FOR ICST64E27`; speak tool shows **1** thumbnail (circled). Mapping demonstrably exists in the packlist system. |
| **P4** | U3O r71 | Names/mapping sheet: `CL3TCR5PK → CL3TIV5PK`, "MAPPED FOR", quantity **5 → 1** circled. |
| **P5** | U3O r76 | eBay packlist, customer note circled: *"One continuous length of 15m if you can please"*. Not in the tool. |
| **P6** | U3O r77 | Speak tool duplicates name+qty; packlist note *"Please can I have it all in one length"* missing. |
| **P7** | U3O r80 | `Cleaned Data`: `CL3TCR5PK` Name-derived quantity "**1 meter**" while Title says "5 Meter Vintage". Handwritten "Mapping". |
| **P9** | U3L r11 | Packlist with ~12 colour shades at x1 each (`LSFT220YE/BL/GR/OR/WH`…) scattered — the "pick one by one is hard" complaint. |
| **P10** | U3L r24 | **Two Amazon orders, same customer, same postcode UB8 1LB** — one plain, one combo. The merge case. |
| **P11** | U3L r28 | Names master sheet mid-edit (`PSDS2RBM` highlighted) — a name change being made. |
| **P12** | U3L r66 | Speak tool speaking **`merge order total: 5 : merge order: 1`** — the exact wording ticket #59 objects to. `international` shown in red but **not spoken**. German address (35781 Weilburg) with `en-US` voice. |
| **P13** | SCH r12 | Quantity badge renders "**X**" with **no number**. SKU `CRSF100BM+WSLS155BM` — a combo, so the name lookup failed and `cleaned.gs:116` blanked the quantity. |
| **P14** | SCH r13 | Italian postcode **`00049` displayed as `49`** and spoken "4 9". Definitive proof of the `getValues()` leading-zero bug. |

> **31 images not yet read** — mostly Unit 4 rows already covered by text, and later U3L rows. Say
> the word and I'll work through them.

---

## 3. Root causes used below

| ID | Root cause | File · function · line | Layer |
|---|---|---|---|
| **A** | No SSML; token read as a number. `name.split(" ").join(" ")` is a no-op | `Lithursan.gs` speech builder + `speakLine()` | Script |
| **B** | Recognition `stop()`+`start()` throws; `onerror` never restarts; mic open during speech → self-trigger | `Lithursan.gs` recognition handlers | Script |
| **C** | **No grouping** — flat per-row loop; `Component` read and discarded | `Lithursan.gs` `readRowAndSpeak()` | Script |
| **D** | Postcode dedupe by adjacency → blanks postcode → cascades to blank QR | `cleaned.gs:162-172`, `:186-192` | Script |
| **E** | `slice(0,-3)` strips 3 chars for a 2-char `"PK"`; failed lookup blanks quantity | `cleaned.gs:112`, `:116` | Script |
| **F** | `getValues()` not `getDisplayValues()` → leading zeros destroyed | `cleaned.gs:27` | Script |
| **G** | Merge label text `merge order total: N : merge order: 1` | `cleaned.gs:92-94` | Script |
| **H** | `RPR44WH` row deleted entirely; postcode moved by backward scan | `cleaned.gs:266-296` | Script |
| **I** | Mapping never called + names sheet lacks `SKU.1`/`Mapping SKU` | `test.gs:11-12`; names master | **Script + Data** |
| **J** | `Status` (`international`/`firstclass`) displayed but never spoken | `Lithursan.gs` display only | Script |
| **K** | Dead/absent features: no `synth.resume()`, `pauseTime` unused, `held` never filled, no mic indicator | `Lithursan.gs` | Script |
| **L** | Column genuinely absent from `Sheet1` (customer note, carrier, label weight) | `Sheet1` | **Data** |
| **M** | Name text wrong/missing in names master sheet | names master col B | **Data** |
| **N** | Duplicated utterance — name+quantity spoken twice | `Lithursan.gs` segment build | Script |

---

## 4. Unit 3 Others — 58 issues

Script: `Copy of jana speak/` — `Lithursan.gs` **1288 L** (no grouping), `cleaned.gs` **345 L**.

| # | Date | Issue | Status | RC | Responsible code | Fix |
|---:|---|---|---|---|---|---|
| 1 | 24/06 | 12 IP20 120 Speech gap | **OPEN** | A | `Lithursan.gs` utterance build | Token classifier + `<break>` between groups |
| 2 | 24/06 | Next order moving auto | done | K | `utter.onend` | resolved |
| 3 | 24/06 | Merge order shown fully, each component mentioned | done | **C** | `readRowAndSpeak()` flat loop | **Still broken** — no grouping exists |
| 4 | 24/06 | International showing as UK | done | **J** | `Status` not spoken; `utter.lang="en-US"` | Speak `Status`; set lang from voice |
| 5 | 24/06 | 3 types of pipe (not painted/black/galvanized) | **OPEN** | M | names master col B | Add finish to spoken name |
| 6 | 25/06 | Next day sticker speak | **OPEN** | L | column absent | Add to import |
| 7 | 25/06 | Hold button create | done | **K** | `held[]` never filled, no button | **Never built** |
| 8 | 25/06 | Services telling — evri, royal mail | **OPEN** | L | column absent (**P1** shows `RM Packlist L u3` on packlist) | Add carrier column |
| 9 | 25/06 | 2 times speak | done | **N** | segment build | **Still broken** — see **P6**, **P8** |
| 10 | 25/06 | Re-speak button | done | — | `controlSpeech("respeak")` | works |
| 11 | 25/06 | Prime/cable/transformer speak then continue | **OPEN** | A+J | — | Needs category rule |
| 12 | 25/06 | Pause button not complete | done | **K** | no `synth.resume()` | **Never fixed** — pause is one-way |
| 13 | 26/06 | Cable 10 meter speak | done | E | `cleaned.gs:112, 118-120` | See **P7/P8** |
| 14 | 26/06 | Total component | done | **C** | no grouping | **Still broken** |
| 15 | 26/06 | 3 CORE BROWN 10 METER | done | E/M | `cleaned.gs:112` | pack-suffix regex |
| 16 | 26/06 | SLOW DOWN SPEAK | done | — | `rateSelect` | works |
| 17 | 26/06 | NAME QUANTITY NOT | done | **E** | `cleaned.gs:116` | See **P13** |
| 18 | 26/06 | After postcode free gap need | done | A | segment join | Sequential utterances |
| 19 | 26/06 | Telling combo start & end | done | **C** | no grouping | **Still broken** |
| 20 | 26/06 | Hold screen shot | done | **K** | `html2canvas` loaded, never called | **Never built** |
| 21 | 26/06 | Mapping merge | done | **I** | `test.gs` | **Never wired** |
| 22 | 29/06 | 24 IP67 150 Watts → "sixty seven thousand" | done | **A** | no SSML | Classifier |
| 23 | 29/06 | Sometimes next not working | done | **B** | `stop()`+`start()` | **Still broken** |
| 24 | 29/06 | Don't auto-move to next order | done | — | — | resolved |
| 25 | 07/07 | Address issue can't show | done | D | `cleaned.gs:167` | Composite key |
| 26 | 07/07 | IP20 000 issue | done | **A** | no SSML | Classifier |
| 27 | 07/07 | "z" spoken as "c" | done | A | no SSML | `say-as characters` |
| 28 | 07/07 | Automatic hold issue | done | K | `held[]` unused | — |
| 29 | 07/07 | Quantity should be with meters for cables | done | E | `cleaned.gs:118-120` | works, but see #45 |
| 30 | 08/07 | UK English voice better than US female | done | A | `:697` hardcodes `Google US English` | Make configurable |
| 31 | 08/07 | Cable qty 5 should say 5 Meter | done | **E** | `cleaned.gs:112` | **See P8 — still wrong** |
| 32 | 08/07 | 12 voltage add | **OPEN** | M | names sheet | dev note confirms |
| 33 | 08/07 | 12 ip20 20 gap needed | done | A | no SSML | Classifier |
| 34 | 08/07 | Automatic hold issue | done | K | — | — |
| 35 | 09/07 | Merge & combo same time both names speak | **OPEN** *"not possible"* | **C** | no grouping | **Possible** — needs grouping |
| 36 | 10/07 | (repeat of 35) | **OPEN** *"not possible"* | **C** | as above | as above |
| 37 | 13/07 | Post code not shown when 2 postcode same | done | **D** | `cleaned.gs:167-169` | **Still broken** |
| 38 | 13/07 | Merge and combo speak auto one after other | **OPEN** | **C** | no grouping | Grouping |
| 39 | 13/07 | Colour code issue | done | **I** | mapping swaps SKU → wrong colour | **See P8 — "Cream" vs Light Gold** |
| 40 | 15/07 | PE11 3TY spoken "20 thousand" | done | **A** | postcode space dropped | Keep the space; SSML |
| 41 | 15/07 | Combo orders like speak merge | done | C | no grouping | Grouping |
| 42 | 15/07 | 2625-717 international address showing UK name | done | **J** | `Status` not spoken | Speak `Status` |
| 43 | 16/07 | SPSDP2BMY — add black cord grip gold top name | done | M | names master | **See P11** |
| 44 | 16/07 | Accessories image together | done | C | combo image lookup | Grouping |
| 45 | 16/07 | Cable 5m says 1m (CT20 2ED) | done | **E** | `cleaned.gs:112` | **See P7/P8 — still wrong** |
| 46 | 18/07 | 4 postcodes — next didn't play | **OPEN** | **B** | recognition death | **Still broken** |
| 47 | 21/07 | Prime speak tool next didn't play | **OPEN** | **B** | as above | as above |
| 48 | 23/07 | IP20 000 issue | **OPEN** | **A** | no SSML | Classifier |
| 49 | 25/07 | Transformer speak tool wrong | **OPEN** | A | order type→V→W | Per Kronen #3 |
| 50 | 27/07 | M22 9A2 000 issue | **OPEN** | **A** | postcode as number | Classifier |
| 51 | 27/07 | RH19 1SE don't tell colour | **OPEN** | **I** | mapping swaps colour | **See P8** |
| 52 | 25/07 | TF2 8NP speak goldtop | **OPEN** | M/I | name/mapping | Names sheet |
| 53 | 08/08 | LU1 4EL speak 1M | **OPEN** | **E** | `cleaned.gs:112` | **See P4 — qty 5→1** |
| 54 | 12/08 | SP11 6TQ not speak quantity | **OPEN** | **E** | `cleaned.gs:116` | **See P13** |
| 55 | 19/08 | Next didn't play | **OPEN** | **B** | recognition death | Restart on error |
| 56 | 15/09 | Customer note not shown; activate speak postcode | **OPEN** | **L** | no note column | **See P5/P6** |
| 57 | 02/10 | Not add note in packlist | untriaged | **L** | no note column | **See P6** |
| 58 | 07/10 | Mapping issue see above picture | **OPEN** | **I** | `test.gs` never wired | **See P7** |

---

## 5. Unit 3 Lampshade — 23 issues

Script: `Lithursan.gs` **948 L** (**has grouping**), `cleaned.gs` **296 L**.
**All 23 are untriaged** — the tab was opened 01/08/2025 and no status was ever set.

| # | Date | Issue | Status | RC | Responsible code | Fix |
|---:|---|---|---|---|---|---|
| 1 | 01.08 | Everything changed in Unit 4 must change in Unit 3 | untriaged | — | 6 script copies | Shared library |
| 2 | 06.08 | QR sollanum (must say QR) | untriaged | **D** | `cleaned.gs:190` wipes QR when postcode blank | Decouple QR from postcode |
| 3 | 06.08 | Reducer plate sollanum | untriaged | **H** | `cleaned.gs:280-288` deletes the row | Keep as component |
| 4 | 06.08 | Nextday sticker sollanum | untriaged | L | column absent | Add to import |
| 5 | 06.08 | BB4 4JY mount must not appear (Mapping) | untriaged | **I** | mapping not wired | Wire + guard |
| 6 | 06.08 | Merge order — all packed before postcode | untriaged | C | grouping order | Postcode last, once |
| 7 | 06.08 | BS39 4NN mount must not appear (Mapping) | untriaged | **I** | as #5 | as #5 |
| 8 | 06.08 | Free bulb shouldn't come first in packlist | untriaged | C | no pack sequence | `pack_sequence` ordering |
| 9 | 08.08 | All colour shades should come together | untriaged | C | no grouping by colour | **See P9** — group variants |
| 10 | 08.08 | CRFF2008BM / CBFF200BM accessories together | untriaged | C | grouping | as #9 |
| 11 | 08.13 | Bulb first, then shade | untriaged | C | no pack sequence | Ordering rule |
| 12 | 08.19 | QR sollala (QR not said) | untriaged | **D** | `cleaned.gs:190` | Decouple |
| 13 | 08.19 | Same postcode customer → looks like merge order **(Important)** | untriaged | **D** | `cleaned.gs:167` adjacency | **Composite key** |
| 14 | 08.19 | Names master sheet change didn't take effect | untriaged | **E** | sheet IS read live; `slice(0,-3)` mangles key | **See P11** — fix the lookup |
| 15 | 08.19 | Merge order must come fully | untriaged | C | grouping incomplete | Full component list |
| 16 | 08.20 | Remaining products don't get free bulb/holder | untriaged | C | grouping | Grouping |
| 17 | 08.20 | Different postcodes for these 2 combo orders | untriaged | **H** | `:282-287` backward scan misattributes | Remove scan |
| 18 | 08.20 | LDMG125E278 | untriaged | M | names master | Add name |
| 19 | 08.27 | Note speak pannanum | untriaged | **L** | no note column | Add column |
| 20 | 08.27 | QR said for some, not others | untriaged | **D** | `cleaned.gs:190` conditional | Decouple |
| 21 | 08.27 | RMI order and 2-4 1st order came merged | untriaged | **C-collision** | group key = combo SKU only, no customer check | **Composite key** |
| 22 | 08.29 | Shade must come last | untriaged | C | no pack sequence | Ordering rule |
| 23 | 25.09 | Activate speak postcode — urgent | untriaged | **D** | postcode blanked | Composite key |

> **#13 and #21 are the same bug from two directions** — #13 falsely merges different customers,
> #21 falsely merges unrelated orders. Both trace to identity being inferred from postcode / combo
> SKU rather than customer. This is the defect proven against live data in
> [discovery-report.md §8 R1](./discovery-report.md).

---

## 6. Schmutter — 14 issues

Script: `Lithursan.gs` **948 L** (has grouping), `cleaned.gs` **263 L** (**no** RPR44WH removal).

| # | Date | Issue | Status | RC | Responsible code | Fix |
|---:|---|---|---|---|---|---|
| 1 | 09/07 | Activation takes too long — simplify | done | — | menu → modal | resolved |
| 2 | 09/07 | Packlist needs listing image + title | **OPEN** *"not possible"* | — | `Title` 140/140, `Image URLs` 140/140 **already present** | **Re-open** — data exists, template change only |
| 3 | 09/07 | Reducer plate name not mentioned | done | **H**≠ | this station has **no** RPR44WH removal | Different cause — check names sheet (M) |
| 4 | 09/07 | Requires speaking twice | done | **N** | segment duplication | Verify — see **P6/P8** |
| 5 | 09/07 | Merged orders as single view | **OPEN** *"not possible"* + *"find a way by MD"* | **C** | grouping exists here but `Merge Order` only 6/140 populated | **Possible** — needs merge key in data |
| 6 | 09/07 | Two buttons: details + label number | done | — | `Postcode` button added | resolved |
| 7 | 10/07 | Label number sometimes not mentioned | done | D | postcode blanked | Composite key |
| 8 | 01/09 | Postcode first number 0 not showing | untriaged | **F** | `getValues()` | **See P14** — `getDisplayValues()` |
| 9 | 01/09 | Sometimes wrong number like 53881 | untriaged | **F** | as #8 | as #8 |
| 10 | 03/09 | Quantity not show | **OPEN** | **E** | `cleaned.gs:116` | **See P13 — badge shows "X"** |
| 11 | 03/09 | Post code 00049 | **OPEN** | **F** | `getValues()` | **See P14 — spoken "4 9"** |
| 12 | 04/09 | Merge single order | **OPEN** | C | `Merge Order` 6/140 | Merge key |
| 13 | 04/09 | Not add merge | **OPEN** | C | as #12 | as #12 |
| 14 | 15/09 | Merge-order update for all German packlists (Kronen & Schmutter) | **OPEN** | C | 2 stations, 2 script versions | Ship as one deployment |

---

## 7. Kronen — 6 issues

Script: `Lithursan.gs` **703 L** (**no grouping**), `cleaned.gs` **263 L**.
Kronen and Schmutter file the same tickets but **run different speak-tool versions** — Schmutter can
group, Kronen cannot. Any "German packlist" fix must account for that.

| # | Date | Issue | Status | RC | Responsible code | Fix |
|---:|---|---|---|---|---|---|
| 1 | 09/07 | Activation takes too long | done | — | — | resolved |
| 2 | 09/07 | Packlist needs listing image + title | **OPEN** *"not possible"* | — | data already present | **Re-open** |
| 3 | 09/07 | Transformer order: type → voltage → wattage | done | **A** | no SSML, no template | **Verify** — needs the classifier |
| 4 | 09/07 | Requires speaking twice | done | N | segment build | Verify |
| 5 | 09/07 | Merged orders as single view | **OPEN** *"not possible"* | **C** | **no grouping in the 703 version** | Port grouping first |
| 6 | 09/07 | Two buttons: details + label number | done | — | `Postcode` button | resolved |

---

## 8. Cross-station summary

### By responsible layer

| Layer | Issues |
|---:|---|
| **Apps Script logic** | **86** |
| Apps Script **+** sheet data (mapping) | 6 |
| Sheet data only (missing column / missing name) | 9 |
| Resolved / not a defect | 10 |

Again: **no issue is caused by spreadsheet formatting or formulas.** Neither tab contains formulas.

### The five root causes that dominate

| RC | Issues across the 4 stations | Fix size |
|---|---:|---|
| **C** — no grouping / grouping wrong | **31** | L |
| **A** — no SSML | **13** | M |
| **E** — `slice(0,-3)` + quantity blanking | **9** | **XS** |
| **D** — postcode dedupe → QR cascade | **9** | M |
| **B** — recognition death / self-trigger | **6** | M |

### Items marked "Done" that the code proves were never built

| Station | Issue | Evidence |
|---|---|---|
| U3 Others #7 | Hold button | `held[]` never written to; no button in DOM |
| U3 Others #12 | Pause button complete | `synth.resume()` absent from **every** station copy |
| U3 Others #20 | Hold screenshot | `html2canvas` loaded, never called |
| U3 Others #3, #14, #19 | Merge components | no grouping in this station's script |
| U3 Others #9 | 2 times speak | **P6, P8** show it still duplicating |
| U3 Others #23 | Next not working | **B** unchanged |
| U3 Others #31, #45 | Cable 5m/1m | **P8** shows "1 meter" for a 5 Meter product |
| U3 Others #37 | Same-postcode | `cleaned.gs:167` unchanged |
| Schmutter #4 / Kronen #4 | Speaking twice | same as U3 Others #9 |

### Two "not possible" verdicts that should be re-opened

1. **Schmutter #2 / Kronen #2** — *"packlist needs listing image and title"*. Both fields are already
   **100 % populated** (`Title` 140/140, `Image URLs` 140/140) and already rendered in the modal.
   This is a packlist-template change, not an impossibility.
2. **Schmutter #5 / Kronen #5 / U3 Others #35, #36** — *"merged orders as a single view"*, escalated
   with *"We need to find a way by MD"*. It is not possible **while `Merge Order` is populated on 6
   of 140 rows**. Compute a real merge key from customer + address and it becomes straightforward.

---

## 9. Recommended order

Same principle as Unit 4: cheap and provable first.

| Step | Fix | RC | Closes | Effort |
|---:|---|---|---:|---|
| 1 | `cleaned.gs:112` pack-suffix regex; `:116` stop blanking quantity | **E** | **9** | XS |
| 2 | `cleaned.gs:27` → `getDisplayValues()` | **F** | 4 | XS |
| 3 | `cleaned.gs:92-94` drop the `merge order total: N` prefix | **G** | 3 | XS |
| 4 | Speak `Status` (`international` / `firstclass`) | **J** | 3 | XS |
| 5 | Add `synth.resume()`; mic indicator | **K** | 4 | S |
| 6 | Recognition: remove `stop()`, restart on error, gate mic while speaking | **B** | 6 | M |
| 7 | Wire + guard the mapping; add `SKU.1`/`Mapping SKU` to names sheet | **I** | 6 | S |
| 8 | Decouple QR from postcode; composite-key dedupe | **D** | 9 | M |
| 9 | Token classifier + SSML | **A** | 13 | M |
| 10 | Port grouping to the 4 stations that lack it — **customer-safe key** | **C** | 31 | L |
| 11 | Add customer-note / carrier columns to the import | **L** | 9 | — |

**Steps 1–4 are four one-line changes closing 19 issues** across all four stations.

⚠️ **Step 10 warning, repeated:** the 948-line grouping keys on the combo-SKU string **alone**. Live
data shows 8 of 45 keys in one station are shared by more than one customer. Porting it as-is to
Unit 3 Others, Unit 4, Kronen and Person 2 would introduce a wrong-parcel risk to four more stations.
Group on **combo SKU + customer + postcode**.
