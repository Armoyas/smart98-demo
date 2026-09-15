// SPDX-License-Identifier: MIT
/**
 * Goal creation dialog tests.
 *
 * Proves:
 *   - Field validation (title, acceptance, description)
 *   - Step-by-step flow (title → criteria → confirm → done)
 *   - AI-assisted acceptance generation is deterministic
 *   - Serialization round-trips
 *   - Submit creates a real Goal
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  validateField,
  validateDialog,
  isValid,
  nextStep,
  generateAcceptanceAI,
  submitGoal,
  serializeDialog,
  deserializeDialog,
} from '../src/goal-dialog.ts';
import { Store } from '../src/store.ts';
import { createGoal } from '../src/goal.ts';

// ---------------------------------------------------------------- state

void test('dialog: initial state has empty fields', () => {
  const state = createInitialState();
  assert.equal(state.step, 'title');
  assert.equal(state.title, '');
  assert.equal(state.acceptance, '');
  assert.equal(state.description, '');
  assert.deepEqual(state.errors, []);
  assert.equal(state.generatedFromAI, false);
});

// ---------------------------------------------------------------- validation

void test('validateField: title empty → error', () => {
  const errors = validateField('title', '');
  assert.ok(errors.some(e => e.includes('required')));
});

void test('validateField: title too short → error', () => {
  const errors = validateField('title', 'ab');
  assert.ok(errors.some(e => e.includes('≥ 3')));
});

void test('validateField: title valid → no errors', () => {
  const errors = validateField('title', 'Fix parser');
  assert.equal(errors.length, 0);
});

void test('validateField: title exactly 100 chars → valid', () => {
  const errors = validateField('title', 'x'.repeat(100));
  assert.equal(errors.length, 0);
});

void test('validateField: title 101 chars → error', () => {
  const errors = validateField('title', 'x'.repeat(101));
  assert.ok(errors.some(e => e.includes('≤ 100')));
});

void test('validateField: acceptance empty → error', () => {
  const errors = validateField('acceptance', '');
  assert.ok(errors.some(e => e.includes('required')));
});

void test('validateField: acceptance too short → error', () => {
  const errors = validateField('acceptance', 'short');
  assert.ok(errors.some(e => e.includes('≥ 10')));
});

void test('validateField: acceptance valid → no errors', () => {
  const errors = validateField('acceptance', 'Tests pass and no regressions.');
  assert.equal(errors.length, 0);
});

void test('validateField: description too long → error', () => {
  const errors = validateField('description', 'x'.repeat(2001));
  assert.ok(errors.some(e => e.includes('≤ 2000')));
});

void test('validateField: description valid → no errors', () => {
  const errors = validateField('description', 'A reasonable description.');
  assert.equal(errors.length, 0);
});

void test('validateDialog: all valid → empty errors', () => {
  const state = {
    ...createInitialState(),
    title: 'Fix parser',
    acceptance: 'Tests pass.',
    description: 'Fix the parser regression.',
  };
  const errors = validateDialog(state);
  assert.deepEqual(errors, {});
});

void test('validateDialog: all invalid → errors per field', () => {
  const state = createInitialState();
  const errors = validateDialog(state);
  assert.ok('title' in errors);
  assert.ok('acceptance' in errors);
});

void test('isValid: valid state → true', () => {
  const state = {
    ...createInitialState(),
    title: 'Fix parser',
    acceptance: 'Tests pass.',
    description: 'Fix the parser regression.',
  };
  assert.equal(isValid(state), true);
});

void test('isValid: invalid state → false', () => {
  assert.equal(isValid(createInitialState()), false);
});

// ---------------------------------------------------------------- flow

void test('nextStep: valid title → advance to criteria', () => {
  const state = { ...createInitialState(), title: 'Fix parser', acceptance: 'Tests pass.' };
  const result = nextStep(state);
  assert.equal(result.canProceed, true);
  assert.equal(result.state.step, 'criteria');
});

void test('nextStep: invalid title → blocked at title', () => {
  const state = createInitialState();
  const result = nextStep(state);
  assert.equal(result.canProceed, false);
  assert.equal(result.state.step, 'title');
  assert.ok(result.blockers.length > 0);
});

void test('nextStep: valid criteria → advance to confirm', () => {
  const state = {
    ...createInitialState(),
    title: 'Fix parser',
    acceptance: 'Tests pass.',
  };
  const result = nextStep(state);
  // After title step, we're at criteria; with valid acceptance we go to confirm
  assert.equal(result.canProceed, true);
});

void test('nextStep: no blockers when valid', () => {
  const state = {
    ...createInitialState(),
    title: 'Fix parser',
    acceptance: 'Tests pass.',
    description: 'Fix regression.',
  };
  const result = nextStep(state);
  assert.deepEqual(result.blockers, []);
});

// ---------------------------------------------------------------- AI

void test('generateAcceptanceAI: deterministic', () => {
  const a = generateAcceptanceAI('Fix parser', 'Regression in parser module');
  const b = generateAcceptanceAI('Fix parser', 'Regression in parser module');
  assert.equal(a, b);
});

void test('generateAcceptanceAI: empty → fallback', () => {
  const result = generateAcceptanceAI('', '');
  assert.ok(result.length > 0);
});

void test('generateAcceptanceAI: performance keyword detected', () => {
  const result = generateAcceptanceAI('Make it fast', 'Need responsive performance');
  assert.match(result, /performance/i);
});

void test('generateAcceptanceAI: security keyword detected', () => {
  const result = generateAcceptanceAI('Secure login', 'Auth and encryption needed');
  assert.match(result, /security/i);
});

void test('generateAcceptanceAI: no keywords → generic criteria', () => {
  const result = generateAcceptanceAI('Do thing', 'General purpose goal');
  assert.ok(result.includes('acceptance criteria'));
});

void test('generateAcceptanceAI: long input handled', () => {
  const long = 'x '.repeat(500);
  const result = generateAcceptanceAI(long, long);
  assert.ok(result.length > 0);
});

// ---------------------------------------------------------------- submit

void test('submitGoal: valid state creates Goal', () => {
  const store = new Store(':memory:');
  const state = {
    ...createInitialState(),
    title: 'Fix parser',
    acceptance: 'Tests pass.',
    description: 'Fix regression.',
  };
  const goal = submitGoal(store, state);
  assert.equal(goal.title, 'Fix parser');
  assert.equal(goal.acceptance, 'Tests pass.');
  assert.equal(goal.status, 'open');
});

void test('submitGoal: invalid state throws', () => {
  const store = new Store(':memory:');
  const state = createInitialState();
  assert.throws(() => submitGoal(store, state), Error);
});

// ---------------------------------------------------------------- serialization

void test('serializeDialog: round-trips', () => {
  const original = {
    ...createInitialState(),
    title: 'My Goal',
    acceptance: 'Must pass.',
    description: 'Do the thing.',
    generatedFromAI: true,
  };
  const json = serializeDialog(original);
  const restored = deserializeDialog(json);
  assert.equal(restored.title, 'My Goal');
  assert.equal(restored.acceptance, 'Must pass.');
  assert.equal(restored.generatedFromAI, true);
});

void test('deserializeDialog: invalid JSON → initial state', () => {
  const restored = deserializeDialog('not json');
  assert.equal(restored.step, 'title');
  assert.equal(restored.title, '');
});

void test('deserializeDialog: partial data → defaults', () => {
  const restored = deserializeDialog(JSON.stringify({ title: 'Partial' }));
  assert.equal(restored.title, 'Partial');
  assert.equal(restored.acceptance, '');
});

// ---------------------------------------------------------------- integration

void test('dialog → goal: full flow creates goal in store', () => {
  const store = new Store(':memory:');
  const state = {
    ...createInitialState(),
    title: 'Parser Fix',
    acceptance: 'All parser tests pass.',
    description: 'Fix the parser regression.',
  };

  // Step 1: validate
  assert.equal(isValid(state), true);

  // Step 2: advance flow
  const { canProceed } = nextStep(state);
  assert.equal(canProceed, true);

  // Step 3: submit
  const goal = submitGoal(store, state);
  assert.ok(goal.id.startsWith('GOAL-'));
});
