# Handover Note

**To:** Varmen
**From:** Lithurshan
**Date:** 2026-08-13
**Re:** Speak Tool — concept documentation and upgrade analysis

---

## What you asked for, and where it is

| Your instruction | Delivered |
|---|---|
| *"First check & understand the system"* | [documentation/01-system-concept.md](../documentation/01-system-concept.md) |
| *"You can check the app scripts for how it works"* | [documentation/02-code-walkthrough.md](../documentation/02-code-walkthrough.md) — all 1,465 lines reviewed, root causes confirmed at line level |
| *"Create the Claude project & add the Google Sheet link & script, explain the concept"* | [prompts/claude-project-setup.md](../prompts/claude-project-setup.md) — paste-ready project instructions and file list |
| *"Then analyze & get the ideas for how to upgrade that"* | [capability/upgrade-proposal.md](../capability/upgrade-proposal.md) |
| *"These are the updates in tool they asked"* (feedback sheet) | All 160 items extracted → [evidence/feedback-register.csv](../evidence/feedback-register.csv), analysed in [validation/open-defects.md](../validation/open-defects.md) |

---

## The short version

The tool is working — 97 of 160 reported items are fixed. But **63 are outstanding and
they keep coming back**, because three structural things have never been addressed:

1. **Postcodes and product codes are handed to the TTS engine as plain text**, so it
   guesses. "IP20" is read as "twenty thousand". 13 tickets across all five stations.
   This needs a *rule*, not more entries in the Names Master Sheet.
2. **Merge orders are not in the data.** Only 6 of 140 rows carry a merge flag, so the
   tool groups by postcode instead — which falsely merges two customers at one postcode
   and misses one customer with two. 20 tickets. This is the one the Schmutter tab
   escalated with *"We need to find a way by MD"*, and it has been marked "not possible"
   four times. It **is** possible; it needs a data-model change rather than a speech
   change. [Proposal §4](../capability/upgrade-proposal.md) has the design.
3. **Six stations, six copies of the script.** A fix is six deployments, so fixes drift
   and the same bug is reported five times.

Doing those three closes 41 of the 63 and stops the backlog regenerating. Roughly two
weeks. My recommendation is to hold new feature requests until they are done.

---

## What the code review added

I have now read all 1,465 lines of the Apps Script
([walkthrough](../documentation/02-code-walkthrough.md)). It confirms all three causes
above and adds two things worth your attention.

**A fourth root cause, which nobody had filed.** `Cleaned Data` is written **twice with
different column counts** — a 18-column write followed by a 15-column one that only
overwrites the first 15. Columns P, Q and R survive as leftovers, and R is `SKU Combined`,
the column the tool uses to **group orders**. A later step then deletes rows without
rebuilding it, so the grouping key is misaligned with its own rows. No packer could see
this, but it may sit underneath several of the merge/combo reports. It should be fixed
*before* the merge-order rework, not after.

**Three items marked Done were never actually built.** The quantity-based pause (FB-014),
the hold feature (FB-009) and the screenshot (FB-021) all have their scaffolding in the
code — variables, CSS, a loaded library — and none of them are wired to anything. The
pause button (FB-012, also Done) calls `synth.pause()` but there is no `synth.resume()`
anywhere, so pause is one-way. I would re-check everything else closed in those batches.

**The good news:** seven of the fixes are one-liners, and together they close eight
tickets. They are listed at the end of the walkthrough and can ship in a day.

---

## FB-072 — answered, and it was not what I expected

I flagged this as the thing to check first. The code answers it: the Names Master Sheet
**is** read live on every run (`cleaned.gs:13`). So no fixes were lost that way — good.

The real fault is one line down (`cleaned.gs:112`). The SKU lookup strips **three**
characters to remove a `"PK"` suffix that is **two** characters long. It works by luck for
single-digit packs (`…6PK`) and breaks for anything else (`…10PK`). And the line after it
blanks the **quantity** whenever the name lookup fails — so a missed lookup produces a
row that says nothing at all.

That one line is the cause of FB-054 and FB-150 (*"not speak quantity"*) as well as the
blank cells I measured in the data. Two-character fix.

---

## Decisions I need from you

| # | Question | Why it blocks work |
|---|---|---|
| 1 | **Customer note — speak it or just show it?** Unit 4 (FB-136) wants it displayed but *not* spoken. Unit 3 Lampshade (FB-077) wants it spoken. | Direct conflict. Either pick one, or I build it as a per-station setting. |
| 2 | **Can the platform import add a `Shipping Service` column?** | Theme F (4 items — next-day sticker, Evri/Royal Mail, S label 2 kilos) is blocked upstream. The dev note *"not found in the packlist"* is correct — the data does not exist. Nothing can be built until someone owns this. |
| 3 | **Approve the consolidation to a shared Apps Script library?** | It changes how deployments work across all six stations. Won't start without your sign-off. |
| 4 | **Budget for USB foot pedals (~£15 × 6)?** | The most reliable fix for FB-133 *"getting tired from it"*. Works when wifi does not. |
| 5 | **Who owns the `dashboard.digitweblk.com` combo→image mapping?** | Theme G (3 items) needs a reconciliation pass and I do not know whose system that is. |

---

## Gaps in this submission

1. **Only the Unit 3 Lampshade Apps Script was exported.** The other five stations run
   their own copies and have never been diffed. That diff is itself worth doing — it
   measures how far the six have drifted and sizes the consolidation work.
2. **Names Master Sheet contents not profiled** — link captured, not read. Needed for
   Theme A sizing.
3. **Only Unit 3 Lampshade's data sheet was profiled column-by-column.** The other five
   are assumed to share the schema. Consistent with their feedback tabs, but unverified.
4. **The code findings are from reading, not running.** I have not executed the script
   against a live sheet. The line-level causes are traceable in the source, but each
   should be confirmed against a real run before it is closed — which is exactly the
   verification step the register is missing today.
4. **Screenshots referenced in the feedback** (FB-058, FB-063, FB-065 — "see above
   picture") are embedded images in the sheet and are not reproduced here.
5. **The feedback register is derived.** Dates and reporter names were carried down from
   merged header cells; a few rows may be attributed to the wrong date. The issue text
   itself is verbatim.
