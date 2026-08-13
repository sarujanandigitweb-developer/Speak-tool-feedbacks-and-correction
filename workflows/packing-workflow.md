# Packing Workflow — As-Is and To-Be

## As-is: a packer's session

1. Open the station's Google Sheet.
2. `Extensions → Speak Tool → Speak Products`. *(FB-141/FB-155: activation is slow —
   both German stations asked for this to be simplified. Marked Done.)*
3. Pick voice and speed. Speeds are Normal ×1, Fast ×1.25, Very Fast ×1.5 (FB-121).
4. The tool speaks row 1 of N:
   ```
   :: S T 6 4 b22 8 wats :: 6: :Post Code: W 3 6 H H
      └─ phonetic name ──┘  └qty┘        └─ postcode ─┘
   ```
5. Packer picks the item, checks it against the on-screen image and quantity badge.
6. Packer says **"next"** (or presses `Next`). Queue advances.
7. After packing, packer presses **`Postcode`** to hear the postcode for the label — this
   is a separate button because the label number is only confirmed once the parcel is
   sealed (FB-146, FB-160).
8. `Row Time` and `Total Time` accumulate as a productivity measure.

Recovery controls: `Back`, `Respeak`, `Pause`, `Restart`.

## Order types and what the packer must hear

| Type | Data shape | Required utterance |
|---|---|---|
| 1. Single order, single product | 1 row | qty → name → postcode |
| 2. Merge order, single products | N rows, same customer | "Merge order" → each order's item → postcode **once, last** |
| 3. Single order, multi products (combo) | N rows sharing `Combo SKU`, flagged `component` | "Component 1 of N" … → postcode last |
| 4. Merge order, multi products | N combos, same customer | "Merge order" → all components across all orders → postcode last |
| 5. Merge, single **and** multi | mixed | as above |

Types 2–5 are where the tool currently under-serves the packer — see
[Theme C](../validation/open-defects.md).

## To-be: the corrected utterance

Target sequence for a merge order, incorporating FB-020, FB-064, FB-069, FB-080, FB-140:

```
"Merge order. Three components."
"Component one of three. Two. Forty centimetre hemp shade."     ← qty before name
"Component two of three. One. One metre short holder pendant full set."
"Component three of three. One. Reducer plate white."
"Instruction QR available."                                      ← FB-060, FB-070
"Post code. C M — six. Three — Z — B."                           ← last, spelled out
```

Rules encoded above:

- **Quantity before the product name** (FB-020, already Done — keep it).
- **Postcode last, and only once** for the whole parcel (FB-064).
- **Say "Merge order" once**, then enumerate — not *"merge order total 2: merge order 1"*
  (FB-140).
- **Shade last** in the pack sequence; bulb and accessories first (FB-069, FB-080).
- **Free bulbs not first** (FB-066).
- **Postcode spelled character by character**, outward and inward code separated by a
  pause (Theme A).
- **Gap after the postcode** before the next order begins (FB-018).

## Pre-flight check (proposed)

Before the session starts, validate the queue and show the packer what is wrong rather
than speaking a broken order:

| Check | Current failure rate | On failure |
|---|---:|---|
| `Name` present | 6/140 blank | speak the SKU letter-by-letter, flag for postage team |
| `Quantity` present | 6/140 blank | block the row, show on screen |
| `Post Code` present | **31/140 blank (22%)** | speak *"postcode missing — check screen"* |
| `Merge Group ID` consistent | not yet implemented | block the group |

Silence is the worst failure mode: the packer cannot distinguish "nothing to say" from
"tool broke". Every Theme D ticket is a silent field.

## Feedback loop (as-is, and why it leaks)

```
packer hits a problem
   → writes a line in their station's tab (free text, no ID)
   → dev marks True/False
   → ...no verification step, no version recorded
   → same issue re-reported weeks later by another station
```

The `Ref` column is empty on all 160 rows. See
[Upgrade Proposal §6](../capability/upgrade-proposal.md) for the fix.
