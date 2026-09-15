// SPDX-License-Identifier: MIT
/**
 * Self-Evolving rule engine.
 *
 * The engine reads *practice* — the ordered sequences of actions an agent took
 * while pursuing goals — and mines it for rules worth remembering.
 *
 * Two independent miners run each pass:
 *
 *   1. Success n-gram miner  — finds action subsequences that correlate with
 *                              achieved runs, and proposes them as habits.
 *   2. Failure cluster miner — groups failed runs by failure signature and
 *                              proposes a recovery rule per cluster.
 *
 * Design constraints, deliberately chosen for a demo an audience can follow:
 *
 *   - Deterministic. Same observations in, same rules out. No sampling,
 *     no randomness, no model call. You can assert on the output.
 *   - Evidence-backed. Every rule carries the run ids that produced it, so a
 *     reviewer can audit the claim instead of trusting it.
 *   - Conservative. A rule needs `minSupport` distinct runs before it is even
 *     proposed. One lucky run is not a habit.
 *   - Non-trivial. Rules that merely restate the goal are rejected; a rule
 *     must describe a *procedure* the agent would not otherwise perform.
 *
 * Maps to docs/spec.md FR-009 and SC-006.
 */

import type { ActionKind, Observation, Rule, RuleLayer } from './types.ts';
import { RULE_LAYERS } from './types.ts';

/** Tunables. Exposed so tests and the CLI can dial sensitivity. */
export interface EvolveOptions {
  /** Minimum distinct runs supporting a candidate rule. Default 3. */
  minSupport?: number;
  /** Minimum n-gram length. Default 2. */
  minGram?: number;
  /** Maximum n-gram length. Default 4. */
  maxGram?: number;
  /** Minimum share of supporting runs that must have succeeded. Default 0.8. */
  minSuccessRate?: number;
}

interface ResolvedOptions {
  minSupport: number;
  minGram: number;
  maxGram: number;
  minSuccessRate: number;
}

function resolve(options: EvolveOptions): ResolvedOptions {
  return {
    minSupport: options.minSupport ?? 3,
    minGram: options.minGram ?? 2,
    maxGram: options.maxGram ?? 4,
    minSuccessRate: options.minSuccessRate ?? 0.8,
  };
}

/**
 * Human-readable phrasing for an action-kind pair, so rules read like advice
 * rather than telemetry.
 */
const PHRASE: Record<ActionKind, string> = {
  read: 'read the relevant files',
  search: 'search before assuming',
  write: 'write the change',
  edit: 'edit in place',
  run: 'run the command',
  test: 'run the tests',
  ask: 'ask for clarification',
  finish: 'finish and report',
};

/** Which layer a habit belongs to, inferred from its first action. */
function layerFor(sequence: ActionKind[]): RuleLayer {
  const first = sequence[0];
  if (first === 'read' || first === 'search' || first === 'ask') return 'planning';
  if (first === 'write' || first === 'edit' || first === 'run') return 'execution';
  if (sequence.includes('test')) return 'verification';
  return 'execution';
}

