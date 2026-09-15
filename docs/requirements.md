# Validation Checklist — Smart98 Demo

> Validation gates for the SDD workflow: spec quality, technical completeness, SDD alignment, feature coverage, open items.

## 1. Spec Quality

| Check | Result |
| --- | --- |
| User stories map to real user needs | ✅ 10 stories, prioritized P1/P2/P3 |
| Requirements are testable | ✅ Each FR maps to an SC |
| Scenarios are Given-When-Then | ✅ 8 scenarios documented |
| Priorities explicit | ✅ P1/P2/P3 per story and FR |

## 2. Technical Completeness

| Check | Result |
| --- | --- |
| MCP marketplace + invocation defined | ✅ FR-001/FR-002, SC-001 |
| Skill registry + activation defined | ✅ FR-003/FR-004, SC-002 |
| Agent builder + autonomy defined | ✅ FR-005/FR-006, SC-003 |
| Workspaces + sharing defined | ✅ FR-007, SC-004 |
| Labs toggles defined | ✅ FR-008, SC-005 |
| Self-Evolving defined | ✅ FR-009, SC-006 |
| Artifact deployment defined | ✅ FR-010, SC-007 |
| Eval / Markdown / text-select / OAuth defined | ✅ FR-011…FR-013, SC-008 |

## 3. SDD Workflow Alignment

| Check | Result |
| --- | --- |
| Spec exists before implementation | ✅ `docs/spec.md` |
| Plan exists with steps + test criteria | ✅ `docs/plan.md` |
| Validation gates documented | ✅ this file |
| Constitution check passed | ✅ 6/6 principles |

## 4. Feature Coverage (Labs screenshot)

| Feature | Covered | Priority in spec |
| --- | --- | --- |
| Agent Graph Runtime Config | ✅ | P2 |
| Input Markdown Rendering | ✅ | P3 |
| Message Text Selection Actions | ✅ | P3 |
| Self-Evolving | ✅ | P2 |
| Save turn as eval case | ✅ | P3 |
| Topic Acceptance | ✅ | P3 |
| Project Workspaces | ✅ | P1 |
| OAuth Apps | ✅ | P3 |
| Artifact Deployments | ✅ | P2 |

## 5. Open Items (need input)

1. **MCP servers to demo** — filesystem, web search, or custom?
2. **Persian (Vazirmatn) UI support** — per Elcamp 1405 work?
3. **Upstream sync cadence** — after repo setup, auto-sync? On-demand?
4. **Prod environment** — which URL will host the demo (smart98.ir subdomain?)

## 6. Approval

- [ ] Spec approved (owner)
- [ ] Plan approved (owner)
- [ ] Validation passed
- [ ] Implementation kickoff: Step 1
