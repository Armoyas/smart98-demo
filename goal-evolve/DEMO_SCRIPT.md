# Smart98 Demo — Vibe Coding Scenario Script

> 4-minute talk track for the "goal + self-evolving" live demo.
> Pair with: `npm run demo` (CLI) and the HTML dashboard.

---

## Setup (before the audience arrives)

```bash
cd goal-evolve
npm run demo          # 10 practice runs + evolution report
npm run demo --json > out/demo.json   # data for the dashboard
```

Sanity check: the CLI must end with `SC-006: PASS`. If it does not, do not
present — the engine found no rule and the story collapses.

---

## Beat 1 — The goal (0:00–0:45)

**Say:** "Everything in Smart98 starts with a *goal* — a unit of intent with
explicit acceptance criteria. Not a prompt, a contract."

**Show:** the CLI header:

```
Goal GOAL-1: Fix the parser regression
Acceptance: The parser test suite passes and no existing tests regress.
```

**Point out:** the acceptance line. The demo goal states what *done* means
before any work happens — that is the Smart98 verify gate.

---

## Beat 2 — The failure (0:45–1:30)

**Say:** "Now we let the agent practice. Runs one to four: it guesses. Edit,
finish. Every run fails the same way."

**Show:** the run trace — four red ✗ marks.

**Say:** "In most tools that is where the story ends. Four failures, no
learning. Watch what Smart98 does with them."

---

## Beat 3 — The evolution (1:30–2:30)

**Say:** "Nothing told the engine what to learn. It read the ten runs and
mined them. Here is what it found on its own:"

**Show:** the proposed rules, e.g.

```
RULE-xxxx [verification] 84% support=6
  Read the relevant files, then edit in place, then run the tests
  Observed in 6 run(s), 6 of which achieved the goal (100% success rate).
  evidence: RUN-5, RUN-6, RUN-7, RUN-8, RUN-9, RUN-10
```

**Point out the three guarantees:**

1. **Deterministic** — run it twice, same output. No sampling, no model call.
2. **Evidence-backed** — every rule cites its runs. You can audit it.
3. **Conservative** — a rule needs three independent runs before it exists.
   One lucky run is not a habit.

---

## Beat 4 — The layers (2:30–3:15)

**Say:** "Rules are organized in Smart98's four layers: planning, execution,
verification, recovery. Notice which layer is blank."

**Show:** the layer bars; `recovery` is blank in the default run because no
failure cluster was large enough to mine.

**Say:** "A blank layer is not an error. It is the platform telling you where
your practice has not yet produced knowledge. That gap is a feature."

---

## Beat 5 — The close (3:15–4:00)

**Say:** "This is the whole loop Smart98 runs at platform scale: goals with
criteria, agents that practice, rules mined from practice, humans who approve.
Everything you just saw is in one folder, zero dependencies, one command."

**Show:**

```bash
git clone https://github.com/Armoyas/smart98-demo
cd smart98-demo/goal-evolve && npm run demo
```

**Final line:** "Vibe coding is not magic. It is goals, practice, and rules
that prove themselves with evidence. Smart98 runs that loop for you."

---

## Q&A ammunition

| Question | Answer |
| --- | --- |
| "Is the LLM in the loop?" | No — this demo is fully deterministic so results are reproducible on stage. The same engine wires to an LLM agent at platform level. |
| "What if two rules conflict?" | They surface as separate candidates. Approval is human — conflicts get flagged for manual review, never auto-merged. |
| "How does this scale?" | The store is an append-only log; reduction rebuilds state. Swap the JSONL file for Kafka/Session-Record and the model is unchanged. |
| "Why does recovery stay blank?" | minSupport=3: we had 4 identical failures but the demo's signatures differ. Set `minSupport: 2` in `evolveNow()` to mine them live. |
