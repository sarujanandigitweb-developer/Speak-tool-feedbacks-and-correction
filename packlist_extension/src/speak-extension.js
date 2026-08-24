/* ===========================================================================
   SPEAK TOOL — PACK LIST EXTENSION
   ---------------------------------------------------------------------------
   Adds voice packing to the dashboard's existing Order Pack List page.

   IT DOES NOT TOUCH THE PACK LIST UI.
   Everything this file adds is position:fixed and lives in its own container
   (#stx-root). It never edits, removes or restyles a single existing element.
   The one mark it leaves on the page is an OUTLINE on the order being packed —
   `outline` draws outside the box and takes no layout space, so nothing on the
   page moves. Set STX.highlight = false below to remove even that.

   It reads the page that is already on screen. It does NOT read the Google
   Sheet, and it does NOT read the Cleaned Data sheet.

   Requires, loaded before this file:
     REF     — names master + Lampshade SOT   (reference-data.js)
     Engine  — parsing and packing rules      (engine.js)

   Names come from the master sheet and from nowhere else. The pack list carries
   its own marketplace title, and that title is deliberately never spoken: it is
   listing copy written for a customer, not a picking instruction. Where the
   master sheet has no name the row is announced as "This one" plus its colour,
   which is the rule already in use on the sheet build.
   =========================================================================== */
