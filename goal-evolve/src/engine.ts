// SPDX-License-Identifier: MIT
/**
 * Engine — wires goal execution to rule evolution.
 *
 * This is the seam the whole demo hangs on: running a goal produces an
 * observation, observations accumulate into practice, and practice is mined
 * into rules. Nothing is hardcoded; the rules at the end are a function of
 * the runs at the beginning.
 *
 *   runGoal()  ──▶ Observation ──▶ Store
 *                                   │
 *   evolveNow() ◀── observations ───┘ ──▶ Rule[]
 */

import { achieveGoal, blockGoal, createGoal, startGoal } from './goal.ts';
import { blankLayers, evolve, staleRules, type EvolveOptions } from './evolve.ts';
import { Store } from './store.ts';
import type {
  Action,
  EvolutionReport,
  Goal,
  Observation,
  Rule,
  Run,
} from './types.ts';

/**
 * A plan is a function that, given the goal, produces the actions an agent
 * would take. Plans are the "agent" side of the demo — swap them out to
 * simulate different behaviours without touching the engine.
 */
export type Plan = (goal: Goal) => { actions: Action[]; outcome: Run['outcome']; note?: string };

export class Engine {
  readonly store: Store;

  constructor(store: Store = new Store()) {
    this.store = store;
  }

  /** Open a new goal and return it. */
  openGoal(title: string, acceptance: string): Goal {
    return createGoal(this.store, { title, acceptance });
  }

  /**
   * Execute one run of a goal using the supplied plan, recording an
   * observation. Returns the completed Run.
   *
   * The goal's status is updated from the run outcome: a run that achieves
   * its goal closes it; a run that fails leaves it running so another
   * attempt can be made (or the caller can block it).
   */
  runGoal(goalId: string, plan: Plan): Run {
    const goal = this.store.snapshot().goals.find((g) => g.id === goalId);
    if (!goal) throw new Error(`Unknown goal: ${goalId}`);

    if (goal.status === 'open') startGoal(this.store, goalId);
    else if (goal.status === 'blocked') startGoal(this.store, goalId);

    const startedAt = new Date();
    const { actions, outcome, note } = plan(goal);
    const finishedAt = new Date();

    const run: Run = {
      id: `RUN-${this.store.ofType('run.completed').length + 1}`,
      goalId,
      actions,
      outcome,
      note,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };

    const observation: Observation = {
      goalId,
      runId: run.id,
      outcome,
      sequence: actions.map((a) => a.kind),
      failureSignature: outcome === 'failed' ? signatureOf(run) : undefined,
    };

    this.store.append('run.completed', { run, observation }, finishedAt.toISOString());

    if (outcome === 'achieved') achieveGoal(this.store, goalId);

    return run;
  }

  /**
   * Run one evolution pass and persist the newly proposed rules.
   *
   * Rules already in the store (by id) are skipped — evolution is idempotent,
   * so running it twice does not duplicate suggestions.
   */
  evolveNow(options: EvolveOptions = {}): EvolutionReport {
    const snap = this.store.snapshot();
    const existing = new Set(snap.rules.map((r) => r.id));
    const mined = evolve(snap.observations, options);

    const proposed: Rule[] = [];
    for (const rule of mined) {
      if (existing.has(rule.id)) continue;
      this.store.append('rule.proposed', rule, rule.createdAt);
      proposed.push(rule);
    }

    const allRules = [...snap.rules, ...proposed];

    return {
      observedRuns: snap.observations.length,
      proposed,
      blankLayers: blankLayers(allRules),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Approve or reject a candidate rule. */
  reviewRule(ruleId: string, status: 'approved' | 'rejected'): Rule {
    const rule = this.store.snapshot().rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
    this.store.append('rule.reviewed', { id: ruleId, status }, new Date().toISOString());
    return { ...rule, status };
  }

  /**
   * Record that an approved rule was applied during a run.
   * Usage drives the pruning view — a rule nobody applies is dead weight.
   */
  applyRule(ruleId: string): Rule {
    const rule = this.store.snapshot().rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
    if (rule.status !== 'approved') {
      throw new Error(`Cannot apply rule ${ruleId}: status is ${rule.status}`);
    }
    const usageCount = rule.usageCount + 1;
    this.store.append('rule.applied', { id: ruleId, usageCount }, new Date().toISOString());
    return { ...rule, usageCount };
  }

  /** Mark a goal as blocked on human input. */
  block(goalId: string, _reason: string): Goal {
    return blockGoal(this.store, goalId);
  }

  /** Rules whose usage has fallen behind their evidence. */
  staleRules(): Rule[] {
    return staleRules(this.store.snapshot().rules);
  }
}

/**
 * Derive a coarse failure signature from a failed run.
 *
 * The signature is intentionally low-cardinality so that independent failures
 * cluster together — that is what makes a recovery rule general enough to be
 * worth learning.
 */
function signatureOf(run: Run): string {
  const last = run.actions.at(-1);
  if (!last) return 'the run produced no actions';

  if (last.kind === 'run' && last.meta?.exitCode !== undefined && last.meta.exitCode !== 0) {
    return `the command \`${last.target}\` exits non-zero`;
  }
  if (last.kind === 'test') return 'the test suite fails';
  if (last.kind === 'edit' || last.kind === 'write') return 'the change does not apply cleanly';
  if (run.note) return run.note;
  return `the run ends on \`${last.kind}\``;
}
