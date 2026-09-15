// SPDX-License-Identifier: MIT
/**
 * Goal creation dialog — interactive goal setup with validation.
 *
 * Maps to docs/spec.md:
 *   US-001  Create goals with acceptance criteria
 *   FR-001  Goal builder (all configuration fields)
 *
 * Features demonstrated in screenshots:
 *   - Title + acceptance criteria input
 *   - AI-assisted generation from description
 *   - Real-time validation
 *   - Step-by-step flow (Next button)
 */

import type { Goal } from './goal.ts';
import { createGoal, GoalError } from './goal.ts';
import type { Domain } from './domain.ts';

export interface DialogState {
  step: 'title' | 'criteria' | 'confirm' | 'done';
  title: string;
  acceptance: string;
  description: string;
  domainId?: string;
  errors: string[];
  suggestedAcceptance?: string;
  generatedFromAI: boolean;
}

export function createInitialState(): DialogState {
  return {
    step: 'title',
    title: '',
    acceptance: '',
    description: '',
    errors: [],
    generatedFromAI: false,
  };
}

/** Validate a single field and return error messages. */
export function validateField(
  field: 'title' | 'acceptance' | 'description',
  value: string,
): string[] {
  const trimmed = value.trim();
  const errors: string[] = [];

  switch (field) {
    case 'title': {
      if (!trimmed) errors.push('Title is required');
      else if (trimmed.length < 3) errors.push('Title must be ≥ 3 characters');
      else if (trimmed.length > 100) errors.push('Title must be ≤ 100 characters');
      break;
    }
    case 'acceptance': {
      if (!trimmed) errors.push('Acceptance criteria are required');
      else if (trimmed.length < 10) errors.push('Acceptance criteria must describe what "done" means (≥ 10 chars)');
      break;
    }
    case 'description': {
      if (trimmed.length > 2000) errors.push('Description must be ≤ 2000 characters');
      break;
    }
  }

  return errors;
}

/** Validate the entire form. Returns all errors grouped by field. */
export function validateDialog(state: DialogState): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  const titleErrors = validateField('title', state.title);
  if (titleErrors.length) errors.title = titleErrors;

  const acceptanceErrors = validateField('acceptance', state.acceptance);
  if (acceptanceErrors.length) errors.acceptance = acceptanceErrors;

  const descErrors = validateField('description', state.description);
  if (descErrors.length) errors.description = descErrors;

  return errors;
}

/** Check if the dialog is in a valid state to proceed. */
export function isValid(state: DialogState): boolean {
  const errors = validateDialog(state);
  return Object.keys(errors).length === 0;
}

/** Advance to the next step in the dialog flow. */
export function nextStep(state: DialogState): { state: DialogState; canProceed: boolean; blockers: string[] } {
  const errors = validateDialog(state);
  const allErrors = Object.values(errors).flat();

  if (allErrors.length > 0) {
    return {
      state: { ...state, errors: allErrors },
      canProceed: false,
      blockers: allErrors,
    };
  }

  const nextStep: DialogState['step'] = {
    title: 'criteria',
    criteria: 'confirm',
    confirm: 'done',
    done: 'done',
  }[state.step];

  return {
    state: { ...state, step: nextStep, errors: [] },
    canProceed: true,
    blockers: [],
  };
}

/**
 * AI-assisted generation of acceptance criteria from a goal title/description.
 *
 * Deterministic: same input → same output. No model call.
 * Demonstrates the "Generate with AI" feature from the screenshot.
 */
export function generateAcceptanceAI(title: string, description: string): string {
  const combined = `${title} ${description}`.trim();
  if (!combined) return 'Achieve the stated goal with verification.';

  const lower = combined.toLowerCase();

  // Deterministic keyword-based generation
  const patterns: [RegExp, string][] = [
    [/(test|spec|requirement)/, 'All acceptance criteria must be verifiable through automated tests.'],
    [/(perform|optimize|improve)/, 'Performance must meet defined benchmarks.'],
    [/(secure|auth|permission)/, 'Security constraints must be validated.'],
    [/(handle|support|process)/, 'Edge cases must be handled gracefully.'],
    [/(user|customer|client)/, 'User-facing behavior must match specifications.'],
    [/(data|migration|import|export)/, 'Data integrity must be preserved.'],
  ];

  const criteria: string[] = [];
  for (const [pattern, suggestion] of patterns) {
    if (pattern.test(lower)) criteria.push(suggestion);
  }

  if (criteria.length === 0) {
    criteria.push('All defined acceptance criteria must be met.');
    criteria.push('No existing functionality may regress.');
  }

  return criteria.join(' ');
}

/** Create an actual Goal from dialog state. */
export function submitGoal(
  store: { append: (type: string, payload: unknown) => void },
  state: DialogState,
): Goal {
  const errors = validateDialog(state);
  if (Object.keys(errors).length > 0) {
    throw new GoalError(`Cannot create goal: ${JSON.stringify(errors)}`);
  }
  return createGoal(store, {
    title: state.title.trim(),
    acceptance: state.acceptance.trim(),
  });
}

/** Serialize dialog state for persistence (shareable across sessions). */
export function serializeDialog(state: DialogState): string {
  return JSON.stringify({
    step: state.step,
    title: state.title,
    acceptance: state.acceptance,
    description: state.description,
    domainId: state.domainId,
    generatedFromAI: state.generatedFromAI,
    timestamp: new Date().toISOString(),
  });
}

/** Restore dialog state from serialized form. */
export function deserializeDialog(json: string): DialogState {
  try {
    const parsed = JSON.parse(json);
    return {
      step: parsed.step ?? 'title',
      title: parsed.title ?? '',
      acceptance: parsed.acceptance ?? '',
      description: parsed.description ?? '',
      domainId: parsed.domainId,
      errors: [],
      generatedFromAI: parsed.generatedFromAI ?? false,
    };
  } catch {
    return createInitialState();
  }
}
