// SPDX-License-Identifier: MIT
/**
 * Append-only event store.
 *
 * Every goal transition and every completed run is appended as one JSON line.
 * This is deliberately boring: an audit trail you can `tail -f`, diff, and
 * replay — the same property Smart98 relies on for agent observability.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Goal, Observation, Rule, Run } from './types.ts';

export type EventType =
  | 'goal.created'
  | 'goal.status'
  | 'run.completed'
  | 'rule.proposed'
  | 'rule.reviewed'
  | 'rule.applied';

export interface StoreEvent {
  seq: number;
  at: string;
  type: EventType;
  payload: unknown;
}

export interface Snapshot {
  goals: Goal[];
  runs: Run[];
  rules: Rule[];
  observations: Observation[];
  events: StoreEvent[];
}

/**
 * File-backed store. Pass `:memory:` to keep everything in RAM (used by tests).
 */
export class Store {
  private readonly path: string;
  private events: StoreEvent[] = [];
  private seq = 0;

  constructor(path = ':memory:') {
    this.path = path;
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
      if (existsSync(path)) this.load();
    }
  }

  private load(): void {
    const raw = readFileSync(this.path, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        this.events.push(JSON.parse(line) as StoreEvent);
      } catch {
        // Tolerate a torn final line — never crash on a partial write.
      }
    }
    this.seq = this.events.reduce((max, e) => Math.max(max, e.seq), 0);
  }

  /** Append one event and return it. */
  append(type: EventType, payload: unknown, at = new Date().toISOString()): StoreEvent {
    const event: StoreEvent = { seq: ++this.seq, at, type, payload };
    this.events.push(event);
    if (this.path !== ':memory:') appendFileSync(this.path, JSON.stringify(event) + '\n');
    return event;
  }

  /** All events, oldest first. */
  all(): readonly StoreEvent[] {
    return this.events;
  }

  /** Events of one type. */
  ofType(type: EventType): StoreEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Reduce the event log into current state.
   *
   * Because state is derived, the log is the source of truth: you can delete
   * `state.json` and it will be rebuilt exactly.
   */
  snapshot(): Snapshot {
    const goals = new Map<string, Goal>();
    const runs: Run[] = [];
    const rules = new Map<string, Rule>();
    const observations: Observation[] = [];

    for (const e of this.events) {
      switch (e.type) {
        case 'goal.created': {
          const goal = structuredClone(e.payload as Goal);
          goals.set(goal.id, goal);
          break;
        }
        case 'goal.status': {
          const { id, status, updatedAt } = e.payload as {
            id: string;
            status: Goal['status'];
            updatedAt: string;
          };
          const goal = goals.get(id);
          if (goal) {
            goal.status = status;
            goal.updatedAt = updatedAt;
          }
          break;
        }
        case 'run.completed': {
          const { run, observation } = e.payload as {
            run: Run;
            observation: Observation;
          };
          runs.push(structuredClone(run));
          observations.push(structuredClone(observation));
          const goal = goals.get(run.goalId);
          if (goal) goal.runIds.push(run.id);
          break;
        }
        case 'rule.proposed': {
          const rule = structuredClone(e.payload as Rule);
          rules.set(rule.id, rule);
          break;
        }
        case 'rule.reviewed': {
          const { id, status } = e.payload as { id: string; status: Rule['status'] };
          const rule = rules.get(id);
          if (rule) rule.status = status;
          break;
        }
        case 'rule.applied': {
          const { id, usageCount } = e.payload as { id: string; usageCount: number };
          const rule = rules.get(id);
          if (rule) rule.usageCount = usageCount;
          break;
        }
      }
    }

    return {
      goals: [...goals.values()],
      runs,
      rules: [...rules.values()],
      observations,
      events: this.events,
    };
  }

  /** Write a derived snapshot for the dashboard to consume. */
  writeSnapshot(path: string): Snapshot {
    const snap = this.snapshot();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snap, null, 2));
    return snap;
  }
}
