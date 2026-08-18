# **Daily Requirement Document**

> **Back-filled log.** This day's requirement was not submitted on the day. It is reconstructed
> from the actual work performed and the artefacts produced on 2026-08-13.
> **Scope of this day: ANALYSIS ONLY — no code was changed.**

---

## **1. Metadata Block**

| Field | Value |
| ----- | ----- |
| daily_requirement_submitted_date | 2026-08-13 |
| expected_deadline_date | 2026-08-20 |
| end_user | Postage & Warehouse Team |
| expected_roi | Reduce repeat defect reports across 6 packing stations; recover ~1 hour/day currently lost to repeating voice commands and re-checking mis-spoken orders |
| developer | Sarujanan |
| project | Speech Tool — Warehouse Voice Packing |
| project_code | STFC |
| phase | Phase-01 — Discovery & Issue Analysis |
| requirement_id | REQ-01 |
| deliverable_id | REQ-01-D01 |
| blos_keys | speak_tool_station_count = 6; feedback_items_total = 160; lampshade_collection_max = 15 (undefined above limit) |
| domain | Warehouse Operations — Order Packing — UK & DE |
| task_assigned_by | Varmen |
| planned benefits | • Establish a single verified picture of how the Speech Tool works across all 6 stations<br>• Convert 160 unstructured feedback rows into a traceable defect register<br>• Identify why "fixed" issues keep being re-reported<br>• Produce an evidence-backed upgrade plan before any code is touched |

---

## **2. Today Requirement Block**

### **Purpose**

Understand the existing Speech Tool end to end — Google Sheets order data, Apps Script, voice
controls and the current packing workflow — and produce an evidence-backed analysis. **No code
change is in scope for this day.**

---

## **2.1 Today Requirement**

### **Task Name:**

Speech Tool — System Discovery & Issue Root-Cause Analysis

### **Business Purpose:**

The warehouse packing team reports the same Speech Tool problems repeatedly even after they are
marked fixed. Before any improvement is attempted, the actual architecture, data flow and root
causes must be established from evidence so that effort is not spent re-fixing the wrong layer.

---

### **Source Information**

**Source System:**

Google Sheets + Google Apps Script (bound HTML Service add-on)

**Spreadsheets:**

```
1uN-9zD… — Speak tool feedbacks and correction (control / QA workbook, 6 tabs)
1AMQMzxu… — Unit 3 Lampshade speak tool (order data)
1UXra9cm… — Unit 3 Lampshade Person 2 speak tool
1XPvIv32… — Unit 4 speak tool
1QsxHvee… — Schmutter speak tool
1ROig4b9… — Kronen speak tool
1KyC8ION… — Unit 3 Others (Copy of jana speak)
16rx5Dz…  — Names master sheet (shared pronunciation dictionary)
```

**Tabs:**

```
Sheet1        — raw platform import
Cleaned Data  — speech-ready queue
names         — SKU → spoken name dictionary
```

**Apps Script files per station:**

```
action.gs · cleaned.gs · clean-1.gs · Lithursan.gs · Merge SKU.gs · sku.gs
```

---

### **Filter Conditions**

```
Stations:        All 6 (Unit 3 Lampshade, Unit 3 Lampshade Person 2, Unit 3 Others,
                 Unit 4, Schmutter, Kronen)
Feedback range:  02/06/2025 – 07/10/2025
Order data:      Live snapshot as at 2026-08-13
Code:            Read-only — no modification permitted this day
```

---

### **Required Data Output**

| Field | Purpose |
| ----- | ----- |
| Station name | Identify which packing station a defect belongs to |
| Issue text | Original reported wording (verbatim, incl. romanised Tamil) |
| Reported date | Sequence and recurrence tracking |
| Sheet status (True/False/blank) | What the team believes is fixed |
| Verified status | What the code actually proves |
| Responsible file : line | Exact location of the defect |
| Root cause code | Group 160 reports into a small number of real causes |
| Script version fingerprint | Detect drift between the 6 station copies |
| Column fill rate | Quantify data-quality gaps in `Cleaned Data` |

---

## **Business Logic Block**

**Purpose:** Define how each reported issue is to be classified so that effort targets real causes.

### **Rule 1 — Verified status classification**

```
IF the code proves the behaviour still fails
THEN verified_status = PROVEN_NOT_FIXED

ELSE IF the reporter confirmed it works in the Feedback column
     OR the code proves the behaviour is correct
THEN verified_status = VERIFIED_FIXED

ELSE verified_status = UNVERIFIED
```

### **Rule 2 — Responsible layer**

```
IF the required column does not exist in Sheet1
THEN layer = SHEET_DATA (blocked upstream)

ELSE IF the spoken/displayed value comes from the names master sheet
THEN layer = REFERENCE_DATA

ELSE layer = APPS_SCRIPT_LOGIC
```

### **Rule 3 — Station drift detection**

```
FOR each station:
    fingerprint = md5(Lithursan.gs), md5(cleaned.gs)
IF fingerprints differ between stations
THEN the stations are running different versions
     AND a fix applied at one station has NOT reached the others
```

---

## **Data Enrichment Block**

**Purpose:** Attach supporting evidence to each finding so conclusions are reviewable.

**Source:** Feedback workbook embedded media + live order sheets

**Required Data:**

| Field | Reason |
| ----- | ----- |
| Embedded screenshots | Several feedback rows have no text — the picture *is* the ticket |
| Screenshot ↔ row anchor | Tie each image to the issue it documents |
| Paired images on one row | Before/after comparison between packlist and Speech Tool |
| Column fill counts | Quantify Post Code / QR / Merge Order data gaps |
| Group-key ↔ customer mapping | Detect orders wrongly merged across customers |
| Names master sheet size & shape | Establish the pronunciation source of truth |

---

## **Acceptance Criteria for the Day**

| # | Criterion |
| --- | --- |
| 1 | All 160 feedback items extracted into a traceable register with IDs |
| 2 | Real architecture documented (not assumed) with file : line evidence |
| 3 | Script version drift measured across all 6 stations |
| 4 | Root causes grouped and counted |
| 5 | Embedded screenshot evidence extracted and reviewed |
| 6 | **No source file modified** |

---

## **Out of Scope (explicitly)**

- Any change to Apps Script
- Any change to Google Sheet structure or data
- Any deployment
- Any change to voice commands, packing sequence or business rules
