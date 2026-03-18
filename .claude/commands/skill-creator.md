---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## Process

1. **Capture Intent** — What should this skill enable Claude to do? When should it trigger? What's the expected output?
2. **Interview and Research** — Ask about edge cases, input/output formats, example files, success criteria, and dependencies.
3. **Write the SKILL.md** — Create the skill file with proper frontmatter (name, description) and markdown instructions.
4. **Test** — Come up with 2-3 realistic test prompts and run them.
5. **Evaluate** — Review outputs qualitatively and quantitatively.
6. **Iterate** — Improve based on feedback, rerun tests, repeat until satisfied.

## Skill Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

## Writing Guide

- Keep SKILL.md under 500 lines
- Use imperative form in instructions
- Explain the **why** behind instructions — models respond better to reasoning than rigid rules
- Make descriptions "pushy" to avoid under-triggering
- Include examples where useful
- Generalize from feedback — don't overfit to test cases
- Keep the prompt lean — remove what isn't pulling its weight

## Skill Frontmatter

```yaml
---
name: skill-name
description: When to trigger, what it does. Include both purpose AND specific trigger contexts.
---
```

The description is the primary triggering mechanism — include both what the skill does AND specific contexts for when to use it.
