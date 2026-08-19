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
/**
 * Column index for the first header matching any of `names`. Exact match wins
 * over a substring match, so "Width_mm" is preferred to "Overall Width".
 * Returns -1 when the sheet carries none of them.
 */
function ppFindHeader(hdr, names) {
  var i, h;
  for (var a = 0; a < names.length; a++) {
    for (i = 0; i < hdr.length; i++) {
      h = String(hdr[i] || '').trim().toLowerCase().replace(/[\s()]+/g, '_');
      if (h === names[a]) return i;
    }
  }
  for (var b = 0; b < names.length; b++) {
    for (i = 0; i < hdr.length; i++) {
      h = String(hdr[i] || '').trim().toLowerCase();
      if (h.indexOf(names[b].replace('_mm', '')) !== -1) return i;
    }
  }
  return -1;
}

/**
 * A measurement cell as a plain number string. The SOT writes "-", "N/A" and
 * blanks for a dimension that does not apply, and those must not reach the
 * packer as a size.
 */
function ppSotNum(v) {
  var t = String(v == null ? '' : v).trim();
  if (!t || t === '-' || t.toUpperCase() === 'N/A') return '';
  var m = t.match(/[0-9]+(?:\.[0-9]+)?/);
  return m ? m[0] : '';
}

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
      // Height and Width are looked up by pattern rather than by an exact name.
      // The SOT keeps them SEPARATE from Diameter_mm, and the exact header
      // spelling is the sheet owner's to change; a missing column just leaves
      // the value blank instead of breaking the load.
      var iHt = ppFindHeader(hdr, ['height_mm', 'height']),
          iWd = ppFindHeader(hdr, ['width_mm', 'width']);
      // Read only as far as the last column we need — the sheet is ~180 wide and
      // pulling all of it would move six times the cells for nothing.
      var width = Math.max(iSku, iFam, iOut, iDia, iImg, iHt, iWd) + 1;
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
            size:   ppSotNum(iDia >= 0 ? vals[r][iDia] : ''),
            height: ppSotNum(iHt  >= 0 ? vals[r][iHt]  : ''),
            width:  ppSotNum(iWd  >= 0 ? vals[r][iWd]  : ''),
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
// Restated by the business 2026-08-19, unchanged since 2026-08-14. Bulb is
// THIRD, ahead of Other. What changed is TYPE 3 below: an order with neither a
// lampshade nor a ceiling rose is no longer ranked at all.
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
      var hasRect = false, hasAnchor = false;
      for (var h = 0; h < slice.length; h++) {
        var ty = slice[h][typeIdx];
        if (ty === 'RECT_ROSE') { hasRect = true; hasAnchor = true; }
        else if (ty === 'SHADE' || ty === 'ROSE') { hasAnchor = true; }
      }

      // TYPE 3: "if there is no Lampshade and no Ceiling Rose, do not apply any
      // filter - speak in the exact order the items appear in the order." There
      // is nothing to rank against, so the source sequence stands, whether that
      // is Holder-Bulb-Other or Bulb-Holder-Other. Confirmed 2026-08-19.
      if (!hasAnchor) { start = i; continue; }

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
// LAMPSHADE COLLECTION
// ===========================================================================
// Rule supplied by the business 2026-08-18. This REPLACES the earlier rule,
// which treated EVERY LS-prefixed product as collectible and scanned the whole
// pack list for all of them.
//
// A lampshade is collected only when its SKU starts with one of the prefixes
// below. There are two lists and they scan differently:
//
//   LIST 1 - "order run"        Collect across the run of CONSECUTIVE orders
//                               that need the SAME SKU family, stopping at the
//                               first order that does not need it. Max 15.
//                               Worked example given by the business: orders 3
//                               and 4 carry that family and order 5 does not,
//                               so orders 3 and 4 are collected and the run ends.
//
//   LIST 2 - "whole pack list"  Scan the entire remaining pack list, exactly as
//                               the previous logic did. Max 15.
//
// Anything NOT in either list is not collected at all - it is packed straight
// from the order like a bulb or a ceiling rose. That is deliberate and was
// confirmed 2026-08-18: LSCP150GR2PK and WCFSDCBM both appear in the live
// orders, and families such as LSCA, LSCO, LSCP, LSFC and LSHQ exist in the
// SOT, and none of them are collected under this rule.
//
// The 15 limit is PER LIST, not shared. An order needing a list-1 shade AND a
// list-2 shade triggers TWO collections, each up to 15, shown as two cards.
//
// NOTE - WCB, WCCY and WCD are cage shades and are collected here, but
// ppProductType() still ranks them OTHER for the packing sort because that
// classification was not part of this change. Flagged, not altered.
// ===========================================================================

