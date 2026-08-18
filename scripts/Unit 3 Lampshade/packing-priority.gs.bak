/**
 * Unit 3 Lampshade — product classification, colour, and packing priority.
 *
 * Self-contained. Defines no function that already exists elsewhere in the project,
 * so it cannot collide with cleaned.gs / clean-1.gs.
 *
 * Classification rules were derived empirically from the shared names master sheet
 * (16rx5Dz…, tab "names", 16,228 rows / 5,548 distinct SKUs) — not assumed.
 * See capability/unit3-packing-priority-report.md for the evidence.
 */

// ---------------------------------------------------------------------------
// Product type
// ---------------------------------------------------------------------------
// Order of tests matters. "ceiling rose" is checked FIRST because some
// LS-prefixed SKUs are ceiling roses, not lampshades — e.g.
//   LSWD360BG = "360 Black gold inner celing rose"
// Testing the LS prefix first would misclassify it as a lampshade.
//
// Spelling variants in the live data (counted across the names master):
//   "Retangle"    28   <- the actual spelling used for rectangle ceiling roses
//   "Rectangular"  5   (children's covers + one chandelier — NOT roses)
//   "Rectangle"    0
//   "celing"      12   <- missing "i"
//   "ceiling"    316
var PP_RE_ROSE  = /c[ei]+l[ei]*ng\s*rose/i;
var PP_RE_RECT  = /re[c]?tangle|rectangular/i;
var PP_RE_BULB  = /\bbulbs?\b|\bwats?\b|\bwatts?\b/i;
var PP_RE_SHADE = /shade|chandelier|dome|curvy|cone|umbrella|kuduvai|tattai|hemp|cage/i;

// Accessory guard. Without it the shade keywords over-match by ~10%:
//   SCRN70BM   "Shade Ring Black"              <- accessory, matched "shade"
//   PCDO20BM   "conduit dome cover Black"      <- accessory, matched "dome"
//   PHHR1HETHE "1 Meter hemp holder Hemp"      <- accessory, matched "hemp"
// Measured effect: removes 82 of 759 from the shade bucket, of which exactly ONE
// is LS-prefixed (LSF1HT300HE, a full-set kit rather than a bare shade).
var PP_RE_ACCESSORY = /\bring\b|\bholder\b|\bgrip\b|\breducer\b|\badapter\b|\bplate\b|\bcover\b|\bcarrier\b|\bconduit\b|\bfull\s*set\b/i;

/**
 * @return {'SHADE'|'RECT_ROSE'|'ROSE'|'BULB'|'OTHER'}
 */
