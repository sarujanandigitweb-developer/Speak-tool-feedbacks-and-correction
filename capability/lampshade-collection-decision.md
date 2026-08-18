# Lampshade Collection — Worked Example, UI Design, and the Decision Needed

**Worked against the example supplied 2026-08-14.** Analysis and UI design only.
**No code changed** — the allocation rule this depends on is still undefined.

---

## 1. The example, calculated

| Size | Colour | Qty |
|---:|---|---:|
| 500 mm | Red | 3 |
| 500 mm | Black | 4 |
| 220 mm | Green | 2 |
| 220 mm | White | 1 |
| 180 mm | Blue | 2 |
| 40 mm | Black | 6 |
| 40 mm | Green | 2 |
| | **TOTAL** | **20** |

**Limit is 15. The requirement is 20. Over by 5.**

So this example is precisely the case the rules leave undefined.

---

## 2. ⚠️ First correction — there are **7** collection line items, not 5 colours

It is tempting to summarise the requirement by colour:

```
Black 10   Green 4   Red 3   Blue 2   White 1     ← WRONG
```

**"Black 10" merges 500 mm Black (4) with 40 mm Black (6) — two different products.**

A lampshade's identity is `family + size + colour`, and each combination is its own SKU
(`SKU Decoder` tab of the Lampshade SOT; verified across 451 SKUs). `LSFT500BM` and `LSTF40BM` are
no more interchangeable than Black and Red are.

The same rule that says *"never merge different colours into one quantity"* therefore also says
**never merge different sizes**. The unit of collection is the **SKU**, and its human label is
**size + colour**.

> **Rule (derived, not invented):** a collection line item is one SKU. Colour separation is a
> special case of SKU separation.

---

## 3. What the existing rules DO determine

| # | Determined | Source |
|---|---|---|
| 1 | Total required = **20** | arithmetic |
| 2 | 20 > 15, so **more than one collection cycle is required** | max = 15 |
| 3 | **No cycle may exceed 15** | stated limit |
| 4 | The 7 line items stay separate — never merged, never summed into a colour total | "different colour SKUs must not be merged" |
| 5 | If the total had been **below** 15, collect exactly the required quantity — never round up to 15 | "if requirement < 15, collect only the required quantity" |
| 6 | Every shade still belongs to its own order; the collection is a picking trip, not a re-grouping | §9, §26 |

**If this example had totalled 12 instead of 20, the answer would be fully determined:** collect all
7 line items exactly as listed, one trip, done. The system can do that today.

---

## 4. What the rules do NOT determine

**Which 15 of the 20.**

Three sub-questions are all open:

### 4a — May a line item be split across cycles?

`40 mm Black 6` — is it legitimate to take 3 now and 3 later, or must a line item be collected whole?

### 4b — May an order be split across cycles?

If each size group is one order, may the packer collect part of an order now and the rest later, or
must an order be completed in one cycle?

### 4c — If orders must stay whole, which combination?

Even under the most restrictive reading — whole size-groups only — **there are 12 valid ways to fill
one cycle**, and no rule to choose between them:

| Cycle 1 content | Total |
|---|---:|
| 500 + 40 | **15 — exact fit** |
| 220 + 180 + 40 | 13 |
| 500 + 220 + 180 | 12 |
| 220 + 40 | 11 |
| 500 + 220 | 10 |
| … 7 more | ≤ 10 |

Both *"fill to exactly 15"* (500 + 40) and *"take them in order until the next one won't fit"*
(500 + 220 + 180 = 12) are defensible. They produce different picking trips.

**I am not choosing between these.** Picking one would silently create the FIFO / largest-first /
best-fit rule the requirement explicitly forbids inventing.

---

## 5. Second blocker — the tool has no cross-order state

Even with the allocation rule decided, there is an architectural gap.

The Speech Tool builds **one queue entry per order** and speaks them in sequence
(`Lithursan.gs:57-72`). It has no concept of a workload, a batch, or a cycle, and no state that
survives closing the modal. It also cannot see how many shades the *next* orders need.

A collection cycle needs the **whole day's workload aggregated before packing starts**. That is a new
layer above the current tool, not a change to the packing sequence.

**Two decisions are therefore needed, not one:**

1. What is the allocation rule above 15?
2. Is the collection wave in scope for the Speech Tool at all, or does it belong to the packlist /
   dashboard system that already knows the whole workload?