var PP_MAX_LAMPSHADE_COLLECTION = 15;

// LIST 1 - collect across the run of consecutive orders needing the same family.
var PP_COLLECT_RUN_PREFIXES = [
  'LSBS', 'LSSS', 'LSWE', 'WCCY', 'LSCYRO', 'LSBG', 'LSCG',
  'LSFG', 'LSGD', 'LSGG', 'LSGL', 'WCB', 'WCD'
];

// LIST 2 - check the entire pack list.
var PP_COLLECT_FULL_PREFIXES = [
  'LSCY2', 'LSDM', 'LSDO', 'LSEL', 'LSFT', 'LSHH', 'LSHM', 'LSLC', 'LSLT',
  'LSMS', 'LSOL', 'LSRP', 'LSTF', 'LSTL', 'LSTM', 'LSUL', 'LSWD'
];

/**
 * Which collection family a SKU belongs to, or null when it is not collected.
 *
 * LONGEST prefix wins. That matters because the lists are not disjoint by
 * length: LSCYRO (list 1) and LSCY2 (list 2) both begin "LSCY", and LSGL
 * (list 1) shadows nothing but sits beside LSGD and LSGG. Matching the longest
 * prefix means LSCYRO120GD is list 1 while LSCY290BM is list 2, which is what
 * the two lists say.
 *
 * "LSCY2" is a real prefix, not a typo for a size: the SOT holds LSCY210* and
 * LSCY290* but also LSCY1C12FG, and only the 2xx sizes are named in list 2.
 *
 * @return {?{prefix:string, mode:string}} mode is 'RUN' (list 1) or 'FULL' (list 2)
 */
function ppCollectionFamily(sku) {
  var s = String(sku || '').toUpperCase().trim();
  if (!s) return null;
  var best = null;

  function scan(list, mode) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (s.indexOf(p) !== 0) continue;
      if (!best || p.length > best.prefix.length) best = { prefix: p, mode: mode };
    }
  }
  scan(PP_COLLECT_RUN_PREFIXES, 'RUN');
  scan(PP_COLLECT_FULL_PREFIXES, 'FULL');
  return best;
}

/**
 * Size token from a SKU - the first digit run after the leading letters.
 *   LSFT220BB   -> "220"     LSDO400YE   -> "400"
 *   LSCYRO120GD -> "120"     LSTF40BM    -> "40"
 *
 * Used for the wording on the collection card, not for deciding what to collect.
 *
 * LIMITATION - numeric pack suffixes are NOT stripped.
 * "LSFT2205PK" is genuinely ambiguous: it reads as either 220 + 5-pack or
 * 2205 + pack, and nothing in the SKU distinguishes them. Guessing would
 * silently mis-label a whole size. Only the unambiguous "APK" form is stripped.
 */