function ppProductType(sku, name) {
  var s = String(sku || '').toUpperCase();
  var n = String(name || '');

  if (PP_RE_ROSE.test(n)) {
    return PP_RE_RECT.test(n) ? 'RECT_ROSE' : 'ROSE';
  }
  if (PP_RE_BULB.test(n) && s.indexOf('LD') === 0) return 'BULB';

  // LS PREFIX = LAMPSHADE. Ruled by the business 2026-08-17: "everything that
  // starts with LS is a lampshade, so we collect it".
  //
  // The name is NOT consulted. It used to also require a shade keyword
  // (shade|dome|cage|…) in the spoken name, which failed whenever the names
  // sheet held a short or missing name. Measured on the live sheet: 16 rows of
  // 156 were mis-filed as OTHER despite an LS prefix —
  //     LSGG200AR     "amber Amber"          (no keyword)
  //     LSSS300NB     "varn shot Navy blue"  (no keyword)
  //     LSGL10014AR   ""                     (no name at all)
  // They were spoken in the wrong position and, worse, never entered a lampshade
  // collection. Against the Lampshade SOT's 451 SKUs the prefix rule now scores
  // 451/451; the old keyword rule missed 9 of the SKUs present in these orders.
  //
  // Ordering still matters. The ceiling-rose test above runs FIRST, so an
  // LS-prefixed rose such as LSWD360BG ("360 Black gold inner celing rose")
  // is still a ROSE, not a shade.
  //
  // Ruled 2026-08-14 and still true: the WC* wire cages (WCDCBM "diamand cage",
  // WCBNRR "ballon cage", WCCYSP160GD "Glass Lamp Cage") are NOT lampshades.
  // They only ever matched on the word "cage", and they carry no LS prefix, so
  // this rule excludes them by construction.
  if (s.indexOf('LS') === 0) return 'SHADE';

  if (s.indexOf('LD') === 0) return 'BULB';   // bulbs whose name omits "bulb"/"wats"
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Colour — from the SKU suffix
// ---------------------------------------------------------------------------
// SKU grammar (confirmed against the names master):
//     PREFIX + SIZE(mm) + [outlet count] + COLOUR CODE
//     CRFF   + 500      + 3              + SN  -> "500 millimeter 3 out let Retangle ceiling rose Satin Nickel"
//
// The trailing 2-letter code maps to a colour with 93–100% consistency across
// thousands of rows. This is MORE reliable than Sheet1's "Combo Color" column,
// which is 100/169 populated and contaminated with values like
// "MAPPED FOR ICST64E27".
var PP_COLOUR_CODES = {
  BM: 'Black',          BY: 'Shiny Black',   BA: 'Matt Black',
  WH: 'White',          YE: 'Yellow',        GR: 'Green',
  BL: 'Blue',           BD: 'Dark Blue',     CB: 'Cyan Blue',
  GY: 'Grey',           PI: 'Pink',          OR: 'Orange',
  RE: 'Red',            RR: 'Rustic Red',    BU: 'Burgandy',
  CO: 'Copper',         BC: 'Brushed Copper',
  CH: 'Chrome',         SN: 'Satin Nickel',
  YB: 'Yellow Brass',   GB: 'Green Brass',   BB: 'Brushed Brass',
  BS: 'Brushed Silver', FG: 'French Gold',   RO: 'Rose Gold',
  GD: 'Gold',           GL: 'Light Gold',    BG: 'Black Gold Inner',
  HE: 'Hemp'
};

/**
 * Colour from the SKU suffix alone. FALLBACK ONLY — ppProductColour() asks the
 * Lampshade SOT first. Kept because the SOT covers lampshades only: ceiling
 * roses, bulbs and accessories still resolve through this table.
 *
 * @return {string} colour name, or "" when the suffix is not a known colour code.
 *
 * NOTE — this strips /\d*A?PK$/ while ppProductSize() strips only /APK$/.
 * That difference is deliberate. The colour code sits BEFORE the pack suffix
 * (LSFT220BG5PK -> LSFT220BG -> "BG"), so a greedy strip is safe and helpful
 * here. For the SIZE the same greedy strip would eat the size digits
 * (LSFT2205PK -> LSFT), which is why that function is deliberately narrower.
 */
function ppColourFromSku(sku) {
  var s = String(sku || '').toUpperCase().replace(/\d*A?PK$/, '');
  var m = s.match(/([A-Z]{2,3})$/);
  if (!m) return '';
  return PP_COLOUR_CODES[m[1].slice(-2)] || '';
}

// ---------------------------------------------------------------------------
// Lampshade SOT — the colour authority
// ---------------------------------------------------------------------------
// https://docs.google.com/spreadsheets/d/1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI
// Tab holding SKU_ID in header row 2 (gid 1477049419 at the time of writing).
//
// Why the SOT rather than the 29-code suffix table, measured over its 452 SKUs:
//
//   suffix table gives no colour at all   111 / 452   (25%)  -> shown as "?"
//   suffix table disagrees with the SOT    26 / 452
//
// The 111 gaps are real colours the table simply never listed — AR (26 SKUs,
// "Amber / Warm Tone"), BI (13, "Black Glossy"), NB (10, "Navy Blue"),
// CL (9, "Clear / Transparent") and 28 more codes. Every one is filled in the
// SOT, so wiring it removes the "Colour: ?" cards entirely.
//
// KNOWN SOT DATA FAULT — 6 SKUs contradict THEIR OWN Product_Name:
//   LSCYRO120GD / 200GD / 300GD  name "Metal Drum Lampshade – Gold"   outer "Black Matt"
//   LSCYRO120WH / 200WH / 300WH  name "Metal Drum Lampshade – White"  outer "Black Matt"
// For these the SKU suffix agrees with the product name, so the Outer_Colour
// cell is what is wrong. They are listed in PP_SOT_OVERRIDE below and reported
// for correction at source. Do not extend that list by guessing — add a SKU
// only when the SOT's own name proves the colour cell wrong.
var PP_SOT_ID = '1b9n4RhyIEuEyRRQIkfmVlsqc7uazQiqqQXCZKKPwpSI';

// SKUs whose SOT Outer_Colour is demonstrably wrong (contradicted by the SOT's
// own Product_Name). Verified 2026-08-17.
var PP_SOT_OVERRIDE = {
  LSCYRO120GD: 'Gold',  LSCYRO200GD: 'Gold',  LSCYRO300GD: 'Gold',
  LSCYRO120WH: 'White', LSCYRO200WH: 'White', LSCYRO300WH: 'White'
};

var PP_SOT_CACHE = null;   // { SKU: {colour, family, size, img} }

/**
 * Loads the SOT once per execution. Returns {} and logs if it cannot be reached,
 * so a network or permission failure degrades to the suffix table rather than
 * breaking the run.
 */
function ppLoadSot() {
  if (PP_SOT_CACHE) return PP_SOT_CACHE;
  var map = {};
  try {
    var sheets = SpreadsheetApp.openById(PP_SOT_ID).getSheets();
    var sh = null, hdr = null;
    for (var i = 0; i < sheets.length; i++) {
      // Row 1 holds section banners (IDENTITY, PHYSICAL, ...); row 2 the real headers.
      var probe = sheets[i].getRange(2, 1, 1, sheets[i].getLastColumn()).getValues()[0];
      if (probe.indexOf('SKU_ID') !== -1) { sh = sheets[i]; hdr = probe; break; }
    }
    if (sh) {
      var iSku = hdr.indexOf('SKU_ID'),
          iFam = hdr.indexOf('Colour_Family'),
          iOut = hdr.indexOf('Outer_Colour'),
          iDia = hdr.indexOf('Diameter_mm'),
          iImg = hdr.indexOf('IMG_LINK');
      // Read only as far as the last column we need — the sheet is ~180 wide and
      // pulling all of it would move six times the cells for nothing.
      var width = Math.max(iSku, iFam, iOut, iDia, iImg) + 1;
      var n = sh.getLastRow() - 2;                       // data starts at row 3
      if (n > 0 && width > 0) {
        var vals = sh.getRange(3, 1, n, width).getValues();
        for (var r = 0; r < vals.length; r++) {
          var sku = String(vals[r][iSku] || '').trim().toUpperCase();
          // Skip the description row and the "◀ Metal Lampshades ▸" section banners.
          if (!sku || sku.indexOf(' ') !== -1) continue;
          var fam = iFam >= 0 ? String(vals[r][iFam] || '').trim() : '';
          var out = iOut >= 0 ? String(vals[r][iOut] || '').trim() : '';
          if (!fam && !out) continue;
          if (out.indexOf('[VERIFY]') !== -1) out = '';
          if (fam.indexOf('[VERIFY]') !== -1) fam = '';
          map[sku] = {
            colour: PP_SOT_OVERRIDE[sku] || out || fam,
            family: fam,
            size:   iDia >= 0 ? String(vals[r][iDia] || '').trim() : '',
            img:    iImg >= 0 ? String(vals[r][iImg] || '').trim() : ''
          };
        }
      }
    }
    Logger.log('Lampshade SOT loaded: ' + Object.keys(map).length + ' SKUs');
  } catch (e) {
    Logger.log('Lampshade SOT unavailable, falling back to the SKU suffix table: ' + e);
  }
  PP_SOT_CACHE = map;
  return map;
}

/**
 * Colour for a SKU. The SOT wins; the suffix table covers everything the SOT
 * does not carry (ceiling roses, bulbs, accessories).
 *
 * @return {string} colour name, or "" when neither source knows it.
 */
function ppProductColour(sku) {
  var key = String(sku || '').trim().toUpperCase();
  var hit = ppLoadSot()[key];
  if (hit && hit.colour) return hit.colour;
  return ppColourFromSku(sku);
}

/** Product image from the SOT, or "" — used to illustrate collection cards. */
function ppProductImage(sku) {
  var hit = ppLoadSot()[String(sku || '').trim().toUpperCase()];
  return hit && hit.img ? hit.img : '';
}

// ---------------------------------------------------------------------------
// Packing priority
// ---------------------------------------------------------------------------
// Rule supplied 2026-08-14. The priority is CONDITIONAL: which ranking applies
// depends on whether the order contains a Rectangle Ceiling Rose.
//
//   1. Rectangle Ceiling Rose PRESENT:
//        Rectangle Ceiling Rose -> Lampshade -> Bulb -> Other
//      A plain ceiling rose is not called out here, so it packs with "Other".
//
//   2. Rectangle Ceiling Rose ABSENT:
//        Lampshade -> other Ceiling Rose -> Bulb -> Other
//
//   3. Neither applies -> normal packing order, untouched.
//
// Rule 3 needs no branch. When an order holds none of these categories every row
// ranks the same, and a stable sort leaves the existing sequence exactly as it is.
//
// This REPLACES the earlier single fixed ranking, in which a plain ceiling rose
// always sat with "Other". It now rises to second place, but only in orders that
// have no Rectangle Ceiling Rose to outrank it.
var PP_RANK_WITH_RECT = { RECT_ROSE: 1, SHADE: 2, BULB: 3, ROSE: 4, OTHER: 4 };
var PP_RANK_NO_RECT   = { SHADE: 1, ROSE: 2, BULB: 3, OTHER: 4 };

/**
 * @param {string} type      one of SHADE / RECT_ROSE / ROSE / BULB / OTHER
 * @param {boolean} hasRect  does THIS order contain a Rectangle Ceiling Rose?
 */
function ppRank(type, hasRect) {
  var map = hasRect ? PP_RANK_WITH_RECT : PP_RANK_NO_RECT;
  return map[type] || 4;
}

/**
 * Reorders `rows` IN PLACE so that, within each contiguous run of rows sharing the
 * same customer, products follow the required packing priority.
 *
 * Rows are never moved across customers — order/customer identity is preserved
 * exactly as the existing pipeline established it (brief §9, §26).
 *
 * ---------------------------------------------------------------------------
 * DETERMINED RULE — an order with NO lampshade is packed immediately.
 * ---------------------------------------------------------------------------
 * Question: when the tool reaches an order that contains no lampshade, should it
 * look ahead at later orders to find lampshades, or pack this order now?
 *
 * Answer: PACK IT NOW. Do not look ahead. This is not a preference — it follows
 * from the existing rules:
 *
 *   1. The priority matrix is defined PER ORDER, and already has an explicit row
 *      for "no Lampshade, no Rose, no Bulb -> existing normal packing order".
 *      A row for the absent-lampshade case would not exist if the answer were to
 *      defer the order.
 *   2. Products from different customers must never be combined (§9, §26).
 *      Pulling a lampshade forward out of order 3 to pack with order 1 is exactly
 *      that prohibited combination.
 *   3. Priority decides the SEQUENCE OF PRODUCTS INSIDE ONE ORDER. It does not
 *      decide the sequence of orders. Nothing in the rules reorders the queue.
 *
 * So for an order without a lampshade, the same matrix simply starts at the
 * highest-ranked type that IS present:
 *
 *   Rect Rose + Bulb + Other  ->  Rose, Bulb, Other
 *   Bulb + Other              ->  Bulb, Other
 *   Other only                ->  unchanged (stable sort is a no-op)
 *
 * Separately: the 15-unit LAMPSHADE COLLECTION is a different concept — gathering
 * shades across a workload in one trip to the shelf. It changes how many shades
 * the packer carries, NOT which order is packed first. It is implemented at the
 * foot of this file as ppBuildPackingWorkflow().
 *
 * DO NOT add cross-order look-ahead here. It would breach §9/§26.
 *
 * @param {Array<Array>} rows          output rows, WITHOUT the header
 * @param {number} customerIdx         column index of "Customer Info"
 * @param {number} postcodeIdx         column index of "Post Code"
 * @param {number} typeIdx             column index of "Product Type"
 * @return {number} how many rows changed position
 */
function ppApplyPackingPriority(rows, customerIdx, postcodeIdx, typeIdx) {
  if (!rows || !rows.length || typeIdx < 0 || customerIdx < 0) return 0;

  var moved = 0;
  var start = 0;

  function keyOf(r) {
    var cust = (r[customerIdx] == null ? '' : String(r[customerIdx])).trim();
    var post = (postcodeIdx >= 0 && r[postcodeIdx] != null) ? String(r[postcodeIdx]).trim() : '';
    return cust + '|' + post;
  }

  for (var i = 1; i <= rows.length; i++) {
    if (i < rows.length && keyOf(rows[i]) === keyOf(rows[start])) continue;

    if (i - start > 1) {
      var slice = rows.slice(start, i);

      // Which ranking applies is decided PER ORDER, before sorting it: does this
      // order contain a Rectangle Ceiling Rose? Scanning the whole block first
      // matters because the deciding row can sit anywhere in the order, not just
      // at the top.
      var hasRect = false;
      for (var h = 0; h < slice.length; h++) {
        if (slice[h][typeIdx] === 'RECT_ROSE') { hasRect = true; break; }
      }

      // decorate–sort–undecorate keeps the sort stable on older V8 builds
      var decorated = slice.map(function (r, idx) {
        return { row: r, idx: idx, rank: ppRank(r[typeIdx], hasRect) };
      });
      decorated.sort(function (a, b) {
        return a.rank - b.rank || a.idx - b.idx;
      });
      for (var k = 0; k < decorated.length; k++) {
        if (decorated[k].idx !== k) moved++;
        rows[start + k] = decorated[k].row;
      }
    }
    start = i;
  }
  return moved;
}

/**
 * Applies the packing priority to the "Cleaned Data" sheet in place.
 *
 * This runs as the LAST step of mergeAndCleanSheets(), after addCombinedSKUSet().
 * Sorting earlier corrupts combos: addCombinedSKUSet() rebuilds "Combo SKU" by
 * finding a "Combo: 1" row and absorbing the "Combo: 2", "Combo: 3" … rows that
 * follow it, so it needs the components in their original sequence. Reordering
 * them first split single customer orders into two.
 *
 * @param {Sheet} sheet  the "Cleaned Data" sheet
 * @return {number} how many rows changed position
 */
function ppSortCleanedSheetRows(sheet) {
  var lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 3) return 0;                       // header + at least two rows

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var custIdx = headers.indexOf('Customer Info');
  var typeIdx = headers.indexOf('Product Type');
  if (custIdx === -1 || typeIdx === -1) {
    Logger.log('Packing priority skipped: Customer Info or Product Type column missing.');
    return 0;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Post Code is deliberately NOT part of the order key here (-1 is passed).
  // By this point removeRPR44WHAndTransferPostCode() has already left the
  // postcode on one row of each order and blanked it on the rest, so keying on
  // it would cut a single order into several one-row blocks and the sort would
  // do nothing. Customer Info alone is the order identity at this stage.
  var moved = ppApplyPackingPriority(rows, custIdx, -1, typeIdx);
  if (moved) sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);
  return moved;
}

