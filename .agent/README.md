# xnapify AI Architecture Guide

The `xnapify` application is officially engineered to support intelligent developer assistance via a unified "Single Source of Truth" AI directory. Various AI agents (`Cursor`, `Claude`, `Gemini`) are configured to pull custom rules and workflows exclusively from the `.agent/` directory.

## Directory Structure

```
xnapify/
├── .agent/                       # Main AI Intelligence Engine
│   ├── README.md                 # This guide
│   ├── workflows/                # Explicit guides on HOW to do things
│   └── skills/                   # Personas and Rulesets on WHAT is allowed
├── .claude/                      # Local Symlinks (for Claude Desktop app compatibility)
│   └── commands/                 # Symlinks to -> ../.agent/workflows
├── .gemini/                      # Meta-settings for Google Gemini Agents
│   └── settings.json             # Pointers to AGENT.md global context
└── AGENT.md                      # Global System Instruction file
```

---

## 1. AGENT.md (Global Context)

`AGENT.md` (formerly `CLAUDE.md`) contains the entire global architecture of the repository. It defines coding standards, directory boundaries, essential dependencies (Express, React 18, Sequelize, TipTap), and database rules.

- **When is it used?** It is injected directly as the "System Prompt" into any AI session interacting with the codebase. The AI already knows the layout of `xnapify` before you even ask it a question.

---

## 2. `.agent/workflows/` (Actionable Guides)

Workflows are highly-detailed, step-by-step markdown guides stored as **Slash Commands**.

Each file includes `description:` YAML frontmatter so the AI knows strictly when to use it.

- **Example Usage:** "Hey AI, please `/add-module` for a new Billing feature."
- **How it works:** The AI instantly reads `.agent/workflows/add-module.md` and generates a customized API hook, React view, and Redux slice perfectly matched against the repository standard, without breaking convention.

**Available Workflows include:**

- API and Data: `/add-api`, `/add-model`, `/add-migration`, `/add-seed`
- Architecture: `/add-module`, `/add-extension`, `/add-worker`
- Frontend: `/add-view`, `/add-react-component`, `/add-redux-feature`
- Infrastructure: `/testing-and-linting`, `/setup-websocket`, `/optimize-performance`

---

## 3. `.agent/skills/` (Rulesets & Personas)

Skills dictate HOW the AI behaves during complex tasks (e.g., refactoring or code reviewing) rather than providing a literal script.

**Available Skills include:**

- **`code-reviewer`:** Instructs the AI on exact Architectural violations. If a developer bypasses the dependency injection `container` to write a static import between two separate domains, the `code-reviewer` skill empowers the AI to flag it and suggest a Hook/Pipeline fix.
- **`module-developer` / `extension-developer`:** Trains the AI on the explicit differences between a core application module (which changes the database via `.migrations()`) and an extension (which extends logic securely via slots and hooks).
- **`test-and-benchmark` / `worker-engineer`:** Specialized instruction on Node.js clustering and Jest timing protocols.

---

## 4. Multi-AI Compatibility Rules

If you are using different AI tools across your team, be aware of how they interact with this directory structure:

1. **Cursor IDE:** Natively discovers `.agent/workflows/` and `.agent/skills/`. It operates out of these files seamlessly.
2. **Claude AI:** Claude expects custom instructions inside `.claude/commands/`. We have replaced this folder with a **symbolic link** mapping directly to `.agent/workflows/`. Thus, anything edited in `.agent` instantly empowers Claude as well.
3. **Gemini / Advanced Agentic Coding:** Controlled via `.gemini/settings.json`, ensuring the AI targets the unified `AGENT.md` file rather than generating conflicting meta-files.

### Modifying the AI Architecture

If you change how models are defined, or how Webpack compiles CSS:

1. Open the relevant file in `.agent/workflows/`.
2. Update the definition.
3. **All AI tools** across the entire team will automatically adapt to the newly corrected conventions.
