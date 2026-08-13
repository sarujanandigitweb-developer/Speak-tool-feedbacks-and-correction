# Open Defects — Thematic Analysis

Source: [evidence/feedback-register.csv](../evidence/feedback-register.csv) — 160 items
normalised from the six station tabs.

> **Confirmed against the source.** Every root cause below was written from the data, then
> checked line-by-line against the exported Apps Script. All of them hold. The code also
> revealed that Theme D's *"QR sollala"* reports and Theme C's *"same postcode"* reports
> are **the same bug** (see C2), and that four items marked *Done* were never built. Line
> references: [02-code-walkthrough.md](../documentation/02-code-walkthrough.md).

| Status | Count |
|---|---:|
| Done (`True`) | 97 |
| Open (`False`) | 37 |
| Never triaged (blank) | 26 |
| **Outstanding** | **63** |

The 26 blank-status items are almost all on the `Unit 3 Lampshade` tab, which was opened
2025-08-01 and has never been triaged. They are outstanding in practice.

---

## The eight themes

The 63 outstanding items are not 63 problems. They are **eight problems reported 63
times**. Fixing themes A, B and C closes 41 of them.

| Theme | Items | Stations affected |
|---|---:|---|
| **A** — Number & postcode pronunciation | 13 | All 5 |
| **B** — "Next" voice command misses | 8 | Unit 3 Others, Unit 4 |
| **C** — Merge / combo not spoken in full | 20 | All 5 |
| **D** — Attribute omitted from speech | 8 | Unit 3 Others, Unit 3 Lampshade, Schmutter |
| **E** — Customer note / packlist detail | 6 | Unit 3 Others, Unit 3 Lampshade, Unit 4, Schmutter, Kronen |
| **F** — Shipping service & label | 4 | Unit 3 Others, Unit 4 |
| **G** — Mapping image wrong | 3 | Unit 3 Others, Unit 3 Lampshade |
| **H** — Estate / process | 1 | Unit 3 Lampshade |

---

### Theme A — Number & postcode pronunciation (13 items)

The TTS engine reads digit groups as **cardinal numbers** instead of spelling them out.

| ID | Report | What was heard |
|---|---|---|
| FB-048, FB-138 | `IP20 000 issue` / `IP 20 Thousand issue` | "I P twenty thousand" instead of "I P two zero" |
| FB-050 | `M22 9A2 000 ISSUE` | Postcode read as a number |
| FB-151 | `post code 00049` | Leading zeros collapsed |
| FB-148 | `postcode first number 0 not showing` | Leading zero dropped entirely |
| FB-149 | `sometimes after speak wrong number like 53881` | Digit-run misread |
| FB-032 | `12 voltage endu add aakanum` | Dev note: *"this is for add name sheet"* |
| FB-001, FB-033* | `12 IP20 120 Speech gap` | No pause between number groups |
| FB-049 | `TRANSFORMER SPEAK TOOL WRONG` | Kronen FB-157 specifies the fix: speak **type → voltage → wattage** |

<sub>* FB-033 is marked Done but the same complaint recurs, so the fix did not hold.</sub>

**Root cause:** the utterance is built as a plain string and handed to
`SpeechSynthesisUtterance`. The browser applies English number rules to any digit run.
`PE11 3TY` becomes "P E eleven three T Y"; `IP20` becomes "twenty thousand" when it
collides with the following token.

**Fix:** stop relying on the engine's guess. Tokenise postcodes and technical codes and
emit them character-by-character with explicit inter-character pauses (SSML
`<say-as interpret-as="characters">`, or space-injection where SSML is unsupported).
One function; closes 13 tickets across all five stations. **This is the highest-value
single change in the backlog.**

---

### Theme B — "Next" voice command misses (8 items)

| ID | Date | Report |
|---|---|---|
| FB-046 | 18/07 | `HG4 1JR, CR0 8TA, TQ2 8NE, KT11 1HW Next sollum pothu play akala` |
| FB-047 | 21/07 | `prime speak tool next sollum pothu play akala` |
| FB-055 | 19/08 | `next sollum pothu play akala` |
| FB-132 | 21/07 | `Next command is not listening enough` |
| FB-133 | 22/07 | `Next command is not listening enough getting tired from it` |
| FB-119* | 11/07 | `Next Command not FAST enough` |
| FB-024* | 29/06 | `Sometimes next not working` |
| FB-131* | 23/07 | (repeat) |

