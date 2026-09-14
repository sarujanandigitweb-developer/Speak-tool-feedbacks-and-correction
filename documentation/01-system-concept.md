# Speak Tool — System Concept

**Last updated:** 2026-09-14 (first written 2026-08-13)
**Audience:** anyone new to the project. This explains the domain; the code-level detail is in
[03-unit3-lampshade-logic.md](03-unit3-lampshade-logic.md) and
[packlist_extension/README.md](../packlist_extension/README.md).

---

## 1. What the tool is

The **Speak Tool** turns a day's order list into a **hands-free audio pick-and-pack stream**. A packer
stands at a station with both hands on stock. Instead of reading a printed pack list, the tool
**speaks each order** — product name, quantity, then postcode — and moves on when the packer says
**"next"** or presses a button.

Eyes and hands stay on the product, so packing is faster and mis-picks drop.

## 2. Two delivery forms

| | HTML Speak Tool | Google Sheets Speak Tool |
|---|---|---|
| Input | The dashboard's **Order Packing HTML** page | The station sheet: `Sheet1` → `Cleaned Data` |
| Runs as | A web page (loader) or an overlay on the pack list | Apps Script modal: `Extensions → Speak Tool → Speak All Rows` |
| Deployed | Varmen AIOS hub, slug `speak_tool` | Pasted into each station's Apps Script |
| Rules | `speak_tool_html_sheet_UI/engine.js` | `scripts/Unit 3 Lampshade/packing-priority.gs` |

Both implement the **same packing rules**. The HTML tool is the one being developed actively; the
Sheets tool is maintained for Unit 3 Lampshade.

## 3. What the packer sees

**HTML Speak Tool** — the pack list page itself, with a control bar fixed at the bottom:
position (`Order 7 of 155 · Item 1 of 3 · file 2`), status (`Remaining 120 of 155`), the words being
spoken, **Restart · Back · Postcode · Pause · Repeat · Next · Hold · Held (N)**, Zoom, Voice
settings, Mic and a live mic level. The product being spoken is outlined on the page and its picture
opens large. Collections appear as a dialog over the page.

**Google Sheets tool** — a modal (1900 × 1400): `Row N of M` and `Item a of b`, row and total
timers, Language / Voice / Speed, **Restart · Back · Postcode · Pause · Repeat · Next**, the words
being spoken, a numbered thumbnail strip (one per component, the current one highlighted), and the
order card with a large per-component quantity. Headset media buttons map to play/pause/next/previous.

