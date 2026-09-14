# Station Registry

All sheets and pages the Speak Tool depends on.
**Last updated:** 2026-09-14 (station links extracted 2026-08-13 from the feedback workbook's
`All Stations` tab).

## Control workbook

| Name | Purpose | Link |
|---|---|---|
| Speak tool feedbacks and correction | Feedback log — one tab per station | [open](https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=592560198) |

## Station sheets (Google Sheets tool)

| # | Station | Feedback tab | Sheet | Script in repo | Has packing priority + collections |
|---|---|---|---|---|:---:|
| 1 | Unit 3 Lampshade | `Unit 3 Lampshade` | [open](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) | [`scripts/Unit 3 Lampshade/`](../scripts/Unit%203%20Lampshade/) | ✅ (repo) |
| 2 | Unit 3 Others (*Copy of jana speak*) | `Unit 3 Others` | [open](https://docs.google.com/spreadsheets/d/1KyC8IONfHAlufQvsRKUfqDAUran0EQ3OC0MOHanRRfY/edit?gid=0) | [`scripts/Copy of jana speak/`](../scripts/Copy%20of%20jana%20speak/) | ❌ |
| 3 | Unit 3 Lampshade — Person 2 | *(shares `Unit 3 Lampshade`)* | [open](https://docs.google.com/spreadsheets/d/1UXra9cmbtpFt_890VjyiuDXKMjds6R0yowq2SlaQTsk/edit) | [`scripts/Unit 3 Lampshade Person 2 Speak tool/`](../scripts/Unit%203%20Lampshade%20Person%202%20Speak%20tool/) | ❌ |
| 4 | Unit 4 | `Unit 4` | [open](https://docs.google.com/spreadsheets/d/1XPvIv32Fcj6zWABZRfx1u7h2TJ8px1VrJpqqyC9QCF8/edit?gid=0) | [`scripts/Unit 4 speak tool/`](../scripts/Unit%204%20speak%20tool/) | ❌ |
| 5 | Schmutter (German pack) | `Schmutter` | [open](https://docs.google.com/spreadsheets/d/1QsxHveeHDoZE_QJ4aOpRzcuvzAh1MFUZb3xWkmVw1gA/edit?gid=2036049509) | [`scripts/Schmutter speak tool/`](../scripts/Schmutter%20speak%20tool/) | ❌ |
| 6 | Kronen (German pack) | `Kronen` | [open](https://docs.google.com/spreadsheets/d/1ROig4b9TtVrqm5F367ZUJ4Dly3xoAoBMZfTVdDeGlyk/edit?gid=0) | [`scripts/Kronen speak tool/`](../scripts/Kronen%20speak%20tool/) | ❌ |

"(repo)": the Unit 3 Lampshade changes of 2026-09-14 are in the repository and **not yet pasted into
the live Apps Script** — see the [handover note](../handover/handover-note.md).

## Shared reference sheets

| Name | Owner | Purpose | Read by | Link |
|---|---|---|---|---|
| Names Master Sheet (tab `names`) | Postage team | SKU → spoken name | Sheets tool on every Clean and Merge; HTML tool live (CSV export, cached 6 h) | [open](https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M/edit?gid=2082105888) |
| Lampshade SOT — *Easy Fit Lampshades* | — | Size, colour, family, image for 451 lampshade SKUs | Sheets tool (`ppLoadSot`); HTML tool from the copy built into `reference-data.js` | [open](https://docs.google.com/spreadsheets/d/1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI/edit?gid=736349891) |

The HTML tool's copy of the SOT is **frozen at build time** (`reference-data.js`, 2026-08-18). SOT
edits reach it only when `reference-data.js` is regenerated and the tool rebuilt.

## HTML Speak Tool — Varmen AIOS hub

| Slug (member `sarujanan`) | What it is |
|---|---|
| [`speak_tool`](https://varman-aios-hub-varmens.vercel.app/view/hub_pages/speak_tool) | **The current HTML Speak Tool** |
| `speak-tool` | Stale 2026-08-19 build — see handover §3.5 |
| `packlist-13-speak` | Frozen 155-order snapshot, not a tool |

Pages are stored in `varman_aios.hub_pages` and rendered inside a sandboxed iframe.

## Notes

- **Station 3 has no feedback tab of its own** — its issues land in `Unit 3 Lampshade`.
- **Stations 5 and 6 report as a pair.** Several items are word-for-word identical; FB-154 asks that
  merge-order changes apply to all German pack lists. Treat them as one deployment target.
- **Each station runs its own copy of the Apps Script.** A fix is up to six deployments, which is why
  the same issue gets reported more than once.
