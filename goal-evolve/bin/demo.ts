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

import { runDemo } from '../src/demo.ts';
import { Store } from '../src/store.ts';
import { RULE_LAYERS } from '../src/types.ts';
import type { EvolutionReport, Rule } from '../src/types.ts';

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const quiet = args.has('--quiet');

const outDir = process.env.SMART98_OUT ?? 'goal-evolve/out';

// In-memory store, then persist a derived snapshot for the dashboard.
const { engine, goal, report } = runDemo(new Store(':memory:'));
const snap = engine.store.writeSnapshot(`${outDir}/snapshot.json`);

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
  printRule(rule, dim, cyan, yellow, green);
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
console.log(dim(`Snapshot written to ${outDir}/snapshot.json\n`));

function printRule(
  rule: Rule,
  dim: (s: string) => string,
  cyan: (s: string) => string,
  yellow: (s: string) => string,
  green: (s: string) => string,
): void {
  console.log(`  ${bold(rule.id)} ${dim(`[${rule.layer}]`)} ${yellow(`${Math.round(rule.confidence * 100)}%`)} ${dim(`support=${rule.support}`)}`);
  console.log(`  ${rule.statement}`);
  console.log(`  ${dim(rule.rationale)}`);
  console.log(`  ${dim(`evidence: ${rule.evidenceRunIds.join(', ')}`)}\n`);
}