// ===========================================================================
// LAMPSHADE COLLECTION — size first, then colour and quantity
// ===========================================================================
// Allocation rule supplied by the business 2026-08-14:
//
//   1. Identify the FIRST lampshade size that appears in the orders.
//   2. Collect up to 15 lampshades of that same size.
//   3. Within a size, collect only the colours and quantities the orders require.
//   4. Do not mix sizes in one batch if 15 of the current size are available.
//   5. If fewer than 15 are required for that size, collect only what is required
//      (never round up to 15, never take stock the orders do not need).
//   6. If that size cannot fill 15, move to the next size and keep filling.
//   7. Keep colour and quantity separate within each size.
//
// Rules 5 and 6 both apply when a size totals under 15. They are consistent when
// read as: R5 caps how much of a size you take (the requirement), R6 says keep
// filling the batch from the next size. Implemented that way.
//
// Rule 4 needs no special case — it falls out of filling in size order. If the
// first size can supply 15, it fills the batch on its own and no mixing occurs.
// ===========================================================================

var PP_MAX_LAMPSHADE_COLLECTION = 15;

// true  -> a line that straddles the 15 boundary is split (batch fills to exactly 15)
// false -> the whole line moves to the next batch (batch may close below 15)
//
// SET TO false — decided 2026-08-14 from a run against the live Unit 3 orders
// (30 lampshade lines, 51 units, 30 orders):
//
//   mode     batches  split lines  split orders  batch sizes
//   true        4          1            1        [15, 15, 15, 6]
//   false       4          0            0        [15, 15, 12, 9]
//
// Both need the SAME number of trips. Splitting buys nothing: it does not reduce
// the trip count, it only makes one order arrive across two trips, so that order
// cannot be packed until the second trip returns. A batch closing at 12 instead
// of 15 costs nothing operationally.
var PP_ALLOW_LINE_SPLIT = false;