/** Render a rule statement from an action sequence. */
function statementFor(sequence: ActionKind[]): string {
  const clauses = sequence.map((k) => PHRASE[k]);
  if (clauses.length === 1) return capitalize(clauses[0]);
  return capitalize(clauses.slice(0, -1).join(', ') + ', then ' + clauses.at(-1));
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Stable id derived from the rule's content — re-running never duplicates. */
function ruleId(prefix: string, key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

/** Every contiguous subsequence of `seq` with length in [min, max]. */
function ngrams(seq: ActionKind[], min: number, max: number): ActionKind[][] {
  const out: ActionKind[][] = [];
  for (let n = min; n <= max; n++) {
    for (let i = 0; i + n <= seq.length; i++) out.push(seq.slice(i, i + n));
  }
  return out;
}

/**
 * A candidate must describe a procedure, not a single step and not the whole
 * run. This is the "non-trivial" gate behind SC-006.
 */
function isNonTrivial(sequence: ActionKind[], all: Observation[]): boolean {
  if (sequence.length < 2) return false;
  // Reject sequences that appear in *every* run — they carry no signal.
  const everyRunHasIt = all.every((o) => containsSubsequence(o.sequence, sequence));
  return !everyRunHasIt;
}

function containsSubsequence(haystack: ActionKind[], needle: ActionKind[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Mine habits from successful runs.
 *
 * For each n-gram we count how many runs contained it and what share of those
 * runs succeeded. A habit is an n-gram that clears both `minSupport` and
 * `minSuccessRate`.
 */
function mineHabits(observations: Observation[], opts: ResolvedOptions): Rule[] {
  if (observations.length === 0) return [];

  /** key → { runs, achieved } */
  const stats = new Map<string, { sequence: ActionKind[]; runs: Set<string>; achieved: Set<string> }>();

  for (const obs of observations) {
    for (const gram of ngrams(obs.sequence, opts.minGram, opts.maxGram)) {
      const key = gram.join('>');
      let entry = stats.get(key);
      if (!entry) {
        entry = { sequence: gram, runs: new Set(), achieved: new Set() };
        stats.set(key, entry);
      }
      entry.runs.add(obs.runId);
      if (obs.outcome === 'achieved') entry.achieved.add(obs.runId);
    }
  }

  const candidates: Rule[] = [];

  for (const entry of stats.values()) {
    const support = entry.runs.size;
    if (support < opts.minSupport) continue;

    const successRate = entry.achieved.size / support;
    if (successRate < opts.minSuccessRate) continue;
    if (!isNonTrivial(entry.sequence, observations)) continue;

    const statement = statementFor(entry.sequence);
    const layer = layerFor(entry.sequence);

    candidates.push({
      id: ruleId('RULE', entry.sequence.join('>')),
      statement,
      rationale:
        `Observed in ${support} run(s), ${entry.achieved.size} of which achieved the goal ` +
        `(${Math.round(successRate * 100)}% success rate).`,
      layer,
      confidence: Number(successRate.toFixed(2)),
      support,
      evidenceRunIds: [...entry.runs].sort(),
      status: 'candidate',
      usageCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return candidates;
}

/**
 * Mine recovery rules from failures.
 *
 * Runs that fail the same way get one rule each: "when you see X, try Y".
 * The suggested remedy is derived from what *successful* runs did instead.
 */
function mineRecoveries(observations: Observation[], opts: ResolvedOptions): Rule[] {
  const failures = observations.filter((o) => o.outcome === 'failed' && o.failureSignature);
  if (failures.length < opts.minSupport) return [];

  const clusters = new Map<string, Observation[]>();
  for (const f of failures) {
    const key = f.failureSignature!;
    const bucket = clusters.get(key) ?? [];
    bucket.push(f);
    clusters.set(key, bucket);
  }

  const successes = observations.filter((o) => o.outcome === 'achieved');
  const rules: Rule[] = [];

  for (const [signature, members] of clusters) {
    if (members.length < opts.minSupport) continue;

    // What did successful runs do that failing runs did not?
    const remedy = inferRemedy(members, successes);

    rules.push({
      id: ruleId('REC', signature),
      statement: `When ${signature}, ${remedy}`,
      rationale:
        `${members.length} run(s) failed with this signature. ` +
        (remedy.startsWith('run the tests')
          ? 'Successful runs verified with tests before finishing.'
          : 'Derived from the difference against successful runs.'),
      layer: 'recovery',
      confidence: Number(Math.min(1, members.length / observations.length + 0.4).toFixed(2)),
      support: members.length,
      evidenceRunIds: members.map((m) => m.runId).sort(),
      status: 'candidate',
      usageCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return rules;
}

/**
 * Pick a remedy by diffing failing runs against successful ones.
 * Prefers a concrete action the successes performed and the failures omitted.
 */
function inferRemedy(failures: Observation[], successes: Observation[]): string {
  const kinds: ActionKind[] = ['test', 'read', 'search', 'ask'];

  for (const kind of kinds) {
    const inSuccess = successes.filter((s) => s.sequence.includes(kind)).length;
    const inFailure = failures.filter((f) => f.sequence.includes(kind)).length;
    const successShare = successes.length ? inSuccess / successes.length : 0;
    const failureShare = failures.length ? inFailure / failures.length : 0;

    if (successShare - failureShare >= 0.3) return `${PHRASE[kind]} before finishing`;
  }

  return 're-read the goal acceptance criteria before retrying';
}

/**
 * Run one evolution pass over the observed practice.
 *
 * Returns the union of habit and recovery candidates, deduplicated by id and
 * sorted by confidence so the strongest suggestions surface first.
 */
export function evolve(observations: Observation[], options: EvolveOptions = {}): Rule[] {
  const opts = resolve(options);
  const merged = new Map<string, Rule>();

  for (const rule of [...mineHabits(observations, opts), ...mineRecoveries(observations, opts)]) {
    const existing = merged.get(rule.id);
    // Keep the higher-confidence variant if the same rule is mined twice.
    if (!existing || rule.confidence > existing.confidence) merged.set(rule.id, rule);
  }

  return [...merged.values()].sort(
    (a, b) => b.confidence - a.confidence || b.support - a.support || a.id.localeCompare(b.id),
  );
}

/** Layers that received no rule in this pass — Smart98 surfaces these as gaps. */
export function blankLayers(rules: Rule[]): RuleLayer[] {
  const covered = new Set(rules.map((r) => r.layer));
  return RULE_LAYERS.filter((layer) => !covered.has(layer));
}

/**
 * Flag rules whose usage has fallen behind their evidence — pruning candidates.
 * A rule is stale if it has been approved but applied fewer times than the
 * number of runs that justified it.
 */
export function staleRules(rules: Rule[]): Rule[] {
  return rules.filter((r) => r.status === 'approved' && r.usageCount < r.support);
}
