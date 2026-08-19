# **Daily Requirement Document**

> **Today's requirement — written in future tense.**
> **Scope of this day: THE PACK LIST ITSELF — add the Speak Tool on top of the dashboard's existing Order Pack List page, without changing that page.**

---

## **0. Today's Task**

**Today's Task:** Add the Speak Tool to the dashboard's existing Order Packing HTML page as an
extension, keeping that page's UI exactly as it is, and provide a single self-contained HTML file
that opens any saved pack list with the tool already running.

**Task Assigned By:** Varmen

**User:** Postage & Warehouse Team

**Expected Benefit:** Remove the last manual step. Yesterday's standalone build still asks the
packer to move to a separate page; today the tool arrives on the page they already have open, with
the same packing priority, the same lampshade collections and the same spoken wording as the Google
Sheets tool — and one file that can be emailed to any station and opened.

---

## **1. Metadata Block**

| Field | Value |
| ----- | ----- |
| daily_requirement_submitted_date | 2026-08-18 |
| expected_deadline_date | 2026-08-25 |
| end_user | Postage & Warehouse Team |
| expected_roi | Delete the remaining hand-work from the picking path. Today a packer exports the pack list, opens a second tool and loads it there. After this change the tool is on the pack list itself — one script tag on the dashboard, or one file to open. The packing rules stay in a single shared file, so the six-station drift that caused the same defect to be reported repeatedly cannot re-form |
| developer | Sarujanan |
| project | Speech Tool — Warehouse Voice Packing |
| project_code | STFC |
| phase | Phase-04 — Standalone HTML Speak Tool (parallel build) |
| requirement_id | REQ-04 |
| deliverable_id | REQ-04-D02 |
| blos_keys | packlist_dom_contract (li.bg-white, div.p-1[id$=-li], span[onclick^=copyText], label.col-3.mb-3, div.fs-6); ui_untouched_guarantee = single #stx-root container; lampshade_prefix_rule = LS; packing_priority_conditional; lampshade_collection_max = 15 per list; colour_authority = Lampshade SOT; size_authority = Lampshade SOT Width/Height; name_authority = names master only |
| domain | Warehouse Operations — Order Packing — UK, DE, FR, IE |
| task_assigned_by | Varmen |
| planned benefits | • The Speak Tool will run on the pack list page the team already opens, with that page unchanged<br>• One self-contained HTML file will be sendable to any station, needing no install, no server and no Google login<br>• The picture of the SKU being spoken will open by itself, so the packer's eye lands on the right product even though the page lists them in the dashboard's order<br>• Voice commands will be heard while the tool is still speaking, which is when a packer naturally says "next"<br>• Language, voice and speed from the Google Sheets tool will be available here too |

---

## **2. Today Requirement Block**

### **Purpose**

Today I will deliver the Speak Tool as an **extension to the existing Order Packing HTML page**,
rather than as a page of its own. The dashboard's pack list is already open in front of the packer
and already carries every field the tool needs. The requirement is explicit that **its UI must not
change**: nothing on that page may be edited, removed, restyled or re-ordered. Everything the tool
adds must be additive and removable in one step.

The Google Sheets tool stays live and untouched for all six stations.

---

## **2.1 Today Requirement**

### **Task Name:**

Speak Tool — Order Pack List extension, single-file delivery, and voice reliability.

### **Business Purpose:**

The packer must be able to work from the page they already have. Every step between the pack list
and the first spoken word is a step that can be skipped, done in the wrong order, or done with
yesterday's file. Putting the tool on the pack list removes all of them.

The second purpose is trust in the voice. A command that is missed teaches the packer to stop using
voice and reach for the mouse, which removes the entire benefit of the tool.

### **Source Information**

| Source | Detail |
| ------ | ------ |
| Order Packing HTML | The dashboard's own pack list page. 13 saved copies in `/order_details/`, 155 orders in total, 37 KB to 1.4 MB each |
| Names master | Google Sheet `16rx5Dz…` — the **only** source of a spoken product name |
| Lampshade SOT | Google Sheet `1b9n4Rhy…` (gid 1477049419) — colour, Width, Height, image for 451 lampshade SKUs |
| Shared rules engine | `/speak_tool_html/engine.js` — classification, priority, collections. Shared with yesterday's standalone build, not copied |

The pack list is read from the DOM already on screen. **No Google Sheet is read at run time, and
the Cleaned Data sheet is not used at all.**

### **Filter Conditions**

- Station: Unit 3 Lampshade.
- Every order on the page, in the page's own sequence. The tool does not reorder the queue.
- Products are re-sequenced **within** one order only, never across customers.
- A lampshade enters a collection only if its SKU matches one of the two prefix lists agreed
  2026-08-18. Anything else is packed straight from the order.

### **Required Data Output**

For each order on the page, in this order:

1. Each component, one per **Next**, in packing-priority order.
2. The count for that component, spoken with the existing logic.
3. On the last component only, the **Post Code**, spelled character by character.

And on screen, without altering the page:

4. A control bar, a collection dialog, an auto-zoom of the component being spoken, and an outline on
   the order being packed — all inside one container.

---

## **Business Logic Block**

Rules 1 to 9 of REQ-04-D01 carry forward unchanged. The rules below are the ones this day adds or
makes explicit.

### **Rule 10 — The pack list page is read-only**

The extension may add elements. It may not edit, remove, restyle or re-order anything the dashboard
rendered. Every element it adds must live inside a single container, so that removing that one
element removes the tool completely.

The one mark permitted on the page is an **outline** on the order being packed, because `outline` is
drawn outside the box and consumes no layout space, so nothing on the page moves.

