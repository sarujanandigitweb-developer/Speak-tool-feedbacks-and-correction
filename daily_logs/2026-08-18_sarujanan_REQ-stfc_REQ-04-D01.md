# **Daily Requirement Document**

> **Today's requirement — written in future tense.**
> **Scope of this day: NEW BUILD — a standalone HTML Speak Tool, running in parallel with the existing Google Sheets tool.**

---

## **0. Today's Task**

**Today's Task:** Build the Unit 3 Lampshade Speech Tool as a standalone HTML application that reads
the pack list directly, with no spreadsheet in the path, carrying across the packing, collection and
voice fixes completed yesterday, while the existing Google Sheets tool keeps running unchanged.

**Task Assigned By:** Varmen

**User:** Postage & Warehouse Team

**Expected Benefit:** Let the packer open one page and start picking — removing the manual pack-list
export, the sheet upload and the Clean and Merge run — while keeping Lampshades collected
colour-wise in the correct packing priority, and giving the team's own instruction fields a proper
home instead of hand-typed spreadsheet columns.

---

## **1. Metadata Block**

| Field | Value |
| ----- | ----- |
| daily_requirement_submitted_date | 2026-08-18 |
| expected_deadline_date | 2026-08-25 |
| end_user | Postage & Warehouse Team |
| expected_roi | Remove the export-to-spreadsheet chain entirely for the stations that move over. Today the packer's data passes through a manual pack-list save, an upload, a sheet write and a Run Clean and Merge before a single word is spoken. Removing that also removes the two failure sources measured this week: the six forked script copies that cause the same defect to be re-reported per station, and the Apps Script editor Run button that destroyed 60 SKUs in Sheet1 with no warning |
| developer | Sarujanan |
| project | Speech Tool — Warehouse Voice Packing |
| project_code | STFC |
| phase | Phase-04 — Standalone HTML Speak Tool (parallel build) |
| requirement_id | REQ-04 |
| deliverable_id | REQ-04-D01 |
| blos_keys | packlist_dom_contract (li.bg-white, div.p-1[id$=-li], span[onclick^=copyText], label.col-3.mb-3); pack_code_map (2PK-9PK, APK=10, CPK=20, DPK=30, EPK=50, FPK=100, NPK=200, PPK=300, QPK=500, RPK=1000); lampshade_prefix_rule = LS; packing_priority_conditional; lampshade_collection_max = 15; colour_authority = Lampshade SOT |
| domain | Warehouse Operations — Order Packing — UK, DE, FR, IE |
| task_assigned_by | Varmen |
| planned benefits | • The packer will open one page and start picking, with no spreadsheet step in between<br>• All nine defects fixed on 2026-08-17 will carry across, so the new tool starts at the corrected behaviour rather than repeating the same faults<br>• Instruction QR, Send Order Instruction and Status will become real fields instead of hand-typed spreadsheet columns<br>• One shared implementation instead of six forked station copies<br>• The existing Google Sheets tool will keep running untouched, so nothing is at risk while this is built |

---

## **2. Today Requirement Block**

### **Purpose**

Today I will begin building the Speak Tool as a **standalone HTML application** that reads the pack
list directly, **without any spreadsheet in the path**. The existing Google Sheets tool will be left
exactly as it is and will continue to be the live tool for all six stations until this build is
accepted. This is the Option C route recommended in
[/evidence/packlist-html-delivery-options.md](../evidence/packlist-html-delivery-options.md).

---

## **2.1 Today Requirement**

### **Task Name:**

Speak Tool — Standalone HTML Build, Parallel to the Google Sheets Tool

### **Business Purpose:**

The pack list already opens as an HTML page and already carries almost everything the packer needs.
The spreadsheet in the middle adds a manual export, a sheet write, a clean-and-merge run and six
diverging script copies, and it is where a hand-run function destroyed live SKU data this week.
Today I will start the version that removes that middle layer, while leaving the current tool
running so the floor is never blocked.

