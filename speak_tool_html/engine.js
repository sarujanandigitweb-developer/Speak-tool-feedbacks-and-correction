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
  var PACK = {'2PK':2,'3PK':3,'4PK':4,'5PK':5,'6PK':6,'7PK':7,'8PK':8,'9PK':9,
              'APK':10,'CPK':20,'DPK':30,'EPK':50,'FPK':100,'NPK':200,
              'PPK':300,'QPK':500,'RPK':1000};
  function packSize(sku){ var s=String(sku||'').toUpperCase();
    return s.length>=3 ? (PACK[s.slice(-3)]||1) : 1; }

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
  function productName(sku){
    var k=String(sku||'').trim().toUpperCase();
    var n=(w.REF&&w.REF.names)?w.REF.names[k]:'';
    if (n) return n;
    var base=k.replace(/\d*A?PK$/,'');                 // LSFT220BG5PK -> LSFT220BG
    return (w.REF&&w.REF.names&&w.REF.names[base]) || '';
  }

  /* ---- packing priority ---------------------------------------------------
     Conditional: which ranking applies depends on whether the order holds a
     Rectangle Ceiling Rose. Rule given 2026-08-14/17. */
  var RANK_RECT = {RECT_ROSE:1, SHADE:2, BULB:3, ROSE:4, OTHER:4};
  var RANK_PLAIN= {SHADE:1, ROSE:2, BULB:3, OTHER:4};
  function rank(type, hasRect){ return (hasRect?RANK_RECT:RANK_PLAIN)[type] || 4; }

  function applyPriority(lines){
    var hasRect = lines.some(function(l){ return l.type==='RECT_ROSE'; });
    return lines
      .map(function(l,i){ return {l:l, i:i, r:rank(l.type,hasRect)}; })
      .sort(function(a,b){ return a.r-b.r || a.i-b.i; })   // stable
      .map(function(x){ return x.l; });
  }

  /* ---- parse one pack list document --------------------------------------
     Selectors are the dashboard's own classes, as used by speak_tool/app.py and
     re-verified against 17 saved pack lists. */
  function parseDoc(doc, sourceName){
    var orders=[];
    var nodes=doc.querySelectorAll('li.bg-white');

    for (var oi=0; oi<nodes.length; oi++){
      var node=nodes[oi];
      var custBlocks=node.querySelectorAll('div.col-2.small');
      var customer = custBlocks.length>1 ? txt(custBlocks[1]) : '';
      var address  = txt(node.querySelector('div.fs-6'));
      var platform = txt(node.querySelector('div.bg-light.border'));
      var price    = txt(node.querySelector('div.text-end span span:nth-child(2)'));

      var lines=[];
      var prods=node.querySelectorAll("div.p-1[id$='-li']");
      for (var pi=0; pi<prods.length; pi++){
        var pd=prods[pi];
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
            lines.push(makeLine({
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
          lines.push(makeLine({sku:parent, combined:'', title:title, link:link,
                               colourRaw:'', qty:adj, img:mainImg, imgEl:mainImgEl}));
        }
      }
      if (!lines.length) continue;

      orders.push({
        customer:customer, address:address, platform:platform, price:price,
        // The <li> this order was read from. The pack-list extension scrolls to
        // it, so the page moves with the speech. Never serialised - persist()
        // copies named fields only, so this cannot reach JSON.stringify.
        node:node,
        source:sourceName||'', lines:applyPriority(lines),
        // Fields the pack list does NOT carry. They exist only because the team
        // types them in, so the tool owns them now instead of a spreadsheet.
        note:'', status:'', instructionQr:''
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

     The 15 limit is PER LIST, not shared: an order short on both lists triggers
     two collections of up to 15 each, shown as two cards.

     Never collect everything up front, and "insufficient" is checked PER SKU -
     15 of the wrong shade does not help. */
  var MAX_COLLECTION = 15;

  var COLLECT_RUN_PREFIXES = ['LSBS','LSSS','LSWE','WCCY','LSCYRO','LSBG','LSCG',
                              'LSFG','LSGD','LSGG','LSGL','WCB','WCD'];
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

    // One batch, but each family walks only its OWN run of consecutive orders
    // and stops at the first order that does not carry it. Families short on the
    // same order share the one batch and the one 15 limit.
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

      var made=modeSeq.map(function(m){ return m==='FULL' ? buildFullBatch(oi) : buildRunBatch(oi, runFamilies); });
      Object.keys(need).forEach(function(k){ pool[k]=(pool[k]||0)-need[k]; });
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

    var tail=[];
    if (order.address) tail.push(':Post Code: ' + String(order.address).split('').filter(function(c){return c.trim();}).join(' '));
    var note=[];
    if (order.instructionQr) note.push(order.instructionQr);
    if (order.note) note.push(order.note);
    if (note.length) tail.push(': Note : ' + note.join(' . '));
    if (tail.length) segs[segs.length-1].say += ' ' + tail.join(' ');
    return segs;
  }

  w.Engine = {
    parseDoc: parseDoc, buildCollections: buildCollections, speechFor: speechFor,
    productType: productType, productColour: productColour, productName: productName,
    packSize: packSize, applyPriority: applyPriority, sizeOf: sizeOf,
    collectionFamily: collectionFamily, collectionScopeLabel: collectionScopeLabel,
    MAX_COLLECTION: MAX_COLLECTION
  };
})(window);
