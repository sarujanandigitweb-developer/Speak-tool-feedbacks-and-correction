#!/usr/bin/env node
/* Add the Speak Tool to a pack list HTML file you have downloaded.
 *
 *   node packlist_extension/add-speak.js  <packlist.html>  [more.html …]
 *
 * Writes  <name>.speak.html  next to each input and leaves the original alone.
 *
 * The tool is INLINED into the output by default, so the result is one
 * self-contained file: move it anywhere, email it, double-click it, and it
 * works. A linked <script src> would break the moment the file was moved out of
 * this folder, and Chrome is restrictive about file:// subresources.
 *
 *   --link     link to packlist-speak.js instead of inlining (smaller output,
 *              but the output must stay beside this folder)
 *   --force    overwrite an existing .speak.html
 *
 * Nothing above </body> is touched. The original file is never modified.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BUNDLE = path.join(__dirname, 'packlist-speak.js');
const MARK = 'packlist-speak';                       // how we spot an already-done file


/* Inside a <script> block the HTML parser stops at the first "</script", even
 * one sitting in a JS string or comment — and the bundle's own header comment
 * shows the install line, which contains exactly that. Unescaped, it closed the
 * tag early and the rest of the tool was parsed as page text.
 * "<\\/script" is the standard escape: identical to JS, invisible to the parser.
 * "<!--" is escaped for the same reason. */
function inlineSafe(js) {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

function addSpeak(file, opts) {
  const src = fs.readFileSync(file, 'utf8');

  if (src.indexOf(MARK) !== -1) {
    return { file, skipped: 'already has the Speak Tool' };
  }
  // Matched case-insensitively: pack lists are hand-templated and </BODY> happens.
  const close = src.search(/<\/body\s*>/i);
  if (close === -1) {
    return { file, skipped: 'no </body> tag — is this a pack list page?' };
  }

  const tag = opts.link
    ? '\n<!-- Speak Tool -->\n<script src="' +
      path.relative(path.dirname(file), BUNDLE).split(path.sep).join('/') +
      '"></script>\n'
    : '\n<!-- Speak Tool — inlined, self-contained. Nothing above this line was changed. -->\n<script>\n' +
      inlineSafe(fs.readFileSync(BUNDLE, 'utf8')) + '\n</script>\n';

  const out = src.slice(0, close) + tag + src.slice(close);

  const dest = file.replace(/\.html?$/i, '') + '.speak.html';
  if (fs.existsSync(dest) && !opts.force) {
    return { file, skipped: path.basename(dest) + ' exists — pass --force to replace it' };
  }
  fs.writeFileSync(dest, out);
  return { file, dest, added: out.length - src.length };
}

const args = process.argv.slice(2);
const opts = { link: args.includes('--link'), force: args.includes('--force') };
const files = args.filter(a => !a.startsWith('--'));

if (!files.length) {
  console.log('Usage:  node packlist_extension/add-speak.js <packlist.html> [more.html …] [--link] [--force]');
  process.exit(1);
}
if (!fs.existsSync(BUNDLE)) {
  console.error('packlist-speak.js is missing. Build it first:  node packlist_extension/build.js');
  process.exit(1);
}

let made = 0;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('  ✗ ' + f + '  — not found'); continue; }
  const r = addSpeak(f, opts);
  if (r.skipped) { console.log('  – ' + path.basename(f) + '  — ' + r.skipped); continue; }
  made++;
  console.log('  ✓ ' + path.basename(r.dest) + '   (+' + Math.round(r.added / 1024) + ' KB)');
}
if (made) {
  console.log('\nOpen the .speak.html file in Chrome.');
  console.log('For VOICE commands it must be served over http — Chrome blocks the microphone on file://');
  console.log('    cd ' + path.dirname(path.resolve(files[0])) + ' && python3 -m http.server 8000');
  console.log('    then open  http://localhost:8000/<name>.speak.html');
}