function ppProductSize(sku) {
  // THE SOT IS THE AUTHORITY, and the SKU digits are not a size at all for some
  // families. Proven on the live SOT 2026-08-18:
  //
  //   SKU            digits    SOT Diameter_mm
  //   LSGL10014AR    10014     140
  //   LSGL10014CL    10014     100     <- same digits, different size
  //   LSGL14013AR    14013     140
  //   LSGL100145BL   100145    140
  //   LSGLWA140AR    140       150     <- the digits even contradict the SOT
  //
  // Parsing the SKU printed "14013mm" and "100145mm" on the collection card and
  // spoke them aloud. Two SKUs sharing 10014 have different real sizes, so no
  // parsing rule can ever recover this - only the SOT can.
  var key = String(sku || '').trim().toUpperCase();
  var hit = ppLoadSot()[key];
  if (hit) {
    var v = hit.width || hit.size || hit.height;   // Width, else Diameter, else Height
    if (v) return v;
  }

  // Fallback for anything the SOT does not carry. The millimetre-size grammar
  // belongs to the LS families only: WCB7BS is cage size 7, not 7mm, and
  // WCCYSQBM2PK ends in a 2-pack code - reading either as a size printed "7mm"
  // and "2mm" on the card, which is the wrong shelf.
  var s = key.replace(/APK$/, '');
  if (s.indexOf('LS') !== 0) return '';
  var m = s.match(/^[A-Z]+(\d+)/);
  return m ? m[1] : '';
}

/**
 * How a size READS on the collection card. The SOT keeps Width and Height in
 * separate columns, so where both exist the packer is shown both - a 140 wide
 * by 130 tall shade and a 140 wide by 200 tall shade are different products
 * sitting on different shelves, and one number cannot tell them apart.
 *
 * @return {string} "140 x 130 mm", "140mm", "H 200mm", or "" when unknown.
 */
function ppProductSizeLabel(sku) {
  var hit = ppLoadSot()[String(sku || '').trim().toUpperCase()];
  var w = hit ? (hit.width || hit.size) : '';
  var h = hit ? hit.height : '';
  if (w && h) return w + ' x ' + h + ' mm';
  if (w) return w + 'mm';
  if (h) return 'H ' + h + 'mm';
  var fallback = ppProductSize(sku);
  return fallback ? fallback + 'mm' : '';
}

/** The same size as SPOKEN words. "x" does not read aloud; "by" does. */
function ppProductSizeSpeech(sku) {
  var hit = ppLoadSot()[String(sku || '').trim().toUpperCase()];
  var w = hit ? (hit.width || hit.size) : '';
  var h = hit ? hit.height : '';
  if (w && h) return w + ' by ' + h + ' millimeter';
  if (w) return w + ' millimeter';
  if (h) return 'height ' + h + ' millimeter';
  var fallback = ppProductSize(sku);
  return fallback ? fallback + ' millimeter' : '';
}

// ===========================================================================
// PACKING WORKFLOW - just-in-time lampshade collection
// ===========================================================================
//   * Process orders in queue sequence.
//   * An order with no collectible lampshade is packed normally.
//   * When an order needs collectible lampshades the pool cannot cover, a
//     collection is TRIGGERED at that order - never everything up front.
//   * List-1 shortages and list-2 shortages produce SEPARATE collections.
//   * Following orders are packed from the pool without a new trigger, until
//     the pool can no longer cover one.
//
// "Insufficient" is checked PER SKU, not on the total: holding 15 of the wrong
// shade does not let you pack an order that needs a different one.
// ===========================================================================

/**
 * @param {Array<{order, lines:Array<{sku,size,colour,qty,type}>}>} orders  queue sequence
 * @param {number} [maxPerBatch]  defaults to PP_MAX_LAMPSHADE_COLLECTION
 * @return {Array<{seq,order,action,collections,uses}>}
 *   action: 'PACK'                - nothing collectible, pack normally
 *           'PACK_FROM_COLLECTED' - taken from the existing pool
 *           'COLLECT_THEN_PACK'   - one or two collections triggered here
 */