/**
 * Size token from a SKU — the first digit run after the leading letters.
 *   LSFT220BB   -> "220"     LSDO400YE   -> "400"
 *   LSCYRO120GD -> "120"     LSTF40BM    -> "40"
 *
 * Grouping is by this token alone, so a 210 Dome and a 210 Curvy count as the
 * same size — matching the wording "15 lampshades of that same size". If shape
 * family must also separate them, add it to the key here.
 *
 * LIMITATION — numeric pack suffixes are NOT stripped.
 * "LSFT2205PK" is genuinely ambiguous: it reads as either 220 + 5-pack or
 * 2205 + pack, and nothing in the SKU distinguishes them. Guessing would
 * silently mis-group a whole size.
 * This is safe today: the Lampshade SOT (451 SKUs) contains NO multi-pack
 * lampshade SKUs, and none appear in the Unit 3 order data. Only the
 * unambiguous "APK" form is stripped. If numeric pack SKUs are ever introduced
 * for lampshades, this function needs a pack-size list to disambiguate.
 */
function ppProductSize(sku) {
  var s = String(sku || '').toUpperCase().replace(/APK$/, '');
  var m = s.match(/^[A-Z]+(\d+)/);
  return m ? m[1] : '';
}

// ===========================================================================
// PACKING WORKFLOW — just-in-time lampshade collection
// ===========================================================================
// Rule supplied 2026-08-14:
//
//   * Process orders in queue sequence.
//   * Orders with no lampshade are packed normally.
//   * When an order needs lampshades AND the already-collected pool cannot
//     cover it, TRIGGER a collection at that moment.
//   * The collection looks FORWARD from the triggering order and takes up to 15
//     lampshades from that order and the ones after it.
//   * Following orders are packed from that pool without a new trigger.
//   * When the pool can no longer cover an order, trigger the next collection.
//   * Never collect everything up front.
//
// "Insufficient" is checked PER SKU, not on the total: holding 15 of the wrong
// shade does not let you pack an order that needs a different one.
// ===========================================================================

