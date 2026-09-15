// SPDX-License-Identifier: MIT
/**
 * Goal lifecycle.
 *
 * A goal is a unit of intent with explicit acceptance criteria — the same
 * shape as a Smart98 goal/task. The lifecycle is intentionally small:
 *
 *   open ──▶ running ──▶ achieved
 *              │  ▲
 *              ▼  │
 *           blocked ──▶ abandoned
 *
 * Every transition is appended to the store, so the goal's history is a
 * replayable log rather than mutable state.
 */

import { Store } from './store.ts';
import type { Goal, GoalStatus } from './types.ts';

/** Legal transitions. Anything not listed here throws. */
const TRANSITIONS: Record<GoalStatus, readonly GoalStatus[]> = {
  open: ['running', 'abandoned'],
  running: ['achieved', 'blocked', 'abandoned'],
  blocked: ['running', 'abandoned'],
  achieved: [],
  abandoned: [],
};

export const TERMINAL_STATUSES: readonly GoalStatus[] = ['achieved', 'abandoned'] as const;

export function isTerminal(status: GoalStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Deterministic, human-readable id: GOAL-1, GOAL-2, … */
function nextGoalId(store: Store): string {
  return `GOAL-${store.ofType('goal.created').length + 1}`;
}

export class GoalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoalError';
  }
}

/**
 * Create a goal. Acceptance criteria are required — an agent cannot be
 * verified against a goal that never said what "done" means.
 */
export function createGoal(
  store: Store,
  input: { title: string; acceptance: string },
): Goal {
  const title = input.title.trim();
  const acceptance = input.acceptance.trim();
  if (!title) throw new GoalError('Goal title must not be empty');
  if (!acceptance) throw new GoalError('Goal acceptance criteria must not be empty');

  const now = new Date().toISOString();
  const goal: Goal = {
    id: nextGoalId(store),
    title,
    acceptance,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    runIds: [],
  };
  store.append('goal.created', goal, now);
  return goal;
}

/** Move a goal to a new status, enforcing the transition table. */
export function transition(store: Store, goalId: string, to: GoalStatus): Goal {
  const goal = store.snapshot().goals.find((g) => g.id === goalId);
  if (!goal) throw new GoalError(`Unknown goal: ${goalId}`);
  if (goal.status === to) return goal;
  if (!TRANSITIONS[goal.status].includes(to)) {
    throw new GoalError(`Illegal transition ${goal.status} → ${to} for ${goalId}`);
  }
  const updatedAt = new Date().toISOString();
  store.append('goal.status', { id: goalId, status: to, updatedAt }, updatedAt);
  return { ...goal, status: to, updatedAt };
}

/** Convenience: open → running. */
export function startGoal(store: Store, goalId: string): Goal {
  return transition(store, goalId, 'running');
}

/** Convenience: running → achieved. */
export function achieveGoal(store: Store, goalId: string): Goal {
  return transition(store, goalId, 'achieved');
}

/** Convenience: running → blocked. */
export function blockGoal(store: Store, goalId: string): Goal {
  return transition(store, goalId, 'blocked');
}

/**
 * Goal progress as a 0..1 ratio of achieved runs to total runs.
 * A goal with no runs yet reports 0.
 */
export function progress(store: Store, goalId: string): number {
  const runs = store.snapshot().runs.filter((r) => r.goalId === goalId);
  if (runs.length === 0) return 0;
  const achieved = runs.filter((r) => r.outcome === 'achieved').length;
  return achieved / runs.length;
}
