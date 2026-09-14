# Handover Note — Speak Tool (STFC)

**Handed over:** 2026-09-14 · **Project:** STFC — Speak Tool, Warehouse Voice Packing · **Assigned by:** Varmen

Read this first. It says what is live, what is only in the repository, and what will bite you.

---

## 1. The project in one paragraph

The Speak Tool reads the day's pack list aloud: each product's **spoken name** (from the Names
Master Sheet, never the marketplace title), its **quantity**, then the **postcode** last. The packer
says **next** to move on. It runs in two forms that share one set of packing rules: an **HTML Speak
Tool** published on the Varmen AIOS hub, and a **Google Sheets tool** (Apps Script) copied into each
station's sheet. The rules decide the order products are spoken in, when the packer is sent to
collect lampshades in bulk, and — for merge orders — which customer order is packed first.

---

## 2. What is live, what is not

| Component | State | Where |
|---|---|---|
| **HTML Speak Tool** | ✅ **Live** — built from this repo on 2026-09-14 | Varmen AIOS, slug `speak_tool` |
| Unit 3 Lampshade — `packing-priority.gs` (WC rank, merge sequencing, 2026-09-14) | ⚠️ **In repo only.** Not yet pasted into the Apps Script editor | `scripts/Unit 3 Lampshade/` |
| Unit 3 Lampshade — `Lithursan.gs` voice fixes (2026-08-24/25) | ⚠️ **In repo only**, and the live copy is a *different* version — see §3.1 | `scripts/Unit 3 Lampshade/` |
| Unit 3 Others, Unit 3 Person 2, Unit 4, Schmutter, Kronen | Original scripts. **None of the packing-priority or collection work.** | `scripts/<station>/` |

---

## 3. Risks — read before changing anything

### 3.1 The live Unit 3 `Lithursan.gs` is not in this repository 🔴

A copy pasted from the live Apps Script editor had an **Enable voice** button, a microphone-device
picker, `interimResults = true`, 5 alternatives and `lang = "en-IN"`. **No file in
`scripts/Unit 3 Lampshade/` matches it** — not `Lithursan.gs`, not any of the nine `*.bak*` /
`*.work.now` copies. The repo copy uses `en-US`, final results only, and no Enable-voice button.

**Consequence:** pasting the repo `Lithursan.gs` over the live one will silently remove whatever the
live version added. **Before pasting, export the live file and commit it**, then merge. Use
[script-export-instructions.md](script-export-instructions.md).

### 3.2 The collection limit is different in the two tools 🟠

| Tool | Max lampshades per collection |
|---|---:|
| HTML Speak Tool (`engine.js` `MAX_COLLECTION`) | **10** — lowered 2026-08-20 |
| Unit 3 Sheets tool (`packing-priority.gs` `PP_MAX_LAMPSHADE_COLLECTION`) | **15** |

Only the HTML tool was changed. Decide whether the Sheets tool should also be 10.

### 3.3 Unit 3 sheet changes need a re-run 🟠

The packing sort runs inside **Run Clean and Merge**. Pasting `packing-priority.gs` changes nothing
until that menu item is run again and `Cleaned Data` is rebuilt.

### 3.4 "Save a copy" does not work on the hub 🟠

The hub renders pages inside `<iframe sandbox="allow-scripts allow-same-origin allow-popups">`.
Without `allow-downloads`, Chrome blocks the download silently, and the loader still reports
*"Saved …"*. Everything else works. Fix is on the hub app (add `allow-downloads`) or a guard in
`speak-loader.template.html`.

### 3.5 Stale entries on the hub 🟡

Under member `sarujanan`:

| Slug | What it is | Recommendation |
|---|---|---|
| `speak_tool` | **The current tool** | Keep |
| `speak-tool` | 2026-08-19 build: collection limit 15, no Restart confirmation, no Finished card, the held-order bug that jumped back to order 1 | Delete, or point users away — the name looks official |
| `packlist-13-speak` | A frozen 155-order snapshot, not a tool | Delete unless kept as a reference |

---

## 4. The rules both tools implement

Full detail in [workflows/packing-workflow.md](../workflows/packing-workflow.md).

**Inside one order** — ranked, stable sort (ties keep pack-list order):

| Order has a Rectangle Ceiling Rose | Order has none |
|---|---|
| 1 Rect Ceiling Rose | 1 Lampshade (`LS*`, `WCWD*`) |
| 2 Lampshade | 2 WC cage (`WC*` except `WCWD`) |
| 3 WC cage | 3 Bulb |
| 4 Bulb | 4 Ceiling Rose = Other (tie) |
| 5 Ceiling Rose = Other (tie) | |

If an order has **no Lampshade and no Ceiling Rose**, it is not reordered at all.

**Merge orders** (several customer orders packed as one parcel): each sub-order is sorted on its own
contents, then the **sub-orders are sequenced** by comparing their ranked contents — e.g.
`Lampshade + Rect Rose` → `Rect Rose + …` → `Lampshade + Rose` → `Bulb + Holder`. If no sub-order has
a Lampshade or Ceiling Rose, the merge keeps its original order.

**Lampshade collections**: before an order short on a shade family, the packer is sent to collect
that family across the next orders (list 1, "these orders only") or the whole pack list (list 2),
up to the limit in §3.2.

---

## 5. Deploying

### 5.1 HTML Speak Tool → Varmen AIOS hub

```bash
node packlist_extension/build.js      # writes packlist_upload/Speak-Tool.html
```

