#!/usr/bin/env node
/* Serve the Speak Tool over http so the microphone works.
 *
 *   node packlist_extension/serve.js                     serve this folder
 *   node packlist_extension/serve.js ~/Downloads         serve a folder
 *   node packlist_extension/serve.js ~/Downloads/11.speak.html    serve and open that file
 *
 * WHY THIS IS NEEDED
 * A page opened from disk has the URL file:///… and therefore the origin "null".
 * Chrome cannot attach a microphone permission to a null origin, so voice
 * commands are refused no matter what anyone clicks — it is not a setting.
 * http://localhost IS a trusted origin, so serving the same file over it makes
 * the microphone work with no other change.
 *
 * Speech OUTPUT and every button work on file:// regardless. This is only about
 * voice commands.
 */
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const arg = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
let root = arg, openFile = '';
if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
  root = path.dirname(arg);
  openFile = path.basename(arg);
} else if (!fs.existsSync(arg)) {
  console.error('Not found: ' + arg);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/' + (openFile || 'speak-loader.html');

  // Never serve outside the folder being shared.
  const file = path.join(root, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + rel + '\n\nFiles here:\n  ' +
              fs.readdirSync(root).filter(f => /\.html?$/i.test(f)).join('\n  '));
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
});

function listen(port, triesLeft) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) return listen(port + 1, triesLeft - 1);
    console.error(e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = 'http://localhost:' + port + '/' + openFile;
    console.log('\n  Speak Tool is being served with the microphone enabled.\n');
    console.log('    ' + url + '\n');
    console.log('  Serving : ' + root);
    console.log('  Stop    : Ctrl+C\n');
    // Best effort; the URL above is printed either way.
    execFile('xdg-open', [url], () => {});
  });
}

listen(Number(process.env.PORT) || 8000, 20);
