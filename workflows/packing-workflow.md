# Packing Workflow and Rules

**Last updated:** 2026-09-14. This is the reference for **what the packer hears and in what order**.
Both the HTML Speak Tool (`speak_tool_html_sheet_UI/engine.js`) and the Unit 3 Lampshade Sheets tool
(`scripts/Unit 3 Lampshade/packing-priority.gs`) implement these rules.

> The 2026-08-13 version of this page proposed **"shade last — bulb and accessories first"**. That was
> overruled by the business: **the lampshade is packed first**. Do not implement the old sequence.

---

## 1. A packing session

**HTML Speak Tool**

1. Open the tool (Varmen AIOS `speak_tool`, or the loader page).
2. Drop the day's Order Packing HTML file(s). Several files merge into one run, ordered by the number in
   the file name.
3. Press **Start packing** if Chrome asks for a first click. Allow the microphone.
4. The tool speaks the first step — a lampshade collection or the first order's first component.
5. Pick, pack, say **"next"**. Repeat until the **Finished** card.
6. Can't pack an order yet? Say **"hold"** and carry on; say **"show held"** later.

**Google Sheets tool (Unit 3 Lampshade)**

1. Paste the platform import into `Sheet1`.
2. **Speak Tool → Run Clean and Merge** — builds `Cleaned Data`, stamps collections, sorts by priority.
3. **Speak Tool → Speak All Rows**.
4. Pick, pack, say **"next"**.

---

## 2. What is spoken for one order

```
:: <spoken name> :: <quantity> ::                       ← one step per component
:: <spoken name> :: <quantity> :: :Post Code: C M 6 3 Z B   ← postcode rides on the LAST component
```

| Rule | Detail |
|---|---|
| **Spoken name, never the title** | From the Names Master Sheet |
| **No name** | "This one" + colour; the packer identifies it from the picture |
| **One component per Next** | So the packer puts each item in the box before hearing the next |
| **Postcode last, once** | Spelled character by character, on the final component — no extra Next |
| **Note** (Sheets tool only) | Instruction QR and Send Order Instruction, after the postcode |
| **Merge label** (Sheets tool only) | `merge order total: N : merge order: 1`, `merge order : 2` … before the first component of each sub-order |

---

## 3. Packing priority inside an order

**Product types**

| Type | Recognised by |
|---|---|
| Rectangle Ceiling Rose | name: *ceiling/celing rose* **and** *rectangle/retangle/rectangular* |
| Ceiling Rose | name: *ceiling/celing rose* |
| Lampshade | SKU `LS*`, and `WCWD*` |
| WC cage | SKU `WC*` except `WCWD` |
| Bulb | SKU `LD*` |
| Other | everything else |

**Ranking** (stable — ties keep pack-list order)

| Position | Order **has** a Rectangle Ceiling Rose | Order has **no** Rectangle Ceiling Rose |
|---:|---|---|
| 1 | Rectangle Ceiling Rose | Lampshade |
| 2 | Lampshade | WC cage |
| 3 | WC cage | Bulb |
| 4 | Bulb | Ceiling Rose = Other |
| 5 | Ceiling Rose = Other | |

**No Lampshade and no Ceiling Rose in the order → no ranking at all.** It is spoken exactly as the
pack list lists it.

Example — `Bulb, Holder, Lampshade, Rect Rose` → **Rect Rose, Lampshade, Bulb, Holder**.

---

## 4. Merge orders

A merge is several customer orders going into **one** parcel.

1. **Each sub-order is ranked on its own contents** (§3). Whether a Rectangle Ceiling Rose is present is
   decided per sub-order, never across the merge.
2. **The sub-orders are then put in order.** Each sub-order's product ranks (with-Rect-Rose table),
   best first, are compared position by position. A full tie keeps the original order.
3. **No sub-order has a Lampshade or Ceiling Rose → the sub-orders keep their original order.**

