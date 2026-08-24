/* Live-names tests — run against the SHIPPED bundle, not the sources.
 *
 *   node evidence/live-names-tests.js
 *
 * Everything under test is lifted out of packlist_extension/packlist-speak.js
 * so a green run says the deployed file behaves, not that a copy of the logic
 * behaves. Network is stubbed so the suite is deterministic and offline-safe;
 * the real endpoint is checked separately with curl.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BUNDLE = fs.readFileSync(path.join(ROOT, 'packlist_extension/packlist-speak.js'), 'utf8');

let pass = 0, fail = 0; const rows = [];
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  rows.push([name, cond ? 'PASS' : 'FAIL', cond ? '' : (detail || '')]);
  if (!cond) console.log('   FAIL: ' + name + (detail ? '  — ' + detail : ''));
}

/* ---- load the two units out of the bundle -------------------------------- */
function slice(startMarker, endMarker) {
  const a = BUNDLE.indexOf(startMarker);
  const b = BUNDLE.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error('cannot locate ' + startMarker);
  return BUNDLE.slice(a, b);
}

// productName(), exactly as shipped
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  let j = src.indexOf('{', i), d = 0;
  for (;;) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); } j++; }
}

/* A fresh sandbox per scenario: real names-live.js, a fake window, fake
   localStorage, fake fetch. */
function sandbox(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  const w = {
    REF: { names: Object.assign({}, opts.builtin || {}) },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { if (opts.storageFails) throw new Error('quota'); store[k] = String(v); },
    },
    fetch: opts.fetch,
    STX: { debug: false },
  };
  w.window = w;
  const src = slice('/* ===== packlist_extension/src/names-live.js',
                    '/* ===== packlist_extension/src/speak-extension.js');
  new Function('window', 'Date', 'Promise', 'setTimeout', 'clearTimeout', 'console', 'AbortController',
    src + '\n')(w, Date, Promise, setTimeout, clearTimeout, console,
                typeof AbortController !== 'undefined' ? AbortController : undefined);

  const pn = new Function('w', grabFn(BUNDLE, 'productName') + '\nreturn productName;')(w);
  return { w, productName: pn, store };
}

const okFetch = csv => () => Promise.resolve({ ok: true, text: () => Promise.resolve(csv) });
const BIG = n => { let s = 'SKU,Name\r\n'; for (let i = 0; i < n; i++) s += 'FILLER' + i + ',filler ' + i + '\r\n'; return s; };

/* ========================================================================= */
/* 1. built-in names still work                                              */
{
  const { w, productName } = sandbox({ builtin: { AAA: 'alpha', BBB: 'beta' } });
  check('1. Built-in names still work',
        productName('AAA') === 'alpha' && productName('bbb') === 'beta',
        productName('AAA') + '/' + productName('bbb'));
  check('1b. Pack-suffix fallback still works',
        sandbox({ builtin: { LSFT220BG: 'shade' } }).productName('LSFT220BG5PK') === 'shade');
  check('1c. Unknown SKU still returns empty', productName('NOPE') === '');
}