---

## 6. UI design

Preserving the existing modal (§18) — this is an **additional panel above the order card**, shown
once at session start and updated as cycles complete. Nothing existing is redesigned.

### 6a — Under the limit (fully determined, buildable today)

```
┌──────────────────────────────────────────────────────────────┐
│  LAMPSHADE COLLECTION                          12 / 15        │
│  ████████████████████████░░░░░░                               │
│                                                               │
│   500 mm   ● Red      3        LSFT500RE                      │
│   500 mm   ● Black    4        LSFT500BM                      │
│   220 mm   ● Green    2        LSFT220GR                      │
│   220 mm   ○ White    1        LSFT220WH                      │
│   180 mm   ● Blue     2        LSDO180BL                      │
│                                                               │
│   COLLECT ALL — one trip                          Total  12   │
└──────────────────────────────────────────────────────────────┘
```

**Design rules:**

- **One row per SKU.** Size and colour are always shown together — never a bare colour total.
- **Colour swatch + colour name + size**, so it reads at a glance from a metre away.
- **SKU shown** as the tie-breaker when two rows look similar.
- **Progress bar against 15**, so the packer sees headroom without doing arithmetic.
- Never displays "15" when only 12 are needed.

### 6b — Over the limit (what the example produces)

The panel must show the requirement honestly and **must not silently pick 15**:

```
┌──────────────────────────────────────────────────────────────┐
│  LAMPSHADE COLLECTION                     ⚠ 20 / 15  OVER 5   │
│  ██████████████████████████████ ▓▓▓▓▓▓▓▓▓▓                    │
│                                                               │
│   500 mm   ● Red      3        LSFT500RE      ┐               │
│   500 mm   ● Black    4        LSFT500BM      ┘ order A   7   │
│   220 mm   ● Green    2        LSFT220GR      ┐               │
│   220 mm   ○ White    1        LSFT220WH      ┘ order B   3   │
│   180 mm   ● Blue     2        LSDO180BL        order C   2   │
│   40 mm    ● Black    6        LSTF40BM       ┐               │
│   40 mm    ● Green    2        LSTF40GR       ┘ order D   8   │
│                                                               │
│   ⚠ EXCEEDS 15 — 2 collection cycles required                 │
│      Split rule not configured — ask supervisor               │
└──────────────────────────────────────────────────────────────┘
```

- Line items **grouped by order**, with an order subtotal — because whichever split rule is chosen,
  the packer needs to see order boundaries.
- The over-limit state is **visually distinct** (amber, warning glyph, explicit "OVER 5").
- It states plainly that the rule is not configured, rather than guessing. A wrong split silently
  applied is worse than a prompt.

### 6c — Once the rule is decided

The same panel gains a cycle header and a confirm control:

```
│  LAMPSHADE COLLECTION            CYCLE 1 of 2      15 / 15    │
│  … line items for cycle 1 …                                   │
│  [ Collected — start packing ]                                │
```

---

## 7. Summary

| Question | Answer |
|---|---|
| Calculate per-colour requirement | ✅ Determined — **but per SKU (size + colour), 7 line items, not 5 colours** |
| Handle the 15 limit — under | ✅ Determined — collect exactly what is required, never round up |
| Handle the 15 limit — over | 🔴 **Undefined.** 20 > 15, and even "keep orders whole" yields 12 valid answers |
| Prioritise the required colours | 🔴 **Undefined** — no rule exists, and inventing one is explicitly forbidden |
| Show the decision in the UI | ✅ Designed above — buildable for the under-limit case today |
| Make colours and quantities clear | ✅ Designed — one row per SKU, size + colour + swatch + SKU, progress against 15 |

---

## 8. What I need to proceed

1. **May a line item be split across cycles?** (`40 mm Black 6` → 3 now, 3 later?)
2. **May an order be split across cycles?**
3. **If orders stay whole, which selection rule** — fill closest to 15, or take orders in queue order
   until the next won't fit?
4. **Is the collection wave in scope for the Speech Tool**, or does it belong to the packlist system
   that already sees the whole workload?

With 1–3 answered, the panel in §6 becomes a contained addition. Question 4 decides *where* it is
built.

**Buildable now without any of them:** the under-limit case (§6a) and the SKU-level breakdown — both
fully determined by the existing rules.
