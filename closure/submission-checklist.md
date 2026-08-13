# Submission Checklist

**Task:** Speak Tool — understand the system, create the Claude project, analyse and
propose upgrades
**Assigned by:** Varmen
**Submitted by:** Lithurshan
**Date:** 2026-08-13

---

## Against Varmen's instructions

| # | Instruction | Status | Deliverable |
|---|---|---|---|
| 1 | *"First check & understand the system"* | ✅ Done | [documentation/01-system-concept.md](../documentation/01-system-concept.md) |
| 2 | *"It have voice control — if you say next the next order list will shift"* | ✅ Documented | [workflows/packing-workflow.md](../workflows/packing-workflow.md) |
| 3 | *"You can check the app scripts for how it works"* | ✅ Done | [documentation/02-code-walkthrough.md](../documentation/02-code-walkthrough.md) — all 1,465 lines reviewed |
| 4 | *"Create the Claude project"* | ✅ Ready to paste | [prompts/claude-project-setup.md](../prompts/claude-project-setup.md) |
| 5 | *"…& add the Google Sheet link"* | ✅ Done | [data-maps/station-registry.md](../data-maps/station-registry.md) — all 6 stations + names master sheet |
| 6 | *"…& script"* | ✅ Done | [scripts/](../scripts/) — 5 files exported and attached |
| 7 | *"…with explain the concept"* | ✅ Done | Project instructions block in [prompts/claude-project-setup.md](../prompts/claude-project-setup.md) |
| 8 | *"Then analyze & get the ideas for how to upgrade that"* | ✅ Done | [capability/upgrade-proposal.md](../capability/upgrade-proposal.md) |
| 9 | Feedback sheet — *"these are the updates in tool they asked"* | ✅ All 160 items | [evidence/feedback-register.csv](../evidence/feedback-register.csv) + [validation/open-defects.md](../validation/open-defects.md) |

**9 of 9 complete.**

---

## Coverage

| Source | Read | Result |
|---|---|---|
| Feedback workbook — 6 tabs | ✅ All | 160 items normalised |
| Unit 3 Lampshade data sheet — `Sheet1` | ✅ 169 rows, 17 cols | profiled |
| Unit 3 Lampshade data sheet — `Cleaned Data` | ✅ 140 rows, 18 cols | profiled, 5 findings |
| Station links from `All Stations` | ✅ All 7 hyperlinks | registry built |
| Apps Script — Unit 3 Lampshade | ✅ 5 files, 1,465 lines | 7 questions answered, 5 new defects found |
| Names master sheet | ⚠️ Link only | not profiled |
| Other 5 station data sheets | ⚠️ Not profiled | schema assumed identical |
| Apps Script — other 5 stations | ⚠️ Not exported | drift between copies still unmeasured |

## Numbers

| Metric | Value |
|---|---:|
| Feedback items catalogued | 160 |
| Fixed (`True`) | 97 |
| Open (`False`) | 37 |
| Never triaged (blank) | 26 |
| **Outstanding** | **63** |
| Distinct themes behind them | 8 |
| Closed by the top 3 recommendations | 41 |
| Closed by 7 one-line code fixes | 8 |
| Stations | 6 |
| Items with a tracking ref in the sheet | **0 of 160** |
| Lines of Apps Script reviewed | 1,465 |
| Defects found in code but never reported | 5 |
| Items marked *Done* that are **not implemented** | 4 (FB-009, FB-012, FB-014, FB-021) |

---

## Deliverables produced

```
documentation/01-system-concept.md      how the tool works, two-layer data model, order types
documentation/02-code-walkthrough.md    line-level root causes, 5 unreported defects, 7 one-line fixes
scripts/                                the exported Apps Script, 5 files
data-maps/station-registry.md           6 stations + names master sheet, live links
data-maps/column-map.md                 Sheet1 -> Cleaned Data schema, 5 data-quality findings
evidence/feedback-register.csv          160 items, normalised, IDs assigned
evidence/raw-feedback-dump.txt          verbatim extract, all 6 tabs
validation/open-defects.md              63 outstanding items grouped into 8 themes
capability/upgrade-proposal.md          priority ranking, designs, 5-week plan
workflows/packing-workflow.md           as-is session, to-be utterance, pre-flight checks
prompts/claude-project-setup.md         paste-ready Claude project setup
sql/proposed-order-model.sql            merge-order data model backing Proposal §4
handover/handover-note.md               summary, 5 decisions needed, gaps
handover/script-export-instructions.md  how to export the script + 7 questions to answer
closure/submission-checklist.md         this file
```

---

## Open for Varmen

Five decisions are needed before implementation starts — listed in full in
[handover/handover-note.md](../handover/handover-note.md):

1. Customer note — speak it, or display only? (Unit 4 and Unit 3 Lampshade disagree)
2. Can the platform import add a `Shipping Service` column? (Theme F is blocked without it)
3. Approve consolidating six script copies into one shared library?
4. Budget for USB foot pedals, ~£15 × 6?
5. Who owns the `dashboard.digitweblk.com` combo→image mapping?

**FB-072 is now answered by the code.** The Names Master Sheet *is* read live
(`cleaned.gs:13`) — no fixes were lost that way. The fault is a SKU-lookup bug one line
below it (`cleaned.gs:112` strips 3 characters to remove a 2-character `"PK"` suffix),
which also blanks the quantity when the lookup fails. See
[02-code-walkthrough.md Q4](../documentation/02-code-walkthrough.md).

**What to do first instead:** the seven one-line fixes at the end of the code walkthrough
— they close eight tickets and can ship in a day — then C1, the double-write bug that
corrupts the order-grouping column.
