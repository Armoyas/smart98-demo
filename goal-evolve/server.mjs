// SPDX-License-Identifier: MIT
/**
 * Smart98 Dashboard — local HTTP server.
 *
 * Usage:
 *   cd goal-evolve && npm run serve
 *   → http://localhost:3000
 *
 * Endpoints:
 *   GET  /              → dashboard HTML
 *   GET  /api/run       → run the engine, return JSON result
 *   GET  /api/status    → engine status (quick check)
 *   GET  /snapshot.json → latest snapshot
 *
 * Zero runtime dependencies. Uses only node:http + node:fs + node:child_process.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DASHBOARD = path.join(__dirname, 'dashboard', 'index.html');
const SNAPSHOT = path.join(__dirname, 'out', 'snapshot.json');
const BIN_DEMO = path.join(__dirname, 'bin', 'demo.ts');
const RUN_MJS = path.join(__dirname, 'run.mjs');

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

/** Run the engine and return structured JSON output. */
function runEngine(): { status: string; output: string; snapshot?: unknown } {
  const CAN_STRIP_TYPES = (() => {
    const [major, minor] = process.versions.node.split('.').map(Number);
    return major > 22 || (major === 22 && minor >= 6);
  })();

  if (CAN_STRIP_TYPES) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', BIN_DEMO, '--json'], {
      cwd: __dirname,
      encoding: 'utf8',
      timeout: 30000,
    });
    if (result.status !== 0) {
      return { status: 'error', output: result.stderr || result.stdout || 'Engine failed' };
    }
    try {
      const json = JSON.parse(result.stdout);
      return { status: 'ok', output: result.stdout, snapshot: json };
    } catch {
      return { status: 'ok', output: result.stdout };
    }
  }

  // Node < 22.6: compile first, then run
  const tsc = path.join(__dirname, 'node_modules', '.bin', 'tsc');
  if (fs.existsSync(tsc)) {
    const built = spawnSync(tsc, [
      '--outDir', 'dist',
      '--module', 'nodenext',
      '--target', 'es2023',
      '--moduleResolution', 'nodenext',
      '--rewriteRelativeImportExtensions',
      '--skipLibCheck',
      'src/types.ts', 'src/store.ts', 'src/goal.ts', 'src/evolve.ts',
      'src/engine.ts', 'src/demo.ts', 'bin/demo.ts', 'test/engine.test.ts', 'test/domain.test.ts', 'test/goal-dialog.test.ts',
    ], { cwd: __dirname, encoding: 'utf8' });
    if (built.status !== 0) {
      return { status: 'error', output: built.stderr || built.stdout || 'tsc failed' };
    }
  }

  const result = spawnSync(process.execPath, ['dist/bin/demo.js', '--json'], {
    cwd: __dirname,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.status !== 0) {
    return { status: 'error', output: result.stderr || result.stdout || 'Engine failed' };
  }
  try {
    const json = JSON.parse(result.stdout);
    return { status: 'ok', output: result.stdout, snapshot: json };
  } catch {
    return { status: 'ok', output: result.stdout };
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ── API endpoints ──────────────────────────────────────────────

  if (pathname === '/api/run' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

    res.write('data: {"status":"running","message":"Running 10 practice runs..."}\n\n');

    const result = runEngine();

    if (result.status === 'ok') {
      res.write(`data: {"status":"complete","message":"Done — ${result.output.split('\n').filter(l => l.includes('SC-006')).join(' ')}"}\n\n`);
      res.write(`data: ${JSON.stringify({ status: 'ok', result: result.snapshot || null, raw: result.output })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ status: 'error', message: result.output })}\n\n`);
    }

    res.end();
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    const hasSnapshot = fs.existsSync(SNAPSHOT);
    let snapshot = null;
    if (hasSnapshot) {
      try {
        snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
      } catch { /* ignore */ }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready', snapshotExists: hasSnapshot, snapshot }));
    return;
  }

  // ── Static file serving ────────────────────────────────────────

  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = DASHBOARD;
  } else if (pathname === '/snapshot.json') {
    filePath = SNAPSHOT;
  } else {
    filePath = path.join(__dirname, pathname.split('?')[0]);
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
