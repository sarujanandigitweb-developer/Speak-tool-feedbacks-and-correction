# Claude Project Setup — Speak Tool

Paste-ready content for a Claude project that helps maintain the Speak Tool.
**Last updated:** 2026-09-14 (first written 2026-08-13).

---

## Project name

`LEDSone Speak Tool — Warehouse Voice Packing (STFC)`

## Project description

Voice pick-and-pack tool for the LEDSone warehouse: an HTML Speak Tool on the Varmen AIOS hub and a
Google Apps Script tool per station, sharing one set of packing rules.

---

## Project instructions (paste into the "Instructions" box)

```
You are helping maintain the LEDSone Speak Tool, which reads warehouse pick-and-pack orders aloud so
packers keep their hands and eyes on the stock. The packer says "next" to move on.

TWO TOOLS, ONE SET OF RULES
1. HTML Speak Tool — a self-contained page published on the Varmen AIOS hub (slug speak_tool).
   The packer drops the day's Order Packing HTML on it. Source: packlist_extension/src/
   (speak-extension.js UI/speech/voice, names-live.js, speak-loader.template.html) plus the shared
   rules in speak_tool_html_sheet_UI/engine.js and reference-data.js. Built with
   `node packlist_extension/build.js` into packlist_upload/Speak-Tool.html. Always rebuild.
2. Google Sheets tool — Apps Script bound to each station sheet. Only Unit 3 Lampshade has the
   rules (scripts/Unit 3 Lampshade/packing-priority.gs). Pipeline: Sheet1 -> "Run Clean and Merge"
   -> Cleaned Data (sorted) -> "Speak All Rows". The other five stations run original copies.
   The repo is NOT guaranteed to match a live station; export before deploying.

NAMES
Marketplace titles are never spoken. Each SKU has a short spoken name in the Names Master Sheet
(e.g. "S T 6 4 b22 8 wats"). No name -> "This one" + colour. Most "it said the wrong thing" reports
are fixes to that sheet, not code. The postcode is always spoken last, character by character.

PACKING PRIORITY (per order, stable sort)
Types: Rect Ceiling Rose (name: ceiling/celing rose + rectangle/retangle), Ceiling Rose, Lampshade
(SKU LS*, WCWD*), WC cage (WC* except WCWD), Bulb (LD*), Other.
With a Rect Rose:  Rect Rose 1, Lampshade 2, WC cage 3, Bulb 4, Rose/Other 5
Without:           Lampshade 1, WC cage 2, Bulb 3, Rose/Other 4
No Lampshade and no Ceiling Rose -> no reordering at all.
MERGE ORDERS: rank each sub-order on its own; then order the sub-orders by comparing their ranks
best-first, position by position (tie keeps original order); no anchor anywhere -> keep order.

LAMPSHADE COLLECTIONS
Before an order short on a shade family, send the packer to collect it. List 1 "these orders only"
(LSBS LSSS LSWE WCCY LSCYRO LSBG LSCG LSFG LSGD LSGG LSGL WCB WCD WCWD) walks consecutive orders;
a run of one is not shown. List 2 "whole pack list" (LSCY2 LSDM LSDO LSEL LSFT LSHH LSHM LSLC LSLT
LSMS LSOL LSRP LSTF LSTL LSTM LSUL LSWD). Longest prefix wins. Limit per collection: 10 in the HTML
tool, 15 in the Sheets tool (not aligned).

HOW TO HELP
- Before changing a rule, measure it against order_details/*.html (13 pack lists, 155 orders,
  27 merges): report how many orders move, and prove single orders are unaffected when only merges
  should change. Keep both tools' rules identical.
- Any new voice word must be checked against the catalogue strings in reference-data.js; a word that
  appears in product names ("black", "gold", "pack") will fire while the tool reads names aloud.
- Never write the hub database connection string into a file or chat; it is the HUB_DB_URL env var.
- Any change affecting Kronen must also be applied to Schmutter — one German pack deployment.
- Feedback is written in English and romanised Tamil. "sollanum" = must say, "varanum" = must
  come/appear, "vara koodaathu" = must not appear, "maarala" = did not change, "play akala" = did
  not play, "kastam" = difficult, "ollunga varala" = not aligned properly.
```

---

## Files to attach

| File | Why |
|---|---|
| [README.md](../README.md) | Project map |
| [handover/handover-note.md](../handover/handover-note.md) | Live vs pending, risks, deploy steps |
| [documentation/01-system-concept.md](../documentation/01-system-concept.md) | Domain concepts |
| [documentation/03-unit3-lampshade-logic.md](../documentation/03-unit3-lampshade-logic.md) | Sheets tool logic |
| [packlist_extension/README.md](../packlist_extension/README.md) | HTML tool behaviour |
| [workflows/packing-workflow.md](../workflows/packing-workflow.md) | The rules and their history |
| [data-maps/station-registry.md](../data-maps/station-registry.md) | All sheet links |
| [data-maps/column-map.md](../data-maps/column-map.md) | `Cleaned Data` columns |
| `speak_tool_html_sheet_UI/engine.js` | The rules as code |
| `scripts/Unit 3 Lampshade/packing-priority.gs` | The rules as Apps Script |
| [evidence/feedback-register.csv](../evidence/feedback-register.csv) | 160 feedback items (as of 2026-08-13) |

## Links

- Varmen AIOS — https://varman-aios-hub-varmens.vercel.app/view/hub_pages/speak_tool
- Feedback workbook — https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=592560198
- Unit 3 Lampshade sheet — https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0
- Names Master Sheet — https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M/edit?gid=2082105888
- Lampshade SOT — https://docs.google.com/spreadsheets/d/1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI/edit?gid=736349891