(function (w, d) {
  'use strict';

  if (w.__stxLoaded) return;                       // a second <script> tag is harmless
  w.__stxLoaded = true;

  var STX = w.STX = {
    debug: false,             // STX.debug = true -> every mic event in the console
    misses: [],               // STX.misses -> transcripts that matched no command
    highlight: true,          // outline the order being packed
    zoom: 'auto',             // 'auto' | 'own' | 'native' | 'off' - see zoomFor()
    listenWhileSpeaking: true,// hear "next" even while the tool is talking
    meter: true               // live microphone level, like a call app
  };

  /* ---------------------------------------------------------------- state */
  var ORDERS = [], QUEUE = [], index = 0, segIndex = 0;

  /* HOLD — temporarily skip an order and come back to it.
   *
   * No second navigation system: `index` over QUEUE stays the one cursor. All
   * Hold does is decide which entries this pass is allowed to land on, so
   * Next/Back/Repeat/Postcode keep working exactly as they did.
   *
   * HELD holds orderIndex values, not QUEUE positions, because one order can
   * own two QUEUE entries (a collection card plus the order itself). Holding by
   * orderIndex keeps them together - packing a shade collection separately from
   * the order that needs it would be worse than not holding at all. */
  var HELD = [];              // orderIndex values, in the order they were held
  /* WHERE THE NORMAL PASS WAS LEFT, saved the moment the held pass starts.
   *
   * Without it the tool had no idea, and endOfPass() guessed with step(-1, 1) -
   * a forward scan from the top. By the time that line runs HELD is empty and
   * mode is back to 'normal', so inMode() is true for every entry and the scan
   * returns entry 0. A packer who held order 4, packed on to 7 and then worked
   * their held order was sent back to order 1 with no way to tell it had
   * happened. Reported from the floor 2026-08-24. */
  var resumeAt = null;        // { i: queue index, s: segment } | null
  var mode = 'normal';        // 'normal' | 'held' - which pass is running
  var normalPassDone = false; // the normal pass has reached its end
  var allComplete = false;    // both passes finished - drives the status chip
  var filesMerged = 0;           // how many pack lists this page was built from
  var synth = w.speechSynthesis;
  var voices = [], selectedVoice = null, speechRate = 0.7;
  var paused = false, speechToken = 0;

  function $(id) { return d.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* =========================================================================
     SPEECH TEXT — identical wording to the Google Sheet build
     =========================================================================
     Per component:   [name or "This one" + colour]  ::  [count]  ::
     Last component:  … then the postcode, spelled out.

     The postcode is ALWAYS last. On the sheet a typed note could follow it, but
     the pack list carries no Instruction QR and no Send Order Instruction
     field, so there is nothing that could come after. */

  // ONE name path, shared with the engine: the master sheet, and a second look
  // with the pack suffix removed (LSFT220BG5PK -> LSFT220BG). Nothing else is
  // consulted - in particular not the pack list's own marketplace title.
  function nameFor(sku) {
    var n = w.Engine.productName(sku);
    return n ? String(n).trim() : '';
  }

  /* THE COLLECTION CARD NAMES ITS SHADES.
   *
   * A collection group is keyed by family+size+colour, so one card can cover
   * more than one SKU (LSBS160OR and LSBS160OR5PK merge). The name is taken
   * from the FIRST of that card's SKUs that the SOT actually carries, and read
   * through nameFor() - the same master-sheet path every order line already
   * uses, live sheet first and built-in table second.
   *
   * The SOT test is what the business asked for and it is not decoration: a SKU
   * the SOT does not carry has no authoritative name, and printing a guessed
   * one on a picking card is worse than printing none. Those cards keep exactly
   * the size + colour wording they have today. */
  /* The pack suffix is stripped for the second look, exactly as productName()
   * does it. LSFT220BG5PK is not a row in the SOT - LSFT220BG is - but a
   * five-pack of an SOT shade is still an SOT shade, and the master sheet names
   * it. Measured on the 13 live pack lists: 12 of the 92 collectible SKUs are
   * pack-suffixed, so an exact-match-only test would drop the name from one
   * collection card in eight for no reason a packer could work out. */
  function isSotSku(sku) {
    var sot = (w.REF && w.REF.sot) || null;
    if (!sot) return false;
    var k = String(sku || '').trim().toUpperCase();
    return !!(sot[k] || sot[k.replace(/\d*A?PK$/, '')]);
  }

  function collectionName(g) {
    var skus = (g && g.skus) || [];
    for (var i = 0; i < skus.length; i++) {
      if (!isSotSku(skus[i])) continue;
      var n = nameFor(skus[i]);
      if (n) return n;
    }
    return '';
  }

  function productSpeech(name, colour, sku) {
    if (name) return ':: ' + name;
    if (!sku) return '';                            // nothing at all to say
    return ':: This one' + (colour ? ' ' + colour : '');
  }

  // Spelled character by character, exactly as the sheet build reads it.
  function postcodeSpeech(pc) {
    var t = String(pc || '').trim();
    if (!t) return '';
    var chars = t.split('').filter(function (c) { return c.trim() !== ''; });
    return ':Post Code: ' + chars.join(' ');
  }

  // One spoken step per component. Next moves one step, so the packer can put
  // that component in the box before hearing the next one.
  function orderSegments(o) {
    var segs = [];
    o.lines.forEach(function (l) {
      var text = productSpeech(nameFor(l.sku), l.colour, l.sku);
      if (!text) return;                            // truly empty row
      var qty = (l.qty === '' || l.qty == null) ? '' : String(l.qty);
      segs.push({ say: text + (qty ? ' :: ' + qty + ' ::' : ''), line: l });
    });
    if (!segs.length) return segs;

    var pc = postcodeSpeech(o.address);
    if (pc) segs[segs.length - 1].say += ' ' + pc;  // rides on the last component
    return segs;
  }

  function collectionSegments(c) {
    var say = ['Collect lampshades first.', 'Collection ' + c.batch + '.',
               c.total + ' lampshade' + (c.total === 1 ? '' : 's') + '.'];
    c.groups.forEach(function (g) {
      // Name FIRST, then the size and colour that were already spoken. The
      // colour is deliberately kept rather than replaced by the name the way
      // productSpeech() does it: on a shelf trip the packer is matching a
      // colour by eye across several cards, and dropping it to save a word
      // would take information away from the one step that needs it most.
      var nm = collectionName(g);
      say.push((nm ? nm + '. ' : '') +
               (g.size ? g.size + ' millimeter. ' : '') +
               (g.colour || 'colour unknown') + '. ' + g.qty + '.');
    });
    say.push('Then pack this order.');
    return [{ say: say.join(' '), line: null }];
  }

  function segments() {
    var e = QUEUE[index];
    if (!e) return [];
    return e.kind === 'collection' ? collectionSegments(e.collection) : orderSegments(e.order);
  }

  /* =========================================================================
     QUEUE — collections interleaved before the order that triggered them
     ========================================================================= */
  function buildQueue() {
    var collections = w.Engine.buildCollections(ORDERS);
    QUEUE = [];
    ORDERS.forEach(function (o, i) {
      // An order short on BOTH prefix lists triggers two collections, each with
      // its own limit of Engine.MAX_COLLECTION. Each becomes its own queue entry.
      (collections[i] || []).forEach(function (c) {
        QUEUE.push({ kind: 'collection', collection: c, order: o, orderIndex: i });
      });
      QUEUE.push({ kind: 'order', order: o, orderIndex: i });
    });
  }

  /* =========================================================================
     PANEL — fixed, in its own container, nothing of the page is touched
     ========================================================================= */
  var CSS = [
    '#stx-root,#stx-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}',
    /* ABOVE the collection dialog. The dialog is a full-viewport overlay
       (inset:0), so with a lower z-index the bar was painted underneath it and
       every click landed on the backdrop instead of the button. The dialog
       reserves room at the bottom with its own padding, so the bar sits in
       clear space rather than over the cards. */
    '#stx-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483003;background:#12181F;color:#EAF0F5;',
      'box-shadow:0 -2px 14px rgba(0,0,0,.34);padding:9px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}',
    '#stx-bar.stx-min{padding:5px 14px}',
    '#stx-bar.stx-min .stx-hideable{display:none}',
    '#stx-pos{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:#8FA3B5;',
      'font-variant-numeric:tabular-nums;white-space:nowrap}',
    '#stx-say{flex:1 1 260px;min-width:0;font-size:16px;font-weight:600;line-height:1.35;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#stx-bar button{font-size:14px;font-weight:500;color:#EAF0F5;background:#243040;border:1px solid #3A4A5E;',
      'border-radius:5px;padding:8px 13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin:0}',
    '#stx-bar button:hover{background:#2E3D50;border-color:#54677E}',
    '#stx-bar button:focus-visible{outline:2px solid #4FB0C6;outline-offset:1px}',
    '#stx-bar button.stx-primary{background:#0F6E76;border-color:#0F6E76;font-weight:600}',
    '#stx-bar button.stx-primary:hover{background:#12858F;border-color:#12858F}',
    '#stx-pause.stx-on{background:#1F7A4D;border-color:#1F7A4D}',
    '.stx-names{display:flex;flex-direction:column;gap:6px;align-items:flex-start}',
    '#stx-namestat{font-size:12px;line-height:1.4;color:#9FB0BE}',
    '#stx-namestat.stx-live{color:#7FD1A0}',
    '#stx-namestat.stx-stale{color:#E0AE4F}',
    '#stx-namesbtn{font-size:12.5px;padding:5px 11px}',
    '#stx-status{font-size:13px;font-weight:600;padding:4px 11px;border-radius:99px;white-space:nowrap;',
    '  border:1px solid #3A4A5E;background:#1B2430;color:#B9C6D4}',
    '#stx-status.stx-warn{border-color:#7A5A1F;background:#33280F;color:#F0C674}',
    '#stx-status.stx-done{border-color:#1F7A4D;background:#12301F;color:#7FD1A0}',
    /* Hold: amber, so it reads as "set aside" rather than as a nav button. The
       Held button is dimmed while the list is empty instead of being hidden -
       a button that appears and disappears is harder to find than a dim one. */
    '#stx-hold{background:#7A5A1F;border-color:#7A5A1F}',
    '#stx-hold:hover{background:#8F6B25;border-color:#8F6B25}',
    '#stx-heldbtn.stx-empty{opacity:.45}',
    '#stx-heldbtn.stx-on{background:#7A5A1F;border-color:#7A5A1F}',
    /* Mic chip. The state is carried by colour AND by how the dot moves, so it
       reads from across the bench: slow pulse = waiting for you, fast pulse =
       hearing you right now, still = not listening. */
    '#stx-mic{font-size:12.5px;padding:5px 11px;border-radius:99px;border:1px solid #3A4A5E;white-space:nowrap;',
      'display:inline-flex;align-items:center;gap:7px}',
    '#stx-mic .stx-dot{width:9px;height:9px;border-radius:50%;background:#8FA3B5;flex:none}',
    /* Level meter. Six segments driven by the real microphone level, the way a
       call app shows it - so the packer can SEE whether the headset is picking
       them up, instead of guessing from whether a command worked. */
    '#stx-mic .stx-bars{display:inline-flex;align-items:flex-end;gap:2px;height:13px}',
    '#stx-mic .stx-bars i{width:3px;border-radius:1px;background:#3A4A5E;display:block;',
      'transition:height .07s linear,background .12s linear}',
    '#stx-mic .stx-bars i:nth-child(1){height:4px}  #stx-mic .stx-bars i:nth-child(2){height:6px}',
    '#stx-mic .stx-bars i:nth-child(3){height:8px}  #stx-mic .stx-bars i:nth-child(4){height:10px}',
    '#stx-mic .stx-bars i:nth-child(5){height:11px} #stx-mic .stx-bars i:nth-child(6){height:13px}',
    '#stx-mic .stx-bars i.lit{background:#3FA96F}',
    '#stx-mic .stx-bars i.hot{background:#E0B341}',   /* loud enough to clip */
    '#stx-mic.listening{border-color:#3FA96F;color:#7FD9A6}',
    '#stx-mic.listening .stx-dot{background:#3FA96F;animation:stxPulse 1.6s ease-in-out infinite}',
    '#stx-mic.hearing{border-color:#5FD98F;color:#A8EFC4;background:#12301F}',
    '#stx-mic.hearing .stx-dot{background:#5FD98F;animation:stxPulse .5s ease-in-out infinite}',

    '#stx-mic.speaking{color:#8FA3B5}',
    '#stx-mic.paused{color:#8FA3B5;background:#1B242E}',
    '#stx-mic.err{border-color:#C86A5C;color:#F0A99C}  #stx-mic.err .stx-dot{background:#C86A5C}',
    '@keyframes stxPulse{0%,100%{opacity:1}50%{opacity:.3}}',

    /* Settings panel — sits above the bar, inside #stx-root like everything else */
    '#stx-set{position:fixed;right:12px;bottom:64px;z-index:2147483004;background:#12181F;',
      'border:1px solid #3A4A5E;border-radius:10px;padding:14px 16px;color:#EAF0F5;',
      'box-shadow:0 10px 34px rgba(0,0,0,.5);display:none;min-width:260px}',
    '#stx-set.on{display:block}',
    '#stx-set h4{margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:.1em;',
      'text-transform:uppercase;color:#8FA3B5}',
    '.stx-f{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}',
    '.stx-f:last-child{margin-bottom:0}',
    '.stx-f label{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:#8FA3B5}',
    '.stx-f select{font-family:inherit;font-size:14px;color:#EAF0F5;background:#243040;',
      'border:1px solid #3A4A5E;border-radius:6px;padding:7px 9px;cursor:pointer;max-width:300px}',
    '.stx-f select:hover{border-color:#54677E}',
    '.stx-f select:focus-visible{outline:2px solid #4FB0C6;outline-offset:1px}',
    '.stx-seg{display:flex;border:1px solid #3A4A5E;border-radius:6px;overflow:hidden}',
    '.stx-seg button{flex:1;font-family:inherit;font-size:13px;color:#B9C6D2;background:#243040;',
      'border:0;border-right:1px solid #3A4A5E;padding:7px 6px;cursor:pointer;margin:0}',
    '.stx-seg button:last-child{border-right:0}',
    '.stx-seg button:hover{background:#2E3D50}',
    '.stx-seg button[aria-pressed="true"]{background:#0F6E76;color:#fff;font-weight:600}',
    '.stx-spacer{margin-left:auto}',
    /* the ONLY mark left on the page: an outline, which takes no layout space */
    '.stx-active{outline:4px solid #0F6E76 !important;outline-offset:3px;scroll-margin-top:16px;scroll-margin-bottom:120px}',
    /* collection dialog, on the same page */
    '#stx-coll{position:fixed;inset:0;z-index:2147483001;background:rgba(12,18,24,.72);',
      // The bottom padding keeps the dialog box clear of the control bar. It is
      // generous because the bar wraps to two rows on a narrow window.
      'display:flex;align-items:center;justify-content:center;padding:26px 20px 150px;overflow:auto}',
    '#stx-coll-box{background:#FFF6E8;border:4px solid #B45F06;border-radius:16px;padding:22px 26px;',
      'max-width:1500px;width:100%;max-height:100%;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.4)}',
    '#stx-coll h2{font-size:27px;font-weight:800;color:#8A4405;text-align:center;margin:0 0 14px;letter-spacing:.01em}',
    '.stx-cbatch + .stx-cbatch{margin-top:20px;padding-top:18px;border-top:3px dashed #E0C9A4}',
    '.stx-chead{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:11px;margin:0 0 13px}',
    '.stx-chead b{font-size:21px;color:#5A2D03}',
    '.stx-scope{font-size:14px;font-weight:700;color:#8A4405;background:#F3E3C8;border-radius:99px;padding:4px 13px}',
    '.stx-ctot{font-size:17px;font-weight:700;color:#5A2D03}',
    '.stx-cgrid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}',
    '.stx-card{flex:0 0 218px;background:#FFFDF8;border:2px solid #E0C9A4;border-radius:14px;padding:11px;',
      'box-shadow:0 2px 5px rgba(0,0,0,.08)}',
    '.stx-card .stx-imgwrap{position:relative}',
    '.stx-card img{width:100%;height:158px;object-fit:contain;background:#fff;border-radius:10px;display:block}',
    '.stx-badge{position:absolute;top:6px;right:6px;background:#B45F06;color:#fff;min-width:40px;height:40px;',
      'border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:800;padding:0 8px}',
    '.stx-cname{font-size:17px;font-weight:800;color:#5A2D03;margin-top:9px;line-height:1.25}',
    /* With a name above it the SKU becomes the cross-check rather than the
       headline, so it steps back to the size and weight of the colour line. */
    '.stx-csku{font-size:18px;font-weight:700;color:#3B2A12;margin-top:9px;word-break:break-all}',
    '.stx-cname + .stx-csku{font-size:14px;font-weight:600;color:#7A6A55;margin-top:3px}',
    '.stx-ccol{font-size:16px;color:#5A2D03;margin-top:3px}',
    '.stx-csize{font-size:15px;color:#7A6A55;margin-top:2px}',
    '.stx-ctake{margin-top:7px;background:#F3E3C8;border-radius:8px;padding:5px 8px;font-size:17px;font-weight:700;color:#8A4405}',
    '.stx-cfor{font-size:12.5px;color:#9A8A75;margin-top:5px}',
    '#stx-coll-done{margin-top:18px;text-align:center;background:#B45F06;color:#fff;font-size:19px;',
      'font-weight:700;border-radius:10px;padding:12px}',
    /* Auto-zoom. Bottom inset keeps it clear of the control bar, and
       pointer-events:none on the backdrop means it never blocks a click on the
       pack list underneath - the packer can still use the page while it is up. */
    '#stx-zoom{position:fixed;left:0;right:0;top:0;bottom:96px;z-index:2147483002;',
      'display:flex;align-items:center;justify-content:center;padding:20px;',
      'background:rgba(12,18,24,.55);pointer-events:none}',
    '#stx-zoom-box{pointer-events:auto;background:#fff;border-radius:14px;padding:14px;',
      'box-shadow:0 18px 50px rgba(0,0,0,.45);max-width:min(760px,88vw);max-height:100%;',
      'display:flex;flex-direction:column;align-items:center;gap:10px;position:relative}',
    '#stx-zoom-box img{max-width:100%;max-height:60vh;object-fit:contain;display:block;border-radius:8px}',
    '#stx-zoom-cap{text-align:center;color:#14181D;line-height:1.3}',
    '#stx-zoom-cap .z-name{font-size:19px;font-weight:700;display:block}',
    '#stx-zoom-cap .z-sku{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:#6B7784;display:block;margin-top:2px}',
    '#stx-zoom-qty{background:#0F6E76;color:#fff;font-size:30px;font-weight:800;',
      'border-radius:10px;padding:5px 20px;line-height:1.15}',
    '#stx-zoom-x{position:absolute;top:6px;right:8px;border:0;background:transparent;',
      'font-size:22px;line-height:1;color:#6B7784;cursor:pointer;padding:4px 8px}',
    '#stx-zoom-x:hover{color:#14181D}',
    /* Start card. Deliberately in the middle of the screen and hard to miss:
       the packer must not stand waiting for a voice that is never coming. */
    '#stx-start{position:fixed;inset:0;z-index:2147483010;background:rgba(10,15,20,.72);',
      'display:flex;align-items:center;justify-content:center;padding:24px}',
    '#stx-start-box{background:#12181F;border:1px solid #3A4A5E;border-radius:14px;',
      'padding:30px 34px;text-align:center;max-width:440px;box-shadow:0 18px 50px rgba(0,0,0,.55)}',
    '#stx-start-t{margin:0 0 8px;font-size:23px;font-weight:700;color:#EAF0F5}',
    '#stx-start-s{margin:0 0 22px;font-size:14.5px;color:#8FA3B5;line-height:1.5}',
    '#stx-start-b{background:#0F6E76;color:#fff;border:0;border-radius:9px;',
      'padding:15px 34px;font-size:18px;font-weight:700;cursor:pointer;font-family:inherit}',
    '#stx-start-b:hover{background:#12858F}',
    '#stx-start-b:focus-visible{outline:3px solid #4FB0C6;outline-offset:3px}',
    /* Confirm dialog and Finished card share the Start card's shell: same dark
       panel, same radius, same shadow. A packer has already met that shape once
       at the top of the run, so neither of these reads as a new kind of thing. */
    '#stx-confirm,#stx-done{position:fixed;inset:0;z-index:2147483011;background:rgba(10,15,20,.72);',
      'display:flex;align-items:center;justify-content:center;padding:24px}',
    '.stx-modal{background:#12181F;border:1px solid #3A4A5E;border-radius:14px;',
      'padding:30px 34px;text-align:center;max-width:520px;width:100%;',
      'box-shadow:0 18px 50px rgba(0,0,0,.55);color:#EAF0F5}',
    '.stx-modal h3{margin:0 0 8px;font-size:23px;font-weight:700;color:#EAF0F5}',
    '.stx-modal p{margin:0 0 20px;font-size:14.5px;color:#8FA3B5;line-height:1.5}',
    '.stx-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}',
    '.stx-modal button{font-family:inherit;font-size:16px;font-weight:600;border-radius:9px;',
      'padding:13px 26px;cursor:pointer;border:1px solid #3A4A5E;background:#243040;color:#EAF0F5}',
    '.stx-modal button:hover{background:#2E3D50;border-color:#54677E}',
    '.stx-modal button:focus-visible{outline:3px solid #4FB0C6;outline-offset:3px}',
    '.stx-modal button.stx-yes{background:#0F6E76;border-color:#0F6E76}',
    '.stx-modal button.stx-yes:hover{background:#12858F;border-color:#12858F}',
    /* The say-this hint. The packer can click, but the whole point of the tool
       is that their hands are full, so the spoken answer is shown first. */
    '.stx-hint{margin:16px 0 0;font-size:13px;color:#8FA3B5}',
    '.stx-hint b{color:#7FD9A6}',
    /* Finished card. Green mark, and the numbers that make it checkable -
       "it says done, but done of how many?" is the first thing asked. */
    '#stx-done .stx-modal{border-color:#1F7A4D}',
    '.stx-tick{width:58px;height:58px;border-radius:50%;background:#12301F;border:2px solid #1F7A4D;',
      'color:#7FD1A0;font-size:30px;line-height:54px;margin:0 auto 14px}',
    '.stx-sum{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:0 0 22px}',
    '.stx-sum div{background:#1B2430;border:1px solid #3A4A5E;border-radius:10px;padding:11px 18px;min-width:96px}',
    '.stx-sum b{display:block;font-size:24px;font-weight:800;color:#EAF0F5;',
      'font-variant-numeric:tabular-nums;line-height:1.15}',
    '.stx-sum span{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:#8FA3B5}',
    '@media (prefers-reduced-motion:reduce){#stx-mic .stx-dot{animation:none}}'
  ].join('');

  function injectPanel() {
    var style = d.createElement('style');
    style.id = 'stx-style';
    style.textContent = CSS;
    d.head.appendChild(style);

    var root = d.createElement('div');
    root.id = 'stx-root';
    root.innerHTML =
      '<div id="stx-bar">' +
        '<span id="stx-pos">—</span>' +
      // Standing answer to "how much is left?" - visible on every order, not
      // only in the message that scrolls past when the pass ends.
      '<span id="stx-status">—</span>' +
        '<span id="stx-say"></span>' +
        '<span class="stx-hideable" style="display:contents">' +
          '<button type="button" data-act="restart">\u{1F501} Restart</button>' +
          '<button type="button" data-act="back">⏮ Back</button>' +
          '<button type="button" data-act="postcode">\u{1F4CD} Postcode</button>' +
          '<button type="button" id="stx-pause" data-act="pause">⏸ Pause</button>' +
          '<button type="button" data-act="repeat">\u{1F504} Repeat</button>' +
          '<button type="button" class="stx-primary" data-act="next">⏭ Next</button>' +
          '<button type="button" id="stx-hold" data-act="hold" title="Set this order aside and come back to it">\u270B Hold</button>' +
          '<button type="button" id="stx-heldbtn" class="stx-empty" data-act="showhold" title="Show the held orders">\u{1F4CB} Held (0)</button>' +
        '</span>' +
        '<span class="stx-spacer"></span>' +
        '<button type="button" class="stx-hideable" data-act="zoom" id="stx-zoombtn">\u{1F50D} Zoom on</button>' +
        '<button type="button" class="stx-hideable" data-act="settings" id="stx-setbtn" title="Language, voice and speed">\u2699 Voice</button>' +
        '<button type="button" class="stx-hideable" data-act="mic">\u{1F3A4} Mic</button>' +
        '<span id="stx-mic" class="stx-hideable"><span class="stx-dot"></span>' +
          '<span class="stx-bars" id="stx-level" title="Microphone level">' +
            '<i></i><i></i><i></i><i></i><i></i><i></i></span>' +
          '<span id="stx-mic-t">Starting</span></span>' +
        '<button type="button" data-act="fold" title="Collapse the bar">▾</button>' +
      '</div>';
    // Language / voice / speed, carried over from the Google Sheet build. Kept in
    // a panel rather than on the bar: they are set once at the start of a shift,
    // and the bar has to stay readable for the controls used on every order.
    var set = d.createElement('div');
    set.id = 'stx-set';
    set.innerHTML =
      '<h4>Voice settings</h4>' +
      '<div class="stx-f"><label for="stx-lang">Speaking language</label><select id="stx-lang"></select></div>' +
      // Which accent the MICROPHONE is matched against. Separate from the
      // speaking voice above - they are two different engines.
      '<div class="stx-f"><label for="stx-reclang">Listening accent</label>' +
        '<select id="stx-reclang">' +
          '<option value="en-GB">English (UK)</option>' +
          '<option value="en-IN">English (India / South Asia)</option>' +
          '<option value="en-US">English (US)</option>' +
        '</select></div>' +
      '<div class="stx-f"><label for="stx-voice">Voice</label><select id="stx-voice"></select></div>' +
      // Which SKU->Name table is actually in use. Shown rather than assumed:
      // a sheet that has quietly stopped being reachable must be visible, not
      // look identical to one that is working.
      '<div class="stx-f"><label>Names</label>' +
        '<div class="stx-names">' +
          '<span id="stx-namestat">Checking\u2026</span>' +
          '<button type="button" id="stx-namesbtn">Refresh Names</button>' +
        '</div></div>' +
      '<div class="stx-f"><label>Speed</label><div class="stx-seg" id="stx-rate">' +
        '<button type="button" data-r="0.6">Slow</button>' +
        '<button type="button" data-r="0.7" aria-pressed="true">Normal</button>' +
        '<button type="button" data-r="1.2">Fast</button>' +
        '<button type="button" data-r="1.5">Faster</button>' +
      '</div></div>';
    root.appendChild(set);

    /* Name status + manual refresh.
     *
     * A refresh needs no reload and no requeue: nameFor() is called from
     * orderSegments() and showZoom() at RENDER time, so re-rendering the order
     * the packer is on is enough to pick up a corrected name. */
    function paintNames() {
      var el = set.querySelector('#stx-namestat');
      if (!el || !w.STX_NAMES) return;
      var st = w.STX_NAMES.state;
      el.textContent = w.STX_NAMES.status();
      el.className = st.source === 'live' ? 'stx-live'
                   : st.source === 'cached' ? 'stx-stale' : '';
    }
    w.STX_paintNames = paintNames;

    var nb = set.querySelector('#stx-namesbtn');
    if (nb) {
      nb.onclick = function () {
        if (!w.STX_NAMES) return;
        nb.disabled = true;
        var was = nb.textContent;
        nb.textContent = 'Refreshing\u2026';
        w.STX_NAMES.refresh({ manual: true }).then(function (changed) {
          nb.disabled = false;
          nb.textContent = was;
          paintNames();
          if (changed) render();      // the order on screen picks up new names
        });
      };
    }
    paintNames();

    var rl = set.querySelector('#stx-reclang');
    if (rl) {
      rl.value = recLang;
      rl.onchange = function () { setRecLang(rl.value); };
    }

    set.addEventListener('click', function (ev) {
      var b = ev.target.closest('#stx-rate button[data-r]');
      if (!b) return;
      speechRate = parseFloat(b.getAttribute('data-r'));
      Array.prototype.forEach.call(set.querySelectorAll('#stx-rate button'), function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      speakCurrent();                       // hear the new speed immediately
    });

    d.body.appendChild(root);

    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      hideStart();                    // any press is the gesture the browser wanted
      if (a === 'pause') togglePause();
      else if (a === 'zoom') toggleZoom();
      else if (a === 'settings') { var sp = $('stx-set'); if (sp) sp.classList.toggle('on'); }
      else if (a === 'mic') toggleMic();
      else if (a === 'fold') $('stx-bar').classList.toggle('stx-min');
      else nav(a);
    });
  }

  // EVERY element the extension creates goes inside #stx-root. That makes the
  // "nothing is added outside our own container" guarantee structural rather
  // than a list a test has to keep up with - and it means one removeChild()
  // takes the whole tool off the page.
  function mount(el) {
    var root = $('stx-root') || d.body;
    root.appendChild(el);
  }

  /* =========================================================================
     COLLECTION DIALOG — shown on this page, removed when Next moves past it
     ========================================================================= */
  function collectionHtml(c) {
    var scope = w.Engine.collectionScopeLabel ? w.Engine.collectionScopeLabel(c.mode) : '';
    var cards = c.groups.map(function (g) {
      var img = g.img
        ? '<img src="' + esc(g.img) + '" alt="' + esc(g.skus.join(' + ')) + '">'
        : '<div style="height:158px;background:#fff;border-radius:10px;display:flex;align-items:center;' +
          'justify-content:center;color:#B9A88F;font-size:14px">No image</div>';
      // Above the SKU, because the name is what the packer reads first and the
      // SKU is what they check against afterwards. Absent for a non-SOT SKU, and
      // the card then looks exactly as it did before.
      var nm = collectionName(g);
      return '<div class="stx-card"><div class="stx-imgwrap">' + img +
        '<span class="stx-badge">' + esc(g.qty) + '</span></div>' +
        (nm ? '<div class="stx-cname">' + esc(nm) + '</div>' : '') +
        '<div class="stx-csku">' + esc(g.skus.join(' + ')) + '</div>' +
        '<div class="stx-ccol">' + esc(g.colour || '') + '</div>' +
        (g.size ? '<div class="stx-csize">' + esc(g.size) + 'mm</div>' : '') +
        '<div class="stx-ctake">Take ' + esc(g.qty) + '</div>' +
        '<div class="stx-cfor">' + esc(g.orders.join(', ')) + '</div></div>';
    }).join('');

    return '<div class="stx-cbatch">' +
      '<div class="stx-chead"><b>Collection Batch ' + esc(c.batch) + '</b>' +
        (scope ? '<span class="stx-scope">' + esc(scope) + '</span>' : '') +
        '<span class="stx-ctot">' + esc(c.total) + ' / ' + esc(w.Engine.MAX_COLLECTION) + '</span></div>' +
      '<div class="stx-cgrid">' + cards + '</div>' +
      (c.overflow ? '<div style="text-align:center;color:#A01C10;font-weight:700;margin-top:8px">' +
                    'This order alone exceeds the limit</div>' : '') +
      '</div>';
  }

  function showCollection(c) {
    hideCollection();
    var ov = d.createElement('div');
    ov.id = 'stx-coll';
    ov.innerHTML = '<div id="stx-coll-box" role="dialog" aria-label="Lampshade collection">' +
      '<h2>\u{1F6D2} LAMPSHADE COLLECTION</h2>' + collectionHtml(c) +
      '<div id="stx-coll-done">COLLECTION COMPLETE — say or press Next</div></div>';
    mount(ov);
  }

  function hideCollection() {
    var ov = $('stx-coll');
    if (ov) ov.parentNode.removeChild(ov);
  }

  /* =========================================================================
     AUTO-ZOOM — the picture of the SKU being spoken, opened by itself
     =========================================================================
     The pack list shows products in the dashboard's own order, but the tool
     SPEAKS them in packing-priority order, so the item being called out is
     rarely the one the eye lands on. Zooming its picture is what ties the two
     together - it replaces the numbered thumbnail strip the sheet build used,
     which cannot be added here without changing the page.

     The page's own zoom is tried FIRST, so on the live dashboard the packer
     sees exactly the viewer they already know. Whether that exists is decided
     once, by clicking an image and watching for a new element; the saved pack
     lists carry no zoom code at all, so there the tool falls back to its own.

     STX.zoom = 'auto' (default) | 'own' | 'native' | 'off'  */

  var nativeZoom = null;          // null = not yet decided, true/false after

  // Counts only the page's own top-level elements. Ours all live inside
  // #stx-root, so they can never be mistaken for a zoom viewer opening.
  function bodyKids() {
    var n = 0, kids = d.body.children;
    for (var i = 0; i < kids.length; i++) if (kids[i].id !== 'stx-root') n++;
    return n;
  }

  // Does this page wire up its own image zoom? Answered once, from one click.
  function detectNativeZoom(imgEl) {
    if (!imgEl) return false;
    var before = bodyKids();
    try { imgEl.click(); } catch (e) { return false; }
    var opened = bodyKids() > before ||
                 !!d.querySelector('.modal.show, .lightbox, .fancybox-container, [class*="zoom"][style*="display: block"]');
    if (opened) {
      // Put the page back as it was; the real zoom will be opened per segment.
      try { d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {}
    }
    return opened;
  }

  function hideZoom() {
    var z = $('stx-zoom');
    if (z) z.parentNode.removeChild(z);
  }

  function showZoom(line) {
    hideZoom();
    var src = line && (line.img || (line.imgEl && line.imgEl.getAttribute('src')));
    if (!src) return;

    var name = nameFor(line.sku) || 'This one' + (line.colour ? ' ' + line.colour : '');
    var z = d.createElement('div');
    z.id = 'stx-zoom';
    z.innerHTML =
      '<div id="stx-zoom-box">' +
        '<button type="button" id="stx-zoom-x" title="Close">&times;</button>' +
        '<img src="' + esc(src) + '" alt="' + esc(line.sku) + '">' +
        '<div id="stx-zoom-qty">&times; ' + esc(line.qty) + '</div>' +
        '<div id="stx-zoom-cap"><span class="z-name">' + esc(name) + '</span>' +
        '<span class="z-sku">' + esc(line.sku) + '</span></div>' +
      '</div>';
    mount(z);
    z.addEventListener('click', function (ev) {
      if (ev.target === z || ev.target.id === 'stx-zoom-x') hideZoom();
    });
  }

  // Called on every segment change.
  function zoomFor(line) {
    if (STX.zoom === 'off') { hideZoom(); return; }
    if (!line) { hideZoom(); return; }

    if (STX.zoom === 'own')    { showZoom(line); return; }
    if (STX.zoom === 'native') { if (line.imgEl) line.imgEl.click(); return; }

    if (nativeZoom === null) nativeZoom = detectNativeZoom(line.imgEl);
    if (nativeZoom && line.imgEl) { line.imgEl.click(); return; }
    showZoom(line);
  }

  /* =========================================================================
     START — the one click a browser insists on
     =========================================================================
     Chrome will not play speech until the page has had a user gesture. A pack
     list opened by navigation has had none, so the very first line was accepted
     by speechSynthesis and then silently dropped: no error, no sound, and the
     packer is looking at order 1 hearing nothing.

     So the tool asks. It still TRIES to speak on load - where the browser allows
     it, nothing is shown - and only if no audio actually began does this card
     appear. Pressing it is the gesture, and the first item is spoken. */
  var spoken = false;

  function showStart() {
    if ($('stx-start') || spoken) return;
    var c = d.createElement('div');
    c.id = 'stx-start';
    c.innerHTML =
      '<div id="stx-start-box" role="dialog" aria-label="Start packing">' +
        '<p id="stx-start-t">Ready to pack</p>' +
        '<p id="stx-start-s">Order 1 of ' + ORDERS.length + ' is loaded. ' +
        'Chrome needs one press before it can speak.</p>' +
        '<button type="button" id="stx-start-b">\u25B6 Start packing</button>' +
      '</div>';
    mount(c);
    var b = $('stx-start-b');
    b.addEventListener('click', function () {
      hideStart();
      index = 0; segIndex = 0;
      render();
      speakCurrent();          // this click IS the gesture, so it will be heard
    });
    b.focus();
  }

  function hideStart() {
    var c = $('stx-start');
    if (c) c.parentNode.removeChild(c);
  }

  /* =========================================================================
     CONFIRM — "are you sure?" for the one control that throws work away
     =========================================================================
     Restart used to fire the instant it was pressed or heard, and it clears
     everything: the position, the held list, both pass flags. On a bench that
     is one syllable away from losing a shift's progress - the voice command is
     /\b(restart|start)\b/, and "start" is a word a packer says out loud.

     So Restart now ASKS, and the answer arrives the same three ways every other
     control does: the Yes button, the Enter key, or the spoken word. One
     pending question at a time, held in confirmPending. */
  var confirmPending = null;         // { onYes: fn } while a question is up

  function hideConfirm() {
    confirmPending = null;
    var c = $('stx-confirm');
    if (c) c.parentNode.removeChild(c);
  }

  function askConfirm(title, detail, onYes) {
    hideConfirm();
    confirmPending = { onYes: onYes };
    var c = d.createElement('div');
    c.id = 'stx-confirm';
    c.innerHTML =
      '<div class="stx-modal" role="alertdialog" aria-label="' + esc(title) + '">' +
        '<h3>' + esc(title) + '</h3>' +
        '<p>' + esc(detail) + '</p>' +
        '<div class="stx-acts">' +
          '<button type="button" class="stx-yes" data-act="yes">\u2713 Yes, restart</button>' +
          '<button type="button" data-act="no">Cancel</button>' +
        '</div>' +
        '<p class="stx-hint">Say <b>Yes</b> to confirm, or <b>No</b> to cancel.</p>' +
      '</div>';
    mount(c);
    var y = c.querySelector('button[data-act="yes"]');
    if (y) y.focus();
    /* The prompt deliberately does NOT contain the word "yes".
     * The microphone stays open while the tool talks, so a spoken "say yes to
     * restart" is transcribed straight back and matched as the answer to its
     * own question. isSelfEcho() guards it as well, but the reliable fix is to
     * never put the trigger word into the tool's mouth. */
    speak('Do you want to restart from the first order?');
  }

  function askRestart() {
    var c = counts();
    askConfirm(
      'Restart from the first order?',
      'This clears where you are' + (c.held ? ', the ' + c.held + ' held order' +
        (c.held > 1 ? 's' : '') : '') + ' and starts the whole pack list again.',
      doRestart);
  }

  // The original Restart body, unchanged - only the way it is reached is new.
  function doRestart() {
    hideFinished();
    index = 0; segIndex = 0;
    HELD = []; mode = 'normal'; normalPassDone = false; allComplete = false;
    resumeAt = null;
    updateHoldUI();
    render(); speakCurrent();
  }

  /* =========================================================================
     FINISHED — the end of the run, said plainly
     =========================================================================
     The status chip already turned green, but a chip on a bar is not an answer
     to "am I done?" from two steps back from the bench. allDone() is the only
     terminal state the tool has, so it gets a card: the tick, the numbers that
     make the claim checkable, and the only two things left to do. */
  function hideFinished() {
    var c = $('stx-done');
    if (c) c.parentNode.removeChild(c);
  }

  function showFinished() {
    hideFinished();
    var colls = 0;
    for (var i = 0; i < QUEUE.length; i++) if (QUEUE[i].kind === 'collection') colls++;

    var tiles = '<div><b>' + esc(ORDERS.length) + '</b><span>Orders packed</span></div>';
    if (colls) tiles += '<div><b>' + esc(colls) + '</b><span>Collection' + (colls > 1 ? 's' : '') + '</span></div>';
    // Only when the loader merged several pack lists - one file needs no count.
    if (filesMerged > 1) tiles += '<div><b>' + esc(filesMerged) + '</b><span>Pack lists</span></div>';

    var c = d.createElement('div');
    c.id = 'stx-done';
    c.innerHTML =
      '<div class="stx-modal" role="dialog" aria-label="All orders packed">' +
        '<div class="stx-tick">\u2713</div>' +
        '<h3>All orders packed</h3>' +
        '<p>Every order on this pack list has been read, and no orders are being held.</p>' +
        '<div class="stx-sum">' + tiles + '</div>' +
        '<div class="stx-acts">' +
          '<button type="button" class="stx-yes" data-act="restart">\u{1F501} Start again</button>' +
          '<button type="button" data-act="closedone">Close</button>' +
        '</div>' +
      '</div>';
    mount(c);
    var b = c.querySelector('button[data-act="closedone"]');
    if (b) b.focus();
  }

  /* =========================================================================
     MOVING THROUGH THE PAGE
     ========================================================================= */
  var lastActive = null;

  function focusOrder(node) {
    if (lastActive) { lastActive.classList.remove('stx-active'); lastActive = null; }
    if (!node) return;
    if (STX.highlight) { node.classList.add('stx-active'); lastActive = node; }
    // Scrolling is a convenience; it must never be able to stop the packing.
    // The old version called scrollIntoView() again inside its own catch, so an
    // engine without the method threw a second time, uncaught - which killed
    // boot() after the bar was drawn but before the queue was published, and
    // the tool looked dead while sitting on the screen.
    if (typeof node.scrollIntoView !== 'function') return;
    try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) {
      try { node.scrollIntoView(); } catch (e2) { /* not scrollable - carry on */ }
    }
  }

  function render() {
    var e = QUEUE[index];
    if (!e) return;

    if (e.kind === 'collection') {
      showCollection(e.collection);
      // The collection is a shelf trip, not a parcel, so no order is outlined.
      if (lastActive) { lastActive.classList.remove('stx-active'); lastActive = null; }
    } else {
      hideCollection();
      focusOrder(e.order.node);
    }

    var segs = segments();
    rememberPosition();
    updateStatus();          // Remaining count follows the cursor, every order

    // When several pack lists were merged into one view, say which one this
    // order came from. The loader tags each row with data-stx-file; a single
    // pack list carries no tag and nothing extra is shown.
    var fileTag = '';
    if (e.kind === 'order' && e.order.node && filesMerged > 1) {
      var f = e.order.node.getAttribute('data-stx-file');
      if (f) fileTag = '  ·  file ' + f;
    }

    $('stx-pos').textContent =
      (e.kind === 'collection' ? 'Collection' : 'Order ' + (e.orderIndex + 1) + ' of ' + ORDERS.length) +
      '  ·  Item ' + (segIndex + 1) + ' of ' + Math.max(1, segs.length) + fileTag;
    $('stx-say').textContent = segs[segIndex] ? segs[segIndex].say : '';

    // The picture of the component being spoken, opened by itself. A collection
    // step has its own dialog with all the pictures on it, so no zoom there.
    try {
      if (e.kind === 'collection') hideZoom();
      else zoomFor(segs[segIndex] ? segs[segIndex].line : null);
    } catch (err) { console.warn('[Speak Tool] zoom:', err); }
  }

  /* WHERE THE PACKER HAD GOT TO.
     Restoring the page but not the position would still lose the shift: the
     packer would be looking at order 1 having packed forty. Two small numbers
     in sessionStorage - per tab, gone when the tab closes, which is exactly the
     life of one packing run. */
  function rememberPosition() {
    try {
      sessionStorage.setItem('stxPos', JSON.stringify({
        i: index, s: segIndex, n: QUEUE.length,
        // Session-scoped, same as the position: a held order must survive an
        // accidental refresh mid-shift. No new storage mechanism is introduced.
        h: HELD, m: mode, d: normalPassDone,
        // Saved with the rest of it: a refresh in the middle of the held pass
        // would otherwise lose the way back and fall through to the old
        // scan-from-the-top behaviour, which is the bug this fixes.
        r: resumeAt
      }));
    } catch (e) { /* private mode - the run still works */ }
  }

  function restorePosition() {
    try {
      var raw = sessionStorage.getItem('stxPos');
      if (!raw) return false;
      var p = JSON.parse(raw);
      // Only if it still fits this queue. A different pack list was loaded,
      // orders were added - anything that changes the length invalidates it,
      // and landing on the wrong order is worse than starting at the top.
      if (!p || p.n !== QUEUE.length) return false;
      if (typeof p.i !== 'number' || p.i < 0 || p.i >= QUEUE.length) return false;
      index = p.i;
      segIndex = (typeof p.s === 'number' && p.s >= 0) ? p.s : 0;
      HELD = Array.isArray(p.h) ? p.h.filter(function (x) { return typeof x === 'number'; }) : [];
      mode = (p.m === 'held' && HELD.length) ? 'held' : 'normal';
      normalPassDone = !!p.d;
      // Only meaningful while the held pass is actually running; kept narrow so
      // a stale entry can never redirect an ordinary pass.
      resumeAt = (mode === 'held' && p.r && typeof p.r.i === 'number' &&
                  p.r.i >= 0 && p.r.i < QUEUE.length) ? { i: p.r.i, s: p.r.s || 0 } : null;
      return true;
    } catch (e) { return false; }
  }

  /* =========================================================================
     CONTROLS — one handler for buttons, keyboard and voice alike
     ========================================================================= */
  /* Re-entrancy guard. nav() changes the position, redraws and starts speech;
     a second call arriving inside that window would leave the panel, the zoom
     and the voice describing different components - which is what "the wrong
     product is spoken" looks like from the floor. */
  var navBusy = false;

  /* Anything the packer does while a question is on screen DISMISSES the
   * question and then does what they asked. Only 'yes' answers it. Leaving the
   * dialog up while Next moved underneath it would put the tool in a state
   * where the next spoken "yes" restarted a run that had already moved on. */
  var PASSES_CONFIRM = { yes: 1, no: 1 };

  // The Finished card is dismissed by anything that resumes work. Repeat,
  // Postcode and Pause do not move the cursor, so they leave it up.
  /* 'restart' is deliberately ABSENT: it only opens a question. Cancelling must
   * leave the Finished card exactly where it was, so doRestart() is what takes
   * it down - once the answer is actually yes. */
  var CLEARS_FINISHED = { next: 1, back: 1, hold: 1, showhold: 1, closedone: 1 };

  function nav(action) {
    if (navBusy) return;
    navBusy = true;
    try {
      if (confirmPending && !PASSES_CONFIRM[action]) hideConfirm();
      if (CLEARS_FINISHED[action]) hideFinished();
      navRun(action);
    } finally { navBusy = false; }
  }

  /* ---- Hold helpers -------------------------------------------------------
   * With HELD empty and mode 'normal', inMode() is true for every entry, so
   * step() degrades to index+1 / index-1 and stepWrap() to the exact modulo the
   * code used before. Nothing about Next or Back changes until an order is
   * actually held. */
  function isHeld(qi) {
    var e = QUEUE[qi];
    return !!e && HELD.indexOf(e.orderIndex) !== -1;
  }
  /* Which entries the current pass may land on.
   *
   * The held pass deliberately skips 'collection' entries. A collection card is
   * a shelf trip ("Collect lampshades first"), planned for the ORIGINAL run of
   * the pack list; by the time the packer comes back to a held order those
   * shades have already been collected, so replaying it would send them to the
   * shelf for stock that is already in front of them. Held orders are therefore
   * read with the ordinary pack-order speech and nothing else - the same thing
   * Next does on a normal order.
   *
   * The normal pass is unchanged: it still shows every collection card. */
  function inMode(qi) {
    var e = QUEUE[qi];
    if (!e) return false;
    if (mode === 'held') return isHeld(qi) && e.kind === 'order';
    return !isHeld(qi);
  }

  // Nearest entry belonging to the current pass. -1 when the pass is finished.
  function step(from, dir) {
    for (var i = from + dir; i >= 0 && i < QUEUE.length; i += dir) if (inMode(i)) return i;
    return -1;
  }
  // Back kept its wrap-around, so it behaves as before within the current pass.
  function stepWrap(from, dir) {
    var n = step(from, dir);
    if (n !== -1) return n;
    return dir > 0 ? step(-1, 1) : step(QUEUE.length, -1);
  }

  function say(msg) { var el = $('stx-say'); if (el) el.textContent = msg; }

  /* Orders still to do in the CURRENT pass, counted from where the packer is
   * standing. Back does not inflate it - it is "what is ahead of me", which is
   * the question being asked. */
  function counts() {
    var rem = 0;
    for (var i = index; i < QUEUE.length; i++) {
      if (QUEUE[i] && QUEUE[i].kind === 'order' && inMode(i)) rem++;
    }
    return { remaining: rem, held: HELD.length, total: ORDERS.length };
  }

  function updateStatus() {
    var el = $('stx-status');
    if (!el) return;
    el.classList.remove('stx-warn', 'stx-done');
    var c = counts();

    if (allComplete) {
      el.textContent = '\u2713 All orders completed';
      el.classList.add('stx-done');
    } else if (mode === 'held') {
      el.textContent = 'Held pass \u00b7 ' + c.remaining + ' of ' + c.held + ' left';
      el.classList.add('stx-warn');
    } else if (normalPassDone && c.held) {
      el.textContent = 'Normal done \u00b7 ' + c.held + ' held remaining';
      el.classList.add('stx-warn');
    } else {
      el.textContent = 'Remaining ' + c.remaining + ' of ' + c.total +
                       (c.held ? '  \u00b7  Held ' + c.held : '');
      if (c.held) el.classList.add('stx-warn');
    }
  }

  function updateHoldUI() {
    var b = $('stx-heldbtn');
    if (!b) return;
    b.textContent = '\u{1F4CB} Held (' + HELD.length + ')';
    b.classList.toggle('stx-empty', HELD.length === 0);
    b.classList.toggle('stx-on', mode === 'held');
    var h = $('stx-hold');
    if (h) h.disabled = (mode === 'held');
    updateStatus();
  }

  function allDone() {
    mode = 'normal';
    allComplete = true;
    updateHoldUI();
    say('All orders completed \u2014 normal and held. Nothing remaining.');
    speak('All orders completed.');
    try { showFinished(); } catch (e) { console.warn('[Speak Tool] finished card:', e); }
  }

  /* Reached the end of the current pass. This is the ONLY behaviour change to
   * Next: it used to wrap to the top forever, because the tool had no idea of
   * being finished. Phases 5 and 6 need a terminal state, so the wrap becomes a
   * stop. Everything before the last order is untouched. */
  function endOfPass() {
    if (mode === 'held') {
      // The whole held pass is the unit of work, matching the existing model,
      // which has no per-order completion flag. Cleared once, at the end, so
      // Back still reaches every held order while the pass is running.
      HELD = [];
      if (normalPassDone) { resumeAt = null; allDone(); return; }
      mode = 'normal';
      updateHoldUI();

      /* BACK TO WHERE THE PACKER LEFT OFF, then forward one.
       *
       * The held pass can only end one way - Next on the last segment of the
       * last held order - so that Next is a real instruction, not a side effect
       * of the pass changing. It is applied to the RESTORED position instead of
       * being swallowed by the transition, which is what makes both cases come
       * out right:
       *
       *   left mid-order (order 7, component 3 of 5)
       *       -> back to 7, component 4. Nothing is skipped.
       *   left having just finished order 7's last component
       *       -> on to order 8. Nothing is read twice.
       *
       * There is no per-order completion flag to consult, and there does not
       * need to be: the segment cursor already carries the distinction. */
      var r = resumeAt;
      resumeAt = null;
      var resumed = r && typeof r.i === 'number' && r.i >= 0 && r.i < QUEUE.length && inMode(r.i);

      if (resumed) {
        index = r.i;
        segIndex = (typeof r.s === 'number' && r.s > 0) ? r.s : 0;
        var rsegs = segments();
        if (segIndex > rsegs.length - 1) segIndex = Math.max(0, rsegs.length - 1);
        if (segIndex < rsegs.length - 1) {
          segIndex++;                       // more of this order still to read
        } else {
          var fwd = step(index, 1);         // that order was finished - move on
          if (fwd === -1) { normalPassDone = true; allDone(); return; }
          index = fwd; segIndex = 0;
        }
      } else {
        // No saved position - a refresh mid-held-pass on an older session, or a
        // queue that no longer holds it. The original scan is the fallback.
        var back = step(-1, 1);
        if (back === -1) { allDone(); return; }
        index = back; segIndex = 0;
      }

      render(); speakCurrent();
      say('Held orders finished \u2014 back at order ' + (QUEUE[index] ? QUEUE[index].orderIndex + 1 : '?') +
          ' of ' + ORDERS.length + '.');
      return;
    }
    normalPassDone = true;
    if (HELD.length) {
      var many = HELD.length > 1;
      say('All normal orders completed. ' + HELD.length + ' held order' + (many ? 's' : '') +
          ' remaining \u2014 press Held to process ' + (many ? 'them' : 'it') + '.');
      speak('All normal orders are completed. You have ' + HELD.length + ' held order' +
            (many ? 's' : '') + ' remaining. Do you want to process ' + (many ? 'them' : 'it') + '?');
    } else {
      allDone();
    }
  }

  function navRun(action) {
    var segs = segments();
    switch (action) {
      case 'next': {
        // Step through THIS order's components first. Only once the last one
        // (which carries the postcode) has been read does Next move on.
        if (segIndex < segs.length - 1) { segIndex++; render(); speakCurrent(); break; }
        var n = step(index, 1);
        if (n === -1) { endOfPass(); break; }
        index = n; segIndex = 0; render(); speakCurrent();
        break;
      }

      case 'back': {
        if (segIndex > 0) { segIndex--; render(); speakCurrent(); break; }
        var p = stepWrap(index, -1);
        if (p !== -1) { index = p; segIndex = 0; }
        render(); speakCurrent();
        break;
      }

      /* Hold — set the current order aside and carry straight on. It is NOT
       * completed and NOT removed; it simply stops being part of this pass. */
      case 'hold': {
        var he = QUEUE[index];
        if (!he) break;
        // Pressing Hold while a collection card is on screen holds the ORDER it
        // belongs to. Holding the shelf trip on its own would be meaningless.
        if (mode === 'held') { say('Already working through the held orders.'); break; }
        if (HELD.indexOf(he.orderIndex) !== -1) { say('This order is already held.'); break; }
        HELD.push(he.orderIndex);
        allComplete = false;          // holding re-opens the run
        updateHoldUI();
        rememberPosition();
        var nx = step(index, 1);
        if (nx === -1) { endOfPass(); break; }
        index = nx; segIndex = 0; render(); speakCurrent();
        break;
      }

      case 'showhold': {
        if (!HELD.length) { say('No held orders.'); break; }
        // Only on the way IN. Pressing Held again while already in the held
        // pass must not overwrite the normal position with a held one.
        if (mode !== 'held') resumeAt = { i: index, s: segIndex };
        mode = 'held';
        var first = step(-1, 1);
        if (first === -1) { mode = 'normal'; updateHoldUI(); say('No held orders.'); break; }
        index = first; segIndex = 0;
        updateHoldUI();
        render(); speakCurrent();
        say('Held orders \u2014 ' + HELD.length + '. Normal orders are not mixed in.');
        break;
      }

      case 'repeat':
        render(); speakCurrent();
        break;

      case 'postcode': {
        // Reads JUST the postcode and does not move segIndex, so the packer
        // stays on whatever component they were on.
        var e = QUEUE[index];
        var pc = (e && e.kind === 'order') ? postcodeSpeech(e.order.address) : '';
        if (pc) speak(pc);
        else $('stx-say').textContent = 'No postcode on this order.';
        break;
      }

      /* Restart ASKS. doRestart() holds the body that used to be here. */
      case 'restart':
        askRestart();
        break;

      case 'yes': {
        if (!confirmPending) break;          // nothing was asked
        var fn = confirmPending.onYes;
        hideConfirm();
        if (fn) fn();
        break;
      }

      case 'no':
        hideConfirm();
        break;

      case 'closedone':
        hideFinished();
        break;

      // Same two-way toggle the Pause button drives, so the verified resume in
      // togglePause() applies to voice as well - including the case where
      // Chrome reports resume() succeeded and produces no sound.
      case 'pause':
        if (!paused) togglePause();
        break;

      case 'resume':
        if (paused) togglePause();
        else speakCurrent();          // not paused - read the current item again
        break;
    }
  }

  /* =========================================================================
     SPEECH
     ========================================================================= */
  /* ---------------------------------------------------------------- voices
     Grouped by LANGUAGE first, exactly as the Google Sheet build does it.
     Chrome exposes 20-70 voices in one flat list, nearly all of them for
     languages this warehouse never uses, so picking "Google US English" meant
     scrolling past dozens of irrelevant entries. Choose the language, then the
     voice inside it. */
  var voicesByLang = {};

  function langLabel(code) {
    var base = String(code || '').split('-')[0].toLowerCase();
    var names = {
      en:'English', ta:'Tamil', si:'Sinhala', hi:'Hindi', de:'German', fr:'French',
      es:'Spanish', it:'Italian', nl:'Dutch', pl:'Polish', pt:'Portuguese',
      ru:'Russian', tr:'Turkish', ar:'Arabic', zh:'Chinese', ja:'Japanese', ko:'Korean'
    };
    return names[base] || base.toUpperCase();
  }

  // "Google UK English Female" -> "UK English Female"
  function voiceLabel(v) {
    var n = v.name.replace(/^(Google|Microsoft)\s+/i, '').trim();
    return n + (v.localService ? '  (offline)' : '');
  }

  function fillVoicesFor(lang, preferred) {
    var sel = $('stx-voice');
    var list = voicesByLang[lang] || [];
    if (!sel) { selectedVoice = (preferred || list[0]) || selectedVoice; return; }
    sel.innerHTML = '';
    list.forEach(function (v, i) {
      var o = d.createElement('option');
      o.value = i;
      o.textContent = voiceLabel(v);
      sel.appendChild(o);
    });
    var at = preferred ? list.indexOf(preferred) : 0;
    sel.selectedIndex = at < 0 ? 0 : at;
    selectedVoice = list[sel.selectedIndex] || null;
  }

  function pickVoices() {
    voices = synth.getVoices() || [];
    if (!voices.length) return false;

    voicesByLang = {};
    voices.forEach(function (v) {
      var k = langLabel(v.lang);
      (voicesByLang[k] = voicesByLang[k] || []).push(v);
    });

    // Keep the sheet's default: Google US English where it exists.
    var preferred = voices.filter(function (v) {
      return v.name === 'Google US English' && v.lang === 'en-US';
    })[0] || voices.filter(function (v) { return /^en/i.test(v.lang); })[0] || voices[0];

    var langSel = $('stx-lang');
    if (!langSel) { selectedVoice = preferred; return true; }   // panel not built yet

    var langs = Object.keys(voicesByLang).sort(function (a, b) {
      if (a === 'English') return -1;          // the packing floor language first
      if (b === 'English') return 1;
      return a.localeCompare(b);
    });
    langSel.innerHTML = '';
    langs.forEach(function (l) {
      var o = d.createElement('option');
      o.value = l;
      o.textContent = l + ' (' + voicesByLang[l].length + ')';
      langSel.appendChild(o);
    });
    langSel.value = langLabel(preferred.lang);
    fillVoicesFor(langSel.value, preferred);

    langSel.onchange = function () { fillVoicesFor(langSel.value, null); speakCurrent(); };
    var vSel = $('stx-voice');
    if (vSel) vSel.onchange = function () {
      selectedVoice = voicesByLang[langSel.value][vSel.value];
      speakCurrent();                          // hear the chosen voice at once
    };
    return true;
  }

  /* THE COLLECTION IS READ SLOWER THAN EVERYTHING ELSE.
   *
   * A collection utterance is one long block - batch number, total, then every
   * size, colour and count on the card - and the packer is copying numbers off
   * a shelf while it runs. Reported as too fast to follow on 2026-08-20.
   *
   * A FACTOR, not a fixed rate, so the Speed buttons still mean what they say:
   * a packer who chose Fast gets a fast collection, just proportionally slower
   * than their fast orders. Floored so no combination can reach a crawl. */
  var COLLECTION_RATE_FACTOR = 0.75;
  var MIN_RATE = 0.4;

  function collectionRate() {
    return Math.max(MIN_RATE, speechRate * COLLECTION_RATE_FACTOR);
  }

  // rate is OPTIONAL. Every existing caller passes nothing and gets speechRate,
  // exactly as before - only speakCurrent() on a collection entry overrides it.
  function speak(text, done, rate) {
    if (!text) { if (done) done(); return; }
    synth.cancel();
    paused = false;
    setPauseBtn(false);
    micSuspend();

    speechToken++;
    var mine = speechToken;
    speakingNow = String(text).toLowerCase();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate || speechRate;
    if (selectedVoice) u.voice = selectedVoice;
    // onstart is the only honest signal that audio really began. Chrome accepts
    // speak() and silently drops it when the page has had no user gesture yet,
    // reporting no error at all.
    u.onstart = function () { spoken = true; hideStart(); };
    u.onend = function () { if (mine !== speechToken) return; micRelease(); if (done) done(); };
    u.onerror = function () { if (mine !== speechToken) return; micRelease(); if (done) done(); };
    synth.speak(u);
  }

  /* One read of the position, used for BOTH the screen and the voice.
     render() and speakCurrent() used to each take their own snapshot; anything
     that changed segIndex between them showed one product and said another. */
  function speakCurrent() {
    var segs = segments();
    if (segIndex >= segs.length) segIndex = Math.max(0, segs.length - 1);
    if (segIndex < 0) segIndex = 0;
    var seg = segs[segIndex];
    if (!seg) { speak(''); return; }
    // The panel is re-stamped from the same segment that is about to be spoken,
    // so the SKU on screen and the SKU in the ear cannot disagree.
    $('stx-say').textContent = seg.say;
    var e = QUEUE[index];
    speak(seg.say, null, (e && e.kind === 'collection') ? collectionRate() : speechRate);
  }

  function setPauseBtn(on) {
    var b = $('stx-pause');
    if (!b) return;
    b.innerHTML = on ? '▶️ Resume' : '⏸ Pause';
    b.className = on ? 'stx-on' : '';
  }

  // Chrome's resume() often reports success while producing no audio, so it is
  // verified rather than trusted. If nothing restarted, the current component is
  // simply spoken again — hearing one item twice beats silence.
  function togglePause() {
    if (paused) {
      paused = false; setPauseBtn(false); micSuspend();
      try { synth.resume(); } catch (e) { /* nothing to resume */ }
      var at = segIndex;
      setTimeout(function () {
        if (paused) return;
        if (synth.speaking && !synth.paused) return;
        segIndex = at; speakCurrent();
      }, 260);
    } else if (synth.speaking) {
      synth.pause(); paused = true; setPauseBtn(true); micRelease();
    } else {
      setPauseBtn(false); speakCurrent();
    }
  }

  /* =========================================================================
     VOICE RECOGNITION — same lifecycle as the sheet build
     ========================================================================= */
  var speakingNow = '';          // lower-cased text of the current utterance
  var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  var rec = null, micOffByUser = false, micRunning = false, micMuted = false;
  var micFatal = '', micTimer = null, lastCmd = '', lastCmdAt = 0, micWatchdog = null;
  var micBootAt = Date.now();    // when the tool started trying
  var micEverRan = false;        // has recognition started even once?
  var micAlive = 0;              // when the recogniser last proved it was awake
  var micHealth = null;
  // A recogniser that has delivered nothing for this long is treated as dead.
  // 15s was too patient - that is a long time to stand repeating a word.
  var MIC_SILENT_LIMIT_MS = 8000;

  /* The near-misses matter as much as the words themselves. Chrome's recogniser
     is trained on conversation, not on a warehouse with a headset and machine
     noise, and it returns a small, repeatable set of wrong words for each
     command - "next" comes back as text / nest / necks / neck constantly.
     Accepting those costs nothing: none of them means anything else here. */
  /* WHAT COUNTS AS A COMMAND — deliberately narrow again.
     ------------------------------------------------------
     I had widened this to catch Chrome's mis-hearings: text, net, neck, bag,
     buck, wait, stop, again. That was a mistake and it is the main reason
     accuracy got worse rather than better. Those are ordinary words. On a
     packing floor someone says "stop", "wait" or "back" in conversation
     constantly, and every one of them was moving the queue or pausing the tool -
     which reads exactly like "the microphone went wrong".

     Only words that are near-useless in normal talk are accepted now. "nest"
     and "necks" stay because Chrome returns them for "next" and nobody says
     them near a bench; "text", "net" and "neck" go, because people do. */
  /* ===================================================================
     COMMAND MATCHING — ported from the Unit 4 Speak Tool, which works.
     ===================================================================
     Unit 4 has never had the "it stops hearing me" problem, and the reason is
     one line it does NOT have: a word-count limit.

     Because the microphone stays open while the tool talks, Chrome merges the
     tool's own speech and the packer's command into ONE final transcript:

       "s t 6 4 b22 8 wats 6 post code w 3 6 h h next"      <- 16 words

     This build rejected anything over five words, so every command spoken
     during an utterance was thrown away. The packer saw the words arrive and
     nothing happened. Unit 4 matches on the whole string with no length guard
     at all, and takes the LAST command word found - because the tool's speech
     is always transcribed before whatever the packer says on top of it, so the
     latest match is the live command. */
  var COMMANDS = [
    { a: 'restart',  re: /\b(restart|start)\b/ },
    { a: 'next',     re: /\b(next|forward)\b|\bgo on\b|\bgo next\b/ },
    { a: 'back',     re: /\b(back|previous|prev)\b/ },
    { a: 'repeat',   re: /\b(respeak|again|repeat)\b/ },
    { a: 'postcode', re: /\bpost ?code\b/ },
    { a: 'pause',    re: /\bpause\b/ },
    { a: 'resume',   re: /\b(resume|unpause)\b/ },
    /* "hold" is matched on a WORD BOUNDARY, never as a substring. 12,886
       strings in reference-data.js were checked: 503 contain "hold"
       ("Ceramic holder", "B22 Switch holder", "short arm holder Copper") and
       NONE of them match \bhold\b. A .includes('hold') test would fire Hold on
       every holder product on the shelf. */
    /* Chrome does not reliably return the single syllable "hold". The initial
     * /h/ is routinely dropped or softened, so the same press of the tongue
     * comes back as "old", "held", "halt" or "holt". The button worked while
     * the voice command did not for exactly this reason - matchCommand was
     * correct, the transcript simply never contained the word "hold".
     *
     * Every alternative below was checked against the 9,729 unique strings in
     * reference-data.js first: hold, holds, held, holt, halt and old all score
     * ZERO collisions. "hole" was rejected - it appears in 25 real products
     * ("third hole ceiling rose", "10 mm hole diamand Rose Gold") and would
     * hold an order every time one was spoken. */
    /* Every alternative here was checked against the 9,729 unique strings in
     * reference-data.js and scores ZERO collisions.
     *
     * REJECTED, and worth recording so nobody adds them later:
     *   "gold"  - 323 products ("360 Black gold inner celing rose"). It is a
     *             very likely mishearing of "hold" and would be a disaster.
     *   "hole"  -  25 products ("third hole ceiling rose").
     *   "open"  -  14 products.
     *
     * "call girl" is not a joke - it is what the US model actually returned for
     * a packer saying "hold", recorded on the floor. Both words are absent from
     * the catalogue, so mapping it costs nothing and saves a retry. The real
     * fix for that class of error is the listening-accent setting above. */
    { a: 'hold',     re: /\b(hold|holds|held|holt|halt|old|cold|bold|fold|told|gold)\b|\bcall girl\b/ },
    /* Plain-English alternatives. For an accented speaker these recognise far
     * more reliably than the single syllable "hold" - two syllables and a
     * common word give the language model something to lock onto. */
    { a: 'hold',     re: /\b(keep|park|later|skip|aside|pending|wait)\b/ },

    /* CLEAR PHRASES for Hold - the forms to teach the packers.
     *
     * None of these contains the word "hold", which is the point: they still
     * work on the runs where the recogniser never produces that syllable at
     * all. Two words also give the language model context, so they are matched
     * far more reliably than any single word can be. */
    /* "back" and "next" are deliberately NOT accepted inside these phrases.
     * "move this back" belongs to Back and "next time" to Next; an existing
     * command must keep its meaning, so those two forms were dropped rather
     * than allowed to compete. */
    { a: 'hold',     re: /\b(?:set|put|keep|leave|push)\s+(?:it\s+|this\s+|that\s+)?(?:aside|later)\b/ },
    { a: 'hold',     re: /\b(?:pack|do|come\s+back)\s+later\b/ },
    { a: 'hold',     re: /\b(?:skip|park|hold)\s+(?:this|it|that|order|one)\b/ },
    { a: 'showhold', re: /\bshowhold\b/ }
  ];

  /* Remembered per browser, not per session: a packer's accent does not change
     between shifts, and being asked to pick it every morning would guarantee it
     stayed on the wrong one. */
  var recLang = 'en-GB';
  try { recLang = localStorage.getItem('stxRecLang') || 'en-GB'; } catch (e) {}

  function setRecLang(code) {
    recLang = code;
    try { localStorage.setItem('stxRecLang', code); } catch (e) {}
    // Restart so the new model is used immediately; onend brings it back up.
    if (rec) { try { rec.lang = code; rec.stop(); } catch (e) {} }
    say('Listening language set to ' + code + '.');
  }

  function normalise(t) {
    return String(t || '').toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* The tool speaks exactly one command word out loud - ":Post Code:" - so that
     is the only one suppressed, and only while audio is actually playing.
     next, back, repeat and restart stay live at all times, which is the whole
     point of listening through speech. */
  /* Words that are BOTH a plausible mishearing of "hold" AND real catalogue
   * speech. "Gold" is the reported case: 323 products contain it, one of them
   * named simply "Gold" and another "Rose Gold".
   *
   * They are accepted as Hold only while the tool is SILENT. If the tool is
   * talking, "gold" is a colour it just read out, not an instruction - which is
   * the same reasoning the postcode guard already uses. That makes the risky
   * words usable instead of banned, without ever letting the tool hold an order
   * by talking to itself. */
  /* Tokens that mean Hold and appear NOWHERE in the catalogue - all verified
   * against the 9,729 unique strings in reference-data.js at zero collisions. */
  var HOLD_STRONG = /\b(?:hold|holds|held|holt|halt|keep|kept|park|parked|later|skip|skipped|aside|pending|wait)\b|\bcall girl\b/;

  function isSelfEcho(action, heard) {
    if (action === 'postcode' && synth.speaking) return true;

    /* Belt and braces on the restart question. The prompt is worded without the
     * word "yes" so there is nothing to echo, but a confirmation that can be
     * triggered by the tool's own voice would be worse than no confirmation at
     * all - it would look like the packer had agreed. */
    if (action === 'yes' && synth.speaking) return true;

    /* While the tool is TALKING, Hold needs a strong word.
     *
     * "gold", "old", "cold", "bold", "fold" and "told" are all plausible
     * mishearings of "hold", so they are accepted - but 323 catalogue products
     * contain "gold" ("360 Black gold inner celing rose", "hair clip Gold"),
     * and the microphone hears every one of them as the tool reads it out.
     *
     * An earlier version anchored this test to the whole transcript, so a bare
     * "gold" was caught but "hair clip gold" sailed through and held the order.
     * Requiring a strong token instead closes that: catalogue speech contains
     * none of them, while a packer saying "hold" or "set aside" over the top of
     * the speech still gets through - which is the point of the open mic. */
    if (action === 'hold' && synth.speaking && !HOLD_STRONG.test(heard || '')) return true;
    return false;
  }

  /* YES / NO — live ONLY while a confirmation is on screen.
   *
   * Kept out of the COMMANDS table on purpose. Matching is last-position-wins
   * across that whole table, so a permanently-live "yes" would beat a real
   * command sitting earlier in the same transcript: "next yes" would resolve to
   * yes and the packer's Next would be silently dropped. Scoped to the moment a
   * question is actually being asked, neither word can cost anything.
   *
   * Checked against the 10,312 unique strings in reference-data.js: yes, yeah,
   * yep, yup, confirm, correct, nope, nah and cancel all score ZERO collisions.
   * "no" hits exactly one product ("no pocket textured apron Black and White"),
   * which is harmless here - the tool is not reading product names while a
   * question is up.
   *
   * REJECTED, and worth recording so nobody adds them later: "ok", "okay",
   * "right" and "sure". All four are clean against the catalogue, but they are
   * conversational filler - "right, next one" would restart the run. An
   * affirmative that throws away a shift's progress has to be deliberate. */
  var YES_RE = /\b(yes|yeah|yep|yup|confirm|correct)\b/;
  var NO_RE  = /\b(no|nope|nah|cancel)\b/;

  function matchCommand(t) {
    if (!t) return null;

    if (confirmPending) {
      if (YES_RE.test(t)) return 'yes';
      if (NO_RE.test(t)) return 'no';
      // Anything else falls through and is handled as a normal command, which
      // nav() treats as dismissing the question. The packer is never trapped.
    }

    // "start again" is one instruction, not "start" then "again". Collapsed
    // first so it resolves to restart under last-match-wins.
    t = t.replace(/\bstart again\b/g, 'restart');

    /* "show hold" must not resolve to "hold".
     *
     * matchCommand is last-match-wins, so in "show hold" the \bhold\b at
     * index 5 beats \bshow hold\b at index 0 and the packer would hold the
     * order they were trying to list. Collapsing it to one token first removes
     * the ambiguity: \bhold\b cannot match inside "showhold" because there is
     * no word boundary after "show". Same trick as "start again" above. */
    t = t.replace(
      /\b(?:show|showed|shows)\s+(?:me\s+)?(?:the\s+)?(?:hold|holds|held|holt|halt|old)(?:\s+(?:list|orders?|ones?))?\b/g,
      'showhold');
    // "held list" / "hold list" on their own mean the same request.
    /* "hold order" means HOLD THIS ORDER. "held orders" means SHOW ME THE HELD
     * ONES. The difference is the tense - imperative "hold" versus past
     * participle "held" - and an earlier version lost it, sending "hold order"
     * to the held list instead of holding the order the packer was looking at.
     * So the imperative words pair only with the word "list"; the past-tense
     * words pair with anything. */
    t = t.replace(/\b(?:hold|keep|park)\s+list\b/g, 'showhold');
    t = t.replace(/\b(?:held|kept|pending|later)\s+(?:list|orders?|items?)\b/g, 'showhold');
    t = t.replace(/\bshow\s+(?:me\s+)?(?:the\s+)?(?:list|pending|later|kept)\b/g, 'showhold');

    /* CLEAR PHRASES for Show Held.
     *
     * A single word is the hardest thing for a recogniser to place; a verb plus
     * a noun gives the language model context and it locks on. These are the
     * forms to teach the packers - the one-word versions above stay as a
     * fallback for when they are in a hurry. */
    t = t.replace(
      /\b(?:show|open|view|display|play|go\s+to|goto|bring\s+up|list)\s+(?:me\s+)?(?:the\s+|my\s+|all\s+)*(?:held|hold|holds|kept|keep|pending|later|skipped|parked)(?:\s+(?:list|orders?|items?|ones?))?\b/g,
      'showhold');
    // "held orders" / "pending orders" on their own are unambiguous requests.
    t = t.replace(/\b(?:held|skipped|parked|pending)\s+(?:orders?|items?|list)\b/g, 'showhold');

    var best = null, bestAt = -1;
    for (var i = 0; i < COMMANDS.length; i++) {
      var re = new RegExp(COMMANDS[i].re.source, 'g');
      var m, at = -1;
      while ((m = re.exec(t)) !== null) at = m.index;
      if (at > bestAt) { bestAt = at; best = COMMANDS[i].a; }
    }
    return best;
  }

  // One state at a time, named the same way the sheet build names them, so a
  // packer moving between the two tools sees the same words.
  var micHearing = false;

  function micUI() {
    var el = $('stx-mic'), t = $('stx-mic-t');
    if (!el || !t) return;
    var state, text;
    if (micFatal)            { state = 'err';       text = 'Mic ' + micFatal; }
    else if (micOffByUser)   { state = 'paused';    text = 'Mic off'; }
    else if (micMuted)       { state = 'speaking';  text = 'Speaking'; }
    else if (micHearing)     { state = 'hearing';   text = 'Hearing you'; }
    else if (micRunning)     { state = 'listening'; text = 'Listening'; }
    else if (!micEverRan && Date.now() - micBootAt > 3000) {
      // Only when recognition has NEVER started. micRunning is briefly false on
      // every ordinary restart, and showing "Allow the microphone" then made a
      // working tool look broken several times a minute.
      state = 'paused';
      text = onFileUrl() ? 'Allow the mic — see note' : 'Allow the microphone';
    }
    else                     { state = '';          text = 'Starting'; }
    el.className = state;
    t.textContent = text;
    el.title = onFileUrl()
      ? 'This page is open from a file, so Chrome asks for the microphone every '
        + 'time and cannot remember the answer. Serve it over http to be asked once.'
      : 'Microphone level and status';
  }

  function onFileUrl() { return w.location.protocol === 'file:'; }

  // Shows the command that was understood, then drops back to the live state.
  function micHeard(action) {
    var t = $('stx-mic-t');
    if (t) t.textContent = 'Heard “' + action + '”';
    setTimeout(micUI, 900);
  }

  /* micMuted is NO LONGER a reason not to start.
     While the tool speaks, recognition is meant to keep running - that is the
     whole point of listening through speech. But micStart() still refused to
     start when micMuted was set, and onend refused to schedule a restart for
     the same reason. So if the recogniser ended during an utterance - Chrome's
     own idle timeout, or a no-speech - nothing brought it back until the 45s
     speech watchdog fired. That is the "I said Next ten times and nothing
     happened" report. */
  function micStart() {
    if (!rec || micOffByUser || micFatal || micRunning) return;
    try {
      rec.start();
      micAlive = Date.now();
    } catch (e) {
      // "already started" while micRunning says otherwise means the two have
      // drifted apart. Cycle it rather than swallowing the error and waiting
      // for an onend that may never come.
      micCycle();
    }
  }
  function micStop() { if (rec) { try { rec.stop(); } catch (e) {} } }

  /* Clears the recogniser's accumulated audio after a command has fired.
     Needed because the microphone no longer closes while the tool speaks:
     without a flush the tool's own words stay in the buffer and are merged into
     the NEXT result as well, so one "next" could match twice. stop() is enough -
     onend restarts it 120ms later. */
  function micFlush() {
    if (!rec || !micRunning) return;
    try { rec.stop(); } catch (e) {}
  }

  /* Force a full stop-then-start. The only reliable way out of a recogniser
     that reports one state and behaves as another. */
  function micCycle() {
    if (!rec || micOffByUser || micFatal) return;
    try { rec.abort ? rec.abort() : rec.stop(); } catch (e) {}
    micRunning = false;
    micHearing = false;
    micLater(300);
  }
  /* A LONG RECOGNITION SESSION GOES DOWNHILL.
     Chrome's continuous recognition is noticeably worse after a few minutes
     than it is in the first thirty seconds - the accumulated session drifts.
     That is the "it works at the start and gets unreliable later" report, and
     no amount of matching logic fixes it, because the words arriving are
     already wrong.

     A restart clears it. The trick is WHEN: restarting while the packer is
     mid-word loses that word, which is the mistake the 8-second health check
     made. So it is done immediately after a command has been acted on - the
     packer is now reaching for the item and will not speak for a second or two.
     That is the only genuinely safe gap in the cycle. */
  /* No periodic session refresh is needed any more. micFlush() stops the
     recogniser after every command and onend brings it straight back, so the
     session is never more than a few commands old - which is what kept Unit 4
     accurate over a long shift. */
  function micLater(ms) {
    if (micTimer) clearTimeout(micTimer);
    micTimer = setTimeout(function () { micTimer = null; micStart(); }, ms || 250);
  }

  // Muted while the tool speaks, so it never hears its own output as a command.
  // The watchdog matters: Chrome does not always fire onend after cancel(), and
  // a missed onend would leave the mic muted for the rest of the shift.
  /* KEEP LISTENING WHILE THE TOOL TALKS.
     Previously the microphone was switched off for the whole utterance, so a
     packer who said "next" the moment they had the item in hand - which is the
     natural moment - was not heard at all, and had to say it again after the
     tool finished. That is the single biggest reason commands felt unreliable.
     Recognition now stays on and the echo guard in onresult filters the tool's
     own words instead. Set STX.listenWhileSpeaking = false to go back to
     switching it off, if a station without a headset hears itself. */
  function micSuspend() {
    micMuted = true;
    if (!STX.listenWhileSpeaking) micStop();
    micUI();
    if (micWatchdog) clearTimeout(micWatchdog);
    micWatchdog = setTimeout(function () { micWatchdog = null; if (micMuted) micRelease(); }, 45000);
  }
  function micRelease() {
    if (micWatchdog) { clearTimeout(micWatchdog); micWatchdog = null; }
    if (!micMuted) return;
    micMuted = false; micUI();
    // 60ms, not 200. Every millisecond here is a window in which a command is
    // simply not heard, and Chrome adds its own restart latency on top.
    if (!micRunning) micLater(60);
  }

  function toggleZoom() {
    STX.zoom = (STX.zoom === 'off') ? 'auto' : 'off';
    var b = $('stx-zoombtn');
    if (b) b.innerHTML = '\u{1F50D} Zoom ' + (STX.zoom === 'off' ? 'off' : 'on');
    if (STX.zoom === 'off') hideZoom();
    else render();
  }

  function toggleMic() {
    if (micFatal) return;
    micOffByUser = !micOffByUser;
    if (micOffByUser) {
      if (micTimer) { clearTimeout(micTimer); micTimer = null; }
      micStop();
      // Release the capture as well, so Chrome stops showing the tab as
      // recording. Mic off should mean off, not off-but-still-listening.
      if (meterStream) {
        meterStream.getTracks().forEach(function (t) { t.stop(); });
        meterStream = null;
      }
      paintLevel(0);
    } else {
      micAsked = false;          // may need the capture back for the meter
      startMic();
      micLater(0);
    }
    micUI();
  }

  /* ---------------------------------------------------------- level meter
     Reads the microphone directly with Web Audio and lights segments from the
     RMS of the waveform. This is a MEASUREMENT, not an animation: if these bars
     do not move when the packer talks, the headset is the problem, and that is
     worth knowing before blaming the tool.

     It needs its own getUserMedia stream because SpeechRecognition does not
     expose audio. Chrome runs both at once without trouble. Like recognition it
     needs a trusted origin, so on file:// it stays dark and the reason is shown
     on the chip. */
  var meterCtx = null, meterStream = null;

  function paintLevel(rms) {
    var el = $('stx-level');
    if (!el) return;
    // Speech sits low in a linear scale, so the level is curved to make normal
    // talking fill the middle of the meter rather than the first segment.
    var lvl = Math.min(1, Math.pow(rms * 7, 0.7));
    var bars = el.children, on = Math.round(lvl * bars.length);
    for (var i = 0; i < bars.length; i++) {
      bars[i].className = i < on ? (i >= bars.length - 1 ? 'hot' : 'lit') : '';
    }
  }

  /* ONE PERMISSION REQUEST, THEN BOTH USERS OF THE MICROPHONE.
     -----------------------------------------------------------
     Two things want the microphone: recognition, and the level meter. Asking
     twice is what produced repeated permission prompts, and two independent
     captures is what produced the audio conflicts. getUserMedia is therefore
     called EXACTLY ONCE, before recognition starts; the grant is per origin,
     so recognition inherits it and never prompts again.

     If it is refused or unavailable, recognition still starts - the packer
     loses the meter, not the commands.

     A permission that keeps being asked for again on every load means the
     origin cannot store one. file:// has the origin "null" and can never
     remember a grant. Serve the page over http and it is asked once, ever. */
  var micAsked = false;

  /* RECOGNITION IS NEVER GATED ON THE METER.
     An earlier version asked for the microphone stream first and started
     recognition in the .then(). While Chrome's permission prompt sits open the
     promise has not settled, so recognition had not started and the chip stayed
     on "Starting"; if the packer dismissed the prompt instead of answering it,
     the promise never settled at all and voice was dead for the whole session.
     Commands are the critical function and the meter is a convenience, so the
     order is now: recognition first, meter alongside. Both use the same
     per-origin grant, so Chrome still asks once. */
  function startMic() {
    if (micAsked) return;
    micAsked = true;

    startRecognition();                 // first, and unconditionally

    var md = w.navigator.mediaDevices;
    if (!STX.meter || !md || !md.getUserMedia) return;

    /* ON file:// THE METER IS NOT WORTH ITS PROMPT.
       A file page has the origin "null", so Chrome cannot store a microphone
       grant against it and asks again every single time anything opens the
       microphone. That makes the meter a SECOND source of the prompt, on top of
       recognition's own - and the meter is only a convenience. Skipped there, so
       the packer answers one dialog instead of two.
       Nothing about recognition or matching changes; on http and https the meter
       behaves exactly as before. */
    if (onFileUrl()) {
      var lv = $('stx-level');
      if (lv) lv.title = 'Level meter needs the page served over http';
      return;
    }
    md.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(attachMeter).catch(function (e) {
      // Losing the meter costs a picture of the input, not the commands.
      console.warn('[Speak Tool] level meter unavailable:', e && e.name);
    });
  }

  function attachMeter(stream) {
    var AC = w.AudioContext || w.webkitAudioContext;
    if (!AC || meterCtx) return;
    (function (stream) {
      meterStream = stream;
      meterCtx = new AC();
      var an = meterCtx.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.55;
      meterCtx.createMediaStreamSource(stream).connect(an);

      var buf = new Uint8Array(an.fftSize);
      (function tick() {
        an.getByteTimeDomainData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) {
          var v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        paintLevel(Math.sqrt(sum / buf.length));
        if (w.requestAnimationFrame) w.requestAnimationFrame(tick);
        else setTimeout(tick, 60);
      })();
    })(stream);
  }

  /* HEALTH CHECK — the difference between "usually works" and "always works".
     Chrome's recogniser can stop without firing onend, or accept start() and
     never deliver a result. Nothing inside the API reports either. So its
     liveness is checked from outside: every event stamps micAlive, and if
     nothing has stamped it for MIC_SILENT_LIMIT_MS while it claims to be
     running, it is force-cycled. A recogniser that is simply not running is
     restarted immediately. */
  /* SILENCE IS NOT A FAULT.
     This used to abort and restart the recogniser after 8 seconds without an
     event. But a packer picking items quietly for eight seconds is the normal
     case, not a broken one - and the restart opened a dead window of several
     hundred milliseconds, so a "next" spoken at that moment was simply lost.
     That is what "it does not catch what I say immediately" was.

     A recogniser that has genuinely stopped fires onend, and onend already
     restarts it. All this needs to do is catch the case where it is NOT running
     and no restart is pending. */
  function startHealthCheck() {
    if (micHealth) return;
    micHealth = setInterval(function () {
      if (micOffByUser || micFatal || !rec) return;
      if (!micRunning && !micTimer) micLater(0);
    }, 2000);
  }

  function startRecognition() {
    if (!SR) { micFatal = 'needs Chrome'; micUI(); return; }
    rec = new SR();
    rec.continuous = true;
    // INTERIM RESULTS ARE THE DIFFERENCE between a command that lands and one
    // that is missed. Chrome can take a second or more to mark a phrase final,
    // and if the packer speaks again before that it may never finalise at all -
    // the word was heard and then thrown away. Acting on the interim makes it
    // respond as soon as it recognises the word. The 1-second de-duplicate below
    // stops the same command firing again when the final arrives.
    /* FINALS ONLY, ONE GUESS - exactly what Unit 4 uses.
       Interim results and five alternatives were my addition, and they turned
       half-heard words into commands. Chrome's final result with its top guess
       is slower by a fraction of a second and far more likely to be what the
       packer actually said. */
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    /* LISTENING LANGUAGE - this was 'en-US', and it is the single biggest cause
     * of a command being heard as something unrelated.
     *
     * The recogniser does not transcribe sounds, it fits them to the accent
     * model it was given. Fed UK-based South Asian English, the US model
     * produced "call girl" for "hold". en-GB fits the warehouse, and en-IN is
     * trained on exactly this accent - for most packers here it is the better
     * of the two. It is a dropdown rather than a constant because the right
     * answer differs per person. */
    rec.lang = recLang;

    rec.onstart = function () {
      if (STX.debug) console.log('[mic] started');
      micRunning = true; micHearing = false; micEverRan = true;
      micAlive = Date.now();
      micUI();
    };
    // Real signal from the recognition API, not a simulated level meter: the dot
    // and the bars only move while Chrome says it is actually picking up speech.
    rec.onspeechstart = function () {
      micAlive = Date.now();
      if (!micOffByUser && !micMuted) { micHearing = true; micUI(); }
    };
    rec.onspeechend = function () { micAlive = Date.now(); micHearing = false; micUI(); };

    rec.onresult = function (ev) {
      if (micOffByUser) return;
      micAlive = Date.now();

      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;

        var heard = normalise(ev.results[i][0].transcript);
        if (STX.debug) console.log('[mic] heard:', heard);

        var a = matchCommand(heard);
        // Logged either way: on the floor the only way to tell "not heard" from
        // "heard but not matched" is to see this line.
        if (!a) {
          if (STX.debug) console.log('[mic]   no command in it');
          // Shown on the bar, not just the console. When a command is not
          // recognised the packer needs to see WHAT was heard - otherwise a
          // mis-transcription is indistinguishable from a dead microphone.
          /* Kept so a real mis-transcription can be added to the table above
           * from evidence instead of guesswork. `STX.misses` in the console
           * lists them; "call girl" was found exactly this way. */
          if (heard) {
            STX.misses.push(heard);
            if (STX.misses.length > 40) STX.misses.shift();
            say('Heard \u201c' + heard + '\u201d \u2014 not a command');
          }
          continue;
        }
        if (isSelfEcho(a, heard)) { if (STX.debug) console.log('[mic]   ignored - tool is speaking'); continue; }

        // One utterance is one command. Different commands are never blocked.
        var now = Date.now();
        if (a === lastCmd && now - lastCmdAt < 1000) {
          if (STX.debug) console.log('[mic]   duplicate ignored');
          continue;
        }
        lastCmd = a; lastCmdAt = now;

        micHeard(a);
        nav(a);
        micFlush();          // drop the audio this command came out of
      }
    };

    rec.onerror = function (ev) {
      var err = (ev && ev.error) || 'unknown';
      if (STX.debug) console.log('[mic] error:', err);
      micRunning = false; micHearing = false;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        // Chrome refuses microphone access on file:// no matter what the user
        // clicks. Saying "permission denied" sends them hunting a setting that
        // cannot fix it, so name the real cause.
        micFatal = (w.location.protocol === 'file:')
          ? 'blocked on file:// - serve the page over http(s)'
          : 'permission denied';
      }
      else if (err === 'audio-capture') micFatal = 'not found';
      micUI();
    };

    rec.onend = function () {
      if (STX.debug) console.log('[mic] ended');
      micRunning = false; micHearing = false; micUI();
      // Unit 4 behaviour: come straight back, every time. Only a fatal
      // permission or hardware error ends the session. 120ms, not 250 - this
      // runs after every command because of micFlush(), so it is in the path
      // the packer feels.
      if (!micOffByUser && !micFatal) micLater(120);
    };

    micStart();
  }

  /* ---------------------------------------------------------------- keyboard
     Only when the packer is not typing into one of the page's own fields, so
     the pack list's existing inputs keep working exactly as they do now. */
  function typing(el) {
    if (!el) return false;
    var t = (el.tagName || '').toUpperCase();
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }

  d.addEventListener('keydown', function (ev) {
    if (typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    /* While a question is up, Enter and Escape answer IT. Without this, Enter
     * was still mapped to Restart and re-asked the question the packer was busy
     * answering - and the focused Yes button would have fired a second time on
     * top. preventDefault stops that native activation. */
    if (confirmPending && (ev.key === 'Enter' || ev.key === 'Escape')) {
      nav(ev.key === 'Enter' ? 'yes' : 'no');
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Escape') { hideZoom(); return; }
    var map = { ArrowRight: 'next', ArrowLeft: 'back', ArrowUp: 'repeat', Enter: 'restart' };
    if (ev.key === 'ArrowDown') { togglePause(); ev.preventDefault(); return; }
    if (map[ev.key]) { nav(map[ev.key]); ev.preventDefault(); }
  });

  /* =========================================================================
     BOOT
     ========================================================================= */
  var booted = false;

  function boot() {
    if (booted) return;              // whichever trigger fires first wins
    booted = true;

    if (!w.Engine || !w.REF) {
      console.error('[Speak Tool] engine.js and reference-data.js must load before this file.');
      return;
    }

    /* Cached names go in BEFORE the pack list is parsed. localStorage is
       synchronous, so this costs nothing and means a packer who used the tool
       yesterday gets corrected names on the very first order, with no network
       wait. The network call it may start is not awaited - presentation must
       never delay a queue that is ready. */
    var namesReady = (w.STX_NAMES && w.STX_NAMES.boot) ? w.STX_NAMES.boot() : null;

    ORDERS = w.Engine.parseDoc(d, 'pack list');

    // How many pack lists were merged into this page, if any.
    var tags = {};
    for (var fi = 0; fi < ORDERS.length; fi++) {
      var t = ORDERS[fi].node && ORDERS[fi].node.getAttribute('data-stx-file');
      if (t) tags[t] = 1;
    }
    filesMerged = Object.keys(tags).length;
    if (!ORDERS.length) {
      console.warn('[Speak Tool] no orders found on this page — is it a pack list?');
      return;
    }

    buildQueue();

    // Published FIRST. Everything below is presentation, and presentation must
    // never be able to make a parsed, ready queue look like a failed load - the
    // pack-list loader decides whether the tool came up by reading STX.orders.
    STX.orders = ORDERS;
    STX.queue = QUEUE;
    STX.nav = nav;
    STX.names = w.STX_NAMES || null;

    // When the live fetch lands after the first order is already on screen,
    // repaint it so a corrected name is not held back until the packer moves on.
    if (namesReady && namesReady.then) {
      namesReady.then(function (changed) {
        if (w.STX_paintNames) w.STX_paintNames();
        if (changed) { try { render(); } catch (e) {} }
      });
    }

    injectPanel();
    var resumed = restorePosition();
    try { render(); } catch (e) { console.warn('[Speak Tool] render:', e); }
    if (resumed && STX.debug) console.log('[Speak Tool] resumed at queue entry', index, 'item', segIndex);

    // getVoices() famously returns [] on the first call, and onvoiceschanged
    // never fires when the voices are already loaded. Try now, listen, and poll.
    var tried = false;
    function ready() {
      if (tried) return;
      tried = true;
      setTimeout(function () {
        speakCurrent();
        // If no audio began, the browser blocked it. Ask for the one press.
        setTimeout(function () { if (!spoken) showStart(); }, 700);
      }, 120);
    }
    if (pickVoices()) ready();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = function () { if (pickVoices()) ready(); };
    }
    var tries = 0;
    var poll = setInterval(function () {
      if (pickVoices()) { clearInterval(poll); ready(); return; }
      if (++tries > 20) { clearInterval(poll); ready(); }
    }, 150);

    startMic();          // recognition first; the meter follows alongside
    startHealthCheck();
    micUI();
    // The health check only ticks every 2.5s, and the packer should not be
    // looking at "Starting" for five seconds while an unanswered permission
    // prompt sits on screen. One explicit repaint just past the threshold.
    setTimeout(micUI, 3200);
  }

  // Three ways in, because one is not enough.
  //
  // A document built by document.write() - which is how the pack-list loader
  // renders an uploaded file - can still report readyState "loading" while its
  // DOMContentLoaded has already been and gone. This script is appended AFTER
  // close(), so the listener alone would never fire and the tool would silently
  // never start. That is exactly what happened in Chrome while jsdom, which
  // reports "complete" by then, ran the direct path and looked fine.
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
    setTimeout(boot, 0);             // covers an event that already passed
  } else {
    boot();
  }

})(window, document);
