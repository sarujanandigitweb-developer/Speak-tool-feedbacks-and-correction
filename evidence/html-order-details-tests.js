/* Run with Node and jsdom available (NODE_PATH may point to its installation). */
'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const {execFileSync} = require('child_process');
const {JSDOM} = require('jsdom');
const root = require('path').join(__dirname, '..');
const read = p => fs.readFileSync(root + '/' + p, 'utf8');
const engine = read('speak_tool_html_sheet_UI/engine.js');
const extension = read('packlist_extension/src/speak-extension.js');
const oldEngine = process.env.STX_BASELINE_ENGINE ? fs.readFileSync(process.env.STX_BASELINE_ENGINE,'utf8') : execFileSync('git', ['show', 'HEAD:speak_tool_html_sheet_UI/engine.js'], {cwd:root, encoding:'utf8'});
function load(src) { const w = {}; vm.runInNewContext(read('speak_tool_html_sheet_UI/reference-data.js') + src, {window:w}); return w; }
const w = load(engine), before = load(oldEngine), E = w.Engine;
const sizes = [1,2,3,4,5,6,7,8,9,10,15,20,30,50,100,12,16,24,75,150,11,80,200,250,300,500,1000,25];
const codes = '123456789ABCDEFGHIJKLMNOPQRS';
w.STX_NAMES = {map:{LDSSTRE274:'Master bulb name'}};
[...codes].forEach((c,i) => {
  assert.equal(E.packSize('LDSSTRE274'+c+'PK'),sizes[i]);
  assert.equal(E.baseSku('LDSSTRE274'+c+'PK'),'LDSSTRE274');
  assert.equal(E.productName('LDSSTRE274'+c+'PK'),'Master bulb name');
});
assert.equal(E.baseSku('LDSSTRE274'),'LDSSTRE274');
assert.equal(E.baseSku('THINGZPK'),'THINGZPK');
let total=0, qr=0, merges=0;
for(let i=1;i<=13;i++) {
  const dom = new JSDOM(read('order_details/'+i+'.html'));
  const doc=dom.window.document, orders=E.parseDoc(doc,''), old=before.Engine.parseDoc(doc,'');
  assert.equal(orders.length,old.length);
  orders.forEach((o,j) => {
    total++; qr+=!!o.instructionQr; merges+=!!o.isMerge;
    assert(!/\bu3$/i.test(o.orderType));
    assert(o.postcodeNode && o.postcodeNode.textContent.trim());
    // Packing sequence and quantities in the saved fixtures remain unchanged.
    assert.equal(JSON.stringify(o.lines.map(l=>[l.sku,l.qty])),JSON.stringify(old[j].lines.map(l=>[l.sku,l.qty])));
    const segs=E.speechFor(o), said=segs.map(s=>s.say).join(' ');
    if(o.orderType && o.startsPacklist) assert(segs[0].say.startsWith(E.packlistSpeech(o)+'. '));
    if(!o.startsPacklist && o.orderType) assert(!segs[0].say.includes(o.orderType));
    if(o.isMerge) assert(segs[0].say.includes('Merge Order.'));
    if(o.instructionQr) assert(said.indexOf('Instruction QR')<said.indexOf(':Post Code:'));
  });
  dom.window.close();
}
for(const s of ['DCV Packlist L u3','Amazon Shipping Prime Packlist L u3','Wayfair Ledsone Packlist u3'])
  assert.equal(E.orderTypeName(s),s.slice(0,s.indexOf('Packlist')+8));
