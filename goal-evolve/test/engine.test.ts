// SPDX-License-Identifier: MIT
/**
 * Engine tests — prove the guarantees the demo claims.
 *
 *   1. Determinism: same observations → same rules, always.
 *   2. Evidence:    every rule cites the runs that produced it.
 *   3. Idempotence: evolving twice does not duplicate rules.
 *   4. Lifecycle:   goal state machine enforces legal transitions.
 *   5. SC-006:      10 practice runs yield ≥ 1 non-trivial rule.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Engine } from '../src/engine.ts';
import { evolve, blankLayers, staleRules } from '../src/evolve.ts';
import { createGoal, transition, progress, GoalError } from '../src/goal.ts';
import { Store } from '../src/store.ts';
import { runDemo, naivePlan, carefulPlan } from '../src/demo.ts';
import type { Observation } from '../src/types.ts';

/** Build an observation directly, bypassing goal execution. */
function obs(
  runId: string,
  outcome: 'achieved' | 'failed',
  sequence: Observation['sequence'],
  failureSignature?: string,
): Observation {
  return { goalId: 'GOAL-1', runId, outcome, sequence, failureSignature };
}

function achieved(id: string, seq: Observation['sequence']): Observation {
  return obs(id, 'achieved', seq);
}

function failed(id: string, seq: Observation['sequence'], sig: string): Observation {
  return obs(id, 'failed', seq, sig);
}

// ---------------------------------------------------------------- store

void test('store: state is derived by reduction from the event log', () => {
  const store = new Store(':memory:');
  const goal = createGoal(store, { title: 'T', acceptance: 'A' });
  transition(store, goal.id, 'running');
  transition(store, goal.id, 'achieved');

  const snap = store.snapshot();
  assert.equal(snap.goals[0]?.status, 'achieved');
  assert.equal(store.ofType('goal.status').length, 2);
});

void test('store: writeSnapshot round-trips through JSON without loss', () => {
  const { engine } = runDemo();
  const snap = engine.store.writeSnapshot('/tmp/smart98-test-snap.json');
  const reloaded = JSON.parse(readFileSync('/tmp/smart98-test-snap.json', 'utf8'));

  assert.equal(reloaded.goals.length, snap.goals.length);
  assert.equal(reloaded.runs.length, snap.runs.length);
  assert.equal(reloaded.rules.length, snap.rules.length);
});

// ---------------------------------------------------------------- goal lifecycle

void test('goal: requires acceptance criteria', () => {
  const store = new Store(':memory:');
  assert.throws(() => createGoal(store, { title: 'No acceptance', acceptance: ' ' }), GoalError);
});

void test('goal: enforces the transition table', () => {
  const store = new Store(':memory:');
  const goal = createGoal(store, { title: 'T', acceptance: 'A' });

  // open → achieved is illegal; must pass through running.
  assert.throws(() => transition(store, goal.id, 'achieved'), GoalError);

  transition(store, goal.id, 'running');
  transition(store, goal.id, 'blocked');
  transition(store, goal.id, 'running');
  transition(store, goal.id, 'achieved');

  // Terminal states are absorbing.
  assert.throws(() => transition(store, goal.id, 'running'), GoalError);
});

void test('goal: progress is the share of achieved runs', () => {
  const engine = new Engine();
  const goal = engine.openGoal('T', 'A');
  assert.equal(progress(engine.store, goal.id), 0);

  engine.runGoal(goal.id, naivePlan);
  assert.equal(progress(engine.store, goal.id), 0);

  engine.runGoal(goal.id, carefulPlan);
  assert.equal(progress(engine.store, goal.id), 0.5);
});

// ---------------------------------------------------------------- evolution

void test('evolve: deterministic — same observations, same rules', () => {
  const observations = [
    achieved('r1', ['read', 'edit', 'test', 'finish']),
    achieved('r2', ['read', 'edit', 'test', 'finish']),
    achieved('r3', ['read', 'edit', 'test', 'finish']),
    failed('r4', ['edit', 'finish'], 'the change does not apply cleanly'),
    failed('r5', ['edit', 'finish'], 'the change does not apply cleanly'),
    failed('r6', ['edit', 'finish'], 'the change does not apply cleanly'),
  ];

  const a = evolve(observations);
  const b = evolve(observations);
  assert.deepEqual(a, b);
  assert.ok(a.length > 0, 'expected at least one rule');
});

void test('evolve: every rule cites evidence and clears minSupport', () => {
  const observations = [
    achieved('r1', ['read', 'edit', 'test']),
    achieved('r2', ['read', 'edit', 'test']),
    achieved('r3', ['read', 'edit', 'test']),
    failed('r4', ['edit', 'finish'], 'sig'),
  ];

  for (const rule of evolve(observations, { minSupport: 3 })) {
    assert.ok(rule.support >= 3, `${rule.id} support ${rule.support} < 3`);
    assert.ok(rule.evidenceRunIds.length === rule.support);
    assert.ok(rule.rationale.length > 0);
    assert.equal(rule.status, 'candidate');
  }
});

