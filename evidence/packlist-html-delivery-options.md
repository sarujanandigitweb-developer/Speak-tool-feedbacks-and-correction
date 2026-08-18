# Speak Tool without the spreadsheet — delivery options on the HTML pack list

**Author:** Sarujanan · **Date:** 2026-08-17 · **Project:** STFC — Speech Tool, Warehouse Voice Packing
**Status:** Analysis only. No code was written or changed for this report.

**Question put to me:** the pack list already opens as an HTML page. If the Speak Tool were built as
a browser extension — or something else — what could it do, and what would it look like compared to
what we do today through Excel/Google Sheets?

---

## 1. Summary

The pack list HTML **already contains most of what the Speak Tool needs**. I confirmed this against
16 real pack list files saved under `speak_tool/uploads/`, and against an existing Flask prototype
in this repository (`speak_tool/app.py`, dated July 2025) that already scrapes those files into the
exact `Sheet1` layout we use today.

That changes the question. This is not "can we read the pack list without Excel" — that is already
proven and already written. The real question is **where the four things the pack list does *not*
contain would come from**, because those four are what the current spreadsheet actually provides.

| | Verdict |
|---|---|
| Can a browser extension read the pack list? | **Yes** — every order field is in the DOM, selectors already known |
| Can it speak, show images, take voice commands? | **Yes** — same Web Speech API, fewer restrictions than today |
| Can it replace the spreadsheet outright? | **No, not as-is** — three manually-entered fields and three derived datasets have no home |
| Recommended | **Option C, then B** — see §6 |

---

## 2. What the pack list HTML already gives us

Measured by parsing the saved pack lists in `speak_tool/uploads/` (16 files, 73 KB – 1.2 MB each).
The DOM contract below is not guesswork; it is the selector set the existing prototype already
relies on and which I re-verified.

| Field the Speak Tool needs | Present? | Where in the DOM |
|---|---|---|
| Customer Info | ✅ | `div.col-2.small` (2nd block) |
| Post Code / Address | ✅ | `div.fs-6` |
| Selling Platform | ✅ | `div.bg-light.border` |
| Price | ✅ | `div.text-end span span:nth-child(2)` |
| Title (marketplace) | ✅ | `div.fw-bold.border-bottom span` |
| SKU | ✅ | `span[onclick^='copyText']` |
| Quantity | ✅ | text node `Quantity:` |
| Combo SKU / Colour / Qty | ✅ | `label.col-3.mb-3` → `div.text-center div.small`, `span.alert` |
| Product images | ✅ | `img[src]` — remote, from `dashboard.digitweblk.com` and `sin1.contabostorage.com` |
| Merge / combo marker | ✅ | `div.bg-warning…rounded-pill` (`zzzmerge_order` → combo, `multi_line`/`merged` → merge order) |

One order in the largest sample carried 22 orders, 22 product blocks and 21 combo components — the
same shape our pipeline handles today.

### A useful thing found in the prototype

`speak_tool/app.py` contains a **pack-code map** that our Apps Script does not have:

```
2PK–9PK = 2–9    APK = 10    CPK = 20    DPK = 30    EPK = 50
FPK = 100        NPK = 200   PPK = 300   QPK = 500   RPK = 1000
```

This directly answers a limitation I documented in `packing-priority.gs`, where `ppProductSize()`
deliberately refuses to strip numeric pack suffixes because `LSFT2205PK` is ambiguous between
"220 + 5-pack" and "2205 + pack". With this map the ambiguity is resolvable. **Worth adopting
regardless of which option below is chosen.**

---

## 3. What the pack list HTML does NOT give us

This is the part that decides the answer. I searched all 16 pack list files for each of these.

### 3.1 Three fields that exist only because a human types them into the sheet

| Field | Occurrences in 16 pack lists | Rows populated in the live `Sheet1` |
|---|---:|---:|
| `Instruction QR` | **0** | 23 / 169 |
| `Send Order Instruction` | **0** | 3 / 169 |
| `Status` | **0** | 20 / 169 |

These are real operational instructions — *"Instruction QR Available"*, *"Commercial Invoice add"*,
*"Label mot print"*. The packer must act on them. The spreadsheet is currently not just a data
carrier; **it is the place where the team writes these in.** Any design that drops the spreadsheet
must give them somewhere else to live, or they are silently lost.

