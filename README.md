# Speak Tool — Feedbacks, Correction & Upgrade Analysis

Analysis package for the **LEDSone Speak Tool**, the Google Apps Script voice tool that
reads warehouse pick-and-pack orders aloud to packers across six stations.

**Task assigned by:** Varmen · **Prepared by:** Lithurshan · **Date:** 2026-08-13

---

## Start here

| If you want… | Read |
|---|---|
| The summary and what I need from you | [handover/handover-note.md](handover/handover-note.md) |
| How the tool actually works | [documentation/01-system-concept.md](documentation/01-system-concept.md) |
| **The bugs, line by line** | [documentation/02-code-walkthrough.md](documentation/02-code-walkthrough.md) |
| What to fix and in what order | [capability/upgrade-proposal.md](capability/upgrade-proposal.md) |
| The evidence behind it | [validation/open-defects.md](validation/open-defects.md) |
| Confirmation the task is complete | [closure/submission-checklist.md](closure/submission-checklist.md) |

---

## The finding in three lines

160 feedback items are logged across the six station tabs. **97 are fixed; 63 are
outstanding** — and they keep coming back, because they are eight problems reported
sixty-three times.

The three root causes are (1) speech built as a plain string, so the TTS engine guesses at
postcodes and product codes; (2) merge orders that exist in the warehouse but not in the
data — only 6 of 140 rows carry a merge flag; and (3) six stations running six independent
copies of the script, so every fix is six deployments and drifts.

**Fixing those three closes 41 of the 63 and stops the backlog regenerating.** About two
weeks of work.

---

Reading the Apps Script confirmed all three, and turned up a fourth nobody had filed: the
`Cleaned Data` tab is **written twice with different column counts**, leaving a stale
`SKU Combined` column that survives a later row deletion — and that misaligned column is
what the tool groups orders by. See
[C1](documentation/02-code-walkthrough.md).

**Seven one-line fixes close eight tickets** — listed at the end of the
[code walkthrough](documentation/02-code-walkthrough.md).

---

## Contents

| Folder | Contents |
|---|---|
| [documentation/](documentation/) | System concept — the two-layer name model, order types, end-to-end flow · **code walkthrough with line-level root causes** |
| [scripts/](scripts/) | The exported Apps Script — 5 files, 1,465 lines |
| [data-maps/](data-maps/) | Station registry (all 6 sheet links) · `Sheet1` → `Cleaned Data` column map |
| [evidence/](evidence/) | 160-item feedback register (CSV) · verbatim extract of all 6 tabs |
| [validation/](validation/) | The 63 outstanding items, grouped into 8 themes with root causes |
| [capability/](capability/) | Upgrade proposal — priorities, designs, 5-week plan |
| [workflows/](workflows/) | As-is packing session · to-be utterance spec · pre-flight checks |
| [prompts/](prompts/) | Paste-ready Claude project setup |
| [sql/](sql/) | Proposed merge-order data model backing Proposal §4 |
| [handover/](handover/) | Handover note · Apps Script export instructions |
| [closure/](closure/) | Submission checklist against Varmen's instructions |

## Sources

- [Speak tool feedbacks and correction](https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=592560198) — 6 station tabs
- [Unit 3 Lampshade speak tool](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) — the data sheet profiled in depth
- Remaining station links → [data-maps/station-registry.md](data-maps/station-registry.md)

## Remaining gap

The Apps Script has now been exported and reviewed — see
[documentation/02-code-walkthrough.md](documentation/02-code-walkthrough.md).

**Only the Unit 3 Lampshade project was exported.** The other five stations run their own
copies and have never been diffed against it, so how far they have drifted is still
unknown. Export steps are in
[handover/script-export-instructions.md](handover/script-export-instructions.md).