<sub>* marked Done; the complaint recurred afterwards.</sub>

The dev note on FB-046 reads *"some times i think for network error"* — the browser
`SpeechRecognition` API is **cloud-backed**; every recognition round-trips to Google.
On warehouse wifi that is where the misses come from.

Note FB-133's wording — *"getting tired from it"*. This is the item with the worst
morale cost. A packer who has to repeat "next" three times per order, 217 orders a day,
stops trusting the tool.

**Fix, in order of value:**
1. Restart the recogniser **immediately** on `onend`/`onerror` rather than after the
   utterance completes — most misses are the mic simply being closed.
2. Add a **hardware fallback**: a USB foot pedal or the barcode scanner mapped to a
   keypress = "next". Hands stay free, zero network dependency. This is the change most
   likely to end the thread for good.
3. Narrow the grammar to the four commands so near-misses still match.

---

### Theme C — Merge / combo not spoken in full (20 items)

The largest theme, and the only one the developer has repeatedly marked
*"not possible for this"* (FB-035, FB-036, FB-145, FB-159) — with the Schmutter tab
adding **"We need to find a way by MD"**, i.e. escalated to the managing director.

| ID | Station | Report |
|---|---|---|
| FB-145, FB-159 | Schmutter, Kronen | `Merged orders need to be shown as a single view in the pack list` |
| FB-035, FB-036 | Unit 3 Others | `merge & combo orders same time both names speak` |
| FB-038 | Unit 3 Others | `Merge and combo product should be speak auto one after other` |
| FB-140 | Unit 4 | `just say Merge Order and merge order all the components needs to show` |
| FB-064 | U3 Lampshade | `last ahh merge order ellam postcode varekka all pack irukkanum` |
| FB-073 | U3 Lampshade | `merge order ellam full ahh varanum` |
| FB-071 | U3 Lampshade | `same postcode customer varathala merge order mathiri varuthu` **(Important)** |
| FB-075 | U3 Lampshade | `Different postcodes for these 2 combo orders` |
| FB-079 | U3 Lampshade | `RMI orderum 2-4 1st orderum merge ahh vanthu irukku` |
| FB-152, FB-153 | Schmutter | `merge single order` / `not add marge` |
| FB-154 | Schmutter | apply merge-order changes to **all German packlists (Kronen & Schmutter)** |
| FB-066, FB-069, FB-074, FB-080 | U3 Lampshade | pack **sequence** — bulb first, shade last, free bulb not first |
| FB-067, FB-068 | U3 Lampshade | group all colour variants / accessories together |
| FB-002* | Unit 3 Others | `Merge order should be shown fully and each component mentioned` |

<sub>* marked Done, still recurring.</sub>

**Root cause is in the data, not the speech.** As
[column-map.md §F2](../data-maps/column-map.md) shows, `Merge Order` is populated on
**6 of 140 rows**. The tool has nothing to group by, so it infers merges from a shared
postcode — which fails in both directions:

- two different customers at one postcode → falsely merged (FB-071, FB-116)
- one customer whose orders carry different postcodes → merge missed (FB-075)

**"Not possible" is not accurate — it is not possible *with a flat row list*.** The fix
is a data-model change, not a speech change:

1. Compute a real `Merge Group ID` from **customer name + normalised address**, written
   into `Cleaned Data` during the cleaning step.
2. Have the script build an **order object** — `{ merge_group, [components], postcode }` —
   rather than iterating rows.
3. Speak it as a unit: *"Merge order. Component 1 of 3: … Component 2 of 3: … Component
   3 of 3: … Post code: …"* with the postcode **last**, which is what FB-064 asks for.
4. Order components by pack sequence (bulb → accessories → shade last, per FB-069/FB-080).

This is the item to take to MD with a concrete plan rather than a "not possible".

---

### Theme D — Attribute omitted from speech (8 items)

