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
    highlight: true,          // outline the order being packed
    zoom: 'auto',             // 'auto' | 'own' | 'native' | 'off' - see zoomFor()
    listenWhileSpeaking: true,// hear "next" even while the tool is talking
    meter: true               // live microphone level, like a call app
  };

  /* ---------------------------------------------------------------- state */
  var ORDERS = [], QUEUE = [], index = 0, segIndex = 0;
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
      say.push((g.size ? g.size + ' millimeter. ' : '') +
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
      // its own limit of 15. Each becomes its own queue entry.
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
    '.stx-csku{font-size:18px;font-weight:700;color:#3B2A12;margin-top:9px;word-break:break-all}',
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
        '<span id="stx-say"></span>' +
        '<span class="stx-hideable" style="display:contents">' +
          '<button type="button" data-act="restart">\u{1F501} Restart</button>' +
          '<button type="button" data-act="back">⏮ Back</button>' +
          '<button type="button" data-act="postcode">\u{1F4CD} Postcode</button>' +
          '<button type="button" id="stx-pause" data-act="pause">⏸ Pause</button>' +
          '<button type="button" data-act="repeat">\u{1F504} Repeat</button>' +
          '<button type="button" class="stx-primary" data-act="next">⏭ Next</button>' +
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
      '<div class="stx-f"><label for="stx-lang">Language</label><select id="stx-lang"></select></div>' +
      '<div class="stx-f"><label for="stx-voice">Voice</label><select id="stx-voice"></select></div>' +
      '<div class="stx-f"><label>Speed</label><div class="stx-seg" id="stx-rate">' +
        '<button type="button" data-r="0.6">Slow</button>' +
        '<button type="button" data-r="0.7" aria-pressed="true">Normal</button>' +
        '<button type="button" data-r="1.2">Fast</button>' +
        '<button type="button" data-r="1.5">Faster</button>' +
      '</div></div>';
    root.appendChild(set);

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
      return '<div class="stx-card"><div class="stx-imgwrap">' + img +
        '<span class="stx-badge">' + esc(g.qty) + '</span></div>' +
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
    $('stx-pos').textContent =
      (e.kind === 'collection' ? 'Collection' : 'Order ' + (e.orderIndex + 1) + ' of ' + ORDERS.length) +
      '  ·  Item ' + (segIndex + 1) + ' of ' + Math.max(1, segs.length);
    $('stx-say').textContent = segs[segIndex] ? segs[segIndex].say : '';

    // The picture of the component being spoken, opened by itself. A collection
    // step has its own dialog with all the pictures on it, so no zoom there.
    try {
      if (e.kind === 'collection') hideZoom();
      else zoomFor(segs[segIndex] ? segs[segIndex].line : null);
    } catch (err) { console.warn('[Speak Tool] zoom:', err); }
  }

  /* =========================================================================
     CONTROLS — one handler for buttons, keyboard and voice alike
     ========================================================================= */
  function nav(action) {
    var segs = segments();
    switch (action) {
      case 'next':
        // Step through THIS order's components first. Only once the last one
        // (which carries the postcode) has been read does Next move on.
        if (segIndex < segs.length - 1) segIndex++;
        else { index = (index + 1) % QUEUE.length; segIndex = 0; }
        render(); speakCurrent();
        break;

      case 'back':
        if (segIndex > 0) segIndex--;
        else { index = (index - 1 + QUEUE.length) % QUEUE.length; segIndex = 0; }
        render(); speakCurrent();
        break;

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

      case 'restart':
        index = 0; segIndex = 0; render(); speakCurrent();
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

  function speak(text, done) {
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
    u.rate = speechRate;
    if (selectedVoice) u.voice = selectedVoice;
    u.onend = function () { if (mine !== speechToken) return; micRelease(); if (done) done(); };
    u.onerror = function () { if (mine !== speechToken) return; micRelease(); if (done) done(); };
    synth.speak(u);
  }

  function speakCurrent() {
    var segs = segments();
    if (segIndex >= segs.length) segIndex = Math.max(0, segs.length - 1);
    speak(segs[segIndex] ? segs[segIndex].say : '');
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

  /* The near-misses matter as much as the words themselves. Chrome's recogniser
     is trained on conversation, not on a warehouse with a headset and machine
     noise, and it returns a small, repeatable set of wrong words for each
     command - "next" comes back as text / nest / necks / neck constantly.
     Accepting those costs nothing: none of them means anything else here. */
  var COMMANDS = [
    { a: 'restart',  re: /\b(restart|start again|start over)\b/ },
    { a: 'next',     re: /\b(next|nest|necks|neck|text|nexus|net|forward)\b|\bgo on\b|\bgo next\b|\bnext one\b/ },
    { a: 'back',     re: /\b(back|bag|buck|previous|prev)\b/ },
    { a: 'repeat',   re: /\b(repeat|repeated|respeak|again|replay|read it)\b/ },
    { a: 'postcode', re: /\bpost ?code\b|\bpostal code\b|\bpost card\b/ }
  ];

  function normalise(t) {
    return String(t || '').toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function matchCommand(t) {
    if (!t) return null;
    if (t.split(' ').length > 5) return null;       // a sentence is not a command
    for (var i = 0; i < COMMANDS.length; i++) if (COMMANDS[i].re.test(t)) return COMMANDS[i].a;
    return null;
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
    else                     { state = '';          text = 'Starting'; }
    el.className = state;
    t.textContent = text;
  }

  // Shows the command that was understood, then drops back to the live state.
  function micHeard(action) {
    var t = $('stx-mic-t');
    if (t) t.textContent = 'Heard “' + action + '”';
    setTimeout(micUI, 900);
  }

  function micStart() {
    if (!rec || micOffByUser || micFatal || micMuted || micRunning) return;
    try { rec.start(); } catch (e) { /* already starting; onend will retry */ }
  }
  function micStop() { if (rec && micRunning) { try { rec.stop(); } catch (e) {} } }
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
    if (micOffByUser) { if (micTimer) { clearTimeout(micTimer); micTimer = null; } micStop(); }
    else micLater(0);
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

  function startMeter() {
    if (!STX.meter || meterCtx) return;
    if (!w.navigator.mediaDevices || !w.navigator.mediaDevices.getUserMedia) return;
    var AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return;

    w.navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(function (stream) {
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
    }).catch(function (e) {
      // Not fatal: the commands still work, there is just no picture of them.
      console.warn('[Speak Tool] level meter unavailable:', e && e.name);
    });
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
    rec.interimResults = true;
    // Chrome ranks its guesses. "next" is regularly second or third behind a
    // conversational word, so all of them are read, not just the top one.
    rec.maxAlternatives = 5;
    rec.lang = 'en-US';

    rec.onstart = function () { micRunning = true; micHearing = false; micUI(); };
    // Real signal from the recognition API, not a simulated level meter: the dot
    // and the bars only move while Chrome says it is actually picking up speech.
    rec.onspeechstart = function () {
      if (!micOffByUser && !micMuted) { micHearing = true; micUI(); }
    };
    rec.onspeechend = function () { micHearing = false; micUI(); };

    rec.onresult = function (ev) {
      if (micOffByUser) return;
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        var a = null, heard = '';
        // Every alternative, interim or final. The first one that is a command wins.
        for (var k = 0; k < r.length && !a; k++) {
          heard = normalise(r[k].transcript);
          a = matchCommand(heard);
        }
        if (!a) continue;

        // The tool's own voice, coming back through the microphone. It says
        // ":Post Code:" out loud, which is a command word, so what is being
        // spoken right now is checked before acting. It never says next, back,
        // repeat or restart, so those always get through.
        if (micMuted && speakingNow && speakingNow.indexOf(heard) !== -1) continue;

        var now = Date.now();
        if (a === lastCmd && now - lastCmdAt < 1000) continue;   // one utterance, not two
        lastCmd = a; lastCmdAt = now;
        micHeard(a);
        nav(a);
      }
    };

    rec.onerror = function (ev) {
      var err = (ev && ev.error) || 'unknown';
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
      micRunning = false; micHearing = false; micUI();
      if (!micOffByUser && !micFatal && !micMuted) micLater(250);
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

    ORDERS = w.Engine.parseDoc(d, 'pack list');
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

    injectPanel();
    try { render(); } catch (e) { console.warn('[Speak Tool] render:', e); }

    // getVoices() famously returns [] on the first call, and onvoiceschanged
    // never fires when the voices are already loaded. Try now, listen, and poll.
    var spoke = false;
    function ready() {
      if (spoke) return;
      spoke = true;
      setTimeout(speakCurrent, 120);
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

    startRecognition();
    startMeter();
    micUI();
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
