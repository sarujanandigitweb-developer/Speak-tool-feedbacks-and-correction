# Speak Tool — Upgrade Proposal

**For:** Varmen
**From:** Lithurshan
**Date:** 2026-08-13
**Basis:** 160 feedback items across 6 stations, a column-level profile of the live
Unit 3 Lampshade sheet, and a full read of the exported Apps Script (1,465 lines).

> **Post-code-review addendum.** The priorities below all hold. Three get cheaper than
> estimated, and **seven of the fixes turn out to be one-liners closing eight tickets**.
> One new item joins the top of the list: `Cleaned Data` is written twice with different
> column widths, leaving a stale `SKU Combined` column that the tool nevertheless uses to
> group orders. Do that before §4. Details and line numbers:
> [02-code-walkthrough.md](../documentation/02-code-walkthrough.md).

---

## Executive summary

The Speak Tool works. 97 of 160 reported items are already fixed. The problem now is not
that the tool is broken — it is that **63 items are outstanding, and they keep coming
back**.

Items marked Done in June are re-reported in August by a different station. The reason is
structural, and there are three causes:

1. **Speech is built as a plain string**, so the browser guesses how to pronounce codes
   and postcodes. Every guess it gets wrong is a separate ticket. (13 items)
2. **Merge orders are not modelled in the data** — only 6 of 140 rows carry a merge flag —
   so the tool infers grouping from postcode, which is wrong in both directions.
   (20 items, escalated to MD)
3. **Six stations run six independent copies of the script.** A fix is six deployments,
   so fixes drift and the same defect is reported up to five times. (drives the repeats)

Fixing these three closes **41 of the 63** outstanding items and stops the backlog
regenerating. The rest are mostly upstream data gaps, not tool bugs.

**Recommendation:** do §1–§3 below (about 2 weeks of work) before accepting any new
feature requests.

---

## §1 — Priority ranking

| # | Change | Closes | Effort | Risk |
|---|---|---:|---|---|
| 1 | Postcode & code pronunciation engine | 13 | S | Low |
| 2 | Voice-command reliability + hardware fallback | 8 | M | Low |
| 3 | Real merge/combo order model | 20 | L | Medium |
| 4 | Pre-flight data validation | 8 | S | Low |
| 5 | Single shared script, per-station config | — (stops repeats) | M | Medium |
| 6 | Customer note handling | 6 | S | Low — *needs a decision first* |
| 7 | Shipping service / label speech | 4 | — | **Blocked upstream** |
| 8 | Combo→image mapping reconciliation | 3 | M | Low |

---

## §2 — Fix pronunciation properly (Priority 1)

**Problem.** `PE11 3TY` is spoken "P E eleven three T Y". `IP20` becomes "twenty
thousand". `00049` loses its leading zeros. Thirteen tickets, five stations, five months.

**Why the current approach cannot win.** Every fix so far has been to edit the Names
Master Sheet — patching one product name at a time. That works for product names. It
cannot work for postcodes, because postcodes are unbounded: there is a new one every
order. The developer's own note on FB-001 says it exactly —
*"i can't do for single one, can do it for every think"*. He is right. It needs a rule,
not a lookup.

**The rule.** Classify each token before speaking it:

| Token type | Detection | Spoken as |
|---|---|---|
| UK postcode | `^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$` | character by character, with a pause between outward and inward code |
| DE postcode | 5 digits (Kronen/Schmutter) | digit by digit, leading zeros preserved |
| IP rating | `IP\d\d` | "I P two zero" — never as a number |
| Wattage / voltage | `\d+W`, `\d+V` | number + unit word |
| Cable length | `\d+m` | number + "**metres**" (FB-031, FB-053) |
| Quantity | integer | number, spoken **before** the product name (FB-020) |
| Everything else | — | Names Master Sheet lookup, then plain text |

Emit with SSML where the voice supports it:

```
<say-as interpret-as="characters">PE11</say-as> <break time="300ms"/>
<say-as interpret-as="characters">3TY</say-as>
```

Where SSML is unsupported, inject spaces between characters — the technique the sheet
already uses for product names (`S T 6 4 b22 8 wats`). Apply it to postcodes too.

**Also fix the transformer order** (FB-049, FB-157) — Kronen specified it precisely:
**type (IP20/IP67) → voltage → wattage**.

**Before this ships, verify FB-072** — that Names Master Sheet edits actually propagate
to all six stations. If they do not, every name-sheet fix already made is silently dead.

---

## §3 — Make "next" reliable (Priority 2)

**Problem.** FB-133: *"Next command is not listening enough — getting tired from it."*

**Why it happens.** The browser `SpeechRecognition` API is cloud-backed. Each recognition
round-trips to Google. It also **closes the microphone** after each result, and if the
restart is tied to speech-synthesis completion there is a dead window where the packer's
"next" hits a closed mic. On warehouse wifi, both failure modes compound.

**Three changes, in order of value:**

1. **Restart the recogniser on `onend` and `onerror`, unconditionally and immediately** —
   do not wait for the utterance to finish. Most misses are simply a closed mic. Cheapest
   fix, biggest single win.