---

### **Source Information**

**Source System:**

Pack list HTML from the dispatch dashboard (`dashboard.digitweblk.com`)

**Reference data still required:**

```
16rx5Dz…  — names master, tab "names"     (SKU -> spoken phonetic name)
1b9n4Rhy… — Lampshade SOT, gid 1477049419 (colour, size, image, 451 SKUs)
```

**Existing assets I will build on:**

```
speak_tool/app.py          — working pack-list parser (BeautifulSoup), already produces the Sheet1 layout
speak_tool/uploads/        — 16 real pack list files, for regression fixtures
scripts/Unit 3 Lampshade/packing-priority.gs — the packing rules, to be ported as-is
```

**Explicitly NOT touched:**

```
The Google Sheets tool and all six station copies of the Apps Script
Sheet1, Cleaned Data, and the Apps Script menu
```

---

### **Filter Conditions**

```
Build scope:    Standalone HTML/web application only
Data scope:     Pack list HTML in, speech and display out
Station scope:  Unit 3 Lampshade first, as the proving station
Excluded:       Any change to the live Google Sheets tool, its scripts or its sheets
```

---

### **Required Data Output**

| Field | Source | Purpose |
| ----- | ------ | ------- |
| Customer Info, Post Code, Platform, Price | Pack list DOM | Order identity and the card |
| Title, SKU, Quantity | Pack list DOM | Line identity |
| Combo SKU / Colour / Quantity | Pack list DOM | Component sets |
| Image URLs | Pack list DOM | The picture the packer picks from |
| Spoken phonetic name | Names master | What the packer actually hears |
| Product Type, Colour, packing order | Derived | Lampshade priority and the collection |
| Instruction QR, Send Order Instruction, Status | **New input UI** | Operational instructions with nowhere to live today |

---

## **Business Logic Block**

**Purpose:** State the rules the new build must satisfy. All of these are already proven in the
current tool; none may regress.

### **Rule 1 — Parse the pack list, do not re-key it**

```
order            = li.bg-white
product line     = div.p-1[id$='-li']
sku              = span[onclick^='copyText']
title            = div.fw-bold.border-bottom span
quantity         = text node "Quantity:"
combo component  = label.col-3.mb-3  ->  div.text-center div.small, span.alert
customer         = div.col-2.small (2nd block)
address          = div.fs-6
platform         = div.bg-light.border
price            = div.text-end span span:nth-child(2)
merge/combo mark = div.bg-warning...rounded-pill
```

### **Rule 2 — Pack size from the SKU suffix**

```
2PK..9PK = 2..9   APK = 10   CPK = 20   DPK = 30   EPK = 50
FPK = 100   NPK = 200   PPK = 300   QPK = 500   RPK = 1000

adjusted_quantity = quantity * pack_size
```

This map exists in `speak_tool/app.py` and is **not** in the Apps Script. It resolves the
`LSFT2205PK` ambiguity that `ppProductSize()` currently refuses to guess at.

### **Rule 3 — Lampshade identification**

```
IF name matches ceiling-rose pattern -> RECT_ROSE if rectangle, else ROSE
ELSE IF name matches bulb pattern AND sku starts with 'LD' -> BULB
ELSE IF sku starts with 'LS' -> SHADE          (the name is NOT consulted)
ELSE IF sku starts with 'LD' -> BULB
ELSE OTHER
```

### **Rule 4 — Conditional packing priority**

```
IF the order contains a Rectangle Ceiling Rose
   THEN RECT_ROSE=1, SHADE=2, BULB=3, ROSE=4, OTHER=4
   ELSE SHADE=1, ROSE=2, BULB=3, OTHER=4

Scan the whole order for a Rectangle Ceiling Rose BEFORE sorting it.
Stable sort, within one customer only.
```

### **Rule 5 — Order identity**

