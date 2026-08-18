/* ============================================================================
   Speak Tool — standalone build (REQ-04)
   Queue, speech and voice control. Behaviour carried across from the Google
   Sheets build; every comment marked "carried" names a defect already fixed
   there, so it is not re-introduced here.
   ========================================================================== */
'use strict';

var ORDERS = [], COLLECTIONS = [], QUEUE = [];
var index = 0, segIndex = 0, paused = false;
var synth = window.speechSynthesis, voices = [], selectedVoice = null, speechRate = 0.7;
var speechToken = 0;
var rowStart = new Date(), totalSecs = 0, rowTimer = null;

var $ = function (id) { return document.getElementById(id); };

/* ------------------------------------------------------------------ loading */
function readFiles(files) {
  var pending = files.length, collected = [], errs = [];
  if (!pending) return;
  $('loadMsg').textContent = 'Reading ' + pending + ' file' + (pending > 1 ? 's' : '') + '…';

  Array.prototype.forEach.call(files, function (f) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var doc = new DOMParser().parseFromString(r.result, 'text/html');
        var got = Engine.parseDoc(doc, f.name);
        if (!got.length) errs.push(f.name + ': no orders found');
        collected = collected.concat(got);
      } catch (e) { errs.push(f.name + ': ' + e.message); }
      if (--pending === 0) start(collected, errs);
    };
    r.onerror = function () { errs.push(f.name + ': could not be read');
                              if (--pending === 0) start(collected, errs); };
    r.readAsText(f);
  });
}

function start(orders, errs) {
  if (!orders.length) {
    $('loadMsg').textContent = errs.length ? errs.join(' · ')
      : 'No orders in that file. Is it a pack list page?';
    return;
  }
  ORDERS = orders;
  COLLECTIONS = Engine.buildCollections(ORDERS);
  buildQueue();
  $('loadScreen').style.display = 'none';
  $('packScreen').style.display = 'flex';
  startTimer();
  render();
  initVoices();
  setTimeout(function () { speakCurrent(); }, 120);
}

/* The queue interleaves collections with orders: a lampshade collection is its
   OWN entry immediately BEFORE the order that triggered it. Carried from the
   sheet build — the collection must never be mixed into a customer's card. */
function buildQueue() {
  QUEUE = [];
  ORDERS.forEach(function (o, i) {
    // An order short on BOTH prefix lists triggers two collections - a
    // "these orders only" batch and a "whole pack list" batch - each with its
    // own limit of 15. Each is its own queue entry, so the packer walks one
    // shelf, presses Next, then walks the other.
    (COLLECTIONS[i] || []).forEach(function (c) {
      QUEUE.push({ kind: 'collection', collection: c });
    });
    QUEUE.push({ kind: 'order', order: o, orderIndex: i });
  });
}

/* ------------------------------------------------------------------ segments */
function entry() { return QUEUE[index] || null; }

function segments() {
  var e = entry();
  if (!e) return [];
  if (e.kind === 'collection') {
    var c = e.collection, out = ['Collect lampshades first. Collection ' + c.batch + '. ' +
      c.total + ' lampshade' + (c.total === 1 ? '' : 's') + '.'];
    c.groups.forEach(function (g) {
      out[0] += ' ' + (g.size ? g.size + ' millimeter. ' : '') + (g.colour || 'colour unknown') + '. ' + g.qty + '.';
    });
    out[0] += ' Then pack this order.';
    return out.map(function (s) { return { say: s, line: null }; });
  }
  return Engine.speechFor(e.order);
}

/* ------------------------------------------------------------------ rendering */
function render() {
  var e = entry();
  if (!e) return;
  $('rowCounter').textContent = (e.kind === 'collection' ? 'Collection' : 'Order ' + (e.orderIndex + 1))
    + ' of ' + ORDERS.length;
  renderStrip();
  $('display').innerHTML = e.kind === 'collection' ? collectionHtml(e.collection) : orderHtml(e.order);
  document.querySelector('.entry').style.display = e.kind === 'collection' ? 'none' : '';
  if (e.kind === 'order') loadEntryFields(e.order);
  updateSeg();
}

