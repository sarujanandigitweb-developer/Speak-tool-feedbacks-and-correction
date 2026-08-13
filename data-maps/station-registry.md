# Station Registry

All live Speak Tool sheets, extracted from the `All Stations` tab of the feedback workbook
(hyperlink targets, 2026-08-13).

## Control workbook

| Name | Purpose | Link |
|---|---|---|
| Speak tool feedbacks and correction | Master feedback log — one tab per station | [open](https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=592560198) |

## Station sheets

| # | Station | Feedback tab | Sheet |
|---|---|---|---|
| 1 | Unit 3 Lampshade | `Unit 3 Lampshade` | [open](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0) |
| 2 | Unit 3 Others (*Copy of jana speak*) | `Unit 3 Others` | [open](https://docs.google.com/spreadsheets/d/1KyC8IONfHAlufQvsRKUfqDAUran0EQ3OC0MOHanRRfY/edit?gid=0) |
| 3 | Unit 3 Lampshade — Person 2 | *(shares `Unit 3 Lampshade`)* | [open](https://docs.google.com/spreadsheets/d/1UXra9cmbtpFt_890VjyiuDXKMjds6R0yowq2SlaQTsk/edit) |
| 4 | Unit 4 | `Unit 4` | [open](https://docs.google.com/spreadsheets/d/1XPvIv32Fcj6zWABZRfx1u7h2TJ8px1VrJpqqyC9QCF8/edit?gid=0) |
| 5 | Schmutter (German pack) | `Schmutter` | [open](https://docs.google.com/spreadsheets/d/1QsxHveeHDoZE_QJ4aOpRzcuvzAh1MFUZb3xWkmVw1gA/edit?gid=2036049509) |
| 6 | Kronen (German pack) | `Kronen` | [open](https://docs.google.com/spreadsheets/d/1ROig4b9TtVrqm5F367ZUJ4Dly3xoAoBMZfTVdDeGlyk/edit?gid=0) |

## Shared reference

| Name | Owner | Purpose | Link |
|---|---|---|---|
| Names master sheet | Postage team | Phonetic/spoken name dictionary used by all stations | [open](https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M/edit?gid=2082105888) |

## Notes

- **Station 3 has no feedback tab of its own** — it is a duplicate of station 1 for a
  second packer. Its issues land in the `Unit 3 Lampshade` tab.
- **Stations 5 and 6 report as a pair.** Four of their six/fourteen items are identical
  text; FB-154 explicitly asks that merge-order changes be applied to *"ellarm germen pack
  list kum — kronen & schmutter"* (all German packlists). Treat them as one deployment
  target.
- Each station runs its **own copy** of the Apps Script. There is no shared library, so
  a fix is six deployments. This is the root cause of duplicate tickets — see
  [Upgrade Proposal §5](../capability/upgrade-proposal.md).
