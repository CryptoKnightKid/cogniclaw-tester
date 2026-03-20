# OpenClaw Skills Library & Architecture (Explainer)

This document explains how the skills system is structured and how it works in practice.

## 1) What is a Skill?

A **skill** is a reusable instruction module for a specific task type.
It usually contains:
- Task scope and when to use it
- Required workflow/steps
- Guardrails and quality standards
- Output format expectations
- Optional references/scripts/assets

In OpenClaw, skills are not random prompt snippets. They are intended to be operational playbooks.

## 2) Why use Skills?

Skills give you:
- Consistency across repeated tasks
- Faster execution (less rethinking from scratch)
- Better quality control
- Easier onboarding for new agents
- More reliable multi-agent delegation

Without skills, output quality drifts because each run starts from a blank strategy.

## 3) Skills Library Structure

Typical structure:

- `SKILL_CATALOG.md`
  - Index of available skills
  - Categories and discoverability

- `Skills/<skill-name>/SKILL.md`
  - Core instructions for that skill

- Optional per-skill assets:
  - templates
  - scripts
  - examples
  - references

There are usually many skills grouped by domain (frontend, backend, design, research, ops, etc.).

## 4) Runtime Behavior (How Skills are Applied)

At runtime, the agent should:
1. Detect task intent
2. Select the most relevant skill
3. Load that skill instructions
4. Execute according to the skill flow
5. Return output in skill-defined format

If multiple skills match, the most specific one should be chosen first.

## 5) Architecture Pattern: Skill-first Execution

Recommended operating pattern:

1. **Architecture first**
   - Define plan in markdown before coding/building

2. **Skill binding**
   - Map each workstream to a specific skill

3. **Delegation**
   - Sub-agents receive architecture doc + assigned skill scope

4. **Review gate**
   - Main agent validates outputs against skill standards

This is the key difference between ad-hoc output and production workflow.

## 6) Quality Control Through Skills

Skills enforce quality by standardizing:
- Section structure
- Naming conventions
- Validation steps
- Failure handling
- Report format

For design/frontend tasks, this is especially important to avoid generic “AI template” output.

## 7) Skills + Memory Integration

Skills perform best when paired with memory layers:
- Hot context (current session)
- Daily logs (recent decisions and outputs)
- Core memory (long-term preferences and standards)

Skill instructions define *how* to do the task.
Memory defines *how your environment/user prefers* it done.

## 8) Skills for Multi-Agent Orchestration

In multi-agent mode, skills act like contracts:
- Agent A: research skill
- Agent B: implementation skill
- Agent C: QA/review skill

This reduces overlap, improves speed, and makes final merge easier.

## 9) Common Failure Modes

- Wrong skill selected
- No architecture doc before execution
- Skill ignored mid-task due to rush
- Missing review gate
- Overly generic output not checked against skill rules

Fix:
- enforce skill-first + architecture-first + artifact-first reporting.

## 10) Practical Recommendation

If you are improving an OpenClaw system, prioritize:
1. Clear skill catalog and taxonomy
2. Strong SKILL.md quality in high-frequency tasks
3. Architecture-first delegation workflow
4. Review checklist per skill
5. Continuous refinement from real task outcomes

---

If needed, I can also provide:
- a visual diagram of the skills architecture
- a “minimum viable skill standard” template
- a checklist to audit skill quality across your library
