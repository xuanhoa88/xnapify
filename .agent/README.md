# xnapify AI Architecture Guide

The `xnapify` application is officially engineered to support intelligent developer assistance via a unified "Single Source of Truth" AI directory. Various AI agents (`Cursor`, `Claude`, `Gemini`, `Antigravity`) are configured to pull custom rules and workflows exclusively from the `.agent/` directory.

## Directory Structure

```
xnapify/
├── .agent/                       # Main AI Intelligence Engine
│   ├── README.md                 # This guide
│   ├── rules.md                  # Coding rules & constraints
│   ├── workflows/                # Explicit guides on HOW to do things
│   ├── skills/                   # Personas and Rulesets on WHAT is allowed
│   └── templates/                # SPEC.md template for feature specs
├── .claude/                      # Local Symlinks (for Claude Desktop app compatibility)
│   └── commands/                 # Symlinks to -> ../.agent/workflows
├── .gemini/                      # Meta-settings for Google Gemini Agents
│   └── settings.json             # Pointers to AGENT.md global context
└── AGENT.md                      # Global System Instruction file
```

---

## 1. AGENT.md (Global Context)

`AGENT.md` contains the entire global architecture of the repository. It defines coding standards, directory boundaries, essential dependencies (Express, React 18, Sequelize, TipTap), lifecycle hook ordering, and database rules.

- **When is it used?** It is injected directly as the "System Prompt" into any AI session interacting with the codebase. The AI already knows the layout of `xnapify` before you even ask it a question.

---

## 2. `.agent/workflows/` (Actionable Guides)

Workflows are highly-detailed, step-by-step markdown guides stored as **Slash Commands** (12 total).

Each file includes `description:` YAML frontmatter so the AI knows strictly when to use it.

- **Example Usage:** "Hey AI, please `/add-module` for a new Billing feature."
- **How it works:** The AI instantly reads `.agent/workflows/add-module.md` and generates a customized API hook, React view, and Redux slice perfectly matched against the repository standard, without breaking convention.

**Available Workflows:**

- Core: `/add-module` (includes schedule & webhook appendix), `/add-extension`, `/add-engine`
- Data: `/add-data` (models, migrations, seeds)
- Frontend: `/add-view` (includes component patterns), `/add-redux`
- Infrastructure: `/add-worker`
- Quality: `/add-test`, `/update-code` (includes lint & benchmark checks)
- Operations: `/debug` (includes performance optimization), `/docker-deploy`, `/git-commit`

---

## 3. `.agent/skills/` (Rulesets & Personas)

Skills dictate HOW the AI behaves during complex tasks (e.g., refactoring or code reviewing) rather than providing a literal script. There are **8 skills** in total.

**Available Skills:**

- **`module-developer`**: Trains the AI on correct lifecycle hooks, auto-discovery, declarative contexts, and dependency wiring for `src/apps/` modules.
- **`extension-developer`**: Trains the AI on the explicit differences between a core module (declarative migrations) and an extension (slots, hooks, IPC, shutdown cleanup). Covers both plugin-type and module-type extensions.
- **`code-reviewer`**: Instructs the AI on exact architectural violations — flags static imports between domains, missing RBAC guards, incorrect lifecycle patterns, and CSS Module enforcement.
- **`security-auditor`**: Audits routes and controllers for Zod validation, RBAC guards, rate limiting, and env var conventions.
- **`clean-code`**: Pragmatic coding standards — concise, direct, no over-engineering, no unnecessary comments.
- **`browser-test`**: Browser automation testing patterns using the browser subagent tool.
- **`i18n-localization`**: Internationalization patterns — detecting hardcoded strings, managing translations, locale files.
- **`frontend-design`**: Design thinking and decision-making for web UI — components, layouts, color schemes, typography, UX psychology.

---

## 4. Multi-AI Compatibility Rules

If you are using different AI tools across your team, be aware of how they interact with this directory structure:

1. **Cursor IDE:** Natively discovers `.agent/workflows/` and `.agent/skills/`. It operates out of these files seamlessly.
2. **Claude AI:** Claude expects custom instructions inside `.claude/commands/`. This folder contains **mirrored copies** of `.agent/workflows/`. When workflows change, the copies must be synced.
3. **Gemini / Antigravity:** Controlled via `.gemini/settings.json`, ensuring the AI targets the unified `AGENT.md` file rather than generating conflicting meta-files.

### Modifying the AI Architecture

If you change how models are defined, or how Webpack compiles CSS:

1. Open the relevant file in `.agent/workflows/` or `.agent/skills/`.
2. Update the definition.
3. **All AI tools** across the entire team will automatically adapt to the newly corrected conventions.