/**
 * @param {Array<{order, lines:Array<{sku,size,colour,qty,type}>}>} orders  queue sequence
 * @param {number} [maxPerBatch]  defaults to PP_MAX_LAMPSHADE_COLLECTION
 * @return {Array<{seq,order,action,collection,uses}>}
 *   action: 'PACK'                 - no lampshade, pack normally
 *           'PACK_FROM_COLLECTED'  - lampshade taken from the existing pool
 *           'COLLECT_THEN_PACK'    - a collection was triggered at this order
 */
function ppBuildPackingWorkflow(orders, maxPerBatch) {
  var max = maxPerBatch || PP_MAX_LAMPSHADE_COLLECTION;
  var steps = [], pool = {}, batchNo = 0;

  function shadeLines(o) {
    var out = [];
    for (var i = 0; i < o.lines.length; i++) {
      var l = o.lines[i];
      if (l.type === 'SHADE' && (parseFloat(l.qty) || 0) > 0) out.push(l);
    }
    return out;
  }
  function needOf(o) {
    var n = {}, ls = shadeLines(o);
    for (var i = 0; i < ls.length; i++) n[ls[i].sku] = (n[ls[i].sku] || 0) + (parseFloat(ls[i].qty) || 0);
    return n;
  }
  function covered(need) {
    for (var k in need) if ((pool[k] || 0) < need[k]) return false;
    return true;
  }
  function groupLines(lines) {
    var order = [], map = {};
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], key = ln.size + '|' + ln.colour;
      if (!map[key]) { map[key] = { size: ln.size, colour: ln.colour, qty: 0, skus: [], orders: [] }; order.push(key); }
      map[key].qty += ln.qty;
      if (map[key].skus.indexOf(ln.sku) === -1) map[key].skus.push(ln.sku);
      if (ln.order && map[key].orders.indexOf(ln.order) === -1) map[key].orders.push(ln.order);
    }
    return order.map(function (k) { return map[k]; });
  }

  for (var oi = 0; oi < orders.length; oi++) {
    var o = orders[oi];

    if (!shadeLines(o).length) {
      steps.push({ seq: steps.length + 1, order: o.order, action: 'PACK', collection: null, uses: null });
      continue;
    }

    var need = needOf(o), collection = null;

    if (!covered(need)) {
      batchNo++;
      collection = { batch: batchNo, total: 0, lines: [], groups: [], triggeredBy: o.order, overflow: false };

      // Fill forward from THIS order, in queue sequence, whole lines only.
      //
      // The TRIGGERING order is always completed, even if that pushes past 15.
      // Stopping mid-order would leave it un-packable: the pool would not cover
      // its own trigger, and the packer would be sent to the shelf without
      // everything that order needs. Exceeding the limit is flagged, not hidden.
      for (var fi = oi; fi < orders.length; fi++) {
        var ls = shadeLines(orders[fi]), stop = false;
        var isTrigger = (fi === oi);
        for (var li = 0; li < ls.length; li++) {
          var l = ls[li], q = parseFloat(l.qty) || 0;
          if (collection.total + q > max) {
            if (isTrigger) {
              collection.overflow = true;      // must finish the triggering order
            } else { stop = true; break; }
          }
          collection.lines.push({ sku: l.sku, size: l.size, colour: l.colour, qty: q, order: orders[fi].order });
          collection.total += q;
          pool[l.sku] = (pool[l.sku] || 0) + q;
        }
        if (stop) break;
      }
      collection.groups = groupLines(collection.lines);
      collection.isFull = (collection.total >= max);
    }

    for (var k in need) pool[k] = (pool[k] || 0) - need[k];

    steps.push({
      seq: steps.length + 1,
      order: o.order,
      action: collection ? 'COLLECT_THEN_PACK' : 'PACK_FROM_COLLECTED',
      collection: collection,
      uses: need
    });
  }
  return steps;
}