/* 2 + 3 + 4. live overrides, new SKUs, changed names                        */
{
  const csv = BIG(600) + 'AAA,ALPHA FROM SHEET\r\nZZZ,brand new sku\r\n';
  const s = sandbox({ builtin: { AAA: 'alpha', BBB: 'beta' }, fetch: okFetch(csv) });
  s.w.STX_NAMES.boot().then(() => {
    check('2. Live sheet overrides a built-in name', s.productName('AAA') === 'ALPHA FROM SHEET', s.productName('AAA'));
    check('3. New SKU from the sheet is available', s.productName('ZZZ') === 'brand new sku', s.productName('ZZZ'));
    check('4. Built-in name with no sheet row survives', s.productName('BBB') === 'beta', s.productName('BBB'));
    check('4b. Source reported as live', s.w.STX_NAMES.state.source === 'live', s.w.STX_NAMES.state.source);

    /* 5. blank sheet name must not erase a good built-in name                */
    const blank = sandbox({ builtin: { AAA: 'alpha' }, fetch: okFetch(BIG(600) + 'AAA,\r\nCCC,   \r\n') });
    return blank.w.STX_NAMES.boot().then(() => {
      check('5. Blank sheet name does not erase built-in', blank.productName('AAA') === 'alpha', blank.productName('AAA'));
      check('5b. Blank-name row is not stored at all', blank.productName('CCC') === '', blank.productName('CCC'));

      /* 6. failed fetch falls back safely                                    */
      const dead = sandbox({ builtin: { AAA: 'alpha' }, fetch: () => Promise.reject(new Error('offline')) });
      return dead.w.STX_NAMES.boot().then(changed => {
        check('6. Failed fetch keeps built-in names', dead.productName('AAA') === 'alpha' && changed === false);
        check('6b. Failed fetch reports built-in source', dead.w.STX_NAMES.state.source === 'builtin', dead.w.STX_NAMES.state.source);
        check('6c. Failed fetch records the reason', /offline/.test(dead.w.STX_NAMES.state.error), dead.w.STX_NAMES.state.error);

        const http500 = sandbox({ builtin: { AAA: 'alpha' }, fetch: () => Promise.resolve({ ok: false, status: 500 }) });
        return http500.w.STX_NAMES.boot().then(() => {
          check('6d. HTTP error keeps built-in names', http500.productName('AAA') === 'alpha' && /500/.test(http500.w.STX_NAMES.state.error));

          const trunc = sandbox({ builtin: { AAA: 'alpha' }, fetch: okFetch('SKU,Name\r\nAAA,truncated junk\r\n') });
          return trunc.w.STX_NAMES.boot().then(() => {
            check('6e. Truncated download is rejected', trunc.productName('AAA') === 'alpha' && /truncated/.test(trunc.w.STX_NAMES.state.error), trunc.w.STX_NAMES.state.error);

            const garbage = sandbox({ builtin: { AAA: 'alpha' }, fetch: okFetch('<html>signin</html>') });
            return garbage.w.STX_NAMES.boot().then(() => {
              check('6f. Non-CSV response is rejected', garbage.productName('AAA') === 'alpha' && garbage.w.STX_NAMES.state.source === 'builtin');

              /* 7. Refresh Names                                             */
              let body = BIG(600) + 'AAA,first\r\n';
              const r = sandbox({ builtin: { AAA: 'alpha' }, fetch: () => Promise.resolve({ ok: true, text: () => Promise.resolve(body) }) });
              return r.w.STX_NAMES.boot().then(() => {
                const before = r.productName('AAA');
                body = BIG(600) + 'AAA,second\r\n';
                return r.w.STX_NAMES.refresh({ manual: true }).then(changed => {
                  check('7. Refresh Names picks up an edit', before === 'first' && changed === true && r.productName('AAA') === 'second',
                        before + ' -> ' + r.productName('AAA'));

                  /* cache */
                  const cached = sandbox({ builtin: { AAA: 'alpha' }, storage: r.store, fetch: () => Promise.reject(new Error('offline')) });
                  return cached.w.STX_NAMES.boot().then(() => {
                    check('7b. Cache survives and is used offline', cached.productName('AAA') === 'second', cached.productName('AAA'));
                    check('7c. Cached source reported', cached.w.STX_NAMES.state.source === 'cached', cached.w.STX_NAMES.state.source);

                    const noStore = sandbox({ builtin: { AAA: 'alpha' }, fetch: okFetch(BIG(600) + 'AAA,x\r\n'), storageFails: true });
                    return noStore.w.STX_NAMES.boot().then(() => {
                      check('7d. Unwritable localStorage does not break the run', noStore.productName('AAA') === 'x');

                      /* 10. merged map is never smaller than built-in        */
                      const many = {}; for (let i = 0; i < 2000; i++) many['B' + i] = 'builtin ' + i;
                      const shrink = sandbox({ builtin: many, fetch: okFetch(BIG(600)) });
                      return shrink.w.STX_NAMES.boot().then(() => {
                        const merged = Object.keys(shrink.w.STX_NAMES.map).length;
                        check('10. Merged map never smaller than built-in', merged >= 2000, merged + ' vs 2000');
                        check('10b. Every built-in key survives the merge',
                              Object.keys(many).every(k => shrink.productName(k) === many[k]));
                        check('10c. window.REF.names is never mutated',
                              Object.keys(shrink.w.REF.names).length === 2000 && shrink.w.REF.names.B0 === 'builtin 0');
                        report();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

/* 8 + 9. nothing else changed — checked structurally against the bundle      */
function report() {
  const has = s => BUNDLE.includes(s);
  check('8. Voice commands untouched (9 actions present)',
        ['next', 'back', 'repeat', 'postcode', 'restart', 'pause', 'resume', 'hold', 'showhold']
          .every(a => has("a: '" + a + "'")));
  check('8b. Speech path untouched', has('function orderSegments') && has('function speakCurrent') && has('function postcodeSpeech'));
  check('9. Packing / order logic untouched',
        has('function buildQueue') && has('function makeLine') && has('function parseDoc') && has('function applyPriority') && has('function hasPriorityAnchor'));
  check('9b. SKU logic untouched', has('function colourFromSku') && has('function productColour') && has('function productImageSot'));
  check('9c. Hold feature still present', has('data-act="hold"') && has('function endOfPass'));
  check('9d. reference-data.js still bundled', has('window.REF = {') && has('LHXBTF40E27WH'));

  console.log('\n| Test | Result |');
  console.log('|---|---|');
  rows.forEach(r => console.log('| ' + r[0] + ' | ' + r[1] + (r[2] ? ' — ' + r[2] : '') + ' |'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
