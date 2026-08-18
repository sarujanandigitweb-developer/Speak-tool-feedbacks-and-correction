# Kronen — Issue Analysis (6 issues)

**Issue tab:** `Kronen` · German packlist station
**Data sheet:** [`1ROig4b9…`](https://docs.google.com/spreadsheets/d/1ROig4b9TtVrqm5F367ZUJ4Dly3xoAoBMZfTVdDeGlyk/edit?gid=0)
**Script:** [`scripts/Kronen speak tool/`](../../scripts/Kronen%20speak%20tool/) — `Lithursan.gs` **703 L (no grouping)** · `cleaned.gs` **263 L (no `RPR44WH` removal)**

> ⚠️ **Kronen's issue tab has only 4 columns, not 5** — there is no `Ref` column at all. Like every
> other station, no issue here carries a tracking reference.
>
> ⚠️ **Kronen and Schmutter file identical tickets but run different code.** Four of Kronen's six
> issues are word-for-word identical to Schmutter's. Yet Kronen runs the **703-line** speak tool with
> **no grouping**, while Schmutter runs the **948-line** version that has it. Any "German packlist"
> fix is therefore two different pieces of work.

| | Count |
|---|---:|
| Total issues | **6** |
| Sheet says Done | 4 |
| Sheet says Open | 2 |
| ✅ **Verified fixed** | **2** |
| ⚠️ Unverified | 2 |
| ❌ **Proven not fixed** | **2** |

`- [x]` = verified fixed · `- [ ]` = not fixed

---

## 09/07/2025 — all six reported the same day

- [x] **#01 · Activation process takes time — please simplify** — `Done` ✅
  Single menu item → modal (`cleaned.gs:3-6`). Resolved. *(Identical to Schmutter #01.)*

- [ ] **#02 · Packlist needs more detail (listing image, listing title)** — `OPEN` *"not possible for this"* ❌ **← should be re-opened**
  **This is possible.** `Title` and `Image URLs` are both fully populated and already rendered in the modal (`Lithursan.gs:142`, `:157`). A packlist-template change, not an impossibility.
  *(Identical to Schmutter #02.)*

- [ ] **#03 · Transformer details in order: type (IP20/IP67) → voltage → wattage** — `Done` ⚠️ **RC-A**
  The most precisely specified request in the entire 160-issue backlog. Marked Done, but **no template or token classifier exists** — `Lithursan.gs:517-518` builds a plain `SpeechSynthesisUtterance` with no SSML, and the name goes through `split(" ").join(" ")` at `:101-102`, **a no-op**. Any ordering must have been done by hand-editing individual names in the names master sheet, which cannot hold.
  Related open reports elsewhere: Unit 3 Others #49 *"TRANSFORMER SPEAK TOOL WRONG"*, Unit 4 #57 *"IP 20 Thousand issue"*.
  **Fix:** a transformer utterance template — `"I P two zero. Twelve volt. One hundred and fifty watts."` — driven by a token classifier, not per-product names.

- [ ] **#04 · Requires speaking twice and takes time — needs one attempt** — `Done` ⚠️ **RC-B / RC-N**
  Two possible readings, both live in this code:
  - **RC-B** — the *voice command* needs repeating. `Lithursan.gs:646-647` calls `recognition.stop()` then `recognition.start()` on adjacent lines, which throws `InvalidStateError`; `onerror` (`:652-656`) logs and **does not restart**.
  - **RC-N** — the *utterance* is duplicated. Proven at Unit 3 Others by screenshots P6 and P8.

  Needs a live run to confirm which the reporter meant. *(Identical to Schmutter #04.)*

- [ ] **#05 · Merged orders need to be shown as a single view** — `OPEN` *"not possible for this"* ❌ **RC-C**
  **Kronen is worse off than Schmutter here.** Schmutter at least has grouping code; Kronen's 703-line script has **none** — verified: `combinedGroups`, `groupKey` and `processedIndices` are absent, and the builder is a flat `dataRange.forEach` at `:56`. On top of that, `component` is read at `:70` and **never used again**.
  So Kronen needs **two** things: grouping ported in, *and* a real merge key in the data (`Merge Order` is populated on 6 of 140 rows).
  *(Identical to Schmutter #05, which carries the note "We need to find a way by MD".)*

- [x] **#06 · Two separate buttons — product details and label number** — `Done` ✅
  The `📍Postcode` button is a separate control (`Lithursan.gs:245`), correctly split because the label number is only confirmed after packing. *(Identical to Schmutter #06.)*

---

## Defects that apply to Kronen but were never reported here

Kronen shares its `Lithursan.gs` byte-for-byte with **Unit 4** (`625c098a`) and its `cleaned.gs` with
Schmutter and Person 2 (`af9a549b`). Every defect proven at those stations is therefore live at
Kronen too, whether or not a packer has filed it:

- [ ] **Leading zeros destroyed** — `cleaned.gs:27` `getValues()`. German postcodes lose their leading zero. Proven at Schmutter (**screenshot P14**: `00049` → `49`). **Certain to affect Kronen.**
- [ ] **Quantity blanked on a failed name lookup** — `cleaned.gs:112` + `:116`. Proven at Schmutter (**P13**).
- [ ] **Postcode dedupe cascades into QR deletion** — `cleaned.gs:167-169`, `:190`.
- [ ] **Postcode button reads a hardcoded array slot** — `Lithursan.gs:407` uses `speakTexts[index][1]`.
- [ ] **No `synth.resume()`** — pause is one-way.
- [ ] **No mic indicator in the DOM.**
- [ ] **Mic never gated during speech** — the tool speaks `":Post Code:"` and `:639` hears it, firing its own command.
- [ ] **`utter.lang` hardcoded `"en-US"`** (`:518`) and the default voice hardcoded `"Google US English"` (`:476`) — **wrong for a German station.** No German ticket has been filed for this, but it is the likeliest cause of poor German address pronunciation.
- [ ] **Two competing `onOpen()`** — `action.gs:1` and `cleaned.gs:1`.

---

## Root causes for this station

| RC | Issues | Count |
|---|---|---:|
| **C** — no grouping (worse than Schmutter) | 5 | 1 |
| **A** — no SSML / no transformer template | 3 | 1 |
| **B / N** — two attempts / spoken twice | 4 | 1 |
| re-open (data already exists) | 2 | 1 |
| resolved | 1, 6 | 2 |

## Fix order for Kronen

| Step | Fix | Closes | Effort |
|---:|---|---:|---|
| 1 | **RC-F** — `cleaned.gs:27` → `getDisplayValues()` *(unreported but certain)* | — | **XS** |
| 2 | Set `utter.lang` and the default voice from station config — **`de-DE` for Kronen** | — | XS |
| 3 | Re-open #02 — listing image + title in the packlist template | 1 | S |
| 4 | **RC-B** — remove `stop()` at `:646`, restart from `onerror`, gate the mic | 1 | M |
| 5 | **RC-A** — transformer template: type → voltage → wattage | 1 | M |
| 6 | **RC-C** — port grouping **then** add the merge key | 1 | L |

Steps 1 and 2 are unreported but near-certain wins for a German station, and both are one-liners.

⚠️ **Do not treat "fix the German packlists" as one task.** Kronen needs grouping ported in before
its merge-order issue can even be attempted; Schmutter only needs the merge key. Same ticket text,
two different jobs.
