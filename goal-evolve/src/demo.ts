// SPDX-License-Identifier: MIT
/**
 * Demo scenario — a simulated agent that gets better at a task.
 *
 * The narrative for the Vibe Coding audience:
 *
 *   Runs 1-4   the agent edits and finishes. It fails. Every time.
 *   Runs 5-10  the agent reads first, then edits, then tests. It succeeds.
 *
 * Nothing tells the engine this. It observes ten runs and derives the rule
 * "Read the relevant files, then edit in place, then run the tests" on its own
 * — which is exactly the habit the successful runs share and the failing ones
 * lack.
 *
 * Run `npm run demo` to watch it happen.
 */

import { Engine } from './engine.ts';
import type { Action, Goal, Run } from './types.ts';

/**
 * The naive plan: edit, then declare victory. No reading, no verification.
 * This is the behaviour we expect the engine to learn *against*.
 */
export const naivePlan = (goal: Goal) => ({
  actions: [
    { kind: 'edit', target: 'src/parser.ts' },
    { kind: 'finish', target: goal.id },
  ] as Action[],
  outcome: 'failed' as Run['outcome'],
  note: 'the change does not apply cleanly',
});

/**
 * The careful plan: read, edit, test, finish.
 * This is the behaviour the engine should discover and codify.
 */
export const carefulPlan = (goal: Goal) => ({
  actions: [
    { kind: 'read', target: 'src/parser.ts' },
    { kind: 'read', target: 'src/parser.test.ts' },
    { kind: 'edit', target: 'src/parser.ts' },
    { kind: 'test', target: 'parser.test.ts' },
    { kind: 'finish', target: goal.id },
  ] as Action[],
  outcome: 'achieved' as Run['outcome'],
  note: 'tests pass',
});

/**
 * A third behaviour: search before acting, used to show that the engine can
 * surface more than one habit when the practice supports it.
 */
export const exploratoryPlan = (goal: Goal) => ({
  actions: [
    { kind: 'search', target: 'parser regression' },
    { kind: 'read', target: 'src/parser.ts' },
    { kind: 'edit', target: 'src/parser.ts' },
    { kind: 'test', target: 'parser.test.ts' },
    { kind: 'finish', target: goal.id },
  ] as Action[],
  outcome: 'achieved' as Run['outcome'],
  note: 'tests pass',
});

/**
 * Drive the full demo: open a goal, run ten practice attempts, evolve, and
 * approve the strongest rule.
 *
 * Returns the engine so the caller can inspect state or write a snapshot.
 */
export function runDemo(engine = new Engine()) {
  const goal = engine.openGoal(
    'Fix the parser regression',
    'The parser test suite passes and no existing tests regress.',
  );

  // Runs 1-4: the agent guesses. All four fail the same way.
  for (let i = 0; i < 4; i++) engine.runGoal(goal.id, naivePlan);

  // Runs 5-10: the agent reads, edits, and verifies. All six succeed.
  for (let i = 0; i < 3; i++) engine.runGoal(goal.id, carefulPlan);
  for (let i = 0; i < 3; i++) engine.runGoal(goal.id, exploratoryPlan);

  const report = engine.evolveNow();

  // Approve the top rule, then apply it — so the pruning view has data too.
  const top = report.proposed[0];
  if (top) {
    engine.reviewRule(top.id, 'approved');
    engine.applyRule(top.id);
  }

  return { engine, goal, report };
}
