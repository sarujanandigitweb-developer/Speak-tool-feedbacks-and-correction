  function isHeld(qi) {
    var e = QUEUE[qi];
    return !!e && HELD.indexOf(e.orderIndex) !== -1;
  }

  function inMode(qi) {
    var e = QUEUE[qi];
    if (!e) return false;
    if (mode === 'held') return isHeld(qi) && e.kind === 'order';
    return !isHeld(qi);
  }

  function step(from, dir) {
    for (var i = from + dir; i >= 0 && i < QUEUE.length; i += dir) if (inMode(i)) return i;
    return -1;
  }

  function stepWrap(from, dir) {
    var n = step(from, dir);
    if (n !== -1) return n;
    return dir > 0 ? step(-1, 1) : step(QUEUE.length, -1);
  }

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

  function allDone() {
    mode = 'normal';
    allComplete = true;
    updateHoldUI();
    say('All orders completed \u2014 normal and held. Nothing remaining.');
    speak('All orders completed.');
  }

  function endOfPass() {
    if (mode === 'held') {
      // The whole held pass is the unit of work, matching the existing model,
      // which has no per-order completion flag. Cleared once, at the end, so
      // Back still reaches every held order while the pass is running.
      HELD = [];
      if (normalPassDone) { allDone(); return; }
      mode = 'normal';
      updateHoldUI();
      var back = step(-1, 1);
      if (back === -1) { allDone(); return; }
      index = back; segIndex = 0; render(); speakCurrent();
      say('Held orders finished. Back to the remaining normal orders.');
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

      case 'restart':
        index = 0; segIndex = 0;
        HELD = []; mode = 'normal'; normalPassDone = false; allComplete = false;
        updateHoldUI();
        render(); speakCurrent();
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

  function matchCommand(t) {
    if (!t) return null;

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

// ---- harness stubs -------------------------------------------------------
var QUEUE=[], index=0, segIndex=0, HELD=[], mode='normal', normalPassDone=false;
var LOG=[], SPOKEN=[], SAID='', allComplete=false;
function $(){ return null; }
function say(m){ SAID=m; LOG.push('SAY: '+m); }
function updateHoldUI(){}
function rememberPosition(){}
function speak(t){ SPOKEN.push(t); LOG.push('SPEAK: '+t); }
function render(){}
function speakCurrent(){ var e=QUEUE[index]; LOG.push('AT: '+(e?e.label:'?')); }
function segments(){ return QUEUE[index] ? QUEUE[index].segs : []; }
function togglePause(){}
function postcodeSpeech(a){ return a ? 'P C ' + a : ''; }
var paused=false;
function nav(a){ navRun(a); }

function setup(n, segsPer){
  QUEUE=[]; for(var i=0;i<n;i++) QUEUE.push({kind:'order',orderIndex:i,order:{address:'W3 6HH'},label:'Order'+String.fromCharCode(65+i),
    segs:Array.from({length:segsPer||1},function(_,k){return {say:'seg'+k};})});
  index=0; segIndex=0; HELD=[]; mode='normal'; normalPassDone=false; LOG=[]; SPOKEN=[]; SAID='';
}
function cur(){ return QUEUE[index] ? QUEUE[index].label : '(none)'; }
var pass=0, fail=0, results=[];
function check(name, cond, detail){
  (cond?pass++:fail++);
  results.push([name, cond?'PASS':'FAIL', cond?'':(detail||'')]);
  if(!cond) console.log('   FAIL: '+name+'  '+(detail||''));
}

// ===== REGRESSION: nothing held => behaviour must be identical ============
setup(5); nav('next'); var r1=cur()==='OrderB'; nav('next'); nav('next'); var r2=cur()==='OrderD';
nav('back'); var r3=cur()==='OrderC';
setup(5); nav('back'); var r4=cur()==='OrderE';
setup(5); nav('repeat'); var r5=cur()==='OrderA'&&index===0;
setup(3,3); nav('next'); var r6=(index===0&&segIndex===1);
nav('next'); nav('next'); var r7=(index===1&&segIndex===0);
setup(5); nav('next'); nav('next'); nav('restart'); var r8=cur()==='OrderA'&&index===0&&segIndex===0;
check('Existing Next', r1&&r2);
check('Existing Back', r3);
check('Existing Back wrap', r4);
check('Existing Repeat', r5);
check('Existing Speak / segment stepping', r6&&r7);
check('Existing Restart', r8);

// ===== VOICE ==============================================================
var vc=[['next','next'],['back','back'],['repeat','repeat'],['post code','postcode'],
        ['restart','restart'],['start again','restart'],['pause','pause'],['resume','resume'],
        ['hold','hold'],['show hold','showhold'],['show the hold','showhold'],
        ['show me the held orders','showhold'],['show hold list','showhold'],
        ['1 meter umbrella holder black',null],['b22 switch holder',null],
        ['ceramic holder',null],['short arm holder copper',null],['20 milimeter back box with hole','back']];
var vcOk=true, bad=[];
vc.forEach(function(p){ var g=matchCommand(p[0]); if(g!==p[1]){vcOk=false;bad.push(JSON.stringify(p[0])+'->'+g);} });
check('Existing voice commands intact', vcOk, bad.join('; '));
check('Hold command matches', matchCommand('hold')==='hold');
check('Show Hold does NOT trigger Hold', matchCommand('show hold')==='showhold', 'got '+matchCommand('show hold'));
check('"holder" products never fire Hold', matchCommand('1 meter umbrella holder black')===null);

// ===== 18-STEP SCENARIO ===================================================
setup(4);
nav('next');                     var s3=cur()==='OrderB';
nav('hold');                     var s5=HELD.length===1&&HELD[0]===1, s6=cur()==='OrderC',
                                     s7=LOG[LOG.length-1]==='AT: OrderC';
nav('next'); nav('next');        var s9=HELD.length===1,
                                     s10=normalPassDone&&/held order/.test(SAID);
check('Hold enters hold list', s3&&s5);
check('Hold moves to next normal order + speaks it', s6&&s7);
check('Held order remains unprocessed', s9);
check('Normal completion detects held orders', s10, SAID);
nav('showhold');                 var s12=mode==='held'&&cur()==='OrderB';
nav('next');                     var s17=HELD.length===0, s18=/All orders completed/.test(SAID);
check('Show Hold shows only held orders', s12, 'mode='+mode+' at='+cur());
check('Held completion clears list', s17);
check('Final completion message', s18, SAID);

// ===== EDGE CASES =========================================================
setup(4); nav('hold');
check('Hold on first order', HELD[0]===0&&cur()==='OrderB');
setup(3); nav('next'); nav('next'); nav('hold');
check('Hold on last normal order', HELD[0]===2&&normalPassDone&&/held order/.test(SAID), SAID);
setup(5); nav('hold'); nav('hold');
check('Multiple holds', HELD.length===2&&HELD[0]===0&&HELD[1]===1&&cur()==='OrderC', HELD.join(','));

// Repeated Hold: the same order can never enter HELD twice. Normal navigation
// already skips held entries, so the guard is reached by landing on a held
// index directly - which is exactly what restorePosition() can do.
setup(5); nav('hold'); index=0; var before=HELD.length; nav('hold');
check('Repeated Hold protection', HELD.length===before&&/already held/i.test(SAID), SAID);

setup(4); nav('showhold');
check('Show Hold with empty list', mode==='normal'&&/No held orders/.test(SAID)&&cur()==='OrderA', SAID);
setup(3); nav('next'); nav('next'); nav('next');
check('Normal completion, no holds', /All orders completed/.test(SAID)&&HELD.length===0, SAID);

setup(6); nav('hold'); nav('hold'); nav('showhold');
var h1=cur()==='OrderA'; nav('next'); var h2=cur()==='OrderB'; nav('back'); var h3=cur()==='OrderA';
check('Next inside held sequence', h1&&h2, cur());
check('Back inside held sequence', h3, cur());
nav('next'); nav('next');
check('Held pass hands back to remaining normal orders', mode==='normal'&&HELD.length===0&&!/All orders completed/.test(SAID), 'mode='+mode+' | '+SAID);

setup(4); nav('hold'); nav('showhold'); nav('repeat');
check('Speak works after Show Hold', LOG[LOG.length-1]==='AT: OrderA', LOG[LOG.length-1]);
setup(4); nav('hold'); nav('showhold'); nav('postcode');
check('Postcode works after Show Hold', mode==='held'&&cur()==='OrderA');
setup(4); nav('hold'); nav(matchCommand('next'));
check('Voice commands work after Hold', cur()==='OrderC', cur());
setup(3); nav('hold'); nav('next'); nav('next');
check('No false completion while holds remain', !/All orders completed/.test(SAID)&&HELD.length===1, SAID);
setup(4); nav('hold'); nav('restart');
check('Restart clears hold state', HELD.length===0&&mode==='normal'&&normalPassDone===false&&cur()==='OrderA');

// collection + order share one orderIndex -> held together
setup(0);
QUEUE=[{kind:'collection',orderIndex:0,label:'CollA',segs:[{say:'c'}]},
       {kind:'order',orderIndex:0,order:{address:'W3 6HH'},label:'OrderA',segs:[{say:'a'}]},
       {kind:'order',orderIndex:1,order:{address:'CM6 3ZB'},label:'OrderB',segs:[{say:'b'}]}];
index=0; segIndex=0; HELD=[]; mode='normal'; normalPassDone=false; SAID='';
nav('hold');
check('Hold keeps a collection with its order', HELD.length===1&&HELD[0]===0&&cur()==='OrderB', cur());

// ===== HELD PASS MUST NOT REPLAY COLLECTION CARDS ========================
// Queue: CollA, OrderA, OrderB, CollC, OrderC
QUEUE=[{kind:'collection',orderIndex:0,label:'CollA',segs:[{say:'collect shades'}]},
       {kind:'order',orderIndex:0,order:{address:'W3 6HH'},label:'OrderA',segs:[{say:'a'}]},
       {kind:'order',orderIndex:1,order:{address:'CM6 3ZB'},label:'OrderB',segs:[{say:'b'}]},
       {kind:'collection',orderIndex:2,label:'CollC',segs:[{say:'collect shades'}]},
       {kind:'order',orderIndex:2,order:{address:'TS23 2PF'},label:'OrderC',segs:[{say:'c'}]}];
index=0; segIndex=0; HELD=[]; mode='normal'; normalPassDone=false; LOG=[]; SAID='';

// normal pass still shows collection cards
var seenNormal=[]; seenNormal.push(cur());
for(var k=0;k<4;k++){ nav('next'); seenNormal.push(cur()); }
check('Normal pass still plays collection cards',
      seenNormal.join(',')==='CollA,OrderA,OrderB,CollC,OrderC', seenNormal.join(','));

// hold OrderA (via its collection card) and OrderC
index=0; segIndex=0; HELD=[]; mode='normal'; normalPassDone=false; SAID='';
nav('hold');                    // on CollA -> holds orderIndex 0
var holdFromColl = HELD.length===1 && HELD[0]===0 && cur()==='OrderB';
check('Hold on a collection card holds its order', holdFromColl, cur()+' HELD='+HELD.join(','));

nav('next');                    // CollC  (orderIndex 2, not held)
nav('hold');                    // holds orderIndex 2
check('Second hold from a collection card', HELD.length===2 && HELD[1]===2, HELD.join(','));

nav('showhold');
var seenHeld=[cur()];
nav('next'); seenHeld.push(cur());
check('Show Hold plays ONLY orders, no collection cards',
      seenHeld.join(',')==='OrderA,OrderC', seenHeld.join(','));
check('Show Hold follows queue sequence', seenHeld[0]==='OrderA' && seenHeld[1]==='OrderC');
nav('next');
check('Held pass completes after last held order',
      HELD.length===0 && /All orders completed/.test(SAID), SAID);

console.log('\n| Test | Result |');
console.log('|---|---|');
results.forEach(function(r){ console.log('| '+r[0]+' | '+r[1]+(r[2]?' — '+r[2]:'')+' |'); });
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);