/** Render the workflow as the packer would experience it. */
function ppFormatWorkflow(steps) {
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    if (s.action === 'PACK') {
      out.push('Order ' + s.seq + '  [' + s.order + ']  no lampshade -> pack normally');
    } else if (s.action === 'PACK_FROM_COLLECTED') {
      out.push('Order ' + s.seq + '  [' + s.order + ']  lampshade -> use already-collected stock');
    } else {
      var c = s.collection;
      out.push('Order ' + s.seq + '  [' + s.order + ']  LAMPSHADE REQUIRED - COLLECTION ' + c.batch +
               '  (' + c.total + '/' + PP_MAX_LAMPSHADE_COLLECTION + (c.isFull ? ' FULL' : '') + ')' +
               (c.overflow ? '  ** single order exceeds the limit **' : ''));
      out.push('     collect, combined by size + colour:');
      for (var q = 0; q < c.groups.length; q++) {
        var gp = c.groups[q];
        out.push('        ' + gp.size + ' - ' + (gp.colour || '?') + ' - ' + gp.qty +
                 '   for ' + gp.orders.join(', '));
      }
    }
  }
  return out.join('\n');
}

/**
 * Wiring helper — run the just-in-time collection over the cleaned rows and stamp
 * the result into the "Lampshade Collection" column.
 *
 * Orders are keyed on Customer Info + Post Code and kept in first-appearance
 * order, which is the sequence the Speak Tool queues them in. The collection
 * text is written on the FIRST row of the order that triggered it, so the packer
 * sees it before that order is processed.
 *
 * Touches only the "Lampshade Collection" column. No other column, and no other
 * function's behaviour, is affected.
 *
 * @param {Array<Array>} rows      output rows WITHOUT the header
 * @param {Array<string>} headers  outputHeaders
 * @return {number} how many collections were triggered
 */