Full control lists: [packlist_extension/README.md](../packlist_extension/README.md) ·
[03-unit3-lampshade-logic.md §5](03-unit3-lampshade-logic.md#5-the-speak-dialog--lithursangs).

## 4. The two-layer name model

The single most important idea in the system.

Marketplace titles are SEO text — 40+ words, unpronounceable:

> `LEDSone Pack 6 | Vintage LED Dimmable B22 Light Bulb, ST64 8W (Equivalent 60W) 2700K Warm White …`

They are **never spoken**. Each SKU has a second, **short spoken name** written for the ear:

> `S T 6 4 b22 8 wats`

Spoken names live in the shared **Names Master Sheet**, owned by the postage team, so a pronunciation
fixed once is fixed for every station. The HTML tool reads it live (cached 6 hours) and falls back to
a built-in copy; the Sheets tool reads it on every **Run Clean and Merge**.

A SKU with no spoken name is announced as **"This one"** plus its colour, and the packer identifies it
from the picture.

**Consequence:** most "it said the wrong thing" tickets are **data** fixes in the Names Master Sheet,
not code fixes.

## 5. Product types and packing priority

Every product is classified, and products inside an order are spoken in priority order:

| Type | How it is recognised |
|---|---|
| Rectangle Ceiling Rose | name matches *ceiling rose* **and** *rectangle / retangle / rectangular* |
| Ceiling Rose | name matches *ceiling rose* (data spells it *celing* too) |
| Lampshade | SKU starts `LS`, or `WCWD` |
| WC cage | SKU starts `WC` (other than `WCWD`) |
| Bulb | name says bulb/watts and SKU starts `LD`, or any `LD` SKU |
| Other | everything else |

| Order has a Rectangle Ceiling Rose | Order has none |
|---|---|
| Rect Rose → Lampshade → WC cage → Bulb → Rose/Other | Lampshade → WC cage → Bulb → Rose/Other |

An order with **no Lampshade and no Ceiling Rose** is spoken in its original order. Rules and their
dated rulings: [workflows/packing-workflow.md](../workflows/packing-workflow.md).

## 6. Order types

Defined by the business on the feedback workbook's `All Stations` tab:

| # | Type | Meaning |
|---|---|---|
| 1 | Single order, single product | One customer, one SKU |
| 2 | Merge order, single products | Several separate orders to the **same customer/address**, one SKU each |
| 3 | Single order, multi products | One customer, several SKUs — a **combo** |
| 4 | Merge order, multi products | Several orders to one customer, each with several SKUs |
| 5 | Merge order, single **and** multi | Mixed |

A **combo** is one purchase made of several components — e.g. `CRSF100BM+PHSH1PBRBM+LSMS320GR`, a
ceiling rose + pendant holder + shade sold as one listing.

A **merge order** is several **distinct** customer orders bound for the same address and packed into
**one** parcel. The tools apply packing priority inside each sub-order, and also decide **which
sub-order is packed first**. On the pack list a merge is one order with several product blocks; in the
sheet it is a run sharing one `SKU Combined` value, with a `Merge Order` label on the first row of each
sub-order.

## 7. Lampshade collections

Lampshades are bulky and shelved elsewhere. Rather than walk to the shelf for every order, the packer
is sent **once** to collect a shade family for several upcoming orders — shown as a **collection**
step before the order that triggers it. Two prefix lists decide the scope ("these orders only" vs
"whole pack list"), with a per-collection limit (**10** in the HTML tool, **15** in the Sheets tool).

## 8. The station estate

Each station has its own sheet and its own copy of the Apps Script:

- Unit 3 Lampshade (+ a Person 2 duplicate)
- Unit 3 Others (*Copy of jana speak*)
- Unit 4
- Schmutter (German pack)
- Kronen (German pack)

Links: [data-maps/station-registry.md](../data-maps/station-registry.md). All six scripts are exported
in [`scripts/`](../scripts/). **Only Unit 3 Lampshade carries the packing-priority and collection
work**; the other five are the original scripts.

Six independent copies means a fix is six deployments and the same defect gets reported more than
once. The HTML Speak Tool avoids this: one file, published once.

## 9. End-to-end flow

```
 HTML SPEAK TOOL                                GOOGLE SHEETS TOOL
 ───────────────                                ──────────────────
 Dashboard → Order Packing HTML                 Selling platforms → Sheet1 (raw rows)
        │                                              │  Run Clean and Merge
        ▼                                              ▼
 Loader page / overlay                          Cleaned Data
   parse orders + product blocks                  spoken name (Names Master Sheet)
   names: live sheet → built-in                   merge labels, combo sets
   product type + packing priority                product type, colour
   merge sub-order sequencing                     lampshade collections stamped
   lampshade collections                          packing priority sort (per sub-order)
        │                                              │  Speak All Rows
        ▼                                              ▼
 Queue: collection steps + orders               Queue: collection entries + orders
        │                                              │
        └──────────── Web Speech API ──────────────────┘
             SpeechSynthesis speaks  ·  SpeechRecognition hears "next"
                               │
                               ▼
                     Packer picks, packs, says "next"
```

## 10. Where the old analysis went

This document replaced its 2026-08-13 version, which was written before the Apps Script was exported
and before either tool gained packing priority or collections. The original root-cause analysis is
kept in [02-code-walkthrough.md](02-code-walkthrough.md) (historical).
