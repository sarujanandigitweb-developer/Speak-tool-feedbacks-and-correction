# Speak Tool (STFC) — Final Handover

**Project code:** STFC · **Assigned by:** Varmen · **Developer:** Sarujanan
(techclawweb@gmail.com) · **Handover date:** 2026-10-05 · **Status of this document:** Newly
created, consolidating and cross-checked against [`handover-note.md`](handover-note.md) (existing
handover file, originally written 2026-09-14, **verified against the latest commit and updated in
place** as part of this handover — see its own change banner)

This is the single document a new developer should read start to finish to take over the project
without needing to ask the outgoing developer anything. `handover-note.md` in this same folder
remains the detailed risk/decision log and is linked from the relevant sections below.

---

## 1. Project Overview

The **Speak Tool** reads a warehouse packing station's day of pick-and-pack orders **aloud**, so
the packer's hands and eyes stay on the stock instead of the screen. For each order it speaks:
the product's **spoken name** (from a managed "Names Master Sheet", never the raw marketplace
title), its **quantity**, then the **postcode**, spelled out, last. The packer says **"next"** (or
presses a button, or a key) to move to the next item.

It exists in **two independently-delivered forms that share one set of packing rules**:

| | HTML Speak Tool | Google Sheets Speak Tool |
|---|---|---|
| What | A self-contained web page dropped onto the day's Order Packing HTML export | Google Apps Script bound to each station's own Google Sheet |
| Where it runs | Varmen AIOS hub (`speak_tool` slug) | Six separate station sheets, `Extensions → Speak Tool` |
| Shared rules | ✅ current | ✅ **Unit 3 Lampshade station only** |

The project began 2026-08-13 as a discovery/root-cause analysis of 160 live feedback items against
the (then undocumented) Unit 3 Lampshade Apps Script, and grew into the HTML tool plus a rules
upgrade ported onto the Unit 3 Sheets script. Full origin story: §10 of
[`handover-note.md`](handover-note.md).

---

## 2. Final Status

| Component | State |
|---|---|
| **HTML Speak Tool** | ✅ Live on the Varmen AIOS hub. Hub was last **confirmed** built from this repo on 2026-09-14. A newer build (pack-size table, Instruction QR, order-type announcement — see §3) is committed in this repo as of 2026-10-05, **but whether it has been pushed to the hub cannot be verified from this repository** — that push is a separate manual step against an external database (§7). **Check the hub before assuming it matches the repo.** |
| **Unit 3 Lampshade — packing-priority.gs** (WC rank, merge sequencing, 2026-09-14 ruling) | ⚠️ In repo only. **Not yet pasted into the live Apps Script editor.** |
| **Unit 3 Lampshade — Lithursan.gs voice fixes** (2026-08-24/25) | ⚠️ In repo only, and the **live copy is a different version** with features (Enable-voice button, mic picker, `en-IN`) that no file in the repo matches. Export the live file before touching this station — see §3.1 of `handover-note.md`. |
| **Unit 3 Others, Unit 3 Person 2, Unit 4, Schmutter, Kronen** | Running their **original** scripts. None of the packing-priority, collection, merge-sequencing or Hold work has been ported to them. |

**Bottom line:** the HTML tool is production software with real packers using it daily; the Sheets
tool rollout is **partial** — one of six stations has the new rules, and even that station's live
code has diverged from the repo. This is the single most important thing for the next developer to
internalise before changing anything.

---

## 3. Latest Updates (what I changed last)

**2026-10-05 — commit `84689ba`, "enhance pack size handling and order processing".** This is the
most recent work and the part least likely to be in anyone's head but mine, so it is covered in
full here (not just linked).

1. **Pack-size table extended.** `speak_tool_html_sheet_UI/engine.js` — the `PACK` suffix table
   (`…2PK`, `…APK`, etc., used to multiply a product's quantity) grew from 12 codes to 29
   (`1PK`–`9PK`, plus `A`–`S` letter codes up to `RPK`=1000), matching a Flask-prototype table that
   the Apps Script build never had. A new `Engine.baseSku()` replaced the old blanket regex
   (`k.replace(/\d*A?PK$/, '')`) used for name lookup — it now only strips a suffix it actually
   recognises in the table, so an unrelated SKU ending in digits is no longer silently truncated.
2. **Order type / merge status is now announced.** Each order's type (read from the pack list's own
   label, falling back to the source file name) and whether it is a merge order are spoken before
   the first component (e.g. *"Amazon Shipping Prime. Merge Order. …"*) and shown as a label on the
   control bar.