### 3.2 Three datasets that come from elsewhere

| Dataset | Source today | Used for |
|---|---|---|
| Spoken phonetic name | `names` master sheet `16rx5Dz…` | What the packer actually hears. The pack list has only the marketplace `Title`, which is never spoken |
| Product Type, Colour, packing order | Computed by `packing-priority.gs` | Lampshade → Rect Rose → Bulb → Other sequencing, and the 15-unit collection |
| Lampshade SOT | `1b9n4Rhy…` | Authoritative colour, size and image for 451 lampshade SKUs |

None of these are in the pack list page. Whichever option is chosen, they still have to be fetched
and joined.

---

## 4. Option-by-option assessment

### Option A — Browser extension injected into the live dashboard page

A content script recognises the pack list page and adds a **Speak** button directly into it.

**What it would do well**
- **No export step at all.** Today someone opens the pack list, saves it, uploads it, waits for the
  sheet to fill, then runs Clean and Merge. That whole chain disappears.
- Escapes every Apps Script restriction we currently work around: the 6-minute execution limit, the
  modal dialog that hangs if run from the editor, and the 1600 px width ceiling Google imposes on a
  modal. A full-screen panel becomes possible.
- Can cache the names master and the SOT locally, so the lookup is instant and survives a slow network.
- Can hold state properly — pick progress, a lampshade collection pool, "packed" ticks per component —
  none of which the current one-shot injection model can do.

**What it cannot do without more work**
- The three manual fields have no home unless the extension adds its own input UI and stores them,
  or the dashboard team adds real fields.
- Needs to reach the names master and the SOT. Either through a small backend, or through Google
  auth inside the extension, which is meaningful additional work.
- **Tightly bound to the dashboard's DOM.** Every selector in §2 is a CSS class in someone else's
  application. A styling change there silently breaks picking. This is the same class of fragility
  as the per-station script forks we already identified as the root cause of recurring defects.
- Chrome policy, installation and updates across 6 stations become an IT task.

### Option B — Bookmarklet or userscript

The same content-script idea, without the extension packaging. The packer clicks a bookmark on the
pack list page.

- Cheaper to deploy and update than an extension; no store, no policy, no per-machine install.
- Same DOM fragility as Option A.
- More constrained on storage and cross-origin requests, so caching the names master and the SOT is
  harder.
- Realistically a good way to **prove Option A** before committing to it.

### Option C — Standalone web page, pack list HTML dropped or pasted into it

This is what `speak_tool/app.py` already half-does today, but instead of writing to a spreadsheet it
would speak directly.

- **The prototype already exists and already parses the pack list correctly.** This is the shortest
  path from where we are.
- Independent of the dashboard's release cycle: if their DOM changes, one parser is fixed in one
  place, and nothing is broken for the packer in the meantime.
- Can host the three manual fields as real inputs, and can persist them.
- Can hold the names master and the SOT server-side, so no auth work inside a browser extension.
- Costs one extra step for the packer — save or paste the pack list — but that step exists today
  anyway, and this removes the spreadsheet, the Clean and Merge run, and the Apps Script entirely.
- One place to fix, so the six-station drift problem stops recurring.

### Option D — Ask the dashboard team to add the Speak view to the pack list page itself

- The correct long-term answer. No scraping, no DOM coupling, no export.
- The three manual fields become real fields with real validation instead of free text in a sheet.
- Depends entirely on another team's roadmap, so it cannot be scheduled by us.

### Option E — Keep the current spreadsheet flow

- Everything already works, and today's nine fixes are tested and ready.
- Keeps the costs we already measured: manual export, six forked script copies, an editor ▶ Run
  button that destroyed 60 SKUs in `Sheet1`, and hand-typed operational fields.

---

## 5. Comparison

