// SPDX-License-Identifier: MIT
/**
 * Domain entity — Smart98 workspace/domain.
 *
 * A domain groups goals, scenarios, and rules into a named workspace.
 * Lifecycle: draft → active → archived
 *
 * Maps to docs/spec.md:
 *   US-004  Workspaces group scenarios
 *   FR-007  Shareable, re-openable across sessions
 */

import type { Goal } from './goal.ts';

export type DomainStatus = 'draft' | 'active' | 'archived';

export interface Domain {
  id: string;
  name: string;
  description: string;
  status: DomainStatus;
  goalIds: string[];
  createdAt: string;
  updatedAt: string;
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

const VALID_TRANSITIONS: Record<DomainStatus, readonly DomainStatus[]> = {
  draft: ['active', 'archived'],
  active: ['archived'],
  archived: [],
};

/** Deterministic ID from the domain name — stable across runs. */
function nextDomainId(existing: string[]): string {
  let hash = 2166136261;
  const base = `DOMAIN-${existing.length + 1}`;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Check for collisions and append counter if needed
  const candidate = `DOM-${(hash >>> 0).toString(36).toUpperCase()}`;
  if (!existing.includes(candidate)) return candidate;
  return `${candidate}-${existing.length + 1}`;
}

/** Create a new domain in draft state. */
export function createDomain(
  existing: Domain[],
  input: { name: string; description: string },
): Domain {
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name) throw new DomainError('Domain name must not be empty');
  if (name.length > 120) throw new DomainError('Domain name must be ≤ 120 characters');
  if (!description) throw new DomainError('Domain description must not be empty');
  if (description.length > 2000) throw new DomainError('Domain description must be ≤ 2000 characters');

  const ids = existing.map(d => d.id);
  const now = new Date().toISOString();
  const domain: Domain = {
    id: nextDomainId(existing),
    name,
    description,
    status: 'draft',
    goalIds: [],
    createdAt: now,
    updatedAt: now,
  };
  return domain;
}

/** Transition a domain to a new status, enforcing the transition table. */
export function transitionDomain(
  domain: Domain,
  to: DomainStatus,
): Domain {
  if (domain.status === to) return domain;
  if (!VALID_TRANSITIONS[domain.status].includes(to)) {
    throw new DomainError(`Illegal transition ${domain.status} → ${to} for ${domain.id}`);
  }
  const updatedAt = new Date().toISOString();
  return { ...domain, status: to, updatedAt };
}

/** Activate a draft domain. */
export function activateDomain(domain: Domain): Domain {
  return transitionDomain(domain, 'active');
}

/** Archive an active or draft domain. */
export function archiveDomain(domain: Domain): Domain {
  return transitionDomain(domain, 'archived');
}

/** Attach a goal to a domain. */
export function attachGoal(domain: Domain, goalId: string): Domain {
  if (domain.goalIds.includes(goalId)) return domain;
  return { ...domain, goalIds: [...domain.goalIds, goalId], updatedAt: new Date().toISOString() };
}

/** Detach a goal from a domain. */
export function detachGoal(domain: Domain, goalId: string): Domain {
  return {
    ...domain,
    goalIds: domain.goalIds.filter(id => id !== goalId),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * AI-assisted domain creation from a natural-language description.
 *
 * Deterministic: same input → same output. No model call.
 * Extracts a domain name and generates structured acceptance criteria
 * from the description keywords.
 */
export function generateFromDescription(rawInput: string): {
  name: string;
  description: string;
  suggestedAcceptance: string;
} {
  const cleaned = rawInput.trim();
  if (!cleaned) throw new DomainError('Input description must not be empty');
  if (cleaned.length < 10) throw new DomainError('Input description must be ≥ 10 characters');

  // Deterministic name extraction: first sentence, first 3-5 words
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const firstSentence = sentences[0]!.trim();
  const words = firstSentence.split(/\s+/).filter(w => w.length > 2);
  const nameWords = words.slice(0, 4);
  const name = nameWords.join(' ').replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Untitled Domain';

  // Deterministic acceptance criteria from keywords
  const lowerInput = cleaned.toLowerCase();
  const keywords = {
    performance: ['fast', 'speed', 'quick', 'responsive', 'latency', 'performance'],
    accuracy: ['accurate', 'correct', 'precise', 'exact', 'quality'],
    completeness: ['complete', 'full', 'comprehensive', 'all', 'every'],
    security: ['secure', 'safe', 'private', 'auth', 'encrypt', 'permission'],
    scalability: ['scale', 'grow', 'large', 'million', 'big'],
  };

  const criteria: string[] = [];
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(w => lowerInput.includes(w))) {
      criteria.push(`Must meet ${category} standards as defined in the domain specification.`);
    }
  }

  if (criteria.length === 0) {
    criteria.push('All goals within this domain must have explicit acceptance criteria.');
    criteria.push('Domain must pass validation before activation.');
  }

  const description = cleaned.length > 2000 ? cleaned.slice(0, 2000) : cleaned;

  return {
    name: name.slice(0, 120),
    description,
    suggestedAcceptance: criteria.join(' '),
  };
}

/** Validate that a domain can transition to active (all preconditions). */
export function validateActivation(domain: Domain, goals: Goal[]): {
  valid: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  const domainGoals = goals.filter(g => domain.goalIds.includes(g.id));

  if (domainGoals.length === 0) {
    blockers.push('Domain must have at least one goal before activation');
  }

  const unverified = domainGoals.filter(g => g.acceptance.trim().length < 5);
  if (unverified.length > 0) {
    blockers.push(`${unverified.length} goal(s) have insufficient acceptance criteria`);
  }

  return { valid: blockers.length === 0, blockers };
}