/**
 * Voice rendering of a collection. Kept separate from the on-screen text: the
 * display carries SKUs and brackets, which do not speak well. The packer hears
 * size, colour and quantity; the SKU stays on screen.
 */
function ppCollectionSpeech(c) {
  var out = ['Collect lampshades first.',
             'Collection ' + c.batch + '.',
             c.total + ' lampshade' + (c.total === 1 ? '' : 's') + '.'];
  for (var i = 0; i < c.groups.length; i++) {
    var g = c.groups[i];
    out.push((g.size ? g.size + ' millimeter' : 'size unknown') + '. ' +
             (g.colour || 'colour unknown') + '. ' + g.qty + '.');
  }
  out.push('Then pack this order.');
  return out.join(' ');
}

function ppStampCollections(rows, headers) {
  var iSku  = headers.indexOf('SKU');
  var iQty  = headers.indexOf('Quantity');
  var iType = headers.indexOf('Product Type');
  var iCol  = headers.indexOf('Colour');
  var iCust = headers.indexOf('Customer Info');
  var iPost = headers.indexOf('Post Code');
  var iOut  = headers.indexOf('Lampshade Collection');
  var iSay  = headers.indexOf('Lampshade Collection Speech');
  if (iSku < 0 || iType < 0 || iOut < 0) return 0;

  // ---- group rows into orders, preserving first-appearance sequence
  var orders = [], byKey = {};
  for (var r = 0; r < rows.length; r++) {
    var cust = iCust >= 0 && rows[r][iCust] != null ? String(rows[r][iCust]).trim() : '';
    var post = iPost >= 0 && rows[r][iPost] != null ? String(rows[r][iPost]).trim() : '';
    var key  = cust + '|' + post;
    if (!byKey[key]) {
      byKey[key] = { order: post || cust.substring(0, 18) || ('row' + (r + 1)), lines: [], firstRow: r };
      orders.push(byKey[key]);
    }
    var sku = rows[r][iSku] != null ? String(rows[r][iSku]).trim() : '';
    byKey[key].lines.push({
      sku:    sku,
      size:   ppProductSize(sku),
      colour: iCol >= 0 && rows[r][iCol] != null ? String(rows[r][iCol]).trim() : '',
      qty:    rows[r][iQty],
      type:   rows[r][iType]
    });
  }

  var steps = ppBuildPackingWorkflow(orders);
  var triggered = 0;

  for (var s = 0; s < steps.length; s++) {
    var st = steps[s];
    if (st.action !== 'COLLECT_THEN_PACK' || !st.collection) continue;
    triggered++;

    var c = st.collection;
    // Structured, machine-readable. Lithursan.gs renders this as its OWN
    // collection-only view - it is never merged into the customer order card.
    //   BATCH|<n>|<total>|<max>
    //   ITEM|<skus>|<size>|<colour>|<qty>|<orders>
    var lines = ['BATCH|' + c.batch + '|' + c.total + '|' + PP_MAX_LAMPSHADE_COLLECTION +
                 (c.overflow ? '|OVERFLOW' : '')];
    for (var gi = 0; gi < c.groups.length; gi++) {
      var gp = c.groups[gi];
      lines.push('ITEM|' + gp.skus.join(' + ') + '|' + (gp.size ? gp.size + 'mm' : '?') +
                 '|' + (gp.colour || '?') + '|' + gp.qty + '|' + gp.orders.join(', '));
    }
    rows[orders[s].firstRow][iOut] = lines.join('\n');
    if (iSay >= 0) rows[orders[s].firstRow][iSay] = ppCollectionSpeech(c);
  }
  return triggered;
}
