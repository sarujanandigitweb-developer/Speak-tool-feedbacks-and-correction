-- =============================================================================
-- Speak Tool — proposed order model
--
-- Supports Upgrade Proposal §4 (merge/combo orders). Written as SQL because it
-- is the clearest way to state the shape; it can be implemented either as a
-- real database (Upgrade Proposal §5 option C) or as extra derived columns in
-- the `Cleaned Data` tab (option A — recommended for now).
--
-- The point: the tool currently iterates a FLAT LIST OF ROWS. It needs to
-- iterate ORDERS THAT CONTAIN COMPONENTS. Every Theme C defect follows from
-- that one difference.
--
-- Author: Lithurshan   Date: 2026-08-13
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Stations — the six deployments. Replaces six divergent script copies with
-- one script plus per-station config (Upgrade Proposal §5, option A).
-- -----------------------------------------------------------------------------
CREATE TABLE station (
    station_id       TEXT PRIMARY KEY,          -- 'unit3-lampshade', 'kronen', ...
    display_name     TEXT NOT NULL,
    sheet_id         TEXT NOT NULL,
    locale           TEXT NOT NULL,             -- 'en-GB' | 'de-DE'
    postcode_format  TEXT NOT NULL,             -- 'UK' | 'DE'  -> drives Theme A rules
    speak_note       BOOLEAN NOT NULL DEFAULT FALSE,  -- FB-136 vs FB-077 conflict
    speak_qr         BOOLEAN NOT NULL DEFAULT TRUE,   -- FB-060, FB-070, FB-078
    default_speed    NUMERIC(3,2) NOT NULL DEFAULT 1.00  -- 1.00 / 1.25 / 1.50 (FB-121)
);


-- -----------------------------------------------------------------------------
-- Products — the two-name model. `spoken_name` is the phonetic form from the
-- Names Master Sheet; `title` is marketplace SEO text and is NEVER spoken.
-- -----------------------------------------------------------------------------
CREATE TABLE product (
    sku              TEXT PRIMARY KEY,
    title            TEXT NOT NULL,             -- displayed only
    spoken_name      TEXT,                      -- e.g. 'S T 6 4 b22 8 wats'
    image_url        TEXT,
    colour           TEXT,                      -- FB-051 'DONT TELL COLOUR'
    pack_sequence    SMALLINT NOT NULL DEFAULT 50,
                     -- FB-069, FB-080: bulb first, shade last.
                     -- 10=bulb  20=holder/cable  30=accessory  40=reducer plate
                     -- 90=shade (always last)
    CONSTRAINT spoken_name_present CHECK (spoken_name IS NOT NULL)
                     -- 6/140 rows are currently blank here -> silent orders.
                     -- Enforce it, or fall back to spelling the SKU. Never silence.
);


-- -----------------------------------------------------------------------------
-- Orders. `merge_group_id` is the fix for Theme C.
--
-- It is derived from CUSTOMER NAME + NORMALISED ADDRESS -- deliberately NOT
-- from postcode alone. Postcode fails in both directions:
--   * two customers share one postcode  -> falsely merged (FB-071 "Important",
--                                          FB-116)
--   * one customer, two postcodes       -> merge missed (FB-075)
-- -----------------------------------------------------------------------------
CREATE TABLE customer_order (
    order_id         TEXT PRIMARY KEY,
    station_id       TEXT NOT NULL REFERENCES station(station_id),
    merge_group_id   TEXT NOT NULL,             -- hash(customer_name || address_norm)
    customer_name    TEXT NOT NULL,
    address_full     TEXT NOT NULL,
    postcode         TEXT,                      -- 31/140 currently NULL (22%)
    country_code     CHAR(2) NOT NULL DEFAULT 'GB',
                     -- FB-004, FB-042: international orders were announced as UK
    selling_platform TEXT NOT NULL,
    shipping_service TEXT,                      -- Theme F: BLOCKED — not in the
                                                -- platform import yet
    customer_note    TEXT,                      -- Theme E
    instruction_qr   BOOLEAN NOT NULL DEFAULT FALSE,
    status           TEXT                       -- includes 'plz cancel this order'
);

CREATE INDEX idx_order_merge_group ON customer_order (station_id, merge_group_id);