This must be **proved, not asserted**: the page body is captured before the tool loads and compared
after, with only the tool's own container removed.

### **Rule 11 — A name comes from the master sheet or nowhere**

The pack list carries its own marketplace title
(*"Black 2,3,4,5 Way LED Spotlight Ceiling Light for Home decor~6138"*). That title is **never
spoken**. It is listing copy written for a customer, not a picking instruction.

Where the master sheet has no name for the SKU, the component is announced as **"This one"** plus
its colour, exactly as on the Google Sheets tool.

### **Rule 12 — The postcode is last**

The postcode rides on the final component of the order. Nothing is spoken after it. The pack list
carries no `Instruction QR` and no `Send Order Instruction` field, so on this route there is nothing
that could follow it.

### **Rule 13 — Size comes from the SOT's Width and Height, not from the SKU**

The SKU digits are not a size for every family. Proven on the live SOT:

| SKU | Digits in the SKU | SOT says |
| --- | --- | --- |
| `LSGL10014AR` | 10014 | 140 |
| `LSGL10014CL` | 10014 | 100 |
| `LSGLWA140AR` | 140 | 150 |

Two SKUs share their digits and have different real sizes, so no parsing rule can recover this. The
SOT is read first, and its **Width and Height are kept separate**: where both exist the card shows
`140 x 130 mm` and the packer hears *"140 by 130 millimeter"*.

### **Rule 14 — The picture must follow the voice**

The pack list shows products in the **dashboard's** order while the tool speaks them in **packing
priority** order, so the item being called out is rarely the one the eye lands on. As each component
is spoken its picture must open by itself, showing the name, the SKU and the count.

The page's own zoom is used where the page has one, so the packer sees the viewer they already know.

### **Rule 15 — The tool must hear a command spoken over its own voice**

A packer says *"next"* the moment the item is in their hand, which is usually before the tool has
finished speaking. Switching the microphone off for the whole utterance loses that command.

Recognition therefore stays on while the tool speaks, and the tool's **own** words are filtered
instead — it knows exactly what it is saying. It says *":Post Code:"* aloud, so **postcode** is
ignored while that plays. It never says next, back, repeat or restart, so those always get through.

Commands act on Chrome's **interim** result, not only the final one, and **all five alternatives**
are read, together with the wrong words Chrome returns for each command.

### **Rule 16 — Show the microphone level, do not imply it**

The mic indicator must show a **measurement** taken from the microphone, not an animation. If the
bars do not move when the packer speaks, the headset is the fault, and that must be visible before
anyone blames the tool.

### **Rule 17 — Speech needs a press, so ask for one**

A browser will not play speech until the page has had a user gesture, and it drops the first
utterance with no error. The tool must try, detect that no audio began, and then ask for a single
press — rather than leaving the packer waiting for a voice that is never coming.

---

## **Data Enrichment Block**

| Field | Source | Note |
| ----- | ------ | ---- |
| Spoken name | names master `16rx5Dz…` | Only source. Pack-list title never used |
| Colour | Lampshade SOT, then SKU suffix table | Unchanged from REQ-03 |
| Size (Width, Height) | Lampshade SOT | New today. SKU parsing is fallback, and only for `LS` SKUs |
| Product image | The pack list's own `<img>` element | Used for the auto-zoom, so the packer sees the same picture the page shows |
| Product type, priority, collections | `engine.js` | Shared with the standalone build |
| Instruction QR / Send Order Instruction / Status | **Not available** | The pack list has no such field. Carried as an open item |

---

## **Acceptance Criteria for the Day**

1. The pack list page is **byte-identical** before and after the tool loads, proved by comparison,
   on more than one pack list.
2. Everything the tool adds lives inside one container, and removing it removes the tool.
3. **Next** speaks one component at a time; the page scrolls to the order being packed.
4. A lampshade collection appears on the same page before the order that triggered it, and is
   removed on the next **Next**.
5. Every order's last spoken step ends with the postcode.
6. No pack-list title reaches the speech on any of the 13 pack lists.
7. The picture of the component being spoken opens by itself.
8. Language, voice and speed are selectable, grouped by language, defaulting to Google US English at
   Normal.
9. The microphone level meter moves with real input.
10. One self-contained HTML file opens any saved pack list with the tool running, with no other file
    present.
11. Refreshing that page does not produce an error.

---

## **Open Decisions (carried forward, still blocking)**

| # | Question | Owner | Effect while open |
| - | -------- | ----- | ----------------- |
| 1 | Where do `Instruction QR`, `Send Order Instruction` and `Status` come from on this route? | Varmen | The pack list has no field for them, so they are neither shown nor spoken |
| 2 | Should the 12 rows with neither SKU nor name speak "This one" plus the count? | Varmen | Sheet route only; still silent |
| 3 | Should cage shades (`WCB`, `WCCY`, `WCD`) rank as lampshades in the packing sort? | Varmen | They are collected first but packed last |
| 4 | Names for the 14 SKUs absent from the names master | Varmen | 19 rows speak as "This one" |
| 5 | The Ceiling Rose source-of-truth link | Varmen | Roses still resolve through the 29-code suffix table |
| 6 | Allocation rule when one colour needs more than 15 | Varmen | Undefined |

---

## **Out of Scope (explicitly)**

- The Google Sheets tool and its six stations — untouched, still live.
- The shared `names` master — used exactly as it stands, not corrected.
- The Lampshade SOT — read only.
- The dashboard's pack list markup — read only; not one element changed.
- Writing anything back to any order, sheet or dashboard record. The extension only reads.
