# Feature Specification — Smart98 Demo Platform

> Derived from Spec-Driven Development (SDD) methodology. Source: `Spec_Driven_Development.pdf` (Smart98_Demo knowledge base).

## 1. Overview

Smart98 is an AI workspace platform where **MCP tools, skills, and agents** are first-class citizens. Users organize work in **Project Workspaces**, invoke tools via chat, activate skills with `@skill-name`, and let agents execute autonomously. The platform **self-evolves** by generating rules from agent practice, deploys chat artifacts to public URLs, and provides eval, Markdown rendering, text-selection, and OAuth features.

## 2. User Stories

### P1 — MVP

| ID | Story |
| --- | --- |
| US-001 | As a user, I can **discover MCP tools** in a marketplace and **invoke them in chat** so I can extend platform capabilities without code. |
| US-002 | As a user, I can **define a Skill** and **activate it with `@skill-name`** in chat so behavior packages are reusable. |
| US-003 | As a user, I can **create custom Agents** that run **autonomously** and report results, so long tasks run unattended. |
| US-004 | As a user, I can **organize scenarios in Project Workspaces** so work is structured and shareable. |
| US-005 | As a user, I can **toggle Labs features** individually so stability is controlled during rollout. |

### P2

| ID | Story |
| --- | --- |
| US-006 | As a user, the platform can **generate rules from agent practice** (Self-Evolving) so behavior improves automatically. |
| US-007 | As a user, I can **deploy chat artifacts to URLs** so outputs are published and shareable. |

### P3

| ID | Story |
| --- | --- |
| US-008 | As a user, I can **save a turn as an eval case** and run evals so quality is measurable. |
| US-009 | As a user, I can **render Markdown in inputs** and use **text-selection actions** on messages. |
| US-010 | As a developer, I can **register OAuth Apps** so external integrations authenticate safely. |

## 3. Functional Requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-001 | MCP marketplace lists tools with name, description, and version | P1 | OPEN |
| FR-002 | Chat can invoke MCP tools with typed arguments; results rendered inline | P1 | OPEN |
| FR-003 | Skill registry supports create/read/update/delete | P1 | OPEN |
| FR-004 | `@skill-name` activation routes to the skill handler | P1 | OPEN |
| FR-005 | Agent builder creates agents with system prompt, model, provider, plugins | P1 | OPEN |
| FR-006 | Agents execute tasks autonomously with status tracking and reports | P1 | OPEN |
| FR-007 | Project Workspaces group scenarios, shareable by link | P1 | OPEN |
| FR-008 | Labs page exposes feature toggles with alpha/beta labels | P1 | OPEN |
| FR-009 | Rule engine captures agent actions and generates candidate rules | P2 | OPEN |
| FR-010 | Artifact deployment publishes chat outputs to stable URLs | P2 | OPEN |
| FR-011 | Eval runner executes saved turns with pass/fail criteria | P3 | OPEN |
| FR-012 | Markdown input rendering and text-selection action bar | P3 | OPEN |
| FR-013 | OAuth app registration, client credentials, and consent flow | P3 | OPEN |

## 4. Success Criteria

| ID | Criterion |
| --- | --- |
| SC-001 | A user can discover an MCP tool and invoke it end-to-end in chat within 2 minutes |
| SC-002 | `@skill-name` activation works in 100% of defined skill names |
| SC-003 | A created agent completes an autonomous task and reports a structured result |
| SC-004 | Project Workspaces can be created, shared, and re-opened across sessions |
| SC-005 | All Labs toggles persist across reload; alpha features are visually marked |
| SC-006 | Self-Evolving generates at least one non-trivial rule from 10 practice runs |
| SC-007 | A deployed artifact is accessible at its public URL with zero auth friction |
| SC-008 | Eval cases run with deterministic pass/fail reporting |

## 5. Given-When-Then Scenarios

### 5.1 MCP Tool Discovery (US-001, SC-001)

- **Given** a user is in a Project Workspace
- **And** the MCP marketplace is installed
- **When** the user opens the tool picker and filters by name
- **Then** matching tools appear with description and version
- **And** invoking one attaches it to the chat as a tool call

### 5.2 Skill Activation (US-002, SC-002)

- **Given** a skill `translate-fa` exists in the registry
- **When** the user sends a message containing `@translate-fa`
- **Then** the skill handler runs and its result is rendered in chat
- **And** an unknown `@unknown-skill` reference shows a non-blocking suggestion

### 5.3 Agent Autonomy (US-003, SC-003)

- **Given** an agent is configured with a system prompt and model
- **When** the user assigns a task and the agent starts
- **Then** the agent executes tools autonomously
- **And** reports progress and a final structured result

### 5.4 Project Workspaces (US-004, SC-004)

- **Given** an authenticated user
- **When** they create a workspace and open it in a new session
- **Then** scenarios and settings are restored

### 5.5 Labs Toggles (US-005, SC-005)

- **Given** the Labs page lists 9 features
- **When** a user toggles a feature and reloads
- **Then** the setting persists and alpha features are marked

### 5.6 Self-Evolving (US-006, SC-006)

- **Given** an agent completes practice runs
- **When** the rule engine observes repeated patterns
- **Then** it proposes candidate rules for human approval

### 5.7 Artifact Deployment (US-007, SC-007)

- **Given** a chat turn rendered as an artifact
- **When** the user triggers deploy
- **Then** a public URL is created and can be opened without auth

### 5.8 Eval Cases (US-008, SC-008)

- **Given** a turn saved as an eval case with criteria
- **When** the eval runner executes it
- **Then** the result is pass/fail with evidence

## 6. Feature → Labs Mapping (from UI screenshot)

| Labs Feature | Status | Spec Section |
| --- | --- | --- |
| Agent Graph Runtime Config | Alpha → P2 | Step 8 |
| Input Markdown Rendering | Beta → P3 | Step 6 + 9 |
| Message Text Selection Actions | Alpha → P3 | Step 6 + 9 |
| Self-Evolving | Alpha → P2 | Step 8 |
| Save turn as eval case | Alpha → P3 | Step 9 |
| Topic Acceptance | Alpha → P3 | Spec §5.4 |
| Project Workspaces | Alpha → P1 | Step 2 |
| OAuth Apps | Beta → P3 | Step 6 + 9 |
| Artifact Deployments | Beta → P2 | Step 7 |