2. **Add a hardware fallback.** A £15 USB foot pedal, or the station's existing barcode
   scanner, mapped to a keypress that means "next". Hands stay on the product, zero
   network dependency, works when wifi does not. *This is the change most likely to end
   this thread permanently* — and it is worth doing even after the software fix, as the
   guaranteed path.
3. **Constrain the grammar** to `next / back / stop / run / respeak / postcode` so
   near-misses still resolve.

Add a visible mic-state indicator (FB-013 reported the icon disappearing). The packer must
be able to see at a glance whether the tool is listening.

---

## §4 — Model merge and combo orders for real (Priority 3)

**This is the one to take back to MD** — the Schmutter tab records
*"We need to find a way by MD"* against it.

**Problem.** Twenty items, every station. Merged orders are not shown as one parcel;
components go unspoken; two customers at one postcode get falsely merged (FB-071, marked
**Important**); one customer with two postcodes does not get merged (FB-075).

**Why it has been called "not possible" four times.** It is not possible *while the script
iterates a flat list of rows*. `Cleaned Data` is one row per line item, and the
`Merge Order` column is populated on **6 of 140 rows** — there is nothing to group by. So
the tool falls back to postcode matching, which is not a valid identity key.

**What to build:**

1. **In the cleaning step**, compute `Merge Group ID = hash(normalised customer name +
   normalised address)`. Not postcode. Write it into `Cleaned Data` as a real column.
2. **In the script**, build order objects instead of iterating rows:
   ```
   { merge_group, customer, postcode, components: [ {sku, name, qty, colour, image} ] }
   ```
3. **Speak the parcel as a unit**, postcode last (FB-064):
   > *"Merge order. Three components. Component one of three: two, forty centimetre hemp
   > shade. Component two of three: … Component three of three: … Post code: C M six,
   > three Z B."*
   FB-140 asks not to hear *"merge order total 2: merge order 1"* — say **"Merge order"**
   once, then enumerate.
4. **Order components by pack sequence**, not sheet order: bulb first, accessories, shade
   **last** (FB-066, FB-069, FB-074, FB-080). Group colour variants together (FB-067).
5. **Show every component on screen simultaneously**, not one at a time — the request
   behind FB-145/FB-159 *"merged orders shown as a single view"* and the `All Stations`
   note *"for an order all the components need to be shown (like packlist)"*.

Roll to Kronen **and** Schmutter together — FB-154 says all German packlists change as
one.

---

## §5 — Consolidate the six copies (Priority 5)

**Problem.** FB-059: *"everything changed in Unit 4 must also be changed in Unit 3."*
Four Schmutter/Kronen items are word-for-word identical. The same postcode bug is filed
five times.

Six sheets each carry their own copy of the Apps Script. Nobody knows which copy is
current.

**Options, cheapest first:**

| Option | What it is | Trade-off |
|---|---|---|
| **A. Shared Apps Script library** | One script project; each sheet binds to it as a library. Config (station name, language, note-speaks-or-not) stays per-sheet. | Smallest change. Still Apps Script, still Google-quota bound. |
| **B. Single web app** | One Apps Script web app serving all stations, reading each station's sheet by ID. Stations open a URL. | One deployment. Needs auth handling. |
| **C. Move off Sheets** | Proper backend + browser front end. | Correct long-term, far more work. Not now. |

**Recommend A** — it fixes the drift without changing how anyone works, and it is the
prerequisite for every other fix landing once instead of six times.

Alongside it, put the script in **version control** (clasp → git). Right now there is no
history, no diff, and no way to tell what changed between stations.

---

## §6 — Fix the feedback loop itself

The `Ref` column exists on every tab and is **empty on all 160 rows**. Nothing has an ID,
so nothing can be closed, and nobody can tell a new report from a repeat. Twenty-six items
on the Unit 3 Lampshade tab have never been triaged at all.

Minimum change:

- Give every item an ID (`FB-001`…) — done, in
  [evidence/feedback-register.csv](../evidence/feedback-register.csv). Paste the IDs back
  into the `Ref` column.
- Replace the True/False column with **Open / In progress / Fixed / Won't fix / Blocked
  upstream**. "False" currently means both *"not done yet"* and *"refused"*, which is why
  the same items keep being re-reported.
- When closing an item, record **which station and which script version** the fix landed
  in.
- Anything marked *"not possible"* gets a one-line reason and an owner. Four of the five
  current ones are possible with a data change.

---

## §7 — Rough plan

| Week | Work |
|---|---|
| 1 | Verify FB-072 (name sheet propagation). Build the pronunciation tokeniser (§2). Pre-flight validation (§4 of open-defects). Ship to one station. |
| 2 | Voice-restart fix + order the foot pedals (§3). Roll pronunciation to all six. |
| 3–4 | Merge-order data model (§4) — cleaning step first, then script, then UI. Kronen + Schmutter together. |
| 5 | Consolidate to a shared library (§5). Put the script in git. |
| Ongoing | Re-triage the 26 untouched items; close the register properly (§6). |

**Decisions needed from Varmen** — listed in
[handover/handover-note.md](../handover/handover-note.md).
