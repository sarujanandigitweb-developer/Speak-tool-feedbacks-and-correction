# Exporting and deploying the Apps Script

**Last updated:** 2026-09-14

## Status

| Station | Exported to | Notes |
|---|---|---|
| Unit 3 Lampshade | [`scripts/Unit 3 Lampshade/`](../scripts/Unit%203%20Lampshade/) | ⚠️ **Repo ≠ live.** The live `Lithursan.gs` has an Enable-voice button, mic-device picker, `interimResults = true`, `en-IN` — none of the repo copies match. Re-export before any deploy |
| Unit 3 Others (*Copy of jana speak*) | [`scripts/Copy of jana speak/`](../scripts/Copy%20of%20jana%20speak/) | Original script |
| Unit 3 Lampshade — Person 2 | [`scripts/Unit 3 Lampshade Person 2 Speak tool/`](../scripts/Unit%203%20Lampshade%20Person%202%20Speak%20tool/) | Original script |
| Unit 4 | [`scripts/Unit 4 speak tool/`](../scripts/Unit%204%20speak%20tool/) | Original script |
| Schmutter | [`scripts/Schmutter speak tool/`](../scripts/Schmutter%20speak%20tool/) | Original script |
| Kronen | [`scripts/Kronen speak tool/`](../scripts/Kronen%20speak%20tool/) | Original script |

The exports are a point-in-time copy. A station may have been edited in its Apps Script editor since.
**Never assume the repo matches a live station — export first.**

---

## Before any deploy: export the live copy

### Option A — by hand (2 minutes)

1. Open the station sheet ([station-registry.md](../data-maps/station-registry.md)).
2. `Extensions → Apps Script`.
3. For each file in the left-hand list, copy its contents into `scripts/<station>/<file>.gs`,
   overwriting the repo copy.
4. `git diff` — anything that changed was edited live and must be kept.
5. Commit **before** making your own changes, so the live state is on record.

### Option B — `clasp` (recommended; gives the script version control)

```bash
npm install -g @google/clasp
clasp login
# Script ID: Apps Script editor → Project Settings
clasp clone <SCRIPT_ID> --rootDir "./scripts/Unit 3 Lampshade"
clasp pull          # later, to refresh
```

`.gitignore` already excludes `.clasprc.json` (your OAuth token) and keeps `.clasp.json` (the script
ID) trackable.

---

## Deploying a change to a station

1. Export the live copy and commit it (above).
2. Merge your change into the exported files. For Unit 3 Lampshade the changed files are normally
   `packing-priority.gs`, `cleaned.gs` and/or `Lithursan.gs`.
3. Paste into the Apps Script editor (or `clasp push`) and save.
4. In the sheet: **Speak Tool → Run Clean and Merge** — required for any change to cleaning, collections
   or packing priority, because the sort happens there.
5. **Speak Tool → Speak All Rows** and listen to at least one merge order and one collection.

Remember that all `.gs` files in a project share **one global scope**: a function defined in two files
means the last one loaded wins. `onOpen` is already defined in both `action.gs` and `cleaned.gs` in
Unit 3 Lampshade.

---

## Rolling Unit 3 logic out to other stations

The other five stations have **none** of: packing priority, lampshade collections, merge sequencing,
customer-safe grouping, the "This one" fallback, the always-on microphone. Porting means at minimum
`packing-priority.gs`, the pipeline changes in `cleaned.gs` (new columns and the final sort) and the
queue/speech changes in `Lithursan.gs` — then a diff against each station's own edits. Schmutter and
Kronen (German packs) report as one target. See handover decision #3 before starting.