function ppBuildPackingWorkflow(orders, maxPerBatch) {
  var max = maxPerBatch || PP_MAX_LAMPSHADE_COLLECTION;
  var steps = [], pool = {}, batchNo = 0;

  // Collectible lines per order, resolved once. A line that matches neither
  // list is not in here at all, so it is invisible to the collection and simply
  // travels with its order.
  var perOrder = [];
  for (var pi = 0; pi < orders.length; pi++) {
    var src = orders[pi].lines || [], acc = [];
    for (var pj = 0; pj < src.length; pj++) {
      var ln = src[pj], q = parseFloat(ln.qty) || 0;
      if (q <= 0) continue;
      var fam = ppCollectionFamily(ln.sku);
      if (!fam) continue;
      acc.push({
        sku: String(ln.sku || '').toUpperCase().trim(),
        size: ln.size, sizeLabel: ln.sizeLabel, sizeSay: ln.sizeSay,
        colour: ln.colour, qty: q,
        order: orders[pi].order, family: fam.prefix, mode: fam.mode
      });
    }
    perOrder.push(acc);
  }

  function linesIn(fi, test) {
    var all = perOrder[fi], out = [];
    for (var i = 0; i < all.length; i++) if (test(all[i])) out.push(all[i]);
    return out;
  }

  // Family is part of the group key. Same size and same colour does NOT make
  // LSBS160OR and LSGD160OR the same product, and a card merging them could not
  // say how many of each to take.
  function groupLines(lines) {
    var seq = [], map = {};
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], key = ln.family + '|' + ln.size + '|' + ln.colour;
      if (!map[key]) {
        map[key] = { size: ln.size, sizeLabel: ln.sizeLabel || '', sizeSay: ln.sizeSay || '',
                     colour: ln.colour, qty: 0, skus: [], orders: [] };
        seq.push(key);
      }
      map[key].qty += ln.qty;
      if (map[key].skus.indexOf(ln.sku) === -1) map[key].skus.push(ln.sku);
      if (ln.order && map[key].orders.indexOf(ln.order) === -1) map[key].orders.push(ln.order);
    }
    var out = [];
    for (var k = 0; k < seq.length; k++) out.push(map[seq[k]]);
    return out;
  }

  // Adds whole lines until the cap would break. Returns true when the caller
  // must stop scanning further orders.
  function fill(c, lines, isTrigger) {
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (c.total + l.qty > max) {
        // The TRIGGERING order is always completed, even past 15. Stopping
        // mid-order would leave it unpackable - the pool would not cover its own
        // trigger and the packer would reach the bench short. Flagged, not hidden.
        if (isTrigger) c.overflow = true;
        else return true;
      }
      c.lines.push(l);
      c.total += l.qty;
      pool[l.sku] = (pool[l.sku] || 0) + l.qty;
    }
    return false;
  }

  function newBatch(mode, oi) {
    batchNo++;
    return {
      batch: batchNo, mode: mode, total: 0, lines: [], groups: [],
      triggeredBy: orders[oi].order, overflow: false, isFull: false
    };
  }

  function finish(c) {
    c.groups = groupLines(c.lines);
    c.isFull = (c.total >= max);
    return c;
  }

  // LIST 2 - the whole remaining pack list.
  function buildFullBatch(oi) {
    var c = newBatch('FULL', oi);
    for (var fi = oi; fi < orders.length; fi++) {
      var ls = linesIn(fi, function (l) { return l.mode === 'FULL'; });
      if (fill(c, ls, fi === oi)) break;
    }
    return finish(c);
  }

  // LIST 1 - one batch, but each family walks only its OWN run of consecutive
  // orders and stops at the first order that does not carry it. Two families
  // short on the same order share the one batch and the one 15 limit.
  function buildRunBatch(oi, families) {
    var c = newBatch('RUN', oi);
    for (var f = 0; f < families.length; f++) {
      var fam = families[f];
      var test = (function (fm) {
        return function (l) { return l.mode === 'RUN' && l.family === fm; };
      })(fam);
      for (var fi = oi; fi < orders.length; fi++) {
        var ls = linesIn(fi, test);
        if (!ls.length) break;                       // the run ends at this order
        if (fill(c, ls, fi === oi)) break;
      }
    }
    return finish(c);
  }

  for (var oi = 0; oi < orders.length; oi++) {
    var mine = perOrder[oi];

    if (!mine.length) {
      steps.push({
        seq: steps.length + 1, order: orders[oi].order,
        action: 'PACK', collections: [], collection: null, uses: null
      });
      continue;
    }

    var need = {};
    for (var ni = 0; ni < mine.length; ni++) {
      need[mine[ni].sku] = (need[mine[ni].sku] || 0) + mine[ni].qty;
    }

    // Decide EVERYTHING before building anything: fill() writes into pool, so a
    // coverage test taken afterwards would read a pool that already contains the
    // batch we are still deciding about.
    var runFamilies = [], seenFam = {}, wantFull = false, modeSeq = [];
    for (var ci = 0; ci < mine.length; ci++) {
      var l = mine[ci];
      if ((pool[l.sku] || 0) >= need[l.sku]) continue;      // pool already covers it
      if (l.mode === 'FULL') {
        if (!wantFull) { wantFull = true; modeSeq.push('FULL'); }
      } else {
        if (!runFamilies.length) modeSeq.push('RUN');
        if (!seenFam[l.family]) { seenFam[l.family] = true; runFamilies.push(l.family); }
      }
    }

    // Batches are created in the order the shortage first appears on this order,
    // which is packing-priority order, so the cards match the pick sequence.
    var collections = [];
    for (var mi = 0; mi < modeSeq.length; mi++) {
      collections.push(modeSeq[mi] === 'FULL' ? buildFullBatch(oi) : buildRunBatch(oi, runFamilies));
    }

    for (var k in need) pool[k] = (pool[k] || 0) - need[k];

    steps.push({
      seq: steps.length + 1,
      order: orders[oi].order,
      action: collections.length ? 'COLLECT_THEN_PACK' : 'PACK_FROM_COLLECTED',
      collections: collections,
      collection: collections.length ? collections[0] : null,   // first batch, for older callers
      uses: need
    });
  }
  return steps;
}

