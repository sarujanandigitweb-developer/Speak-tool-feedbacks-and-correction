/* ============================================================================
   Speak Tool — pack list engine
   ----------------------------------------------------------------------------
   Reads a dispatch pack list straight from its HTML and produces the queue the
   speaker walks. No spreadsheet anywhere in this path.

   The rules below are the ones proven on the Google Sheets build (REQ-03) and
   are carried across unchanged. Where a rule cost us a live defect, the comment
   says which one, so it is not "simplified" back.
   ========================================================================== */
(function (w) {
  'use strict';

  /* ---- pack size from the SKU suffix -------------------------------------
     Taken from the existing Flask prototype (speak_tool/app.py). The Apps
     Script build never had this, which is why ppProductSize() refuses to strip
     numeric pack suffixes: LSFT2205PK is ambiguous without this table. */
  var PACK = {'1PK':1,'2PK':2,'3PK':3,'4PK':4,'5PK':5,'6PK':6,'7PK':7,'8PK':8,'9PK':9,
              'APK':10,'BPK':15,'CPK':20,'DPK':30,'EPK':50,'FPK':100,
              'GPK':12,'HPK':16,'IPK':24,'JPK':75,'KPK':150,'LPK':11,
              'MPK':80,'NPK':200,'OPK':250,'PPK':300,'QPK':500,'RPK':1000,'SPK':25};
  function packSize(sku){ var s=String(sku||'').trim().toUpperCase();
    return PACK[s.slice(-3)]||1; }
  function baseSku(sku){
    var s=String(sku||'').trim().toUpperCase();
    return PACK[s.slice(-3)] ? s.slice(0,-3) : s;
  }

  /* ---- classification -----------------------------------------------------
     Ceiling rose is tested FIRST: LSWD360BG is "360 Black gold inner celing
     rose", an LS-prefixed SKU that is a rose, not a shade.

     Spelling in the live reference data is not what you would guess:
       "Retangle" 28   "Rectangle" 0      "celing" 12   "ceiling" 316          */
  var RE_ROSE = /c[ei]+l[ei]*ng\s*rose/i;
  var RE_RECT = /re[c]?tangle|rectangular/i;
  var RE_BULB = /\bbulbs?\b|\bwats?\b|\bwatts?\b/i;

  function productType(sku, name){
    var s=String(sku||'').toUpperCase(), n=String(name||'');
    if (RE_ROSE.test(n)) return RE_RECT.test(n) ? 'RECT_ROSE' : 'ROSE';
    if (RE_BULB.test(n) && s.indexOf('LD')===0) return 'BULB';
    // LS PREFIX = LAMPSHADE, ruled by the business 2026-08-17. The name is not
    // consulted: 16 of 156 live rows were mis-filed as OTHER when it was, e.g.
    // LSGG200AR named "amber Amber". Scores 451/451 against the SOT.
    if (s.indexOf('LS')===0) return 'SHADE';
    // WCWD ("v diamand") was added to the lampshade prefixes by the business
    // 2026-08-19, so it ranks as a shade in the packing sort as well as being
    // collected. Sits AFTER the rose test, exactly like the LS rule, and does
    // NOT extend to the other WC* cages - only WCWD was named.
    if (s.indexOf('WCWD')===0) return 'SHADE';
    /* THE REST OF THE WC FAMILY - wire and glass cages: WCB, WCCY, WCD, WCFS.
     *
     * These used to fall through to OTHER and were therefore packed LAST, level
     * with the accessories. Ruled 2026-09-11: a cage belongs with the shades,
     * so WC is packed IMMEDIATELY AFTER Lampshade and ahead of everything else.
     *
     * A separate type rather than reusing SHADE, because the 2026-08-14 ruling
     * that "the WC* wire cages are NOT lampshades" still stands - it governs
     * what goes into a lampshade COLLECTION, which is a different question from
     * what order things are packed in. Only WCWD was ever named a lampshade,
     * and it keeps that (the test above wins, being checked first).
     *
     * Measured on the 13 live pack lists: 28 SKUs move up out of OTHER, the
     * 4 WCWD are unaffected. */
    if (s.indexOf('WC')===0) return 'CAGE';
    if (s.indexOf('LD')===0) return 'BULB';
    return 'OTHER';
  }

  /* ---- colour -------------------------------------------------------------
     SOT first, suffix table as the fallback for roses, bulbs and accessories. */
  var COLOURS = {BM:'Black',BY:'Shiny Black',BA:'Matt Black',WH:'White',YE:'Yellow',
    GR:'Green',BL:'Blue',BD:'Dark Blue',CB:'Cyan Blue',GY:'Grey',PI:'Pink',OR:'Orange',
    RE:'Red',RR:'Rustic Red',BU:'Burgundy',CO:'Copper',BC:'Brushed Copper',CH:'Chrome',
    SN:'Satin Nickel',YB:'Yellow Brass',GB:'Green Brass',BB:'Brushed Brass',
    BS:'Brushed Silver',FG:'French Gold',RO:'Rose Gold',GD:'Gold',GL:'Light Gold',
    BG:'Black Gold Inner',HE:'Hemp'};

  // SOT rows whose Outer_Colour contradicts the SOT's OWN Product_Name.
  // Verified 2026-08-17; the SKU suffix agrees with the name, so the name wins.
  // Do not extend by guessing.
  var SOT_OVERRIDE = {LSCYRO120GD:'Gold',LSCYRO200GD:'Gold',LSCYRO300GD:'Gold',
                      LSCYRO120WH:'White',LSCYRO200WH:'White',LSCYRO300WH:'White'};

  function colourFromSku(sku){
    var s=String(sku||'').toUpperCase().replace(/\d*A?PK$/,'');
    var m=s.match(/([A-Z]{2,3})$/);
    return m ? (COLOURS[m[1].slice(-2)]||'') : '';
  }
  function productColour(sku){
    var k=String(sku||'').trim().toUpperCase();
    if (SOT_OVERRIDE[k]) return SOT_OVERRIDE[k];
    var hit=(w.REF&&w.REF.sot)?w.REF.sot[k]:null;
    if (hit && (hit[0]||hit[1])) return hit[0]||hit[1];
    return colourFromSku(k);
  }
  function productImageSot(sku){
    var hit=(w.REF&&w.REF.sot)?w.REF.sot[String(sku||'').trim().toUpperCase()]:null;
    return hit && hit[3] ? hit[3] : '';
  }
  /* Live names from the master sheet are consulted first, the built-in table
     second. STX_NAMES.map is already built-in-plus-live merged, so the || chain
     below is belt and braces: if names-live.js is absent, or its fetch failed,
     map is null and this behaves exactly as it did before. */
  function productName(sku){
    var k=String(sku||'').trim().toUpperCase();
    var live=(w.STX_NAMES&&w.STX_NAMES.map)||null;
    var n=(live&&live[k])||((w.REF&&w.REF.names)?w.REF.names[k]:'');
    if (n) return n;
    var base=baseSku(k);                 // LSFT220BG5PK -> LSFT220BG
    return (live&&live[base])||(w.REF&&w.REF.names&&w.REF.names[base])||'';
  }

  /* ---- packing priority ---------------------------------------------------
     Conditional: which ranking applies depends on whether the order holds a
     Rectangle Ceiling Rose. Rule given 2026-08-14/17. */
  /* Ranking as stated by the business 2026-08-19, and unchanged since
     2026-08-14. Bulb is THIRD, ahead of Other.

       Type 1 - a Rectangle Ceiling Rose is in the order
         Rect Ceiling Rose 1 · Lampshade 2 · Bulb 3 · Other 4
         (a plain ceiling rose is not called out here, so it packs with Other)

       Type 2 - no Rectangle Ceiling Rose
         Lampshade 1 · Bulb 3 · Other 4 · plain Ceiling Rose = Other
         Corrected 2026-08-19: the plain rose used to sit at 2, ahead of the
         bulb. The business restated it as "Normal Ceiling Rose = Other type",
         which also makes the two types agree - Type 1 already ranks it 4.
         Rose and Other TIE, so the stable sort keeps them in pack list order.
         Measured on the 13 live pack lists: 25 of 155 orders move.

     Type 3 - neither a Lampshade nor a Ceiling Rose - is handled in
     applyPriority(): no ranking is applied at all. */
  /* CAGE sits between SHADE and BULB in both tables - "immediately after
     Lampshade", ruled 2026-09-11. The numbers shifted down to make room; every
     RELATIVE position that was already agreed is unchanged:
         Rect Rose before Shade, Shade before Bulb, Bulb before Rose/Other,
         and ROSE still TIES with OTHER so the stable sort keeps a plain rose
         in its pack-list position. */
  var RANK_RECT = {RECT_ROSE:1, SHADE:2, CAGE:3, BULB:4, ROSE:5, OTHER:5};
  var RANK_PLAIN= {SHADE:1, CAGE:2, BULB:3, ROSE:4, OTHER:4};
  /* Falls back to the table's OWN "Other" value, not a hard-coded 4. With the
     renumbering above, 4 is BULB in RANK_RECT - a literal would have ranked an
     unknown type AHEAD of a rose. */
  function rank(type, hasRect){
    var map = hasRect ? RANK_RECT : RANK_PLAIN;
    return map[type] || map.OTHER;
  }

  /* TYPE 3 - the branch that was missing.
     "If there is no Lampshade and no Ceiling Rose, do not apply any filter.
      Speak in the exact order in which the items appear in the order."

     Type 2's ranking used to be applied to EVERY order without a rect rose,
     including orders holding no lampshade and no rose either. Bulb (3) then
     jumped ahead of Other (4), so a free bulb was called out before the fitting
     it goes into - order s652qq spoke "Free Bulb" then "Pipe Light Black".
     There is nothing in such an order to rank against, so the source order
     stands, whether that is Holder-Bulb-Other or Bulb-Holder-Other.
     Confirmed 2026-08-19. */
  function hasPriorityAnchor(lines){
    return lines.some(function(l){
      return l.type==='RECT_ROSE' || l.type==='SHADE' || l.type==='ROSE';
    });
  }

  function applyPriority(lines){
    if (!hasPriorityAnchor(lines)) return lines;          // branch 3
    var hasRect = lines.some(function(l){ return l.type==='RECT_ROSE'; });
    return lines
      .map(function(l,i){ return {l:l, i:i, r:rank(l.type,hasRect)}; })
      .sort(function(a,b){ return a.r-b.r || a.i-b.i; })   // stable
      .map(function(x){ return x.l; });
  }

  /* ---- ORDER-LEVEL PRIORITY for a merge order ------------------------------
     Ruled 2026-09-14. The sub-orders of a merge all go into ONE large pack, so
     WHICH sub-order is spoken first is decided by packing priority too:

       Order 1  Bulb + Holder          ranks [4,5]
       Order 2  Rect Rose + ...        ranks [1,5]
       Order 3  Lampshade + Rose       ranks [2,5]
       Order 4  Lampshade + Rect Rose  ranks [1,2]
       spoken   Order 4 -> Order 2 -> Order 3 -> Order 1

     Key: the sub-order's product ranks, best first, read from the SAME table
     applyPriority() uses (RANK_RECT - a superset whose relative order of the
     other types is identical to RANK_PLAIN). Sub-orders are compared position
     by position, so Order 4 beats Order 2: both open with a Rect Rose, and
     Order 4's next product is a Lampshade. A full tie keeps pack-list order.

     Each block arrives ALREADY sorted by applyPriority(); this only chooses
     the sequence of blocks and never reorders anything inside one.

     TYPE 3 at merge level: if no sub-order holds a Lampshade or any Ceiling
     Rose, nothing is reordered - the same rule applyPriority() follows for one
     order. Measured on the 13 live pack lists: 5 of 27 merges change sequence;
     single orders (one block) cannot be affected. */
  function orderKey(block){
    return block.map(function(l){ return RANK_RECT[l.type] || RANK_RECT.OTHER; })
                .sort(function(a,b){ return a-b; });
  }
  function compareOrderKeys(a,b){
    for (var i=0; i<Math.max(a.length,b.length); i++){
      // a sub-order that has run out of products ranks after one that has not
      var x = i<a.length ? a[i] : Infinity, y = i<b.length ? b[i] : Infinity;
      if (x!==y) return x<y ? -1 : 1;
    }
    return 0;
  }
  function sequenceSubOrders(blocks){
    var list = blocks.filter(function(b){ return b.length; });
    var all  = [].concat.apply([], list);
    if (list.length<2 || !hasPriorityAnchor(all)) return all;   // one order, or Type 3
    return [].concat.apply([], list
      .map(function(b,i){ return {b:b, i:i, k:orderKey(b)}; })
      .sort(function(x,y){ return compareOrderKeys(x.k,y.k) || x.i-y.i; })   // stable
      .map(function(x){ return x.b; }));
  }

  /* ---- parse one pack list document --------------------------------------
     Selectors are the dashboard's own classes, as used by speak_tool/app.py and
     re-verified against 17 saved pack lists. */
  function orderTypeName(value){
    var name=String(value||'').replace(/\s+/g,' ').trim();
    var match=name.match(/^(.*?\bPacklist)\b/i);
    if (match) return match[1];
    if (/^[{[]/.test(name) || /^(?:pack list|\d+(?:\.html?)?)$/i.test(name)) return '';
    return name.replace(/\.html?$/i,'').replace(/\s+(?:L\s+)?u\d+$/i,'').trim();
  }

  function packlistSpeech(order){
    if (order.startsPacklist === false) return '';
    return String(order.orderType || '').replace(/^Amazon Shipping Prime Packlist$/i, 'Amazon Shipping Prime');
  }

  function parseDoc(doc, sourceName){
    var orders=[];
    var nodes=doc.querySelectorAll('li.bg-white');

    for (var oi=0; oi<nodes.length; oi++){
      var node=nodes[oi];
      var custBlocks=node.querySelectorAll('div.col-2.small');
      var customer = custBlocks.length>1 ? txt(custBlocks[1]) : '';
      var postcodeNode = node.querySelector('div.fs-6');
      var address  = txt(postcodeNode);
      var orderType = orderTypeName(txt(node.querySelector('div.text-secondary.fw-bold'))) ||
        orderTypeName(attr(node,'data-stx-source')) || orderTypeName(sourceName);
      var instructionQr = Array.prototype.some.call(node.querySelectorAll('.badge.bg-success'), function(b){
        return /^Instruction\s+QR$/i.test(txt(b));
      }) ? 'Instruction QR' : '';
      var isMerge = Array.prototype.some.call(node.querySelectorAll('div.text-primary'), function(b){
        return /^(?:zzz)?merge[ _]order$/i.test(txt(b));
      });
      var platform = txt(node.querySelector('div.bg-light.border'));
      var price    = txt(node.querySelector('div.text-end span span:nth-child(2)'));

      /* PRIORITY IS APPLIED INSIDE EACH SUB-ORDER, NOT ACROSS THE MERGE.
         ------------------------------------------------------------------
         One  div.p-1[id$='-li']  is ONE sub-order: "1126617-0-li" and
         "1126617-1-li" are two line items merged into a single parcel. Every
         component of both used to be poured into one flat array and sorted in
         one pass, so a later sub-order's lampshade jumped into the middle of an
         earlier one. Live example, 1.html:

           sub-orders  [PHSHF1PBRYB LSCY290BG LDMST64E274] [PHCH1FBRBM LSHQ180BG]
           was         LSCY290BG  LSHQ180BG  LDMST64E274  PHSHF1PBRYB  PHCH1FBRBM
                                  ^ sub-order 2's shade, spoken inside sub-order 1
           now         LSCY290BG  LDMST64E274  PHSHF1PBRYB | LSHQ180BG  PHCH1FBRBM

         Each block is ranked on its OWN contents, so "does this order hold a
         Rectangle Ceiling Rose?" is answered per sub-order, and the blocks are
         appended in pack-list order. Measured on the 13 live pack lists: 11 of
         155 orders were interleaved this way.

         NO merge test is needed. All 27 multi-block orders in those pack lists
         are merge-tagged and NO single-order is - a block boundary IS a
         sub-order boundary. A normal order has exactly one block, where sorting
         it alone is identical to what this did before. */
      var lines=[], blocks=[];
      var prods=node.querySelectorAll("div.p-1[id$='-li']");
      for (var pi=0; pi<prods.length; pi++){
        var pd=prods[pi];
        var blockLines=[];
        var title = txt(pd.querySelector('div.fw-bold.border-bottom span, div.fw-bold.border-bottom a span'));
        var parent= txt(pd.querySelector("span[onclick^='copyText']"));
        var qty   = readQty(pd);
        var adj   = qty * packSize(parent);
        var link  = attr(pd.querySelector('div.fw-bold.border-bottom a'),'href');
        var imgs  = pd.querySelectorAll('img');
        var mainImgEl = imgs.length ? imgs[imgs.length-1] : null;
        var mainImg = mainImgEl ? attr(mainImgEl,'src') : '';

        var combos = pd.querySelectorAll('label.col-3.mb-3');
        if (combos.length){
          for (var ci=0; ci<combos.length; ci++){
            var it=combos[ci];
            var t=it.querySelectorAll('div.text-center div.small');
            var cq=it.querySelector('span.alert');
            var csku = t.length>0 ? txt(t[0]) : '';
            blockLines.push(makeLine({
              sku:csku, combined:parent, title:title, link:link,
              colourRaw: t.length>1 ? txt(t[1]) : '',
              qty: cq ? Number(String(txt(cq)).replace(/[^0-9.]/g,''))||adj : adj,
              img: attr(it.querySelector('img'),'src') || mainImg,
              // The element itself, so the pack-list extension can zoom the exact
              // picture of the component being spoken. Never serialised.
              imgEl: it.querySelector('img') || mainImgEl
            }));
          }
        } else {
          // Non-combo product: its own SKU, and no combined string.
          blockLines.push(makeLine({sku:parent, combined:'', title:title, link:link,
                               colourRaw:'', qty:adj, img:mainImg, imgEl:mainImgEl}));
        }
        // Ranked within this sub-order; the order of the sub-orders is chosen below.
        blocks.push(applyPriority(blockLines));
      }
      lines = sequenceSubOrders(blocks);
      if (!lines.length) continue;

      var previous = orders.length ? orders[orders.length - 1] : null;
      var packlistKey = attr(node,'data-stx-file') || attr(node,'data-stx-source') || sourceName || '';
      orders.push({
        packlistKey:packlistKey,
        startsPacklist:!previous || previous.packlistKey !== packlistKey || previous.orderType !== orderType,
        customer:customer, address:address, platform:platform, price:price,
        // The <li> this order was read from. The pack-list extension scrolls to
        // it, so the page moves with the speech. Never serialised - persist()
        // copies named fields only, so this cannot reach JSON.stringify.
        node:node, postcodeNode:postcodeNode, orderType:orderType,
        isMerge:isMerge || blocks.length > 1,
        source:sourceName||'', lines:lines,
        // Notes/status remain editable; Instruction QR comes from the badge.
        note:'', status:'', instructionQr:instructionQr
      });
    }
    return orders;
  }

  function makeLine(o){
    var sku=String(o.sku||'').trim().toUpperCase();
    var name=productName(sku);
    return {
      sku:sku, combined:String(o.combined||'').trim().toUpperCase(),
      title:o.title||'', link:o.link||'', img:o.img||productImageSot(sku),
      qty:o.qty||1, name:name, imgEl:o.imgEl||null,
      colour: productColour(sku) || String(o.colourRaw||'').trim(),
      type: productType(sku,name)
    };
  }

  function txt(el){ return el ? String(el.textContent).replace(/\s+/g,' ').trim() : ''; }
  function attr(el,a){ return el && el.getAttribute(a) ? String(el.getAttribute(a)).trim() : ''; }
  function readQty(pd){
    var w=pd.querySelectorAll('*');
    for (var i=0;i<w.length;i++){
      var t=w[i].textContent||'';
      if (t.indexOf('Quantity:')!==-1 && w[i].children.length===0){
        var m=t.match(/Quantity:\s*([0-9.]+)/); if(m) return Number(m[1])||1;
      }
    }
    var m2=(pd.textContent||'').match(/Quantity:\s*([0-9.]+)/);
    return m2 ? (Number(m2[1])||1) : 1;
  }

  /* ---- lampshade collection ----------------------------------------------
     Rule supplied by the business 2026-08-18. This REPLACES the earlier rule,
     which treated every SHADE-typed product as collectible and scanned the whole
     pack list for all of them.

     A lampshade is collected only when its SKU starts with one of the prefixes
     below, and the two lists scan differently:

       LIST 1 "RUN"   collect across the run of CONSECUTIVE orders needing the
                      SAME SKU family, stopping at the first order that does not
                      need it. Worked example: orders 3 and 4 carry the family,
                      order 5 does not, so only 3 and 4 are collected.
       LIST 2 "FULL"  scan the entire remaining pack list, as before.

     Anything in neither list is not collected at all - it is packed straight
     from the order. LSCP, LSCA, LSCO, LSFC, LSHQ and WCFS all fall outside on
     purpose (confirmed 2026-08-18).

     The 10 limit is PER LIST, not shared: an order short on both lists triggers
     two collections of up to 10 each, shown as two cards.

     Never collect everything up front, and "insufficient" is checked PER SKU -
     10 of the wrong shade does not help.

     Lowered from 15 to 10 on 2026-08-20: the packers reported that carrying 15
     shades back from the shelf in one trip is not workable in practice. Only
     the number changes - every rule above (per-list, per-SKU, the triggering
     order always completed) is untouched, and the "n / 10" card total follows
     the constant because the dialog reads Engine.MAX_COLLECTION. */
  var MAX_COLLECTION = 10;

  var COLLECT_RUN_PREFIXES = ['LSBS','LSSS','LSWE','WCCY','LSCYRO','LSBG','LSCG',
                              'LSFG','LSGD','LSGG','LSGL','WCB','WCD','WCWD'];
  var COLLECT_FULL_PREFIXES = ['LSCY2','LSDM','LSDO','LSEL','LSFT','LSHH','LSHM',
                               'LSLC','LSLT','LSMS','LSOL','LSRP','LSTF','LSTL',
                               'LSTM','LSUL','LSWD'];

  /* LONGEST prefix wins. The lists are not disjoint by length: LSCYRO (list 1)
     and LSCY2 (list 2) both begin "LSCY", so LSCYRO120GD must resolve to list 1
     while LSCY290BM resolves to list 2. "LSCY2" is a real prefix rather than a
     size - the SOT also holds LSCY1C12FG, which is in neither list. */
  function collectionFamily(sku){
    var s=String(sku||'').toUpperCase().trim();
    if (!s) return null;
    var best=null;
    function scan(list,mode){
      list.forEach(function(p){
        if (s.indexOf(p)!==0) return;
        if (!best || p.length>best.prefix.length) best={prefix:p, mode:mode};
      });
    }
    scan(COLLECT_RUN_PREFIXES,'RUN');
    scan(COLLECT_FULL_PREFIXES,'FULL');
    return best;
  }

  function collectionScopeLabel(mode){
    return mode==='RUN' ? 'These orders only' : mode==='FULL' ? 'Whole pack list' : '';
  }

  /* @return {Array<Array<collection>>} one array per order, empty when nothing
     is triggered there. An order can trigger two collections. */
  function buildCollections(orders){
    var pool={}, batch=0, out=[];

    // Collectible lines per order, resolved once. A line matching neither list
    // is absent here, so it is invisible to the collection and travels with its
    // order like a bulb.
    var perOrder = orders.map(function(o){
      var acc=[];
      (o.lines||[]).forEach(function(l){
        var q=Number(l.qty)||0;
        if (q<=0) return;
        var fam=collectionFamily(l.sku);
        if (!fam) return;
        acc.push({sku:String(l.sku||'').toUpperCase().trim(), qty:q, colour:l.colour,
                  size:sizeOf(l.sku), img:l.img,
                  order:o.address||o.customer, family:fam.prefix, mode:fam.mode});
      });
      return acc;
    });

    function fill(c, lines, isTrigger){
      for (var i=0;i<lines.length;i++){
        var l=lines[i];
        if (c.total + l.qty > MAX_COLLECTION){
          // The TRIGGERING order is always completed, or the packer walks to the
          // shelf without everything this order needs. Flagged, not hidden.
          if (isTrigger) c.overflow=true; else return true;
        }
        c.picked.push(l);
        c.total += l.qty;
        pool[l.sku]=(pool[l.sku]||0)+l.qty;
      }
      return false;
    }

    function newBatch(mode){ batch++; return {batch:batch, mode:mode, total:0, picked:[], groups:[], overflow:false, isFull:false}; }
    function finish(c){ c.groups=groupCollected(c.picked); c.isFull=c.total>=MAX_COLLECTION; return c; }

    function buildFullBatch(oi){
      var c=newBatch('FULL');
      for (var fi=oi; fi<orders.length; fi++){
        var ls=perOrder[fi].filter(function(l){ return l.mode==='FULL'; });
        if (fill(c, ls, fi===oi)) break;
      }
      return finish(c);
    }

    /* A list-1 collection exists to save WALKS: one trip to the shelf serving a
       run of consecutive orders. A run of ONE saves nothing - the packer is sent
       to the shelf for that order's own shade, which they were going to fetch
       anyway, and the card just gets in the way.

       Ruled 2026-08-19: "if there is only one order and the next order is not
       one of these types, do not mention or apply this special logic", read as
       the SAME family in the next order (confirmed with the business the same
       day, against the alternative of any list-1 family).

       Measured on the 13 live pack lists: 16 of 20 list-1 cards disappear,
       including the WCCYSP160GD2PK "2 / 15" card the packers reported. The four
       that remain are genuine multi-order runs.

       List 2 is untouched - "whole pack list" was never about runs. */
    function runLength(oi, fam){
      var n=0;
      for (var fi=oi; fi<orders.length; fi++){
        var carries = perOrder[fi].some(function(l){
          return l.mode==='RUN' && l.family===fam;
        });
        if (!carries) break;
        n++;
      }
      return n;
    }

    // One batch, but each family walks only its OWN run of consecutive orders
    // and stops at the first order that does not carry it. Families short on the
    // same order share the one batch and the one MAX_COLLECTION limit.
    function buildRunBatch(oi, families){
      var c=newBatch('RUN');
      families.forEach(function(fam){
        for (var fi=oi; fi<orders.length; fi++){
          var ls=perOrder[fi].filter(function(l){ return l.mode==='RUN' && l.family===fam; });
          if (!ls.length) break;                 // the run ends at this order
          if (fill(c, ls, fi===oi)) break;
        }
      });
      return finish(c);
    }

    orders.forEach(function(o,oi){
      var mine=perOrder[oi];
      if (!mine.length){ out.push([]); return; }

      var need={};
      mine.forEach(function(l){ need[l.sku]=(need[l.sku]||0)+l.qty; });

      // Decide everything BEFORE building: fill() writes into pool, so a coverage
      // test taken afterwards would read a pool already holding the batch we are
      // still deciding about.
      var runFamilies=[], seenFam={}, wantFull=false, modeSeq=[];
      mine.forEach(function(l){
        if ((pool[l.sku]||0) >= need[l.sku]) return;      // pool already covers it
        if (l.mode==='FULL'){ if(!wantFull){ wantFull=true; modeSeq.push('FULL'); } }
        else {
          if (!runFamilies.length) modeSeq.push('RUN');
          if (!seenFam[l.family]){ seenFam[l.family]=true; runFamilies.push(l.family); }
        }
      });

      // Drop any family whose run is a single order - see runLength() above.
      // Done AFTER the pool test so a family the pool already covers never got
      // this far, and BEFORE building so fill() is not asked for a batch we are
      // about to discard (fill writes into pool; an unwanted write would starve
      // a later, genuine run of the same shade).
      runFamilies = runFamilies.filter(function(f){ return runLength(oi,f) >= 2; });
      if (!runFamilies.length){
        modeSeq = modeSeq.filter(function(m){ return m!=='RUN'; });
      }

      var made=modeSeq.map(function(m){ return m==='FULL' ? buildFullBatch(oi) : buildRunBatch(oi, runFamilies); });
      /* The pool is stock ALREADY on the trolley, so it cannot go below zero.
         Before the run-of-one rule every collectible arrived via a batch, so a
         plain subtraction never went negative. Now a suppressed family is
         picked straight off the shelf with its own order and contributes
         nothing to the trolley - without the clamp its count went to -1 and
         stayed there, and the next genuine run of that shade was measured
         against a debt it had already paid, producing a second card for stock
         the packer was holding. */
      Object.keys(need).forEach(function(k){
        pool[k]=Math.max(0,(pool[k]||0)-need[k]);
      });
      out.push(made);
    });
    return out;
  }

  function sizeOf(sku){
    var s=String(sku||'').toUpperCase();
    var hit=(w.REF&&w.REF.sot)?w.REF.sot[s]:null;
    if (hit && hit[2]) return hit[2];                       // SOT is authoritative
    // The millimetre-size grammar belongs to the LS families only. WCB7BS is cage
    // size 7, not 7mm, and WCCYSQBM2PK ends in a 2-pack code - reading either as
    // a size printed "7mm" and "2mm" on the collection card.
    if (s.indexOf('LS')!==0) return '';
    var m=s.replace(/APK$/,'').match(/^[A-Z]+(\d+)/);
    return m?m[1]:'';
  }

  // Family is part of the key, so two different shade families never merge into
  // one card. Same size and colour does not make LSBS160OR and LSGD160OR the
  // same product, and a merged card could not say how many of each to take.
  function groupCollected(items){
    var order=[], map={};
    items.forEach(function(it){
      var k=it.family+'|'+it.size+'|'+it.colour;
      if (!map[k]){ map[k]={size:it.size, colour:it.colour, qty:0, skus:[], orders:[], img:it.img}; order.push(k); }
      map[k].qty+=it.qty;
      if (map[k].skus.indexOf(it.sku)===-1) map[k].skus.push(it.sku);
      if (it.order && map[k].orders.indexOf(it.order)===-1) map[k].orders.push(it.order);
    });
    return order.map(function(k){ return map[k]; });
  }

  /* ---- speech -------------------------------------------------------------
     One segment per component. Postcode and note ride on the LAST component so
     no extra Next is needed for information the packer does not pick. */
  function speechFor(order){
    var segs=[];
    order.lines.forEach(function(l){
      var text = l.name ? l.name
               : (l.sku ? 'This one' + (l.colour ? ' ' + l.colour : '') : '');
      if (!text) return;                       // nothing at all to say
      segs.push({say:':: '+text+' :: '+l.qty+' ::', line:l});
    });
    if (!segs.length) return segs;

    var intro=[packlistSpeech(order), order.isMerge ? 'Merge Order' : ''].filter(Boolean).join('. ');
    if (intro) segs[0].say = intro + '. ' + segs[0].say;
    var tail=[];
    if (order.instructionQr) tail.push(order.instructionQr + '.');
    if (order.address) tail.push(':Post Code: ' + String(order.address).split('').filter(function(c){return c.trim();}).join(' '));
    var note=[];
    if (order.note) note.push(order.note);
    if (note.length) tail.push(': Note : ' + note.join(' . '));
    if (tail.length) segs[segs.length-1].say += ' ' + tail.join(' ');
    return segs;
  }

  w.Engine = {
    parseDoc: parseDoc, packlistSpeech: packlistSpeech, buildCollections: buildCollections, speechFor: speechFor,
    productType: productType, productColour: productColour, productName: productName,
    packSize: packSize, baseSku: baseSku, orderTypeName: orderTypeName, applyPriority: applyPriority, sizeOf: sizeOf,
    collectionFamily: collectionFamily, collectionScopeLabel: collectionScopeLabel,
    MAX_COLLECTION: MAX_COLLECTION
  };
})(window);
