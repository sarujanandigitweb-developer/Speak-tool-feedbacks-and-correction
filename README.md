# Speak Tool — Warehouse Voice Packing (STFC)

The **LEDSone Speak Tool** reads warehouse pick-and-pack orders aloud so a packer's hands and
eyes stay on the stock. The packer says **"next"** (or presses a button) to move on.

This repository holds the tool's source, its rules, and the analysis behind them.

**Last updated:** 2026-09-14 · **Project code:** STFC · **Assigned by:** Varmen

---

## Start here

| If you are… | Read |
|---|---|
| **Taking over the project** | [handover/handover-note.md](handover/handover-note.md) — current state, what is live, what is pending, risks |
| Working on the **HTML Speak Tool** (the one on Varmen AIOS) | [packlist_extension/README.md](packlist_extension/README.md) |
| Working on the **Google Sheets tool** (Unit 3 Lampshade) | [documentation/03-unit3-lampshade-logic.md](documentation/03-unit3-lampshade-logic.md) |
| New to the domain (orders, combos, merges, names) | [documentation/01-system-concept.md](documentation/01-system-concept.md) |
| Checking the packing rules | [workflows/packing-workflow.md](workflows/packing-workflow.md) |

---

## There are two tools

They share the same **packing rules** but are delivered differently.

| | **HTML Speak Tool** | **Google Sheets Speak Tool** |
|---|---|---|
| What it is | A self-contained web page. Drop the day's Order Packing HTML on it and it speaks the pack list. | Google Apps Script bound to each station's sheet. `Extensions → Speak Tool`. |
| Source | [`packlist_extension/`](packlist_extension/) + shared rules in [`speak_tool_html_sheet_UI/engine.js`](speak_tool_html_sheet_UI/engine.js) | [`scripts/<station>/`](scripts/) — one independent copy per station |
| Reads | The pack list HTML page | `Sheet1` → cleaned into `Cleaned Data` |
| Deployed to | **Varmen AIOS hub**, slug `speak_tool` | Each station's Apps Script editor (pasted by hand) |
| Packing priority, collections, merge sequencing | ✅ current | ✅ Unit 3 Lampshade only, **repo version not yet pasted live** — see handover |
| Hold / Held orders | ✅ | ❌ |

Live page: <https://varman-aios-hub-varmens.vercel.app/view/hub_pages/speak_tool>

---

## Project structure

| Folder | What is in it | Kind |
|---|---|---|
| [`packlist_extension/`](packlist_extension/) | HTML Speak Tool: UI/speech/voice source, build script, loader | **Code** |
| [`packlist_upload/`](packlist_upload/) | `Speak-Tool.html` — the built single file that is uploaded to the hub. **Generated.** | Build output |
| [`speak_tool_html_sheet_UI/`](speak_tool_html_sheet_UI/) | `engine.js` (packing rules) and `reference-data.js` (names + Lampshade SOT) — **shared by the build**. `index.html` + `app.js` are the older REQ-04 standalone UI, no longer deployed. | **Code** |
| [`scripts/`](scripts/) | Apps Script exported from all six stations. Unit 3 Lampshade is the only one carrying the packing-priority and collection work. `*.bak*` files are local backups, not deployed. | **Code** |
| [`order_details/`](order_details/) | 13 real pack-list HTML files (155 orders) used as test data | Test data |
| [`outputs/`](outputs/) | `packlists-13.speak.html` — a frozen snapshot of those 13 lists with the tool inside | Generated |
| [`documentation/`](documentation/) | System concept, Unit 3 logic reference, and the 13 Aug code walkthrough (historical) | Docs |
| [`workflows/`](workflows/) | The packing sequence rules the tools implement | Docs |
| [`data-maps/`](data-maps/) | Station and sheet links; `Sheet1` → `Cleaned Data` columns | Docs |
| [`handover/`](handover/) | Handover note; how to export / deploy Apps Script | Docs |
| [`validation/`](validation/) | Rule decisions (dated) and issue analyses | Dated records |
| [`capability/`](capability/) | Implementation reports and the original upgrade proposal | Dated records |
| [`evidence/`](evidence/) | Feedback register (160 items), discovery reports, test scripts and results | Dated records |
| [`daily_logs/`](daily_logs/) | Day-by-day work logs | Dated records |
| [`sql/`](sql/) | Daily-task insert for the reporting DB; a proposed order model (never built) | Dated records |
| [`closure/`](closure/), [`prompts/`](prompts/) | 13 Aug submission checklist; Claude project setup text | Docs |

**Dated records are kept as they were written.** Where a later ruling changed something, the file
carries a banner at the top pointing to what is current. Do not treat an unbannered 13 Aug figure
(for example "1,465 lines" or "limit of 15") as current without checking the code.

---

## Build and deploy the HTML Speak Tool

```bash
node packlist_extension/build.js        # rebuilds packlist-speak.js, speak-loader.html
                                        # and packlist_upload/Speak-Tool.html
```

The build is what makes a source edit real. Always rebuild before uploading — an unbuilt edit
is not in `Speak-Tool.html`. Upload steps are in the
[handover note](handover/handover-note.md#5-deploying).

---

## Sources

| Sheet | Link |
|---|---|
| Feedback workbook (one tab per station) | [1uN-9zDQ…](https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=592560198) |
| Unit 3 Lampshade station sheet | [1AMQMzxu…](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) |
| Names Master Sheet (spoken names) | [16rx5Dz…](https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M/edit?gid=2082105888) |
| Lampshade SOT (sizes, colours, images) | [1b9n4Rhy…](https://docs.google.com/spreadsheets/d/1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI/edit?gid=736349891) |
| All other station sheets | [data-maps/station-registry.md](data-maps/station-registry.md) |