function renderStrip() {
  var box = $('comboImagesContainer'); box.innerHTML = '';
  var e = entry(); if (!e || e.kind !== 'order') return;
  var segs = segments();
  segs.forEach(function (s, i) {
    if (!s.line || !s.line.img) return;
    var cell = document.createElement('div'); cell.className = 'thumb';
    var img = document.createElement('img');
    img.src = s.line.img; img.alt = 'Component ' + (i + 1);
    img.onclick = function () { showZoom(s.line.img); };
    var b = document.createElement('span'); b.className = 'thumb-badge'; b.textContent = String(i + 1);
    cell.appendChild(img); cell.appendChild(b); box.appendChild(cell);
  });
  highlightThumb();
}
function highlightThumb() {
  var cells = $('comboImagesContainer').querySelectorAll('.thumb');
  for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('on', i === segIndex);
}

function esc(s) { return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function orderHtml(o) {
  var names = o.lines.map(function (l) { return l.name || l.sku; }).filter(Boolean).join(' + ');
  var totals = o.lines.map(function (l) { return '&times; ' + l.qty; }).join(' &nbsp;+&nbsp; ');
  var combined = o.lines[0] && o.lines[0].combined ? o.lines[0].combined
                : o.lines.map(function (l) { return l.sku; }).join('+');
  return '<div class="ordercard"><div class="oc-grid">' +
    '<div class="oc-left">' +
      '<p class="oc-lab">Title</p><p class="oc-title">' + esc(o.lines[0] ? o.lines[0].title : '') + '</p>' +
      '<p class="oc-name">' + esc(names) + '</p>' +
      '<div class="oc-chips"><span class="chip">' + esc(o.platform || ' ') + '</span>' +
        (o.instructionQr ? '<span class="chip chip-alert">' + esc(o.instructionQr) + '</span>' : '') + '</div>' +
      (o.status ? '<p class="oc-status">' + esc(o.status) + '</p>' : '') +
    '</div>' +
    '<div class="oc-media">' +
      '<img id="mainImage" src="' + esc(o.lines[0] ? o.lines[0].img : '') + '" alt="" onclick="zoomMain()">' +
      '<div class="oc-qty"><span class="oc-qty-x">&times;</span><span id="mainQty">&mdash;</span></div>' +
      '<div class="oc-qty-cap">this item</div>' +
    '</div>' +
    '<div class="oc-right">' +
      '<p class="oc-price">&pound;' + esc(String(o.price || '0.00').replace(/[^0-9.]/g, '') || '0.00') + '</p>' +
      '<p class="oc-lab">Deliver to</p><p class="oc-cust">' + esc(o.customer) + '</p>' +
      '<p class="oc-post">' + esc(o.address) + '</p>' +
      (o.note ? '<p class="oc-note"><span class="oc-note-lab">Note</span>' + esc(o.note) + '</p>' : '') +
    '</div></div>' +
    '<div class="oc-foot"><div class="oc-foot-qty">' + totals + '</div>' +
      '<div class="oc-foot-sku">' + esc(combined) + '</div></div></div>';
}

function collectionHtml(c) {
  var cards = c.groups.map(function (g) {
    return '<div class="coll-card">' +
      (g.img ? '<img src="' + esc(g.img) + '" alt="">' : '') +
      '<span class="coll-badge">' + g.qty + '</span>' +
      '<div class="coll-sku">' + esc(g.skus.join(' + ')) + '</div>' +
      '<div class="coll-meta">' + esc((g.size ? g.size + 'mm · ' : '') + (g.colour || '?')) + '</div>' +
      '<div class="coll-for">' + esc(g.orders.join(', ')) + '</div></div>';
  }).join('');
  // The scope chip matters operationally: "these orders only" means the packer
  // will be back at the shelf shortly, "whole pack list" means this covers the
  // rest of the run.
  var scope = Engine.collectionScopeLabel(c.mode);
  return '<div class="collection"><div class="coll-head">' +
    '<span class="coll-title">Lampshade collection ' + c.batch + '</span>' +
    (scope ? '<span class="chip">' + esc(scope) + '</span>' : '') +
    '<span class="coll-count">' + c.total + ' / ' + Engine.MAX_COLLECTION + (c.isFull ? ' full' : '') + '</span>' +
    (c.overflow ? '<span class="chip chip-alert">This order alone exceeds the limit</span>' : '') +
    '</div><div class="coll-grid">' + cards + '</div>' +
    '<p class="coll-note">Collect these, then press Next to pack the order.</p></div>';
}

function updateSeg() {
  var segs = segments();
  $('spokenText').textContent = segs[segIndex] ? segs[segIndex].say : '';
  $('itemCounter').textContent = 'Item ' + (segIndex + 1) + ' of ' + Math.max(1, segs.length);
  highlightThumb();
  var s = segs[segIndex];
  var q = $('mainQty'), img = $('mainImage');
  if (q) q.textContent = s && s.line ? String(s.line.qty) : '—';
  if (img && s && s.line && s.line.img) img.src = s.line.img;   // picture follows the spoken item
}

/* ------------------------------------------------- the three typed fields */
function loadEntryFields(o) {
  $('fQr').value = o.instructionQr || '';
  $('fNote').value = o.note || '';
  $('fStatus').value = o.status || '';
}
['fQr', 'fNote', 'fStatus'].forEach(function (id) {
  document.addEventListener('input', function (ev) {
    if (ev.target.id !== id) return;
    var e = entry(); if (!e || e.kind !== 'order') return;
    if (id === 'fQr') e.order.instructionQr = ev.target.value;
    if (id === 'fNote') e.order.note = ev.target.value;
    if (id === 'fStatus') e.order.status = ev.target.value;
    persist();
    $('savedMsg').classList.add('on');
    clearTimeout(window._savedT);
    window._savedT = setTimeout(function () { $('savedMsg').classList.remove('on'); }, 900);
    $('display').innerHTML = orderHtml(e.order);
    updateSeg();
  });
});
// Survives a refresh, so a half-packed run is not lost.
function persist() {
  try {
    var d = ORDERS.map(function (o) { return [o.customer, o.instructionQr, o.note, o.status]; });
    localStorage.setItem('speakToolEntries', JSON.stringify(d));
  } catch (e) { /* private mode - the run still works, it just will not survive a refresh */ }
}

/* ------------------------------------------------------------------ speech */
function speakCurrent(done) {
  var segs = segments();
  if (!segs.length) { if (done) done(); return; }
  if (segIndex < 0) segIndex = 0;
  if (segIndex >= segs.length) segIndex = segs.length - 1;
  updateSeg();
  speak(segs[segIndex].say, done);
}

function speak(text, done) {
  synth.cancel();
  paused = false; setPauseButton(false);
  if (!text || !text.trim()) { if (done) done(); return; }
  micSuspend();
  speechToken++;
  var mine = speechToken;
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = speechRate;
  if (selectedVoice) u.voice = selectedVoice;
  u.onend = function () { if (mine !== speechToken) return; micResume(); if (done) done(); };
  u.onerror = function () { if (mine !== speechToken) return; micResume(); if (done) done(); };
  synth.speak(u);
}

/* ------------------------------------------------------------------ nav */
function nav(action) {
  var segs = segments();
  switch (action) {
    case 'next':
      // Step through THIS order's components first. Only once the postcode and
      // note have been read does Next move on. Carried from the sheet build.
      if (segIndex < segs.length - 1) { segIndex++; speakCurrent(); }
      else move(+1);
      break;
    case 'back':
      if (segIndex > 0) { segIndex--; speakCurrent(); }
      else move(-1);
      break;
    case 'repeat': speakCurrent(); break;
    case 'postcode':
      var e = entry();
      if (e && e.kind === 'order' && e.order.address) {
        speak(':Post Code: ' + e.order.address.split('').filter(function (c) { return c.trim(); }).join(' '));
      }
      break;
    case 'restart': index = 0; segIndex = 0; totalSecs = 0; render(); startTimer(); speakCurrent(); break;
  }
}
function move(d) {
  stopTimer();
  index += d;
  if (index >= QUEUE.length) index = 0;
  if (index < 0) index = QUEUE.length - 1;
  segIndex = 0;
  render(); startTimer(); speakCurrent();
}

/* --------------------------------------------------------- pause / resume */
function setPauseButton(p) {
  var b = $('pauseBtn'); if (!b) return;
  b.innerHTML = p ? '<span class="ico">▶️</span>Resume'
                  : '<span class="ico">⏸️</span>Pause';
  b.className = p ? 'is-paused' : '';
}
function togglePause() {
  // RESUME IS NOT RELIABLE IN CHROME. resume() often reports success while no
  // audio follows, which left the packer with a Pause label and silence. So it
  // is verified: if audio did not restart, say the component again.
  if (paused) {
    paused = false; setPauseButton(false); micSuspend();
    try { synth.resume(); } catch (e) {}
    var at = segIndex;
    setTimeout(function () {
      if (paused) return;
      if (synth.speaking && !synth.paused) return;
      segIndex = at; speakCurrent();
    }, 260);
  } else if (synth.speaking) {
    synth.pause(); paused = true; setPauseButton(true);
    micResume();                       // silent now, so the mic can listen
  } else {
    setPauseButton(false); speakCurrent();
  }
}

/* ------------------------------------------------------------------ zoom */
function showZoom(src) { $('zoomImg').src = src; $('zoomOverlay').classList.add('open'); $('zoomClose').focus(); }
function hideZoom() { $('zoomOverlay').classList.remove('open'); $('zoomImg').src = ''; }
function zoomMain() { var i = $('mainImage'); if (i && i.src) showZoom(i.src); }

/* ------------------------------------------------------------------ voices */
function langLabel(code) {
  var b = (code || '').split('-')[0].toLowerCase();
  var n = {en:'English',ta:'Tamil',si:'Sinhala',hi:'Hindi',de:'German',fr:'French',es:'Spanish',
           it:'Italian',nl:'Dutch',pl:'Polish',pt:'Portuguese',ru:'Russian',tr:'Turkish',
           ar:'Arabic',zh:'Chinese',ja:'Japanese',ko:'Korean'};
  return n[b] || b.toUpperCase();
}
var byLang = {};
function initVoices() {
  function build() {
    voices = synth.getVoices(); if (!voices.length) return;
    byLang = {};
    voices.forEach(function (v) { (byLang[langLabel(v.lang)] = byLang[langLabel(v.lang)] || []).push(v); });
    var langs = Object.keys(byLang).sort(function (a, b) {
      if (a === 'English') return -1; if (b === 'English') return 1; return a.localeCompare(b); });
    $('langSelect').innerHTML = langs.map(function (l) {
      return '<option value="' + esc(l) + '">' + esc(l) + ' (' + byLang[l].length + ')</option>'; }).join('');
    var pref = voices.filter(function (v) { return v.name === 'Google US English'; })[0] || voices[0];
    $('langSelect').value = langLabel(pref.lang);
    fillVoices(pref);
  }
  function fillVoices(pref) {
    var list = byLang[$('langSelect').value] || [];
    $('voiceSelect').innerHTML = list.map(function (v, i) {
      return '<option value="' + i + '">' + esc(v.name.replace(/^(Google|Microsoft)\s+/i, '')) +
             (v.localService ? ' (offline)' : '') + '</option>'; }).join('');
    var at = pref ? list.indexOf(pref) : 0;
    $('voiceSelect').selectedIndex = at < 0 ? 0 : at;
    selectedVoice = list[$('voiceSelect').selectedIndex] || null;
  }
  $('langSelect').onchange = function () { fillVoices(null); };
  $('voiceSelect').onchange = function () {
    selectedVoice = (byLang[$('langSelect').value] || [])[$('voiceSelect').value]; speakCurrent(); };

  // Try now, listen for the event as well, and poll briefly. Chrome returns []
  // from the first getVoices(), and when the voices are already loaded the
  // onvoiceschanged event never fires at all - relying on it alone left the
  // Language and Voice menus empty for the whole session.
  build();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = build;
  var tries = 0;
  var poll = setInterval(function () {
    if ((voices && voices.length) || ++tries > 20) { clearInterval(poll); return; }
    build();
  }, 150);
}

/* ------------------------------------------------------------------ timers */
function fmt(s){var p=function(n){return String(n).padStart(2,'0')};
  return p(Math.floor(s/3600))+':'+p(Math.floor(s%3600/60))+':'+p(s%60);}
function startTimer(){ rowStart=new Date(); clearInterval(rowTimer);
  rowTimer=setInterval(function(){ $('rowTimeTracker').textContent=fmt(Math.floor((new Date()-rowStart)/1000)); },1000); }
function stopTimer(){ clearInterval(rowTimer); totalSecs+=Math.floor((new Date()-rowStart)/1000);
  $('totalTimeTracker').textContent=fmt(totalSecs); }

/* ------------------------------------------------------------------ mic */
var recog=null, micPausedByUser=false, micRunning=false, micMuted=false, micFatal='', micTimer=null;
var lastCmd='', lastCmdAt=0, micWatchdog=null;

function setMic(state,text){ $('micIndicator').className='mic-'+state; $('micText').textContent=text; }
function refreshMic(){
  if (micFatal) setMic('error','Microphone unavailable — '+micFatal);
  else if (micPausedByUser) setMic('paused','Voice commands off');
  else if (micMuted) setMic('speaking','Speaking — mic off');
  else if (micRunning) setMic('listening','Listening');
  else setMic('processing','Starting');
  $('micBtn').innerHTML='<span class="ico">🎤</span>'+(micPausedByUser?'Mic off':'Mic on');
  $('micBtn').className = micPausedByUser ? 'mic-off' : '';
}
function micStart(){ if(!recog||micPausedByUser||micFatal||micMuted||micRunning) return;
  try{ recog.start(); }catch(e){} }
function micStop(){ if(!recog||!micRunning) return; try{ recog.stop(); }catch(e){} }
function micLater(ms){ clearTimeout(micTimer); micTimer=setTimeout(micStart, ms||250); }
// Watchdog: Chrome does not always fire onend, and a missed one would leave the
// mic muted for the rest of the session. Carried from the sheet build.
function micSuspend(){ micMuted=true; micStop(); refreshMic();
  clearTimeout(micWatchdog); micWatchdog=setTimeout(function(){ if(micMuted) micResume(); },45000); }
function micResume(){ clearTimeout(micWatchdog); if(!micMuted) return; micMuted=false; refreshMic(); micLater(200); }
function toggleMic(){ if(micFatal){refreshMic();return;} micPausedByUser=!micPausedByUser;
  if(micPausedByUser){ clearTimeout(micTimer); micStop(); } else micLater(0); refreshMic(); }

var CMDS=[{a:'restart',re:/\b(restart|start)\b/},{a:'next',re:/\b(next|forward)\b|\bgo on\b/},
          {a:'back',re:/\b(back|previous|prev)\b/},{a:'repeat',re:/\b(repeat|again|respeak)\b/},
          {a:'postcode',re:/\bpost ?code\b/}];
(function initMic(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ micFatal='not supported in this browser (use Chrome)'; refreshMic(); return; }
  recog=new SR(); recog.continuous=true; recog.interimResults=false; recog.lang='en-US';
  recog.onstart=function(){ micRunning=true; refreshMic(); };
  recog.onspeechstart=function(){ if(!micPausedByUser&&!micMuted) setMic('hearing','Listening'); };
  recog.onspeechend=function(){ if(!micPausedByUser&&!micMuted) refreshMic(); };
  recog.onresult=function(ev){
    if(micPausedByUser||micMuted) return;
    for(var i=ev.resultIndex;i<ev.results.length;i++){
      if(!ev.results[i].isFinal) continue;
      var t=String(ev.results[i][0].transcript).toLowerCase().replace(/[.,!?;:]+/g,' ').replace(/\s+/g,' ').trim();
      if(t.split(' ').length>5) continue;               // a sentence is not a command
      var hit=null; for(var k=0;k<CMDS.length;k++) if(CMDS[k].re.test(t)){ hit=CMDS[k].a; break; }
      if(!hit) continue;
      var now=Date.now();
      if(hit===lastCmd && now-lastCmdAt<1000) continue; // one utterance, not two
      lastCmd=hit; lastCmdAt=now;
      setMic('processing','Heard “'+hit+'”');
      nav(hit);
    }
  };
  recog.onerror=function(ev){
    micRunning=false;
    var e=ev&&ev.error;
    if(e==='not-allowed'||e==='service-not-allowed') micFatal='permission denied';
    else if(e==='audio-capture') micFatal='no microphone found';
    refreshMic();
  };
  recog.onend=function(){ micRunning=false; refreshMic();
    if(!micPausedByUser&&!micFatal&&!micMuted) micLater(250); };
  micStart();
})();

