# **Daily Requirement Document**

> **Today's requirement — written in future tense.**
> **Scope of this day: MAKE IT USABLE ON THE FLOOR — the microphone must stay granted, several pack lists must open as one, a refresh must not lose the packer's place, and three packing rules the team reported wrong must be corrected.**

---

## **0. Today's Task**

**Today's Task:** Make the pack list Speak Tool fit for daily floor use — stop Chrome asking for the
microphone on every command, let a packer open several pack lists at once as a single list, keep the
packer where they were after a page refresh, and correct three packing-order and collection rules
that the postage team reported as wrong.

**Task Assigned By:** Varmen

**User:** Postage & Warehouse Team

**Expected Benefit:** Yesterday's build was correct but not yet livable: the microphone prompt
appeared for every spoken command, one file had to be opened at a time, a refresh threw the packer
back to the chooser, and three rules sent them on shelf trips that saved nothing. After today the
tool is asked for the microphone once, opens a whole day's pack lists in one view, survives a
refresh, and speaks the order the team actually packs in.

---

## **1. Metadata Block**

| Field | Value |
| ----- | ----- |
| daily_requirement_submitted_date | 2026-08-19 |
| expected_deadline_date | 2026-08-25 |
| end_user | Postage & Warehouse Team |
| expected_roi | Remove the four things that stop a correct tool being used: a permission prompt per command, one-file-at-a-time loading, a refresh that loses the place, and shelf trips that save no walking. Each of these was reported from the floor, not found in review |
| developer | Sarujanan |
| project | Speech Tool — Warehouse Voice Packing |
| project_code | STFC |
| phase | Phase-04 — Standalone HTML Speak Tool (parallel build) |
| requirement_id | REQ-04 |
| deliverable_id | REQ-04-D03 |
| blos_keys | mic_permission_needs_secure_origin; recognition_matches_unit4; collection_run_minimum = 2 consecutive orders; plain_ceiling_rose_ranks_as_other; lampshade_prefix_rule = LS + WCWD; lampshade_collection_max = 15 per list; trolley_pool_floor = 0; session_store = IndexedDB; position_store = sessionStorage; theme_states = system/light/dark |
| domain | Warehouse Operations — Order Packing — UK, DE, FR, IE |
| task_assigned_by | Varmen |
| planned benefits | • The microphone will be asked for once per browser, not once per command<br>• "Next" will be heard reliably, including while the tool is still speaking<br>• A packer will open a whole day's pack lists at once, in file-name order, as one continuous list<br>• A page refresh will return the packer to the same order, not to the chooser<br>• Dark and light mode will follow the computer, or be forced either way<br>• The three rules the postage team reported will match how they actually pack |

---

## **2. Today Requirement Block**

### **Purpose**

Yesterday delivered a tool that was **right but not usable**. Everything reported today came from the
floor: a packer saying "Next" ten times and being ignored, a permission bar appearing for every
command, thirteen files opened one at a time, a refresh that lost the place, and a collection card
sending someone to the shelf for a single order's own shade.

Today is about **removing friction and correcting the rules**, not adding features. The pack list
page's UI stays untouched, the Google Sheets tool stays live, and no working logic is refactored.

---

## **2.1 Today Requirement**

### **Task Name:**

Microphone reliability, multi-file loading, refresh persistence, and three packing-rule corrections.

### **Business Purpose:**

A voice tool that must be re-authorised every command is slower than reading the screen. A packer
who has to load thirteen files one at a time will load none. A rule that sends someone to the shelf
for one order wastes the walk it was invented to save. Each of these turns a correct tool into an
unused one.

### **Source Information**

| Source | Used for |
| ------ | -------- |
| The dashboard's Order Packing HTML page | Orders, SKUs, quantities, customer, postcode, platform |
| `names` master sheet | The spoken product name — the only authority |
| Lampshade SOT | Colour and size (Width / Height columns) |
| The business, 2026-08-19 | The three corrected rules |
| Unit 4 Google Sheets Speak Tool | The proven recognition design to copy exactly |

### **Filter Conditions**

- List 1 ("these orders only") collections run **only across consecutive orders needing the same
  family**, and are shown **only when that run is 2 orders or more**.
- List 2 ("whole pack list") is unchanged — it was never about runs.
- Packing rank is applied **only** when the order holds a lampshade or a ceiling rose.

### **Required Data Output**

| Output | Requirement |
| ------ | ----------- |
| Spoken order | Rect rose → lampshade → bulb → (plain rose = other) |
| Collection card | Only for a run of 2+ orders, max 15 per list |
| Merged view | Several pack lists as one list, file-name order preserved, each order labelled with its file |
| After refresh | Same pack lists, same order, same position |
| Microphone | Asked for once per browser on a secure origin |

---

## **Business Logic Block**

### **Rule 18 — The microphone is granted to an origin, not to a page**

Chrome attaches a microphone permission to the **origin**. A page opened from disk has the URL
`file://` and therefore the origin `null`, and Chrome will not persist a grant against `null`. The
tool must therefore be served over `https` (the dashboard) or `http://localhost` (local testing).
This is not a setting anyone can change, and it must be stated in the delivery note rather than
worked around.

### **Rule 19 — Recognition must match Unit 4 exactly**

The Unit 4 Google Sheets Speak Tool works correctly on the floor. Its design is the specification:
always-on microphone, `continuous = true`, `interimResults = false`, `maxAlternatives = 1`,
**no word-count limit on a transcript**, last-match-wins within the transcript, and a deliberate
`stop()` after each accepted command to drop the audio that command came out of.

