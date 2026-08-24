/* Live product names from the Names Master Sheet.
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS SOLVES
 * reference-data.js travels inside the tool, so the names are frozen at the
 * moment Speak-Tool.html was built. When the postage team corrects a
 * pronunciation or adds a SKU, the floor keeps hearing the old one until
 * somebody regenerates the file and re-uploads it. Measured against the sheet
 * on 2026-08-19, the shipped build was 5 SKUs and 332 names behind.
 *
 * THE LOOKUP ORDER
 *     live sheet  ->  localStorage cache  ->  window.REF.names  ->  ''
 *
 * window.REF.names is NEVER modified. The merged map is built on top of it, so
 * the built-in names are a floor that nothing here can lower: a failed fetch, a
 * truncated download or an empty sheet all leave the tool exactly as it behaves
 * today. That is the single most important property of this file.
 *
 * NO PROXY. docs.google.com serves the CSV export with
 * "access-control-allow-origin: *" - verified against this sheet, including
 * from Origin: null, which is what a saved .speak.html sends. So the browser can
 * read it directly and no Apps Script deployment is involved.
 *
 * Requires: reference-data.js (window.REF). Read by engine.js productName().
 */
;(function (w) {
  'use strict';

  var SHEET_ID = '16rx5Dz-YYp-GTvRfytjq9e4p6AHw3qYh8Tm9rOPkS6M';
  var GID      = '2082105888';
  var CSV_URL  = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
                 '/export?format=csv&gid=' + GID;

  var CACHE_KEY = 'stxNamesCache';
  var CACHE_V   = 1;
  var MAX_AGE   = 6 * 60 * 60 * 1000;   // refetch in the background after 6h
  var TIMEOUT   = 20000;                // a warehouse connection, not a datacentre

  /* A sheet this size is ~5,500 rows. Anything wildly under that is a truncated
   * download or the wrong tab, and is rejected rather than merged - a partial
   * file is how you would silently lose half the names. */
  var MIN_ROWS = 500;

  var state = {
    source: 'builtin',   // 'live' | 'cached' | 'builtin'
    at: 0,               // epoch ms of the data currently in use
    count: 0,            // entries in the live layer (not the merged total)
    total: 0,            // entries in the merged map actually used for lookups
    error: ''
  };

  function builtin() { return (w.REF && w.REF.names) || {}; }
  function builtinCount() { return Object.keys(builtin()).length; }

  /* ---- CSV -----------------------------------------------------------------
   * Two columns, SKU,Name, CRLF line endings, quoted fields possible. Written
   * out rather than pulled from a library so this file stays self-contained. */
  function parseCsv(text) {
    var out = [], row = [], field = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += c;
      } else if (c === '"') {
        quoted = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field); out.push(row); row = []; field = '';
      } else if (c !== '\r') {
        field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); out.push(row); }
    return out;
  }

  /* Rows -> {SKU: Name}. A row with a SKU but no name is SKIPPED, never stored
   * as an empty string: 329 rows in the live sheet are in exactly that state,
   * and storing them would blank out a perfectly good built-in name. */
  function toMap(rows) {
    var map = {};
    for (var i = 1; i < rows.length; i++) {          // row 0 is the header
      var sku  = String(rows[i][0] || '').trim().toUpperCase();
      var name = String(rows[i][1] || '').trim();
      if (!sku || !name) continue;
      map[sku] = name;                               // a repeated SKU: last row wins
    }
    /* DISTINCT SKUs, not rows. The sheet holds ~12,400 named rows but only
       ~5,550 distinct SKUs, so counting rows would report more than twice the
       number of names actually in use - a figure a manager would reasonably
       read as coverage. */
    return { map: map, count: Object.keys(map).length };
  }

  /* ---- the merge -----------------------------------------------------------
   * Built-in first, live layered on top. Returns null if the result would be
   * smaller than the built-in set, which cannot happen by construction and is
   * asserted anyway - this is the guarantee the whole file exists to keep. */
  function merge(live) {
    var merged = {}, base = builtin(), k;
    for (k in base) merged[k] = base[k];
    for (k in live) if (live[k]) merged[k] = live[k];
    if (Object.keys(merged).length < builtinCount()) return null;
    return merged;
  }

  function apply(live, source, at, count) {
    var merged = merge(live);
    if (!merged) { state.error = 'merge would reduce coverage - ignored'; return false; }
    w.STX_NAMES.map = merged;
    state.source = source;
    state.at     = at || 0;
    state.count  = count || Object.keys(live).length;
    state.total  = Object.keys(merged).length;
    state.error  = '';
    return true;
  }

  /* ---- cache ---------------------------------------------------------------
   * localStorage is SYNCHRONOUS, so the cached names are in place before the
   * queue is built - a packer who used the tool yesterday gets correct names on
   * the very first order with no network wait. */
  function readCache() {
    try {
      var raw = w.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== CACHE_V || !o.names) return null;
      if (Object.keys(o.names).length < MIN_ROWS) return null;
      return o;
    } catch (e) { return null; }
  }

  function writeCache(map, at) {
    try {
      w.localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_V, at: at, names: map }));
    } catch (e) {
      // Private mode, or the quota is full. The run still works - it just will
      // not be instant next time.
      if (w.STX && w.STX.debug) console.log('[names] cache not written:', e && e.message);
    }
  }

  /* ---- fetch ---------------------------------------------------------------
   * Resolves true when the live layer was replaced, false when nothing changed.
   * It NEVER rejects: a name refresh must not be able to take the tool down. */
  function refresh(opts) {
    opts = opts || {};
    if (!w.fetch) {
      state.error = 'this browser cannot fetch';
      return Promise.resolve(false);
    }

    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);

    return w.fetch(CSV_URL, {
      cache: 'no-store',
      redirect: 'follow',
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        clearTimeout(timer);
        var res = toMap(parseCsv(text));
        if (res.count < MIN_ROWS) throw new Error('only ' + res.count + ' names - looks truncated');
        var at = Date.now();
        if (!apply(res.map, 'live', at, res.count)) throw new Error(state.error);
        writeCache(res.map, at);
        if (w.STX && w.STX.debug) {
          console.log('[names] live: ' + res.count + ' from the sheet, ' + state.total + ' in use');
        }
        return true;
      })
      .catch(function (e) {
        clearTimeout(timer);
        // Whatever went wrong, the tool keeps whatever it already had.
        state.error = (e && e.name === 'AbortError') ? 'timed out' : (e && e.message) || 'failed';
        if (w.STX && w.STX.debug) console.log('[names] refresh failed:', state.error);
        return false;
      });
  }

  /* ---- start ---------------------------------------------------------------
   * Called before the queue is built. Applies the cache synchronously, then
   * goes to the network only when the cache is missing or stale. */
  function boot() {
    var c = readCache();
    if (c) apply(c.names, 'cached', c.at, Object.keys(c.names).length);
    else   apply({}, 'builtin', 0, 0);

    var stale = !c || (Date.now() - c.at) > MAX_AGE;
    return stale ? refresh({ auto: true }) : Promise.resolve(false);
  }

  function ago(ms) {
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 90) return 'just now';
    var m = Math.round(s / 60);      if (m < 90) return m + ' min ago';
    var h = Math.round(m / 60);      if (h < 36) return h + ' hr ago';
    return Math.round(h / 24) + ' days ago';
  }

  /* One line for the settings panel. Says which of the three sources is really
   * in use, so a sheet that has quietly stopped being reachable is visible
   * instead of looking like everything is fine. */
  function status() {
    if (state.source === 'live')   return 'Live · ' + state.count + ' names, updated ' + ago(state.at);
    if (state.source === 'cached') return 'Cached · ' + state.count + ' names, ' + ago(state.at) +
                                          (state.error ? ' · sheet unreachable' : '');
    return 'Built-in copy · ' + builtinCount() + ' names' +
           (state.error ? ' · sheet unreachable' : '');
  }

  w.STX_NAMES = {
    map: null,          // merged built-in + live; engine.js reads this
    state: state,
    boot: boot,
    refresh: refresh,
    status: status,
    url: CSV_URL,
    // exposed for the test harness
    _parseCsv: parseCsv,
    _toMap: toMap,
    _merge: merge
  };

})(window);