```
An order is one CUSTOMER, not one product set.

The combined SKU string identifies a product set; two customers who buy the same kit
must never share a queue entry, and one customer must never be split into two.
```

### **Rule 6 — Speech segmentation**

```
one segment per component, in packing-priority order
advance only on an explicit Next
after the LAST component, append Post Code, then Note, in the SAME step
```

### **Rule 7 — Nothing may be silent**

```
IF the names master has a name  -> speak the name
ELSE IF the line has a SKU      -> speak "This one" + colour, with the quantity
ELSE                             -> open decision (carried from REQ-03)

A line whose picture is on screen must never be unannounced.
```

### **Rule 8 — Colour and image authority**

```
colour = Lampshade SOT Outer_Colour, else Colour_Family, else SKU suffix table
image  = pack list img src, else Lampshade SOT IMG_LINK

Where the SOT contradicts its own Product_Name, the product name wins
(6 known SKUs, override list carried from REQ-03).
```

### **Rule 9 — The three typed fields**

```
Instruction QR, Send Order Instruction and Status are entered by the team,
appear in NO pack list, and must be first-class inputs in the new tool.

They must persist against the order, and must be spoken as the Note
after the postcode.
```

---

## **Data Enrichment Block**

**Purpose:** Join the two reference sheets that the pack list cannot supply.

| Field | Source | Reason |
| ----- | ------ | ------ |
| Spoken phonetic name | names master `16rx5Dz…` | The pack list carries only the marketplace Title, which is never spoken |
| Outer_Colour / Colour_Family | Lampshade SOT | Closes the 111 colour gaps the SKU suffix table cannot resolve |
| IMG_LINK | Lampshade SOT | Collection-card image for all 451 lampshade SKUs |
| Diameter_mm | Lampshade SOT | Authoritative size, replacing an 85%-accurate SKU parse |

---

## **Acceptance Criteria for the Day**

| # | Criterion |
| --- | --- |
| 1 | The live Google Sheets tool will be unchanged and still working at the end of the day |
| 2 | The new build will read a pack list HTML file with no spreadsheet in the path |
| 3 | All 16 pack list files in `speak_tool/uploads/` will parse without error |
| 4 | Orders, components, combo sets, images, quantities and postcodes will match what the current pipeline produces for the same input |
| 5 | Pack size will be applied from the SKU suffix map |
| 6 | Every `LS`-prefixed SKU will classify as a lampshade |
| 7 | Packing priority will match the conditional rule, verified per customer |
| 8 | One customer will never be split across entries, and two customers will never share one |
| 9 | Instruction QR, Send Order Instruction and Status will be enterable and will persist |
| 10 | No line carrying a SKU will be silent |
| 11 | Speech will advance one component per Next, with postcode and note on the last component |

---

## **Open Decisions (carried forward, still blocking)**

| # | Decision | Impact if unresolved |
| --- | --- | --- |
| 1 | Re-import `Sheet1`, or run the verified recovery script? | 36 rows in the current tool still carry a corrupted SKU |
| 2 | Should lines with no SKU and no Combo SKU speak `"This one" + count`? | 12 lines stay silent, including a 10-bulb order |
| 3 | Is there a Ceiling Rose SOT? | Rose classification still depends on spoken-name keywords |
| 4 | Allocation rule when one colour exceeds 15 in a collection | The collection cannot be closed out above 15 |
| 5 | Is the pack list DOM stable, and will we be told before it changes? | Every selector in Rule 1 belongs to another team's application |
| 6 | Does the pack list carry a real order ID? | Postcode is currently the order key, and two customers can share one |

---

## **Out of Scope (explicitly)**

- Any change to the Google Sheets tool, its Apps Script files, or its sheets
- Migrating the other five stations — Unit 3 Lampshade proves it first
- Correcting the shared `names` master sheet — owned by another team
- Correcting the Lampshade SOT at source — reported, not edited
- A browser extension or bookmarklet — assessed and deferred until the DOM contract is agreed