3. **Instruction QR is now spoken.** Previously the tool parsed the `Instruction QR` badge but never
   spoke it (documented as "not spoken" everywhere). It now rides after the postcode, on the last
   component. **This closes a known gap** — see §9.
4. **Control bar redesign** (`packlist_extension/src/speak-extension.js`): a details panel next to
   the spoken text shows QTY and postcode for the line being read; the spoken-text row wraps instead
   of truncating long names; the bar's own height is measured and reserved as scroll space so the
   final order can still scroll fully into view; **Postcode** (button or auto-reached) now scrolls
   the page to the postcode line, not just the product image.
5. **New regression test**: `evidence/html-order-details-tests.js` — checks all 29 pack codes,
   `baseSku()`, and re-parses the 13 real pack lists (155 orders) to confirm order count and packing
   sequence are byte-for-byte unchanged while the new `orderType` / `isMerge` / `instructionQr`
   fields appear correctly. **Requires `jsdom`, which is not in `package.json`** — see §9 before
   running it.
6. `evidence/live-names-tests.js` was updated to load the engine through the same path the live
   bundle uses, after the engine's internal structure changed.

I ran all three Node test suites myself while preparing this handover (after installing `jsdom`
locally, not committed): **28/28, 38/38, and the new suite's assertions all passed** — see §9 for
exact commands and the one caveat worth checking before this reaches the hub.