-- -----------------------------------------------------------------------------
-- Line items. A combo is several rows sharing `combo_sku`.
-- `component_index` / `component_total` give the packer "component 2 of 3"
-- (FB-022, FB-140) instead of an unnumbered stream.
-- -----------------------------------------------------------------------------
CREATE TABLE order_line (
    line_id          BIGSERIAL PRIMARY KEY,
    order_id         TEXT NOT NULL REFERENCES customer_order(order_id),
    sku              TEXT NOT NULL REFERENCES product(sku),
    combo_sku        TEXT,                      -- 'CRSF100BM+PHSH1PBRBM+LSMS320GR'
    quantity         INTEGER NOT NULL,
    unit             TEXT NOT NULL DEFAULT 'each',
                     -- FB-031, FB-053: cables must be spoken in METRES,
                     -- not bare counts ("5" -> "5 metres")
    colour           TEXT,
    price            NUMERIC(10,2),
    component_index  SMALLINT,
    component_total  SMALLINT,
    CONSTRAINT quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_line_order ON order_line (order_id);
CREATE INDEX idx_line_combo ON order_line (combo_sku);


-- -----------------------------------------------------------------------------
-- Pronunciation rules — Theme A. This is the table that replaces per-product
-- patching. Postcodes are unbounded; they need a RULE, not a lookup. The dev
-- note on FB-001 says it exactly: "i can't do for single one, can do it for
-- every think".
-- -----------------------------------------------------------------------------
CREATE TABLE pronunciation_rule (
    rule_id          SERIAL PRIMARY KEY,
    priority         SMALLINT NOT NULL,         -- lower runs first
    pattern          TEXT NOT NULL,             -- regex
    say_as           TEXT NOT NULL,             -- 'characters' | 'digits' | 'cardinal'
                                                -- | 'unit'
    pause_ms         SMALLINT NOT NULL DEFAULT 0,
    note             TEXT
);

INSERT INTO pronunciation_rule (priority, pattern, say_as, pause_ms, note) VALUES
  (10, '^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$', 'characters', 300,
       'UK postcode. FB-040 PE11 3TY heard as "20 thousand"; FB-050 M22 9A2'),
  (10, '^\d{5}$',            'digits',     300,
       'DE postcode, Kronen/Schmutter. FB-148 leading zero dropped; FB-151 00049'),
  (20, 'IP\d{2}',            'characters',   0,
       'IP rating. FB-048, FB-138 "IP20" heard as "twenty thousand"'),
  (30, '\d+\s?[Ww]$',        'unit',         0, 'wattage'),
  (30, '\d+\s?[Vv]$',        'unit',         0, 'voltage. FB-032'),
  (30, '\d+\s?m$',           'unit',         0,
       'cable length -> "metres". FB-031, FB-053 spoke 1m for a 5m cable'),
  (90, '.*',                 'cardinal',     0, 'default');

-- Transformer utterance order is fixed by FB-157 (Kronen), and is a property of
-- the template rather than of a single token:  TYPE -> VOLTAGE -> WATTAGE
--   "I P two zero.  Twelve volt.  One hundred and fifty watts."


-- -----------------------------------------------------------------------------
-- The speak queue. THIS is what the tool should iterate -- one row per PARCEL,
-- with components nested, postcode LAST and said ONCE (FB-064, FB-140).
-- -----------------------------------------------------------------------------
CREATE VIEW speak_queue AS
SELECT
    o.station_id,
    o.merge_group_id,
    COUNT(DISTINCT o.order_id)          AS orders_in_group,
    COUNT(l.line_id)                    AS component_total,
    COUNT(DISTINCT o.order_id) > 1      AS is_merge_order,
    MAX(o.postcode)                     AS postcode,
    MAX(o.customer_name)                AS customer_name,
    BOOL_OR(o.instruction_qr)           AS instruction_qr,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'sku',        l.sku,
            'spoken',     p.spoken_name,
            'quantity',   l.quantity,
            'unit',       l.unit,
            'colour',     COALESCE(l.colour, p.colour),
            'image',      p.image_url
        )
        ORDER BY p.pack_sequence, l.sku      -- bulb first, shade last
    )                                   AS components
FROM customer_order o
JOIN order_line     l ON l.order_id = o.order_id
JOIN product        p ON p.sku      = l.sku
WHERE COALESCE(o.status, '') NOT ILIKE '%cancel%'
GROUP BY o.station_id, o.merge_group_id;


-- -----------------------------------------------------------------------------
-- Pre-flight validation. Run before the session starts; show the packer what is
-- broken rather than speaking a half-order. Silence is the worst failure mode --
-- the packer cannot tell "nothing to say" from "tool broke". Every Theme D
-- ticket is a silent field.
-- -----------------------------------------------------------------------------
CREATE VIEW preflight_errors AS
SELECT o.order_id, 'missing_postcode'    AS problem  -- 31/140 today (22%)
  FROM customer_order o WHERE o.postcode IS NULL
UNION ALL
SELECT o.order_id, 'missing_spoken_name'             -- 6/140 today
  FROM customer_order o
  JOIN order_line l ON l.order_id = o.order_id
  JOIN product    p ON p.sku = l.sku
 WHERE p.spoken_name IS NULL
UNION ALL
SELECT o.order_id, 'merge_group_postcode_mismatch'   -- FB-075
  FROM customer_order o
 GROUP BY o.order_id, o.merge_group_id
HAVING COUNT(DISTINCT o.postcode) > 1;


-- -----------------------------------------------------------------------------
-- Feedback register — Upgrade Proposal §6. The `Ref` column exists on every
-- station tab and is EMPTY on all 160 rows, so nothing can be closed and a
-- repeat cannot be told from a new report.
--
-- Note `resolution`: "False" in the sheet currently means BOTH "not done yet"
-- AND "refused". That ambiguity is why items keep being re-reported.
-- -----------------------------------------------------------------------------
CREATE TABLE feedback (
    ref              TEXT PRIMARY KEY,          -- 'FB-001'
    station_id       TEXT NOT NULL REFERENCES station(station_id),
    reported_on      DATE,
    reporter         TEXT,
    issue            TEXT NOT NULL,
    theme            CHAR(1),                   -- A..H, see open-defects.md
    resolution       TEXT NOT NULL DEFAULT 'open'
                     CHECK (resolution IN ('open','in_progress','fixed',
                                           'wont_fix','blocked_upstream')),
    fixed_in_version TEXT,                      -- which script version, which station
    verified_by      TEXT,                      -- the step that is missing today
    dev_note         TEXT
);