| | A — Extension | B — Bookmarklet | C — Web page | D — Dashboard | E — Today |
|---|:--:|:--:|:--:|:--:|:--:|
| Removes the export step | ✅ | ✅ | ➖ one step remains | ✅ | ❌ |
| Removes the spreadsheet | ✅ | ✅ | ✅ | ✅ | ❌ |
| Removes Apps Script limits | ✅ | ✅ | ✅ | ✅ | ❌ |
| Fixes the 6-copy drift | ✅ | ✅ | ✅ | ✅ | ❌ |
| Survives a dashboard DOM change | ❌ | ❌ | ➖ one parser to fix | ✅ | ✅ |
| Homes the 3 manual fields | ➖ needs new UI | ❌ | ✅ | ✅ | ✅ today |
| Names master + SOT lookup | ➖ auth work | ❌ hard | ✅ server-side | ✅ | ✅ today |
| Real pick state / collection pool | ✅ | ➖ | ✅ | ✅ | ❌ |
| We can schedule it ourselves | ✅ | ✅ | ✅ | ❌ | ✅ |
| Reuses work already written | ➖ | ➖ | ✅ prototype exists | ❌ | ✅ |

---

## 6. Recommendation

**Start with Option C, and treat Option D as the destination.**

1. **Option C is the shortest honest path.** The parser is already written and already correct.
   Redirecting it from "write to a spreadsheet" to "speak directly" removes the spreadsheet, the
   Apps Script, the Clean and Merge run and the six forked copies in one move, and it gives the
   three manual fields a real home instead of a free-text column.
2. **Option B is worth one day** if we want to see the extension experience on the live page before
   committing to Option A.
3. **Option A only after the DOM contract is agreed with the dashboard team.** Building an extension
   on undocumented CSS classes recreates exactly the fragility we have spent this week removing.
4. **Option D should be raised with them now**, because everything in Options A–C is a workaround
   for the pack list not offering this itself.

Whichever is chosen, **the packing logic does not need rewriting.** Classification, the conditional
priority, the just-in-time collection and the speech segmentation are all plain rules; they move
across unchanged.

---

## 7. Things that must be decided before any build starts

| # | Question | Why it blocks |
|---|---|---|
| 1 | Where do `Instruction QR`, `Send Order Instruction` and `Status` get entered? | 46 of 169 rows carry one; they are operational instructions, not decoration |
| 2 | Is the pack list DOM stable, and will we be told before it changes? | Every option except D depends on it |
| 3 | Can the names master and the Lampshade SOT be exposed as an API or a scheduled export? | Otherwise every option needs Google auth in the browser |
| 4 | Does the pack list carry a real order ID? | We currently use the postcode as the order key because `Sheet1` has no order ID. Two customers can share a postcode |
| 5 | Do the stations have reliable network? | `SpeechRecognition` is cloud-backed; speech synthesis is local. Voice commands fail offline, buttons do not |
| 6 | One shared tool for all 6 stations, or per-station config? | The 6-copy fork is the root cause of recurring defects |

---

## 8. Related finding — credential handling

`speak_tool/service-account-file.json` is a **live Google service-account private key**
(`unit4-337@coherent-surf-461012-f8.iam.gserviceaccount.com`).

It is correctly excluded from git by `.gitignore` — I verified this. Two points regardless:

- `app.py` hardcodes a Windows path (`C:\speak_tool\service-account-file.json`), so the file is
  expected to sit on a developer machine. Any move to a shared service should put the key in a
  secret store, not on disk beside the code.
- The key grants spreadsheet write access. The `Sheet1` SKU loss this week was caused by a function
  run by hand from the Apps Script editor, not by this key — but both are the same category of risk:
  **write access to live data with no guard in front of it.**

---

## 9. Evidence

| Source | What it establishes |
|---|---|
| `speak_tool/uploads/` — 16 pack list files, Jun–Jul 2025 | The DOM contract, and that combos, merges, images and prices are all present |
| `speak_tool/app.py` | A working pack list parser already exists and already produces the `Sheet1` layout; also the pack-code map in §2 |
| Live `Sheet1` (`1AMQMzxu…`), 169 rows | `Instruction QR` 23, `Send Order Instruction` 3, `Status` 20 — none of which appear in any pack list file |
| `/documentation/02-code-walkthrough.md` | The one-shot injection model the current tool is built on |
| `/validation/issues/unit-3-sku-blanking.md` | The live-data risk that motivates removing hand-run scripts |
| `/capability/unit3-packing-priority-report.md` | The packing rules that carry over unchanged |