For the full dated history before this (10-item collection limit, Hold feature, WC rank, merge
sequencing, etc.), see [`workflows/packing-workflow.md` §7](../workflows/packing-workflow.md#7-rule-history).

---

## 4. Project Structure / Important Files

```
packlist_extension/        HTML Speak Tool source — EDIT HERE
  src/speak-extension.js       UI, speech, voice commands, hold, collections view
  src/names-live.js             live Names Master Sheet fetch/cache layer
  src/speak-loader.template.html  the loader page template
  build.js                     bundles the above into the generated files below
  packlist-speak.js             GENERATED — do not edit
  speak-loader.html             GENERATED — do not edit
  add-speak.js / serve.js       CLI helpers (inject tool into saved HTML / serve over http)
  README.md                     component-level docs — kept in sync with this handover

speak_tool_html_sheet_UI/
  engine.js                  packing rules, pack sizes, collections, HTML parsing — EDIT HERE
  reference-data.js          built-in names + Lampshade SOT, bundled into the build

packlist_upload/Speak-Tool.html   GENERATED — the exact file uploaded to the Varmen hub

scripts/<station name>/      Apps Script exported per station (6 stations). Unit 3 Lampshade is
                              the only one carrying packing-priority.gs. *.bak* files are local
                              backups only, never deployed.

order_details/1.html … 13.html   Real pack-list test data (155 orders, used by all test suites)
outputs/packlists-13.speak.html  Frozen snapshot of the 13 lists with the tool embedded

evidence/                    Test scripts + the 160-item feedback register + discovery notes
validation/                  Dated rule decisions and issue analyses
capability/                  Implementation reports, original upgrade proposal
workflows/packing-workflow.md    The packing-order rules both tools implement, with history
documentation/               System concept, Unit 3 logic reference, 13-Aug code walkthrough
data-maps/                   Station + sheet links; Sheet1 → Cleaned Data column map
sql/                         Daily-task reporting insert; a never-built order-model proposal
handover/                    This document, handover-note.md, Apps Script export instructions
```

Full annotated table: top-level [`README.md`](../README.md#project-structure).

---

## 5. Data Sources / Database Tables

The tool itself **has no database** — at runtime it reads only:
1. The day's Order Packing HTML page (pasted/dropped in, or served alongside it).
2. The bundled `reference-data.js` (built-in names + Lampshade SOT, compiled into the build).
3. The live **Names Master Sheet**, fetched as CSV in the background and cached 6 hours in
   `localStorage`; a failed or truncated (<500 rows) fetch never overrides the built-in names.

External sheets referenced by the project (links in [`README.md`](../README.md#sources) and
[`data-maps/station-registry.md`](../data-maps/station-registry.md)):

| Sheet | Purpose |
|---|---|
| Feedback workbook | One tab per station; source of the 160-item feedback register |
| Unit 3 Lampshade station sheet | `Sheet1` → `Cleaned Data`; what the Sheets tool reads/writes |
| Names Master Sheet | Spoken names, used live by both tools |
| Lampshade SOT | Sizes, colours, images for the lampshade collection cards |

Database objects used by the **deployment tooling** (not by the Speak Tool itself):

| Object | Used for | Notes |
|---|---|---|
| `varman_aios.hub_pages` | Stores the HTML tool's page on the Varmen hub. Key `(member_name, page_slug)` | Written only by the external `push_to_hub.js` script (§7). Shared connection — do not repurpose |
| `daily_task.tbl_stfc_sarujanan` | Daily work reporting, not the tool | [`sql/daily_task_insert_2026-08-17.sql`](../sql/daily_task_insert_2026-08-17.sql) |

No credentials, connection strings, or API keys are stored in this repository. The hub database
connection is supplied at deploy time as the `HUB_DB_URL` environment variable and **must never be
committed**.

---

## 6. Current Workflow / Architecture

Both tools implement the same packing-order rules (full detail:
[`workflows/packing-workflow.md`](../workflows/packing-workflow.md)):

- **Inside one order**, products are re-sequenced by a fixed rank (Rectangle Ceiling Rose →
  Lampshade → WC cage → Bulb → Ceiling Rose/Other, or a different order if there's no rectangle
  rose) — a stable sort, ties keep the original pack-list order. An order with neither a lampshade
  nor a ceiling rose is left untouched.
- **Merge orders** (several customer orders packed as one parcel) are sorted twice: each sub-order
  internally, then the sub-orders themselves are sequenced against each other by their ranked
  contents.
- **Lampshade collections**: before an order that's short on a shade family, the packer is sent to
  collect that family in bulk across either "these orders only" or the whole pack list, up to
  `Engine.MAX_COLLECTION` (currently **10** in the HTML tool; **15** in the Unit 3 Sheets tool —
  an open, undecided discrepancy, see §9).
- **Hold**: the packer can set an order aside and come back to it later; implemented in the HTML
  tool only.

Architecturally, `speak_tool_html_sheet_UI/engine.js` is the single source of truth for the rules
and is compiled into the HTML tool's bundle by `build.js`. The Google Sheets tool is **not** built
from this file — `scripts/Unit 3 Lampshade/packing-priority.gs` is a hand-ported, independent
re-implementation of the same rules, and the other five stations' scripts have none of it at all.
There is no shared runtime between the two delivery forms; keeping their rules in sync is a manual,
human responsibility.

---

## 7. How to Run

### HTML Speak Tool
```bash
node packlist_extension/build.js        # rebuilds packlist-speak.js, speak-loader.html,
                                          # and packlist_upload/Speak-Tool.html — always run
                                          # this before uploading; an unbuilt source edit is
                                          # not in Speak-Tool.html
```
Three ways to use the built output (full detail: [`packlist_extension/README.md`](../packlist_extension/README.md)):
1. Drop the day's Order Packing HTML onto `packlist_upload/Speak-Tool.html` (what the hub serves).
2. Add `<script src="packlist-speak.js"></script>` before `</body>` of the live pack-list page,
   served from the same origin.
3. `node packlist_extension/add-speak.js <file>.html` to inject the tool into a saved pack list.

Voice **commands** need `http(s)` (Chrome denies microphone access to `file://`); speech output,
buttons and keys work regardless. `node packlist_extension/serve.js <file>` serves a saved file
locally so the microphone works for manual testing.

### Google Sheets tool
Open the station sheet → `Extensions → Apps Script` to view/edit, or use the menu added to the
sheet itself: **Speak Tool → Run Clean and Merge**, then **Speak Tool → Speak All Rows**.

---

## 8. Refresh / Deployment Process

### HTML Speak Tool → Varmen AIOS hub
```bash
node packlist_extension/build.js
cd /home/led-247/SOT-Data-Gap-Analysis-Dashboard/hub        # a separate repo/folder, not this one
export HUB_DB_URL="…ask Varmen — never write it into a file or chat…"
node push_to_hub.js sarujanan speak_tool "Speak Tool — Order Pack List" \
     /home/led-247/Speak-tool-feedbacks-and-correction/packlist_upload/Speak-Tool.html
```
Same member + slug overwrites the existing page in place; a different slug creates a new one.
**File size proves nothing** — verify a change actually landed by decoding the `stx-bundle` base64
out of the stored HTML and checking your edit is inside it (method used to verify this handover,
§3). This push step lives **outside this repository** and was **not re-run** as part of this
handover — only the in-repo build was verified.

### Google Sheets tool
1. **Export the live copy first** and commit it — the live file may have changed since the repo's
   copy was taken, and overwriting without checking will silently discard whatever changed live
   (this exact situation currently exists for Unit 3's `Lithursan.gs` — see §3.1 of
   [`handover-note.md`](handover-note.md)). Steps: [`handover/script-export-instructions.md`](script-export-instructions.md).
2. Merge your change into the exported files, paste into the Apps Script editor (or `clasp push`),
   save.
3. In the sheet: **Speak Tool → Run Clean and Merge** (required — the packing sort happens here,
   not in the Apps Script save) then **Speak Tool → Speak All Rows**, and listen to at least one
   merge order and one collection.

---

## 9. Validation Completed

No browser-based automated test suite exists — voice requires a real Chrome instance and a real
microphone, so voice itself is verified manually on a real station over `http(s)`.

What **was** run and passed, including today while preparing this handover:

| Suite | Command | Result |
|---|---|---|
| Live-name lookup against the built bundle | `node evidence/live-names-tests.js` | 28/28 passing, 2026-10-05 |
| Hold / held-pass logic | `node evidence/hold-feature-tests.js` | 38/38 passing, 2026-10-05 |
| Pack sizes, order type, merge flag, Instruction QR | `node evidence/html-order-details-tests.js` | Passing, 2026-10-05, **after** `npm install jsdom` (not in `package.json` — see §10) |

**One thing worth re-checking before the 2026-10-05 build reaches the hub:** the new test reports
**73 orders** flagged `isMerge: true` out of the 155 test orders, whereas every existing dated
document (`handover-note.md` §7, `documentation/03-unit3-lampshade-logic.md`, written/verified
2026-09-14) states **27 merges** for the same 155-order test set. The `isMerge` field itself is new
in the 2026-10-05 commit — it is `true` when either an explicit "Merge Order" badge is found *or*
an order simply has more than one product block. That `or` may be classifying more orders as
"merge" than the historical figure counted, which matters because `isMerge` now also controls
whether the tool **says "Merge Order" out loud**. I have **not** confirmed with Varmen whether the
wider trigger is intended; recommend checking this before/soon after the next hub push, by diffing
`isMerge` against the pack list's actual merge badges on a sample of real orders.

Packing-rule correctness itself (sequencing, collections) is unchanged by the 2026-10-05 commit —
confirmed by the new test's own assertion that order count and packing sequence are identical to
the prior committed `engine.js`.

---

## 10. Known Issues / Dependencies

**HTML Speak Tool**
- "Save a copy" silently fails on the hub — its iframe sandbox lacks `allow-downloads`. Works when
  the loader is opened directly.
- Send Order Instruction is not spoken (no field for it on the pack-list page). The Sheets tool
  speaks it.
- `evidence/html-order-details-tests.js` needs `jsdom`, absent from `package.json`'s
  `devDependencies`. Install locally (`npm install jsdom`) before running it; `node_modules` is
  already `.gitignore`d, so this is safe to do without affecting anyone else.
- The `isMerge` trigger-rate discrepancy above (§9) — needs a decision, not yet a confirmed bug.

**Unit 3 Sheets tool** (carried over from the 13-Aug review, re-checked 2026-09-14, still true)
- `onOpen` is defined in both `action.gs` and `cleaned.gs` — the last one loaded wins.
- Pack-suffix lookup in `cleaned.gs`'s `processRow` strips exactly 3 characters, which is wrong for
  a 2-character `PK` suffix.
- Merge label still reads "merge order total: N : merge order: 1" (a feedback item asked for just
  "Merge order").
- Duplicate-postcode blanking compares adjacent rows only, and also blanks the QR flag as a
  side-effect.
- `RPR44WH` is hardcoded in shared cleaning logic.
- No Hold feature.
- Collection limit is **15**, vs the HTML tool's **10** — undecided which should govern (§3.2 of
  `handover-note.md`).

**Other five stations** — none have packing priority, collections, merge sequencing or Hold at all;
rolling the Unit 3 work out to them (or retiring their sheets in favour of the HTML tool) is an open
decision, not started.

**External dependencies**
- **Chrome only** — `SpeechRecognition` is Chrome-specific and cloud-backed (needs network for
  voice *commands*; speech *output* is local).
- Network access to `docs.google.com` for the live Names Master Sheet; falls back to built-in names
  offline.
- Varmen AIOS hub + its Postgres-backed `hub_pages` table, reached only through
  `/home/led-247/SOT-Data-Gap-Analysis-Dashboard/hub/push_to_hub.js` — a **separate repository**
  this handover does not cover in depth. `HUB_DB_URL` is supplied out-of-band and must never be
  committed anywhere.
- Google Apps Script platform for the Sheets tool; `clasp` CLI optional but recommended for proper
  version control of station scripts (`.clasp.json` is tracked, `.clasprc.json` — the OAuth token —
  is `.gitignore`d).

---

## 11. Backup Person / Owner

**Varmen** assigned the project and is the contact for deployment decisions and the `HUB_DB_URL`
credential. **No backup developer is named in any document in this repository.** This is a gap —
before the outgoing developer's access is removed, confirm with Varmen who will:
- hold the `HUB_DB_URL` / hub deploy access going forward,
- own the five open decisions in §12,
- be the point of contact for station teams reporting new issues (previously routed through the
  feedback workbook, one tab per station).

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Edited `engine.js` or `speak-extension.js` but the hub page (or a saved `.speak.html`) doesn't reflect it | You must run `node packlist_extension/build.js` first — source edits are not live until the bundle is rebuilt. Then re-push to the hub (§8). |
| Pushed to the hub, hub still looks unchanged | File size alone proves nothing. Decode the `stx-bundle` base64 inside the stored HTML and check your change is in it — same/slug updates in place but caching or a wrong slug can mask a failed push. |
| Voice *commands* don't work, but speech output does | Page is being opened over `file://`. Chrome refuses microphone access to that origin. Serve it (`node packlist_extension/serve.js <file>`) or test on the hub, which is `https`. |
| "Saved" message appears but no file downloads on the hub | Known issue (§10) — the hub's iframe sandbox blocks downloads silently. Open the loader directly instead, outside the hub iframe. |
| Edited a station's `.gs` file, sheet behaviour unchanged | You must run **Speak Tool → Run Clean and Merge** in the sheet — the packing sort and cleaning pipeline run there, not on save. |
| Two station `.gs` files both define the same function (e.g. `onOpen`) | Apps Script shares one global scope per project; the last file loaded wins. Check which file actually runs before debugging the "wrong" one. |
| About to change a station's Apps Script | **Export the live copy first** (`handover/script-export-instructions.md`) and commit it before merging your change — a live station may already differ from the repo (confirmed true for Unit 3's `Lithursan.gs`). |
| New regression test won't run | `Cannot find module 'jsdom'` means it needs `npm install jsdom` first (§10) — it is a dev-only dependency, not yet declared in `package.json`. |
| Unsure whether a rule change affects real orders | Re-run the rule against `order_details/*.html` (155 real orders, 27 structurally-merged by the pre-2026-10-05 definition) and report how many orders move — the convention every prior rule change in this project followed (see `workflows/packing-workflow.md` §7). |

---

## 13. Final Handover Notes

- Start at the top-level [`README.md`](../README.md) — it routes to everything else by role.
- [`handover-note.md`](handover-note.md) in this folder is the detailed risk and open-decision log;
  it has been verified and updated as part of this handover (see its own banner) and should be read
  in full before touching the Unit 3 Sheets tool specifically.
- The single highest-risk action available to a new developer is **pasting a repo `.gs` file over
  a live station's Apps Script without exporting the live version first** — this has already
  silently happened once (Unit 3's `Lithursan.gs`, §3.1 of `handover-note.md`) and would delete
  real, undocumented live changes again if repeated.
- Five decisions are open and unresolved (Sheets-tool collection limit, stale hub pages, whether to
  roll Unit 3's rules out to the other five stations, whether to speak the customer note, and a
  possible `Shipping Service` column) — listed in full in §9 of `handover-note.md`. None of them
  block current operation; all of them need a decision from Varmen or the business, not more code.
- This document and `handover-note.md` describe only what exists in this Git repository. The hub
  push step, the external `push_to_hub.js` tooling, and the Google Sheets stations' live state all
  live outside it and were not independently re-verified beyond what is noted above.

No passwords, API keys, tokens, or credentials are recorded in this document or anywhere in this
repository.