// Exercise the actual extension in a DOM with controllable speech events.
const dom = new JSDOM(`<ul><li class="bg-white"><div class="text-secondary fw-bold">DCV Packlist L u3</div><div class="text-primary">zzzmerge_order</div><div class="fs-6">AB1 2CD</div><span class="badge bg-success">Instruction QR</span><div class="p-1" id="1-li"><span onclick="copyText()">LDSSTRE2742PK</span><span>Quantity: 3</span></div></li><li class="bg-white" data-stx-source="Wayfair Ledsone Packlist u3.html"><div class="fs-6">EF3 4GH</div><div class="p-1" id="2-li"><span onclick="copyText()">OTHER</span><span>Quantity: 1</span></div></li></ul>`, {url:'https://example.test',runScripts:'outside-only'});
const win=dom.window, spoken=[]; let scrolls=0;
win.eval(read('speak_tool_html_sheet_UI/reference-data.js')+engine);
win.STX_NAMES={map:{LDSSTRE274:'Master bulb name'},status(){return 'Test names';},state:{source:'builtin'}};
win.SpeechSynthesisUtterance=function(text){this.text=text;};
win.speechSynthesis={cancel(){},getVoices(){return[];},speak(u){spoken.push(u);},speaking:false};
win.eval(extension);
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
const orders=win.STX.orders;
assert.equal(orders[1].instructionQr,'');
assert.equal(orders[1].isMerge,false);
const loader=read('packlist_extension/src/speak-loader.template.html');
const mergeSource=loader.slice(loader.indexOf('  function merge(files)'),loader.indexOf('  function open_(files)'));
const merge=win.eval('(' + mergeSource.trim() + ')');
const bulk=merge([1,2,4].map(i=>({name:i+'.html',html:read('order_details/'+i+'.html')})));
const bulkOrders=E.parseDoc(bulk,'pack list');
assert.equal(bulkOrders.find(o=>o.node.getAttribute('data-stx-file')==='1').orderType,'Amazon Shipping Prime Packlist');
assert.equal(bulkOrders.find(o=>o.node.getAttribute('data-stx-file')==='2').orderType,'DCV Packlist');
assert.equal(bulkOrders.find(o=>o.node.getAttribute('data-stx-file')==='3').orderType,'Wayfair Ledsone Packlist');
// Each bulk file announces its category only on its first order.
for (const file of ['1','2','3']) {
  const group=bulkOrders.filter(o=>o.node.getAttribute('data-stx-file')===file);
  assert.equal(group.filter(o=>E.packlistSpeech(o)).length,1);
  assert.equal(group[0].startsPacklist,true);
}
assert.equal(E.packlistSpeech(bulkOrders[0]),'Amazon Shipping Prime');
// Two uploads with the same category still have separate packlist starts.
const duplicate=E.parseDoc(merge([1,1].map((i,j)=>({name:j+'.html',html:read('order_details/'+i+'.html')}))),'');
assert.equal(duplicate.filter(o=>E.packlistSpeech(o)).length,2);
assert.equal(orders[0].lines[0].qty,6);
assert.equal(orders[0].lines[0].name,'Master bulb name');
orders[0].postcodeNode.scrollIntoView=()=>scrolls++;
win.STX.nav('repeat');
assert(spoken.at(-1).text.startsWith('DCV Packlist. Merge Order.'));
assert(spoken.at(-1).text.includes('Instruction QR'));
assert(!spoken.at(-1).text.includes(':Post Code:'));
assert.equal(win.document.getElementById('stx-order-type').textContent,'DCV Packlist · Merge Order');
spoken.at(-1).onend();
assert(spoken.at(-1).text.startsWith(':Post Code:'));
spoken.at(-1).onstart(); assert.equal(scrolls,1);
win.STX.nav('next');
assert(spoken.at(-1).text.startsWith('Wayfair Ledsone Packlist.'));
win.STX.nav('back'); const cancelled=spoken.at(-1);
win.STX.nav('next'); const count=spoken.length;
cancelled.onend(); assert.equal(spoken.length,count,'Next cancels pending postcode continuation');
win.STX.nav('back'); win.STX.nav('postcode'); spoken.at(-1).onstart(); assert.equal(scrolls,2);
const style=win.getComputedStyle(win.document.getElementById('stx-say'));
assert.equal(style.whiteSpace,'normal');
assert.equal(style.overflowWrap,'anywhere');
assert.equal(win.document.getElementById('stx-say').textContent,'Master bulb name');
assert(win.document.getElementById('stx-details').textContent.includes('AB1 2CD'));
assert(win.document.getElementById('stx-panel-space'));
const oldExt=process.env.STX_BASELINE_EXTENSION ? fs.readFileSync(process.env.STX_BASELINE_EXTENSION,'utf8') : execFileSync('git',['show','HEAD:packlist_extension/src/speak-extension.js'],{cwd:root,encoding:'utf8'});
const mic=s=>s.slice(s.indexOf('  var SR ='),s.indexOf('  /* ---------------------------------------------------------------- keyboard'));
assert.equal(mic(extension),mic(oldExt),'Microphone controls must remain byte-for-byte unchanged');
dom.window.close();
console.log(`PASS: all 28 pack codes; ${total} saved orders (${qr} QR, ${merges} merge); unchanged packing sequence/quantities; announcements, scrolling, Next cancellation; microphone code unchanged.`);