| Sub-order | Contents | Ranks |
|---|---|---|
| Order 1 | Bulb + Holder | [4, 5] |
| Order 2 | Rect Rose + … | [1, 5] |
| Order 3 | Lampshade + Rose | [2, 5] |
| Order 4 | Lampshade + Rect Rose | [1, 2] |

Spoken: **Order 4 → Order 2 → Order 3 → Order 1** — 4 before 2 because both start with a Rect Rose
and Order 4's next product is a Lampshade.

---

## 5. Lampshade collections

Before an order that is short on a lampshade family, the packer is sent to collect that family in
one trip.

| | List 1 — "These orders only" | List 2 — "Whole pack list" |
|---|---|---|
| Prefixes | `LSBS LSSS LSWE WCCY LSCYRO LSBG LSCG LSFG LSGD LSGG LSGL WCB WCD WCWD` | `LSCY2 LSDM LSDO LSEL LSFT LSHH LSHM LSLC LSLT LSMS LSOL LSRP LSTF LSTL LSTM LSUL LSWD` |
| Scans | the run of consecutive orders carrying the same family | the rest of the pack list |
| Run of one order | **not shown** | shown |

- Longest prefix wins (`LSCYRO…` list 1, `LSCY290…` list 2). Other families are never collected.
- Shortage is checked **per SKU**. The limit is **per list** — an order short on both gets two collections.
- The triggering order is always completed; if it alone exceeds the limit, the card says so.
- **Limit: 10** in the HTML Speak Tool · **15** in the Sheets tool (not yet aligned).
- HTML tool only: card shows each shade's master-sheet name; collection speech is 0.75 × normal speed.

---

## 6. Hold (HTML Speak Tool only)

- **Hold** sets the whole order aside, including its collection card.
- **Held (N)** / *"show held"* speaks only held orders, without collection cards.
- When the held orders are done, packing resumes from **where the normal pass was left**.
- **Finished** appears only when normal and held orders are all done.

---

## 7. Rule history

`daily_logs/` covers work up to 2026-08-19 only. Later rulings are recorded here and in comments beside
the code that implements them.

| Date | Ruling | Record |
|---|---|---|
| 2026-08-14 | Priority by product type; WC wire cages are **not** lampshades | [capability/unit3-packing-priority-report.md](../capability/unit3-packing-priority-report.md) |
| 2026-08-17 | Every `LS` SKU is a lampshade (prefix, not name keywords) | same |
| 2026-08-18 | Two collection lists; only listed families collected | [validation/unit3-lampshade-collection-rule-2026-08-18.md](../validation/unit3-lampshade-collection-rule-2026-08-18.md) |
| 2026-08-19 | `WCWD` is a lampshade · plain Ceiling Rose ranks with Other · Type 3 no-ranking · list-1 run of one hidden | [validation/unit3-lampshade-rules-2026-08-19.md](../validation/unit3-lampshade-rules-2026-08-19.md) |
| 2026-08-20 | HTML tool: collection limit 15 → **10**; slower collection speech; SOT names on cards; Restart confirmation; Finished card | code comments in `engine.js`, `speak-extension.js` |
| 2026-08-24 | HTML tool: held pass resumes at the normal-pass position | code comments in `speak-extension.js` |
| 2026-09-11 | **WC cages rank immediately after Lampshade**; priority applied **per merge sub-order** | this page; code comments |
| 2026-09-14 | **Merge sub-orders sequenced by priority**; Type 3 applies at merge level; ported to the Unit 3 Sheets tool | this page; code comments |

---

## 8. Still proposed, not built

From the 2026-08-13 analysis — none of these are implemented:

- A pre-flight check before the session (missing name, quantity or postcode shown before speaking).
- *"Postcode missing — check screen"* instead of silence when a postcode is blank.
- Saying *"Merge order"* once instead of `merge order total: N : merge order: 1` (FB-140).
- Postcode spelled with a pause between outward and inward code; SSML / number normalisation.