Then upsert it with the shared hub script. It lives **outside this repo**, at
`/home/led-247/SOT-Data-Gap-Analysis-Dashboard/hub/push_to_hub.js` (that folder has `pg` installed):

```bash
cd /home/led-247/SOT-Data-Gap-Analysis-Dashboard/hub
export HUB_DB_URL="…ask Varmen / DWC — never write it into a file or chat…"
node push_to_hub.js sarujanan speak_tool "Speak Tool — Order Pack List" \
     /home/led-247/Speak-tool-feedbacks-and-correction/packlist_upload/Speak-Tool.html
```

Same member + slug updates in place; the URL does not change. A **different** slug creates a new
page. To verify, decode the `stx-bundle` base64 out of the stored HTML and check your change is
inside it — file size alone proves nothing.

### 5.2 Google Sheets tool

1. Export the live files first (§3.1) and commit them.
2. Paste the updated `.gs` files into `Extensions → Apps Script`, save.
3. In the sheet, run **Speak Tool → Run Clean and Merge**, then **Speak All Rows**.

---

## 6. Database

| Database object | Used for | Notes |
|---|---|---|
| `varman_aios.hub_pages` | Varmen AIOS hub pages. Key `(member_name, page_slug)`; `html_content` holds the whole page | Written only by `push_to_hub.js`. The connection is shared and has access beyond this table — do not repurpose it |
| `daily_task.tbl_stfc_sarujanan` | Daily work reporting | [`sql/daily_task_insert_2026-08-17.sql`](../sql/daily_task_insert_2026-08-17.sql), [`daily_logs/claude-code-prompt__daily_task_insert.md`](../daily_logs/claude-code-prompt__daily_task_insert.md) |
| [`sql/proposed-order-model.sql`](../sql/proposed-order-model.sql) | A 2026-08-13 **proposal** | Never built |

The connection string is supplied as the `HUB_DB_URL` environment variable. **It is not in this
repo and must never be committed.**

The tool itself has no database. It reads the pack list page, the bundled reference data, and the
Names Master Sheet CSV (live, cached 6 hours in `localStorage`).

---

## 7. Testing

There is no browser test suite — voice needs Chrome and a real microphone.

| What | How |
|---|---|
| Live-name lookup against the **built** bundle | `node evidence/live-names-tests.js` — 28 checks, all passing 2026-09-14 |
| Hold / held-pass logic | `node evidence/hold-feature-tests.js` — 38 checks, all passing 2026-09-14 |
| Packing rules | Load `reference-data.js` + `engine.js` in Node and run `Engine.applyPriority` / `Engine.buildCollections` against orders extracted from `order_details/*.html` (155 orders, 27 merges) |
| Voice | Real station, Chrome, over `http(s)` — `file://` blocks the microphone (`node packlist_extension/serve.js <file>`) |

Every rule change should report how many of the 155 orders it moves, and confirm single orders are
unaffected when only merges should change.

---

## 8. Known open issues

**HTML Speak Tool**
- "Save a copy" on the hub (§3.4).
- Instruction QR and Send Order Instruction are **not spoken** — the pack list page has no field for
  them. The Sheets tool does speak them.

**Unit 3 Sheets tool** (from the 13 Aug review, re-checked against current code 2026-09-14)
- `onOpen` is defined in both `action.gs` and `cleaned.gs`; the last loaded wins.
- Pack-suffix lookup `rawSku.slice(0, -3)` strips 3 characters for a 2-character `PK`
  (`cleaned.gs`, `processRow`) — wrong name for `…10PK`.
- Merge label still reads `merge order total: N : merge order: 1` (FB-140 asked for "Merge order").
- Postcode space dropped when spelled; `Status` (`international`, `firstclass`) shown but not spoken.
- Duplicate-postcode blanking compares adjacent rows only; blanking a postcode also blanks the QR flag.
- `RPR44WH` is hardcoded in shared cleaning logic.
- No Hold feature.

**Rules / data**
- `WCWD` has no Lampshade SOT row, so its collection card shows no size.
- 3 of the 10 list-2 collections cover a single order — confirm whether the single-order rule should
  apply to list 2 as well.

---

## 9. Decisions still open

| # | Question |
|---|---|
| 1 | Should the Sheets tool's collection limit also be 10? (§3.2) |
| 2 | Delete the stale hub pages `speak-tool` and `packlist-13-speak`? (§3.5) |
| 3 | Roll the Unit 3 rules out to the other five stations, or retire their sheets in favour of the HTML tool? |
| 4 | Customer note — speak it or only show it? (Unit 4 FB-136 vs Unit 3 Lampshade FB-077) |
| 5 | Can the platform import add a `Shipping Service` column? (next-day / Evri / Royal Mail tickets) |

---

## 10. History

The project began as a 2026-08-13 analysis of the Unit 3 Lampshade Apps Script and 160 feedback
items. That analysis is kept as a record in
[documentation/02-code-walkthrough.md](../documentation/02-code-walkthrough.md),
[validation/open-defects.md](../validation/open-defects.md),
[capability/upgrade-proposal.md](../capability/upgrade-proposal.md) and
[closure/submission-checklist.md](../closure/submission-checklist.md). Day-by-day progress is in
[daily_logs/](../daily_logs/) **up to 2026-08-19 only**; dated rule decisions are in
[validation/](../validation/). Work from 2026-08-20 to 2026-09-14 (collection limit 10, Restart
confirmation, Finished card, held-pass resume, live names, WC rank, merge sequencing) is recorded in
[workflows/packing-workflow.md §7](../workflows/packing-workflow.md#7-rule-history) and in comments
beside the code — there are no daily logs for it.