**No everyday word may be a command.** `stop`, `wait`, `text` and `bag` are spoken during ordinary
packing and must not trigger navigation. The command set is Unit 4's seven actions and no more.

### **Rule 20 — A transcript may be long, and must still be read**

With the microphone open while the tool speaks, Chrome glues the tool's own speech to the packer's
command into one final result of fifteen words or more. Any limit on transcript length silently
discards exactly the commands the packer cares about. The command is found by scanning the **whole**
transcript and taking the **last** match.

### **Rule 21 — A collection must save a walk**

A list-1 collection exists to serve a **run of consecutive orders** from one trip to the shelf. When
the run is a single order it saves nothing: the packer walks for a shade they were fetching with that
order anyway.

> "If there is only one order and the next order is not one of these types, do not mention or apply
> this special logic."

Read as **the same shade family in the next order**. Confirmed 2026-08-19.

### **Rule 22 — A plain ceiling rose packs as "Other", in both types**

| | Rect rose | Lampshade | Bulb | Plain rose | Other |
| --- | --- | --- | --- | --- | --- |
| Rect rose present | 1 | 2 | 3 | 4 | 4 |
| No rect rose | — | 1 | 3 | **4** | 4 |

Plain rose and Other **tie**, and the sort is stable, so a rose keeps its position among the
accessories — it only steps behind the bulb. The two tables now agree.

### **Rule 23 — `WCWD` is a lampshade**

`WCWD` joins list 1 **and** the lampshade type, so it is both collected and spoken in the lampshade
position. It does not extend to `WCB`, `WCCY`, `WCD` or the neighbouring `WCW*` families, which were
not named.

### **Rule 24 — The trolley cannot hold negative stock**

The collected pool models what the packer is already carrying. It must never go below zero. Before
Rule 21 every collectible arrived via a batch, so a plain subtraction was safe; once a card can be
suppressed, the shade is picked straight off the shelf and contributes nothing to the trolley.

### **Rule 25 — Several pack lists open as one, in file-name order**

Files are sorted **numerically by name** (`1.html`, `2.html`, … `13.html`, not `1, 10, 11, 2`).
Orders keep their original sequence, each is tagged with the file it came from, and the page's own
"Total Orders: N" is corrected to the merged total.

### **Rule 26 — A refresh must not lose the packer's place**

A blob URL dies with the document that created it, so a refresh gives `ERR_FILE_NOT_FOUND` and the
origin `null` also kills the microphone. The merged pack list is stored in **IndexedDB** (13 files is
roughly 4.8 MB of text, ~9.6 MB as UTF-16, well past the ~5 MB localStorage budget) and the current
position in **sessionStorage**. Where IndexedDB is unavailable — private browsing, a locked-down
profile — the tool must still work; only the saved session is lost.

---

## **Data Enrichment Block**

| Field | Source | Note |
| ----- | ------ | ---- |
| Product name | `names` master only | Never the pack list's marketplace title |
| Colour | Lampshade SOT, SKU suffix as fallback | |
| Size | Lampshade SOT Width / Height | `WCWD` has no SOT row — card shows no size |
| Product type | SKU prefix (`LS`, `WCWD` → shade; `LD` → bulb), rose tested first by name | |
| File label | Merge step, `data-stx-file` | Shown as "· file N" |

---

## **Acceptance Criteria for the Day**

| # | Criterion | How it is proved |
| - | --------- | ---------------- |
| 1 | Microphone asked for once, not per command | Real run on `http://localhost` |
| 2 | "Next" moves to exactly the next SKU, never skips | Real run, spoken over the tool's own voice |
| 3 | No everyday word triggers navigation | Command table review |
| 4 | Several pack lists open as one, order preserved | 13 files → 155 orders in sequence |
| 5 | Refresh returns to the same order | Manual F5 |
| 6 | "← Open another" returns to the chooser | Manual |
| 7 | Dark / light / system all render | Manual |
| 8 | `WCWD` typed as a lampshade and collected | Automated, 3 SKUs |
| 9 | Plain rose never spoken before a bulb | Automated, 155 orders |
| 10 | No list-1 card for a single order | Automated, all cards |
| 11 | No card over 15 without the overflow flag | Automated |
| 12 | Pack list markup byte-identical | Automated, 13/13 files |
| 13 | Sheets engine and HTML engine agree | Automated, 5,548 SKUs |

---

## **Open Decisions (carried forward, still blocking)**

1. `WCWD` has no Lampshade SOT row — three rows needed, or the card stays sizeless.
2. `WCB`, `WCCY`, `WCD` are collected but still rank `OTHER`. Only `WCWD` was named as a lampshade.
3. Three of the ten list-2 collections cover a single order. The single-order rule was given under
   the "These Orders Only" heading, so list 2 was left alone — confirm whether it should apply.
4. `Instruction QR`, `Send Order Instruction` and `Status` have no source on the pack list route.
5. 14 SKUs are missing from the names master.
6. The Ceiling Rose SOT link has not been supplied.
7. The rule for allocating more than 15 of one colour is undefined.

---

## **Out of Scope (explicitly)**

- The pack list page's UI, markup, styling and ordering — read-only.
- The Google Sheets tool for the other five stations.
- Name lookup, `skuToName`, the existing `slice(0,-3)`, quantity blanking,
  `keepOnlyLastOccurrenceInD`, postcode speech building, name speech building.
- Any refactor, clean-up or improvement of code not named above.
