#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Universal entry point — works on Node 18, 20, 22 and 24.
 *
 * `--experimental-strip-types` only exists on Node >= 22.6. On older Node it
 * is a hard error:
 *
 *     node: bad option: --experimental-strip-types
 *
 * So we pick the cheapest strategy the running Node actually supports:
 *
 *   Node >= 22.6  run the TypeScript sources directly (no build step)
 *   Node <  22.6  compile once with tsc into dist/, then run the JavaScript
 *
 * Either way the command the user types is the same: `npm run demo`.
 *
 * Usage:
 *   node run.mjs demo [--json] [--quiet]   run the demo
 *   node run.mjs test                      run the test suite
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);

/** Node >= 22.6 can strip types natively. */
const CAN_STRIP_TYPES = major > 22 || (major === 22 && minor >= 6);

const [, , command = 'demo', ...rest] = process.argv;

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: here });
  process.exit(result.status ?? 1);
}

function ensureBuilt() {
  // The demo build and the test build produce different artefacts, so each
  // command checks for the file *it* needs. Checking only dist/bin/demo.js
  // made `npm run demo && npm test` fail with
  // "Could not find .../dist/test/engine.test.js".
  const needed =
    command === 'test'
      ? join(here, 'dist', 'test', 'engine.test.js')
      : join(here, 'dist', 'bin', 'demo.js');
  if (existsSync(needed)) return;

  console.log('Node ' + process.versions.node + ' cannot strip types natively.');
  console.log('Compiling TypeScript once with tsc...\n');

  const tsc = join(here, 'node_modules', '.bin', 'tsc');
  if (!existsSync(tsc)) {
    console.error(
      '\n  tsc not found. Install the build dependency first:\n\n' +
        '    npm install\n\n' +
        '  Or upgrade to Node 22.6+ to run the TypeScript sources directly:\n\n' +
        '    nvm install 22 && nvm use 22\n',
    );
    process.exit(1);
  }

  // Compile the full source set every time, so running `demo` then `test`
  // never leaves the second command without its artefact.
  const built = spawnSync(
    tsc,
    [
      '--outDir', 'dist',
      '--module', 'nodenext',
      '--target', 'es2023',
      '--moduleResolution', 'nodenext',
      '--rewriteRelativeImportExtensions',
      '--skipLibCheck',
      'src/types.ts', 'src/store.ts', 'src/goal.ts', 'src/evolve.ts',
      'src/engine.ts', 'src/demo.ts', 'bin/demo.ts', 'test/engine.test.ts',
    ],
    { stdio: 'inherit', cwd: here },
  );

  if (built.status !== 0) process.exit(built.status ?? 1);
  console.log('\nBuild complete.\n');
}

if (command === 'demo') {
  if (CAN_STRIP_TYPES) {
    run(process.execPath, ['--experimental-strip-types', 'bin/demo.ts', ...rest]);
  } else {
    ensureBuilt();
    run(process.execPath, ['dist/bin/demo.js', ...rest]);
  }
} else if (command === 'test') {
  if (CAN_STRIP_TYPES) {
    run(process.execPath, ['--experimental-strip-types', '--test', 'test/engine.test.ts']);
  } else {
    ensureBuilt();
    run(process.execPath, ['--test', 'dist/test/engine.test.js']);
  }
} else {
  console.error(`Unknown command: ${command}. Use "demo" or "test".`);
  process.exit(1);
}
