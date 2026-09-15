// SPDX-License-Identifier: MIT
/**
 * Smart98 Demo — Goal + Self-Evolving domain model
 *
 * Maps to docs/spec.md:
 *   FR-009  Rule engine captures agent actions and generates candidate rules
 *   SC-006  Self-Evolving generates >= 1 non-trivial rule from 10 practice runs
 *   US-006  Platform can generate rules from agent practice (Self-Evolving)
 */

/** A discrete, observable thing an agent did while pursuing a goal. */
export type ActionKind =
  | 'read'
  | 'search'
  | 'write'
  | 'edit'
  | 'run'
  | 'test'
  | 'ask'
  | 'finish';

export interface Action {
  kind: ActionKind;
  /** Stable identifier of the target, e.g. a file path or command name. */
  target: string;
  /** Optional structured detail, e.g. { exitCode: 1 }. */
  meta?: Record<string, unknown>;
}

/** A single attempt at a goal. One goal may have many runs. */
export interface Run {
  id: string;
  goalId: string;
  /** Ordered actions the agent took. */
  actions: Action[];
  outcome: 'achieved' | 'failed';
  /** Human-readable reason, surfaced in the dashboard. */
  note?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/** Lifecycle of a goal. Terminal states are `achieved` and `abandoned`. */
export type GoalStatus =
  | 'open'
  | 'running'
  | 'achieved'
  | 'blocked'
  | 'abandoned';

export interface Goal {
  id: string;
  title: string;
  /** Acceptance criteria — what "done" means. Mirrors Smart98 task verify. */
  acceptance: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  /** Ids of runs, newest last. */
  runIds: string[];
}

/**
 * A rule the platform learned from its own practice.
 *
 * Rules are *candidates* until a human approves them — this mirrors the
 * Smart98 Self-Evolving panel, where suggested rules require review.
 */
export interface Rule {
  id: string;
  /** Short imperative statement, e.g. "Run tests before finishing". */
  statement: string;
  /** Why the engine proposed this rule — evidence, not vibes. */
  rationale: string;
  /** Which layer the rule belongs to (Smart98 rule layers). */
  layer: RuleLayer;
  /** 0..1 — how strongly the evidence supports the rule. */
  confidence: number;
  /** How many observed runs contributed evidence. */
  support: number;
  /** Runs that triggered this rule's discovery. */
  evidenceRunIds: string[];
  status: 'candidate' | 'approved' | 'rejected';
  /** Times the rule was applied after approval. Drives pruning decisions. */
  usageCount: number;
  createdAt: string;
}

/**
 * Rule layers mirror the Smart98 Self-Evolving model: rules are grouped by
 * the stage of work they influence, so blank layers are visible at a glance.
 */
export type RuleLayer =
  | 'planning'
  | 'execution'
  | 'verification'
  | 'recovery';

export const RULE_LAYERS: readonly RuleLayer[] = [
  'planning',
  'execution',
  'verification',
  'recovery',
] as const;

/** A raw practice observation, before it is mined into rules. */
export interface Observation {
  goalId: string;
  runId: string;
  outcome: 'achieved' | 'failed';
  /** Action-kind sequence, e.g. ['read','edit','test','finish']. */
  sequence: ActionKind[];
  /** Set when the run failed, for failure clustering. */
  failureSignature?: string;
}

/** Result of one evolution pass. */
export interface EvolutionReport {
  observedRuns: number;
  proposed: Rule[];
  /** Layers that received no rule this pass — Smart98 flags these as blank. */
  blankLayers: RuleLayer[];
  generatedAt: string;
}
