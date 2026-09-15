// SPDX-License-Identifier: MIT
/**
 * Domain entity tests.
 *
 * Proves:
 *   - Creation with validation
 *   - State machine transitions (draft → active → archived)
 *   - Goal attachment/detachment
 *   - AI-assisted generation is deterministic
 *   - Activation validation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDomain,
  transitionDomain,
  activateDomain,
  archiveDomain,
  attachGoal,
  detachGoal,
  generateFromDescription,
  validateActivation,
  DomainError,
} from '../src/domain.ts';
import type { Domain } from '../src/domain.ts';
import type { Goal } from '../src/goal.ts';

// ---------------------------------------------------------------- creation

void test('domain: create with valid input', () => {
  const domain = createDomain([], {
    name: 'Parser Fix',
    description: 'Fix the parser regression issue',
  });

  assert.equal(domain.name, 'Parser Fix');
  assert.equal(domain.description, 'Fix the parser regression issue');
  assert.equal(domain.status, 'draft');
  assert.equal(domain.goalIds.length, 0);
  assert.ok(domain.id.startsWith('DOM'));
  assert.ok(domain.createdAt);
  assert.ok(domain.updatedAt);
});

void test('domain: reject empty name', () => {
  assert.throws(() => createDomain([], { name: '', description: 'test' }), DomainError);
});

void test('domain: reject empty description', () => {
  assert.throws(() => createDomain([], { name: 'Test', description: ' ' }), DomainError);
});

void test('domain: reject name > 120 chars', () => {
  assert.throws(
    () => createDomain([], { name: 'x'.repeat(121), description: 'test' }),
    DomainError,
  );
});

void test('domain: reject description > 2000 chars', () => {
  assert.throws(
    () => createDomain([], { name: 'Test', description: 'x'.repeat(2001) }),
    DomainError,
  );
});

void test('domain: name is deterministic for same input length', () => {
  const d1 = createDomain([], { name: 'Alpha', description: 'First domain' });
  const d2 = createDomain([], { name: 'Alpha', description: 'First domain' });
  // Both created in empty context → same ID
  assert.equal(d1.id, d2.id);
});

// ---------------------------------------------------------------- transitions

void test('domain: draft → active is valid', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const active = activateDomain(domain);
  assert.equal(active.status, 'active');
});

void test('domain: draft → archived is valid', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const archived = archiveDomain(domain);
  assert.equal(archived.status, 'archived');
});

void test('domain: active → archived is valid', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const active = activateDomain(domain);
  const archived = archiveDomain(active);
  assert.equal(archived.status, 'archived');
});

void test('domain: archived → anything is blocked', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const archived = archiveDomain(domain);
  assert.throws(() => transitionDomain(archived, 'active'), DomainError);
  assert.throws(() => transitionDomain(archived, 'draft'), DomainError);
});

void test('domain: active → draft is blocked', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const active = activateDomain(domain);
  assert.throws(() => transitionDomain(active, 'draft'), DomainError);
});

void test('domain: draft → draft is no-op', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const result = transitionDomain(domain, 'draft');
  assert.equal(result.status, 'draft');
});

// ---------------------------------------------------------------- goals

void test('domain: attachGoal adds goal id', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const withGoal = attachGoal(domain, 'GOAL-1');
  assert.deepEqual(withGoal.goalIds, ['GOAL-1']);
});

void test('domain: attachGoal is idempotent', () => {
  const domain = createDomain([], { name: 'Test', description: 'desc' });
  const withGoal = attachGoal(attachGoal(domain, 'GOAL-1'), 'GOAL-1');
  assert.deepEqual(withGoal.goalIds, ['GOAL-1']);
});

void test('domain: detachGoal removes goal id', () => {
  const domain = attachGoal(createDomain([], { name: 'T', description: 'd' }), 'GOAL-1');
  const without = detachGoal(domain, 'GOAL-1');
  assert.deepEqual(without.goalIds, []);
});

void test('domain: detachGoal on missing goal is no-op', () => {
  const domain = createDomain([], { name: 'T', description: 'd' });
  const result = detachGoal(domain, 'GOAL-999');
  assert.deepEqual(result.goalIds, []);
});

// ---------------------------------------------------------------- AI generation

void test('generateFromDescription: extracts name from first sentence', () => {
  const result = generateFromDescription('Fix the parser regression issue in the codebase.');
  assert.ok(result.name.length > 0);
  assert.ok(result.name.length <= 120);
});

void test('generateFromDescription: rejects short input', () => {
  assert.throws(() => generateFromDescription('too short'), DomainError);
});

void test('generateFromDescription: rejects empty input', () => {
  assert.throws(() => generateFromDescription(''), DomainError);
});

void test('generateFromDescription: deterministic — same input same output', () => {
  const input = 'Analyze the performance of the query engine under load.';
  const a = generateFromDescription(input);
  const b = generateFromDescription(input);
  assert.deepEqual(a, b);
});

void test('generateFromDescription: detects performance keywords', () => {
  const result = generateFromDescription('We need fast and responsive performance.');
  assert.match(result.suggestedAcceptance, /performance/);
});

void test('generateFromDescription: detects security keywords', () => {
  const result = generateFromDescription('Make the system secure and private.');
  assert.match(result.suggestedAcceptance, /security/);
});

void test('generateFromDescription: detects accuracy keywords', () => {
  const result = generateFromDescription('The results must be accurate and precise.');
  assert.match(result.suggestedAcceptance, /accuracy/);
});

void test('generateFromDescription: fallback when no keywords match', () => {
  const result = generateFromDescription('Do the thing properly and completely.');
  assert.ok(result.suggestedAcceptance.includes('explicit acceptance criteria'));
});

void test('generateFromDescription: caps name at 120 chars', () => {
  const longInput = 'x '.repeat(100);
  const result = generateFromDescription(longInput);
  assert.ok(result.name.length <= 120);
});

// ---------------------------------------------------------------- validation

void test('validateActivation: valid domain with goals passes', () => {
  const domain = attachGoal(
    createDomain([], { name: 'T', description: 'd' }),
    'GOAL-1',
  );
  const goals = [
    { id: 'GOAL-1', acceptance: 'Tests pass' } as Goal,
  ];
  const result = validateActivation(domain, goals);
  assert.equal(result.valid, true);
  assert.deepEqual(result.blockers, []);
});

void test('validateActivation: rejects domain with no goals', () => {
  const domain = createDomain([], { name: 'T', description: 'd' });
  const result = validateActivation(domain, []);
  assert.equal(result.valid, false);
  assert.ok(result.blockers.some(b => b.includes('at least one goal')));
});

void test('validateActivation: rejects domain with goals lacking criteria', () => {
  const domain = attachGoal(
    createDomain([], { name: 'T', description: 'd' }),
    'GOAL-1',
  );
  const goals = [{ id: 'GOAL-1', acceptance: ' ' } as Goal];
  const result = validateActivation(domain, goals);
  assert.equal(result.valid, false);
  assert.ok(result.blockers.some(b => b.includes('acceptance')));
});

// ---------------------------------------------------------------- integration

void test('domain: full lifecycle with goals', () => {
  const domain = createDomain([], { name: 'Parser', description: 'Fix parser' });
  const withGoal = attachGoal(domain, 'GOAL-1');
  const active = activateDomain(withGoal);
  const archived = archiveDomain(active);

  assert.equal(domain.status, 'draft');
  assert.equal(active.status, 'active');
  assert.equal(archived.status, 'archived');
  assert.deepEqual(archived.goalIds, ['GOAL-1']);
});
