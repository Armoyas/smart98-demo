#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Smart98 Dashboard — local HTTP server.
 *
 * Usage:
 *   cd goal-evolve && npm run serve
 *   → http://localhost:3000
 *
 * Zero runtime dependencies. Uses only node:http + node:fs.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DASHBOARD = path.join(__dirname, 'dashboard', 'index.html');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let filePath;

  if (req.url === '/' || req.url === '/index.html') {
    filePath = DASHBOARD;
  } else {
    filePath = path.join(__dirname, req.url.split('?')[0]);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       Smart98 Dashboard                          ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🔗  http://localhost:${PORT}                     ║`);
  console.log(`║  🔗  http://127.0.0.1:${PORT}                     ║`);
  console.log('║                                                  ║');
  console.log('║  Press Ctrl+C to stop                          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