/* ------------------------------------------------------------------ wiring */
$('pickBtn').onclick = function () { $('fileInput').click(); };
$('fileInput').onchange = function (e) { readFiles(e.target.files); };
var dz = $('dropZone');
['dragenter','dragover'].forEach(function(n){ dz.addEventListener(n,function(e){
  e.preventDefault(); dz.classList.add('over'); }); });
['dragleave','drop'].forEach(function(n){ dz.addEventListener(n,function(e){
  e.preventDefault(); dz.classList.remove('over'); }); });
dz.addEventListener('drop', function (e) { readFiles(e.dataTransfer.files); });

$('rateSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-rate]'); if (!b) return;
  speechRate = parseFloat(b.getAttribute('data-rate'));
  Array.prototype.forEach.call($('rateSeg').querySelectorAll('button'), function (x) {
    x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
});

$('zoomOverlay').addEventListener('click', function (e) {
  if (e.target === $('zoomOverlay')) hideZoom(); });

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if ($('zoomOverlay').classList.contains('open')) { hideZoom(); e.preventDefault(); } return; }
  if ($('zoomOverlay').classList.contains('open')) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;   // typing a note is not navigation
  if (e.key === 'ArrowRight') nav('next');
  else if (e.key === 'ArrowLeft') nav('back');
  else if (e.key === 'ArrowUp') nav('repeat');
  else if (e.key === 'ArrowDown') togglePause();
  else if (e.key === 'Enter') nav('restart');
});
refreshMic();