/** How the two scan rules read on screen and in a log. */
function ppCollectionScopeLabel(mode) {
  return mode === 'RUN' ? 'These orders only' : 'Whole pack list';
}

/** Render the workflow as the packer would experience it. */
function ppFormatWorkflow(steps) {
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    if (s.action === 'PACK') {
      out.push('Order ' + s.seq + '  [' + s.order + ']  nothing to collect -> pack normally');
    } else if (s.action === 'PACK_FROM_COLLECTED') {
      out.push('Order ' + s.seq + '  [' + s.order + ']  lampshade -> use already-collected stock');
    } else {
      out.push('Order ' + s.seq + '  [' + s.order + ']  LAMPSHADE REQUIRED');
      for (var ci = 0; ci < s.collections.length; ci++) {
        var c = s.collections[ci];
        out.push('   COLLECTION ' + c.batch + '  (' + c.total + '/' + PP_MAX_LAMPSHADE_COLLECTION +
                 (c.isFull ? ' FULL' : '') + ')  ' + ppCollectionScopeLabel(c.mode) +
                 (c.overflow ? '  ** single order exceeds the limit **' : ''));
        for (var q = 0; q < c.groups.length; q++) {
          var gp = c.groups[q];
          out.push('        ' + (gp.sizeLabel || gp.size || '?') + ' - ' + (gp.colour || '?') + ' - ' + gp.qty +
                   '   for ' + gp.orders.join(', '));
        }
      }
    }
  }
  return out.join('\n');
}

/**
 * Voice rendering of one collection. Kept separate from the on-screen text: the
 * display carries SKUs and brackets, which do not speak well. The packer hears
 * size, colour and quantity; the SKU stays on screen.
 */
