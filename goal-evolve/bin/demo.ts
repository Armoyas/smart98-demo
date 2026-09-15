#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * CLI runner — `npm run demo`
 *
 * Plays the 10-run practice scenario, then prints:
 *   1. The goal and its acceptance criteria
 *   2. A run-by-run trace
 *   3. The rules the engine proposed, with evidence
 *   4. The Smart98 layers view (covered vs blank)
 *
 * Flags:
 *   --json    machine-readable output (for the dashboard)
 *   --quiet   only the final report
 *
 * Exit code 0 iff SC-006 holds: at least one non-trivial rule was proposed.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runDemo } from '../src/demo.ts';
import { Engine } from '../src/engine.ts';
import { RULE_LAYERS } from '../src/types.ts';
import type { EvolutionReport, Rule } from '../src/types.ts';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const quiet = args.has('--quiet');

// Resolve relative to this package, not the caller's cwd. Hardcoding
// 'goal-evolve/out' meant running from inside goal-evolve/ wrote to
// goal-evolve/goal-evolve/out/.
//
// `import.meta.url` points at bin/ (TS sources) or dist/bin/ (compiled), so
// walk up until we find package.json — that is the package root either way.
function findPackageRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const pkgRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.SMART98_OUT ?? join(pkgRoot, 'out');

// In-memory store, then persist a derived snapshot for the dashboard.
const { engine, goal, report } = runDemo(new Engine());
const snap = engine.store.writeSnapshot(join(outDir, 'snapshot.json'));

if (asJson) {
  process.stdout.write(
    JSON.stringify(
      {
        goal,
        runs: snap.runs,
        rules: snap.rules,
        report: {
          observedRuns: report.observedRuns,
          proposedCount: report.proposed.length,
          blankLayers: report.blankLayers,
          generatedAt: report.generatedAt,
        },
      },
      null,
      2,
    ) + '\n',
  );
  process.exit(report.proposed.length > 0 ? 0 : 1);
}

const dim = (s: string) => `\u001b[2m${s}\u001b[0m`;
const bold = (s: string) => `\u001b[1m${s}\u001b[0m`;
const green = (s: string) => `\u001b[32m${s}\u001b[0m`;
const red = (s: string) => `\u001b[31m${s}\u001b[0m`;
const cyan = (s: string) => `\u001b[36m${s}\u001b[0m`;
const yellow = (s: string) => `\u001b[33m${s}\u001b[0m`;

if (!quiet) {
  console.log(bold('\nSmart98 Demo — Goal + Self-Evolving\n'));
  console.log(`${bold('Goal')} ${cyan(goal.id)}: ${goal.title}`);
  console.log(`${bold('Acceptance')}: ${goal.acceptance}\n`);

  console.log(bold('Practice runs'));
  for (const run of snap.runs) {
    const mark = run.outcome === 'achieved' ? green('✓') : red('✗');
    const seq = run.actions.map((a) => a.kind).join(' → ');
    console.log(`  ${mark} ${cyan(run.id)}  ${dim(seq)}`);
  }
}

console.log(bold(`\nEvolution report — ${report.observedRuns} runs observed\n`));

if (report.proposed.length === 0) {
  console.log(red('  No rules proposed. SC-006 FAILED.'));
  process.exit(1);
}

for (const rule of report.proposed) {
  printRule(rule, dim, bold, yellow);
}

console.log(bold('\nRule layers'));
for (const layer of RULE_LAYERS) {
  const count = snap.rules.filter((r) => r.layer === layer).length;
  const bar = '█'.repeat(count) || dim('·');
  console.log(`  ${layer.padEnd(12)} ${bar} ${count === 0 ? dim('(blank)') : count}`);
}

console.log(bold('\nLayer gaps'));
if (report.blankLayers.length === 0) {
  console.log(green('  none — every layer has at least one rule'));
} else {
  console.log(yellow(`  blank: ${report.blankLayers.join(', ')}`));
}

console.log(
  `\n${bold('SC-006')}: ${green('PASS')} — ${report.proposed.length} non-trivial rule(s) from ${report.observedRuns} practice runs`,
);
console.log(dim(`Snapshot written to ${join(outDir, 'snapshot.json')}\n`));

function printRule(
  rule: Rule,
  dim: (s: string) => string,
  bold: (s: string) => string,
  yellow: (s: string) => string,
): void {
  console.log(
    `  ${bold(rule.id)} ${dim(`[${rule.layer}]`)} ${yellow(`${Math.round(rule.confidence * 100)}%`)} ${dim(`support=${rule.support}`)}`,
  );
  console.log(`  ${rule.statement}`);
  console.log(`  ${dim(rule.rationale)}`);
  console.log(`  ${dim(`evidence: ${rule.evidenceRunIds.join(', ')}`)}\n`);
}

void (0 as unknown as EvolutionReport);
