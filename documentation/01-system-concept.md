# Speak Tool — System Concept

**Prepared for:** Varmen (task assigner)
**Prepared by:** Lithurshan
**Date:** 2026-08-13
**Status:** Concept understood and documented from live sheets. Apps Script source not yet exported (see Gap 1).

---

## 1. What the tool is

The **Speak Tool** is a Google Apps Script add-on bound to a Google Sheet. It converts a
day's order list into a **hands-free audio pick-and-pack instruction stream** for the
warehouse team.

A packer stands at a station with both hands on stock. Instead of reading a printed
packlist and looking up and down between paper and shelf, the tool **speaks the order to
them** — quantity, product name, then postcode — and advances to the next order on a
**voice command** ("next") or a button press.

The business value is simple: eyes and hands stay on the product, so packing is faster
and mis-picks drop.

## 2. The user interface

From the live tool (`Extensions → Speak Tool → Speak Products`), the modal shows:

| Element | Purpose |
|---|---|
| `Row: 1 of 217` | Position in the day's queue |
| `Row Time: 00:01:28` | Time spent on the current order — a productivity metric |
| `Total Time: 00:00:00` | Cumulative session time |
| `Voice:` dropdown | Browser TTS voice selection (e.g. *Google US English (en-US)*) |
| `Speed:` dropdown | Normal / Fast / Very Fast (per FB-121: x1, x1.25, x1.5) |
| `Back` | Previous order |
| `Restart` | Re-run the queue from row 1 |
| `Respeak` | Repeat the current order |
| `Postcode` | Speak the postcode on demand (confirmed **after** packing) |
| `Pause` | Hold the queue |
| `Next` | Advance one order |
| Spoken-text banner | The exact string being spoken, e.g. `:: S T 6 4 b22 8 wats :: 6: :Post Code: W 3 6 H H` |
| Product panel | Thumbnail, marketplace title, phonetic name, price, customer + address, quantity badge, SKU |

Every button also has a **spoken equivalent** — "next", "back", "stop", "run" — captured
through the browser Speech Recognition API. That is the "voice control" Varmen referred
to: *say "next" and the order list shifts*.

## 3. The two-layer data model

This is the single most important thing to understand about the system.

The tool does **not** read the marketplace product title aloud. Marketplace titles are
SEO text — 40+ words, unpronounceable, useless to a packer:

> `LEDSone Pack 6 | Vintage LED Dimmable B22 Light Bulb, ST64 8W (Equivalent 60W) 2700K Warm White 806 Lumens Amber Glass | Bayonet Base LED Energy Saving Bulb for Squirrel Cage Lamp & Home Decorative`

Instead the sheet carries a second, **phonetic short name** written for the ear:

> `S T 6 4 b22 8 wats`

So each order row exists twice:

- **`Sheet1`** — the raw import from the selling platforms (Amazon UK/DE/FR/IE, eBay,
  Wayfair, B&Q, Shopify/ledsone.co.uk). 17 populated columns, one row per line item.
- **`Cleaned Data`** — the speech-ready projection. Adds `Name` (phonetic), `Post Code`
  (split out of the address), and `Combo: n` component markers.

The phonetic `Name` values come from a **shared Names Master Sheet** owned by the postage
team, so a pronunciation fixed once is fixed for every station.

**Consequence:** most "it said the wrong thing" tickets are *data* bugs (fix the name
sheet), not *code* bugs. But postcode and number pronunciation is *algorithmic* — and
that is where the recurring defects live. See
[Upgrade Proposal §2](../capability/upgrade-proposal.md).

## 4. Order types

Defined by the business on the `All Stations` tab:

| # | Type | Meaning |
|---|---|---|
| 1 | Single order, single product | One customer, one SKU |
| 2 | Merge order, single products | Several separate orders to the **same customer/address**, each one SKU |
| 3 | Single order, multi products | One customer, several SKUs (a *combo*) |
| 4 | Merge order, multi products | Several orders to the same customer, each with several SKUs |
| 5 | Merge order, single **and** multi products | Mixed |

A **combo** is one purchase made of several components — e.g. combo SKU
`CRSF100BM+PHSH1PBRBM+LSMS320GR` is a ceiling rose + pendant holder + green dome shade,
sold as one Amazon listing. These arrive in the sheet as **multiple rows** flagged
`component`, sharing a `Combo SKU`.

A **merge order** is several *distinct* orders bound for the same address, which must be
packed into one parcel.

Types 2–5 are the source of roughly a third of all feedback. The packer must be told the
**whole** parcel — "component 1 of 3, component 2 of 3…" and the postcode **last** — or
they under-pack. See [Open Defects — Theme C](../validation/open-defects.md).

## 5. The station estate

Six independent copies of the tool run across the warehouse, each bound to its own sheet:

See [Station Registry](../data-maps/station-registry.md) for live links.

- Unit 3 Lampshade (+ a Person 2 duplicate)
- Unit 3 Others
- Unit 4
- Schmutter (German pack)
- Kronen (German pack)
- Names Master Sheet — shared pronunciation dictionary, postage team

Each station keeps its **own feedback tab** in the
[Speak tool feedbacks and correction](../data-maps/station-registry.md) workbook.

**This estate shape is itself a finding.** Six copies of the same script means the same
defect is reported and fixed up to six times. Four items are word-for-word identical
between Schmutter and Kronen (FB-142/156, FB-145/159, and two more). See
[Upgrade Proposal §5](../capability/upgrade-proposal.md).

## 6. End-to-end flow

```
Selling platforms (Amazon/eBay/Wayfair/B&Q/Shopify)
        │
        ▼
   Sheet1  ── raw line items, 17 cols, combos as separate `component` rows
        │
        │  cleaning step: phonetic Name lookup (Names Master Sheet),
        │  postcode extraction, combo numbering
        ▼
 Cleaned Data ── speech-ready queue
        │
        ▼
  Apps Script  ── builds the utterance string per row
        │            ":: <Name> :: <Qty>: :Post Code: <P O S T C O D E>"
        ▼
  HTML modal   ── Web Speech API
        │            SpeechSynthesis  → speaks it
        │            SpeechRecognition → listens for "next"/"back"/"stop"
        ▼
     Packer    ── picks, packs, says "next"
```

## 7. Gaps in this document

1. **Apps Script source not included.** Bound Apps Script cannot be fetched from a public
   URL — it needs the sheet owner's login. Export instructions are in
   [handover/script-export-instructions.md](../handover/script-export-instructions.md).
   Everything in this document is derived from the live sheet data, the tool UI, and the
   160-item feedback register; the script will confirm or refine §6, not overturn it.
2. **Names Master Sheet not yet profiled** — link captured, contents not read.
3. Only the Unit 3 Lampshade data sheet was profiled in depth. The other five are assumed
   to share the schema (the feedback tabs are consistent with that, but it is unverified).
