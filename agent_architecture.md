# AI Agent Architecture Flow

This flowchart illustrates the core routing, governance, and operational hierarchy of the enterprise-grade AI agent system implemented in the `.agent/` directory.

```mermaid
flowchart TD
    %% Styling
    classDef user fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff,rx:8px,ry:8px
    classDef ui fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff,rx:8px,ry:8px
    classDef global fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    classDef orchestrator fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    classDef skill fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    classDef audit fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    classDef system fill:#475569,stroke:#334155,stroke-width:2px,color:#fff

    %% Nodes
    User(["👤 User Request"]):::user
    
    subgraph UILayer ["User Interface / Triggers"]
        IDE["VS Code / IDE Extension"]:::ui
        Commands["/.claude/commands/ \n(Slash Commands)"]:::ui
    end

    subgraph Governance ["Global Governance & Context"]
        AgentMD["AGENT.md\n(System Architecture & Memory)"]:::global
        RulesMD["RULES.md\n(Hard Coding Constraints)"]:::global
    end

    subgraph Orchestrators ["Orchestration Phase (.agent/workflows/)"]
        Build["<b>/build</b><br>Feature Implementer"]:::orchestrator
        Plan["<b>/plan</b><br>System Designer"]:::orchestrator
        Fix["<b>/fix</b><br>Diagnostic Router"]:::orchestrator
        MoreWFS["(/test-e2e, /audit-security, /deploy)<br><i>22 Total Workflows</i>"]:::system
    end

    subgraph Specialized ["Specialized Execution (.agent/skills/)"]
        Arch["architecture-planning"]:::skill
        Frontend["frontend-design"]:::skill
        I18n["i18n-localization"]:::skill
        Sec["security-compliance"]:::skill
        MoreSkills["(module-development, etc.)<br><i>17 Total Skills</i>"]:::system
    end

    subgraph Validation ["Automated Auditing (.agent/skills/*/scripts/)"]
        TS["syntaxCheck.js"]:::audit
        A11y["a11yCheck.js"]:::audit
        UX["uxAudit.js"]:::audit
        AuthCheck["rbacCheck.js"]:::audit
    end

    subgraph SharedToolkit ["Shared Utilities (.agent/scripts/)"]
        Constants["constants.js<br>(walkFiles, SKIP_DIRS)"]:::system
    end

    
    Output(["📝 Final Implementation & Output"]):::user

    %% Linkages
    User --> IDE
    IDE --> Commands
    
    Commands -. "Provides Context" .-> AgentMD
    Commands -. "Enforces Constraints" .-> RulesMD

    Commands --> Build
    Commands --> Plan
    Commands --> Fix
    Commands --> MoreWFS
    
    Build --> Frontend
    Build --> Sec
    Build --> MoreSkills
    
    Plan --> Arch
    Plan --> Sec
    
    Fix --> Frontend
    Fix --> Arch
    
    Frontend --> UX
    Frontend --> A11y
    Sec --> AuthCheck
    MoreSkills --> TS
    
    Validation -. "Imports from" .-> SharedToolkit
    
    UX --> Output
    A11y --> Output
    AuthCheck --> Output
    TS --> Output

    %% Subgraph Relationships
    Governance -. "Guides" .-> Orchestrators
    Governance -. "Guides" .-> Specialized
```

## How It Works

1. **Trigger (UI Layer):** The user triggers the agent using a specific natural language instruction or through a slash command in their IDE interface (e.g., `/build a new dashboard module`).
2. **Context Intake (Governance):** The AI universally loads `AGENT.md` to understand context and `RULES.md` to know the absolute constraints before processing anything.
3. **Orchestration (Workflows/Verbs):** The request routes into `.agent/workflows/` which acts as the high-level orchestrator. The AI identifies the goal, constructs an overarching plan, and establishes an approval gate for the user.
4. **Specialization (Skills/Nouns):** The workflow delegates complex tasks to specialized capabilities found in `.agent/skills/`. For example, visual modifications trigger the `frontend-design` skill to ensure cognitive load rules and contrast ratios are met.
5. **Validation (Scripts):** Before completing the implementation, the AI references built-in auditing scripts (like `uxAudit.js` or `rbacCheck.js`) to guarantee enterprise-grade quality and catch regressions.
   - **Shared Utilities Layer:** To DRY up script logic, auditing scripts import shared configuration from `.agent/scripts/constants.js` (e.g., standard directories to ignore, standardized file walking).
6. **Execution (Output):** Verified code and artifacts are returned to the user.
