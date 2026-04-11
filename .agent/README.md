# xnapify AI Architecture Guide

The `xnapify` application is officially engineered to support intelligent developer assistance via a unified "Single Source of Truth" AI directory. Various AI agents (`Cursor`, `Claude`, `Gemini`, `Antigravity`) are configured to pull custom rules and workflows exclusively from the `.agent/` directory.

## Directory Structure

```
xnapify/
├── .agent/                       # Main AI Intelligence Engine
│   ├── ARCHITECTURE.md           # AI Agent Architecture Flow
│   ├── README.md                 # This guide
│   ├── RULES.md                  # Coding rules & constraints
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

Workflows are highly-detailed, step-by-step markdown guides stored as **Slash Commands** (22 total).

Each file includes `description:` YAML frontmatter so the AI knows strictly when to use it.

- **Example Usage:** "Hey AI, please `/add-module` for a new Billing feature."
- **How it works:** The AI instantly reads `.agent/workflows/add-module.md` and generates a customized API hook, React view, and Redux slice perfectly matched against the repository standard, without breaking convention.

**Available Workflows:**

- Orchestrators: `/build`, `/fix`, `/plan`
- Scaffold: `/add-module`, `/add-extension`, `/add-engine`, `/add-route`, `/add-view`, `/add-data`, `/add-redux`, `/add-worker`, `/add-test`
- Quality: `/modify` (includes lint & benchmark checks), `/audit-security`, `/test-e2e`, `/refactor`
- Operations: `/debug`, `/deploy`, `/commit`, `/lookup`, `/scout`, `/recap`

---

## 3. `.agent/skills/` (Rulesets & Personas)

Skills dictate HOW the AI behaves during complex tasks (e.g., refactoring or code reviewing) rather than providing a literal script. There are **17 skills** in total.

**Available Skills:**

- Process: **`design-thinking`**, **`architecture-planning`**, **`implementation-planning`**, **`requirement-traceability`**, **`test-driven-development`**
- Domain: **`module-development`**, **`extension-development`**, **`database-development`**, **`engine-development`**, **`websocket-development`**
- Quality: **`coding-standards`**, **`code-review`**, **`security-compliance`**
- Specialized: **`frontend-design`**, **`i18n-localization`**, **`browser-testing`**, **`workspace-isolation`**

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