| ID | Report | Missing field |
|---|---|---|
| FB-051 | `RH19 1SE DONT TELL COLOUR` | `Combo Color` |
| FB-052 | `TF2 8NP SPEAK GOLDTOP` | variant detail |
| FB-054, FB-150 | `SP11 6TQ not speak quantity` / `quantity not show` | `Quantity` |
| FB-053 | `LU1 4EL SPEAK 1M` | cable length — spoke 1 m for a 5 m cable |
| FB-005 | `3 types of pipe (not painted, black, galvanized)` | finish variant |
| FB-061 | `reducer plate sollanum` | accessory |
| FB-060, FB-070, FB-078 | `QR sollanum` / `QR sollala` / `qr silathukku solluthu illa` | `Instruction QR` (5/140 populated) |

These correlate exactly with the blank-cell counts in
[column-map.md](../data-maps/column-map.md): 6 blank `Quantity`, 6 blank `Name`, 5
populated `Instruction QR`. **The tool is not dropping these fields — the data does not
have them.**

**Fix:** validate `Cleaned Data` before the session starts and refuse to queue a row with
a blank `Name`, `Quantity` or `Post Code`, surfacing it for correction instead of
speaking a half-order. Silence is the worst possible failure mode here: the packer
cannot tell "nothing to say" from "tool broke".

---

### Theme E — Customer note / packlist detail (6 items)

| ID | Report |
|---|---|
| FB-056 | `customer note not shown in speak tool plz shortout` |
| FB-057 | `not add note in packlist` |
| FB-077 | `note speak pnnannum` |
| FB-136 | `Make the note available in speak tool but don't speak` |
| FB-142, FB-156 | Schmutter + Kronen: packlist needs listing image + listing title |

Note FB-136 vs FB-077 **conflict**: Unit 4 wants the note *displayed but not spoken*;
Unit 3 Lampshade wants it *spoken*. Needs a per-station setting, or a decision from
Varmen. Flagged as a question in [handover](../handover/handover-note.md).

FB-142/FB-156 were closed *"not possible for this"* — but `Sheet1` already carries both
`Title` and `Image URLs` at 169/169 and 140/140 fill, and the modal already renders both.
Worth re-opening: this may only need a packlist-print template change.

---

### Theme F — Shipping service & label (4 items)

| ID | Report | Dev note |
|---|---|---|
| FB-006 | `next day sticker speak` | *"not found in the packlist"* |
| FB-008 | `services telling - evri, royal mail` | *"not found in the packlist"* |
| FB-062 | `nextday sticker sollanum` | — |
| FB-120 | `for Amazon 2 Day Small orders - speak S label 2 kilos` | — |

The dev note is correct — the carrier/service field genuinely is not in the sheet. This
is **blocked on an upstream data change**, not a tool bug. Someone must add a
`Shipping Service` column to the platform import before any of these can be built.

Related and already agreed (FB-146, FB-160, both Done): a **separate Label Number button**,
because the label number is only confirmed *after* packing.

---

### Theme G — Mapping image wrong (3 items)

FB-058 (`mapping issue see above picture`), FB-063 and FB-065
(`BB4 4JY / BS39 4nn mount vara koodaathu — packlistla ullathu varanum`): the tool shows
a *mount* that is not on the packlist. The `Image URLs` column points at
`dashboard.digitweblk.com` — the mapping between combo SKU and image is wrong for some
combos. Needs a reconciliation pass against that dashboard.

FB-058 and FB-063/065 reference screenshots embedded in the sheet that are not reproduced
here — see the live tabs.

---

### Theme H — Estate / process (1 item, high leverage)

FB-072: **`name master sheet la change pannathu maarala`** — *a change made in the Names
Master Sheet did not take effect.*

If the shared pronunciation dictionary does not propagate, then every Theme A and Theme D
fix made "in the name sheet" silently fails, and the packer re-reports the same issue
weeks later. **This should be verified before any other pronunciation work is done** —
otherwise the fixes will not stick.

Related: FB-059, `Unit 4 Change panninathu ellam unit 3 change pannanum` — *everything
changed in Unit 4 must also be changed in Unit 3*. Six independent script copies, changes
propagated by hand. See [Upgrade Proposal §5](../capability/upgrade-proposal.md).