function ppCollectionSpeech(c) {
  // No lead-in here. Two batches can be spoken back to back, and repeating
  // "Collect lampshades first" between them made the packer think a second,
  // separate instruction had started. The caller says it once.
  var out = ['Collection ' + c.batch + '.',
             c.total + ' lampshade' + (c.total === 1 ? '' : 's') + '.'];
  for (var i = 0; i < c.groups.length; i++) {
    var g = c.groups[i];
    // A cage shade has no millimetre size, so the phrase is dropped rather than
    // read as "size unknown", which sounds like data the packer must chase.
    out.push((g.sizeSay ? g.sizeSay + '. ' : '') +
             (g.colour || 'colour unknown') + '. ' + g.qty + '.');
  }
  return out.join(' ');
}

/**
 * Wiring helper - run the just-in-time collection over the cleaned rows and stamp
 * the result into the "Lampshade Collection" column.
 *
 * Orders are keyed on Customer Info + Post Code and kept in first-appearance
 * order, which is the sequence the Speak Tool queues them in. The collection
 * text is written on the FIRST row of the order that triggered it, so the packer
 * sees it before that order is processed.
 *
 * Touches only the "Lampshade Collection" and "Lampshade Collection Speech"
 * columns. No other column, and no other function's behaviour, is affected.
 *
 * @param {Array<Array>} rows      output rows WITHOUT the header
 * @param {Array<string>} headers  outputHeaders
 * @return {number} how many collections were triggered
 */
function ppStampCollections(rows, headers) {
  var iSku  = headers.indexOf('SKU');
  var iQty  = headers.indexOf('Quantity');
  var iType = headers.indexOf('Product Type');
  var iCol  = headers.indexOf('Colour');
  var iCust = headers.indexOf('Customer Info');
  var iPost = headers.indexOf('Post Code');
  var iOut  = headers.indexOf('Lampshade Collection');
  var iSay  = headers.indexOf('Lampshade Collection Speech');
  if (iSku < 0 || iOut < 0) return 0;

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
      // Grouping still keys on the bare `size` token. `sizeLabel` and `sizeSay`
      // are what the packer reads and hears, and carry Width x Height when the
      // SOT supplies both.
      sizeLabel: ppProductSizeLabel(sku),
      sizeSay:   ppProductSizeSpeech(sku),
      colour: iCol >= 0 && rows[r][iCol] != null ? String(rows[r][iCol]).trim() : '',
      qty:    rows[r][iQty],
      type:   iType >= 0 ? rows[r][iType] : ''
    });
  }

  var steps = ppBuildPackingWorkflow(orders);
  var triggered = 0;

  for (var s = 0; s < steps.length; s++) {
    var st = steps[s];
    if (st.action !== 'COLLECT_THEN_PACK' || !st.collections.length) continue;

    // Structured, machine-readable. Lithursan.gs renders this as its OWN
    // collection-only view - it is never merged into a customer order card.
    // A BATCH line opens each block, so one cell can carry two batches.
    //   BATCH|<n>|<total>|<max>|<OVERFLOW or empty>|<RUN or FULL>
    //   ITEM|<skus>|<size>|<colour>|<qty>|<orders>
    var out = [], say = ['Collect lampshades first.'];
    if (st.collections.length > 1) say.push(st.collections.length + ' collections.');
    for (var ci = 0; ci < st.collections.length; ci++) {
      var c = st.collections[ci];
      triggered++;
      out.push('BATCH|' + c.batch + '|' + c.total + '|' + PP_MAX_LAMPSHADE_COLLECTION + '|' +
               (c.overflow ? 'OVERFLOW' : '') + '|' + c.mode);
      for (var gi = 0; gi < c.groups.length; gi++) {
        var gp = c.groups[gi];
        out.push('ITEM|' + gp.skus.join(' + ') + '|' + (gp.sizeLabel || '') +
                 '|' + (gp.colour || '?') + '|' + gp.qty + '|' + gp.orders.join(', '));
      }
      say.push(ppCollectionSpeech(c));
    }
    say.push('Then pack this order.');

    rows[orders[s].firstRow][iOut] = out.join('\n');
    if (iSay >= 0) rows[orders[s].firstRow][iSay] = say.join(' ');
  }
  return triggered;
}
