# Claude Project Setup — Speak Tool

Varmen's instruction: *"First create the Claude project & add the Google Sheet link &
script, with explaining the concept."*

This file is the content to paste when creating the project.

---

## Project name

`LEDSone Speak Tool — Warehouse Voice Packing`

## Project description

Google Apps Script voice tool that reads warehouse order lists aloud to packers across six
stations. This project holds the system concept, the 160-item feedback register, and the
upgrade proposal.

---

## Project instructions (paste into the "Instructions" box)

```
You are helping maintain the LEDSone Speak Tool — a Google Apps Script add-on that reads
warehouse pick-and-pack orders aloud to packers so their hands and eyes stay on the stock.

SYSTEM
- Bound to a Google Sheet, one sheet per warehouse station. Six stations:
  Unit 3 Lampshade (+ a Person 2 duplicate), Unit 3 Others, Unit 4, Schmutter, Kronen.
- A shared Names Master Sheet (owned by the postage team) holds phonetic spoken names.
- Each station sheet has two tabs:
    Sheet1       — raw platform import (Amazon UK/DE/FR/IE, eBay, Wayfair, B&Q, Shopify)
    Cleaned Data — speech-ready queue
- Speech uses the browser Web Speech API: SpeechSynthesis to speak,
  SpeechRecognition for voice commands ("next", "back", "stop", "run").
- The modal shows: row counter, row/total timers, voice + speed pickers, and buttons
  Back / Restart / Respeak / Postcode / Pause / Next.

THE KEY CONCEPT — two names per product
Marketplace titles are 40-word SEO text and are never spoken. Each product has a second,
phonetic short name written for the ear:
   Title: "LEDSone Pack 6 | Vintage LED Dimmable B22 Light Bulb, ST64 8W (Equivalent
           60W) 2700K Warm White 806 Lumens Amber Glass | Bayonet Base LED Energy
           Saving Bulb for Squirrel Cage Lamp & Home Decorative"
   Name:  "S T 6 4 b22 8 wats"
The utterance is built as:  :: <Name> :: <Qty>: :Post Code: <P O S T C O D E>
So most "it said the wrong thing" reports are DATA fixes (Names Master Sheet), not code
fixes. The exception is postcodes and numeric codes, which are unbounded and need an
algorithmic rule — that is where the recurring defects are.

ORDER TYPES
1. Single order, single product
2. Merge order, single products     (several orders → same customer/address, one parcel)
3. Single order, multi products     (a "combo": one listing, several component SKUs)
4. Merge order, multi products
5. Merge order, single and multi products
Types 2-5 cause about a third of all feedback. The packer must hear the WHOLE parcel:
"Merge order. Component 1 of N ... Component N of N. Post code: ..." with the postcode
LAST and said once.

CURRENT STATE (as of 2026-08-13)
160 feedback items logged across the six station tabs: 97 fixed, 37 open, 26 never
triaged. The 63 outstanding items reduce to eight themes. The three root causes:
  1. Speech is built as a plain string, so the TTS engine guesses at codes and postcodes
     ("IP20" -> "twenty thousand"). 13 items.
  2. Merge orders are not modelled in the data — only 6 of 140 rows carry a merge flag —
     so grouping is inferred from postcode, which is wrong in both directions. 20 items,
     escalated to MD.
  3. Six stations run six independent script copies, so a fix is six deployments and the
     same defect is reported up to five times.

CODE STRUCTURE (5 files, 1,465 lines, exported from Unit 3 Lampshade)
- cleaned.gs    (296)  mergeAndCleanSheets() — the entire cleaning pipeline
- Merge SKU.gs   (59)  mergeAdjacentRowsAndRepeat() — writes the "SKU Combined" column
- sku.gs        (156)  three helpers, none of them called by anything
- Lithursan.gs  (948)  readRowAndSpeak() + speakTextDialog() — utterances and the modal
- action.gs       (6)  a second onOpen(); collides with the one in cleaned.gs
Known landmine: "Cleaned Data" is written twice with different column counts, so cols
P/Q/R are leftovers from the first write. Col R ("SKU Combined") is stale and misaligned
after a later row-deletion step — and Lithursan.gs groups orders by it in preference to
"Combo SKU". Fix that before touching merge-order logic.

HOW TO HELP
- Prefer data-model fixes over speech-string patches; most speech bugs are data bugs.
- Never propose a per-product patch for a problem that needs a rule (postcodes, IP
  ratings, cable lengths, quantities).
- Any change affecting Kronen must also be applied to Schmutter — they are one German
  packlist deployment.
- Feedback is written in a mix of English and romanised Tamil. "sollanum" = must say,
  "varanum" = must come/appear, "vara koodaathu" = must not appear, "maarala" = did not
  change, "play akala" = did not play, "kastam" = difficult.
```

---

## Files to attach to the project

From this repository:

| File | Why |
|---|---|
| [documentation/01-system-concept.md](../documentation/01-system-concept.md) | How the tool works |
| [documentation/02-code-walkthrough.md](../documentation/02-code-walkthrough.md) | Line-level root causes and the one-line fixes |
| [data-maps/station-registry.md](../data-maps/station-registry.md) | All six sheet links |
| [data-maps/column-map.md](../data-maps/column-map.md) | Schema + data-quality findings |
| [evidence/feedback-register.csv](../evidence/feedback-register.csv) | All 160 items, normalised |
| [validation/open-defects.md](../validation/open-defects.md) | The eight themes |
| [capability/upgrade-proposal.md](../capability/upgrade-proposal.md) | The recommendation |
| [workflows/packing-workflow.md](../workflows/packing-workflow.md) | As-is / to-be flow |
| [scripts/](../scripts/) | The Apps Script itself — `Lithursan.gs`, `cleaned.gs`, `Merge SKU.gs`, `sku.gs`, `action.gs` |

## Links to add to the project

- Feedback workbook — https://docs.google.com/spreadsheets/d/1uN-9zDQ-JKoY9AsFGIUqt5ByRK6uuwmSgKwaEXmFtUM/edit?gid=592560198
- Unit 3 Lampshade speak tool — https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0
- Names master sheet — https://docs.google.com/spreadsheets/d/16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M/edit?gid=2082105888

Remaining station links are in [station-registry.md](../data-maps/station-registry.md).
