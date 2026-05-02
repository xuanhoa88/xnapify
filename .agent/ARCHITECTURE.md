# AI Agent Architecture Flow

This flowchart illustrates the core routing, governance, and operational hierarchy of the enterprise-grade AI agent system implemented in the `.agent/` directory.

```mermaid
flowchart TD
    User(["User Request"])
    
    subgraph UILayer [User Interface]
        IDE["VS Code / IDE Extension"]
        Commands[".agent/workflows/ (Slash Commands)"]
    end

    subgraph Governance [Global Governance]
        AgentMD["AGENT.md (System Architecture & Memory)"]
        RulesMD[".agent/RULES.md (Hard Coding Constraints)"]
    end

    subgraph Orchestrators [Orchestration Phase]
        Build["/build Feature Implementer"]
        Plan["/plan System Designer"]
        Fix["/fix Diagnostic Router"]
        MoreWFS["(/audit-security, /deploy) 21 Total Workflows"]
    end

    subgraph Specialized [Specialized Execution]
        Arch["architecture-planning"]
        Frontend["frontend-design"]
        I18n["i18n-localization"]
        Sec["security-compliance"]
        MoreSkills["(module-development, etc.) 17 Total Skills"]
    end

    subgraph Validation [Automated Auditing]
        TS["syntaxCheck.js"]
        A11y["a11yCheck.js"]
        UX["uxAudit.js"]
        AuthCheck["rbacCheck.js"]
    end

    subgraph SharedToolkit [Shared Utilities]
        Constants["constants.js (walkFiles, SKIP_DIRS)"]
    end

    
    Output(["Final Implementation & Output"])

    %% Linkages
    User --> IDE
    IDE --> Commands
    
    Commands -.->|"Provides Context"| AgentMD
    Commands -.->|"Enforces Constraints"| RulesMD

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
    
    TS -.->|"Imports from"| Constants
    A11y -.->|"Imports from"| Constants
    UX -.->|"Imports from"| Constants
    AuthCheck -.->|"Imports from"| Constants
    
    UX --> Output
    A11y --> Output
    AuthCheck --> Output
    TS --> Output

    %% Context Relationships
    AgentMD -.->|"Guides"| Build
    RulesMD -.->|"Guides"| Build
```

## How It Works

1. **Trigger (UI Layer):** The user triggers the agent using a specific natural language instruction or through a slash command in their IDE interface (e.g., `/build a new dashboard module`).
2. **Context Intake (Governance):** The AI universally loads `AGENT.md` to understand context and `.agent/RULES.md` to know the absolute constraints before processing anything.
3. **Orchestration (Workflows/Verbs):** The request routes into `.agent/workflows/` which acts as the high-level orchestrator. The AI identifies the goal, constructs an overarching plan, and establishes an approval gate for the user.
4. **Specialization (Skills/Nouns):** The workflow delegates complex tasks to specialized capabilities found in `.agent/skills/`. For example, visual modifications trigger the `frontend-design` skill to ensure cognitive load rules and contrast ratios are met.
5. **Validation (Scripts):** Before completing the implementation, the AI references built-in auditing scripts (like `uxAudit.js` or `rbacCheck.js`) to guarantee enterprise-grade quality and catch regressions.
   - **Shared Utilities Layer:** To DRY up script logic, auditing scripts import shared configuration from `.agent/scripts/constants.js` (e.g., standard directories to ignore, standardized file walking).
6. **Execution (Output):** Verified code and artifacts are returned to the user.