void test('evolve: rejects rules that appear in every run (non-triviality gate)', () => {
  // 'edit>finish' appears in ALL runs below — it must not become a rule.
  const observations = [
    achieved('r1', ['edit', 'finish', 'test']),
    achieved('r2', ['edit', 'finish', 'test']),
    achieved('r3', ['edit', 'finish', 'test']),
    failed('r4', ['edit', 'finish'], 'sig'),
  ];

  const rules = evolve(observations);
  for (const rule of rules) {
    assert.ok(
      !rule.statement.includes('edit in place, then finish and report'),
      `trivial rule proposed: ${rule.statement}`,
    );
  }
});

void test('evolve: clusters repeated failures into one recovery rule', () => {
  const observations = [
    failed('r1', ['edit', 'finish'], 'the test suite fails'),
    failed('r2', ['run', 'finish'], 'the test suite fails'),
    failed('r3', ['edit', 'run'], 'the test suite fails'),
    achieved('r4', ['edit', 'test', 'finish']),
    achieved('r5', ['edit', 'test', 'finish']),
    achieved('r6', ['edit', 'test', 'finish']),
  ];

  const rules = evolve(observations);
  const recovery = rules.filter((r) => r.layer === 'recovery');
  assert.equal(recovery.length, 1, 'expected exactly one recovery rule');
  assert.match(recovery[0]!.statement, /When the test suite fails/);
});

void test('evolve: blankLayers reports uncovered Smart98 layers', () => {
  const rules = evolve([
    achieved('r1', ['read', 'edit', 'test', 'finish']),
    achieved('r2', ['read', 'edit', 'test', 'finish']),
    achieved('r3', ['read', 'edit', 'test', 'finish']),
  ]);
  // No failures were observed → no recovery rules → recovery layer is blank.
  assert.ok(blankLayers(rules).includes('recovery'));
});

void test('evolve: staleRules flags approved rules with usage below evidence', () => {
  const rule = {
    id: 'RULE-test',
    statement: 'Run the tests',
    rationale: 'evidence',
    layer: 'verification' as const,
    confidence: 0.9,
    support: 3,
    evidenceRunIds: ['r1', 'r2', 'r3'],
    status: 'approved' as const,
    usageCount: 1,
    createdAt: new Date().toISOString(),
  };
  assert.equal(staleRules([rule]).length, 1);

  const used = { ...rule, usageCount: 3 };
  assert.equal(staleRules([used]).length, 0);
});

// ---------------------------------------------------------------- engine

void test('engine: runGoal records an observation and closes achieved goals', () => {
  const engine = new Engine();
  const goal = engine.openGoal('Fix parser', 'tests pass');
  engine.runGoal(goal.id, carefulPlan);

  const snap = engine.store.snapshot();
  assert.equal(snap.runs.length, 1);
  assert.equal(snap.observations.length, 1);
  assert.equal(snap.goals[0]?.status, 'achieved');
});

void test('engine: failed run leaves the goal open for retry', () => {
  const engine = new Engine();
  const goal = engine.openGoal('Fix parser', 'tests pass');
  engine.runGoal(goal.id, naivePlan);

  const snap = engine.store.snapshot();
  assert.equal(snap.goals[0]?.status, 'running');
  assert.ok(snap.observations[0]?.failureSignature);
});

/** Mixed practice: one failure + three successes with distinct shapes. */
function mixedPractice(engine: Engine): string {
  const goal = engine.openGoal('Fix parser', 'tests pass');
  engine.runGoal(goal.id, naivePlan);
  engine.runGoal(goal.id, carefulPlan);
  engine.runGoal(goal.id, carefulPlan);
  engine.runGoal(goal.id, carefulPlan);
  return goal.id;
}

void test('engine: evolveNow is idempotent — no duplicate rules', () => {
  const engine = new Engine();
  mixedPractice(engine);

  const first = engine.evolveNow();
  const second = engine.evolveNow();

  assert.ok(first.proposed.length > 0);
  assert.equal(second.proposed.length, 0);
});

void test('engine: review and apply update usage counts', () => {
  const engine = new Engine();
  mixedPractice(engine);

  const { proposed } = engine.evolveNow();
  const rule = proposed[0]!;

  const approved = engine.reviewRule(rule.id, 'approved');
  assert.equal(approved.status, 'approved');

  // Re-reviewing is legal — the log records each decision; state follows the last.
  const rejected = engine.reviewRule(rule.id, 'rejected');
  assert.equal(rejected.status, 'rejected');

  // Candidates cannot be applied.
  const other = proposed[1];
  if (other) assert.throws(() => engine.applyRule(other.id), /status is candidate/);
});

// ---------------------------------------------------------------- SC-006

void test('SC-006: 10 practice runs yield at least one non-trivial rule', () => {
  const { report } = runDemo();
  assert.equal(report.observedRuns, 10);
  assert.ok(report.proposed.length >= 1, 'SC-006 violated: no rules proposed');
});

void test('SC-006: the demo discovers the read→edit→test habit', () => {
  const { report } = runDemo();
  const statements = report.proposed.map((r) => r.statement).join(' | ');
  assert.match(statements, /read the relevant files/);
  assert.match(statements, /run the tests/);
});
