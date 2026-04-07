---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use when designing components, layouts, color schemes, typography, or creating aesthetic interfaces. Generates creative, polished code and UI design that avoids generic AI aesthetics.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Frontend Design System

> **Philosophy:** Every pixel has purpose. Restraint is luxury. User psychology drives decisions.
> **Core Principle:** THINK, don't memorize. ASK, don't assume.

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

---

## 🎯 Selective Reading Rule (MANDATORY)

**Read REQUIRED files always, OPTIONAL only when needed:**

| File | Status | When to Read |
|------|--------|--------------|
| [ux-psychology.md](ux-psychology.md) | 🔴 **REQUIRED** | Always read first! |
| [color-system.md](color-system.md) | ⚪ Optional | Color/palette decisions |
| [typography-system.md](typography-system.md) | ⚪ Optional | Font selection/pairing |
| [visual-effects.md](visual-effects.md) | ⚪ Optional | Glassmorphism, shadows, gradients |
| [animation-guide.md](animation-guide.md) | ⚪ Optional | Animation needed |
| [motion-graphics.md](motion-graphics.md) | ⚪ Optional | Lottie, GSAP, 3D |
| [decision-trees.md](decision-trees.md) | ⚪ Optional | Context templates |

> 🔴 **ux-psychology.md = ALWAYS READ. Others = only if relevant.**

---

## 🔧 Runtime Scripts

**Execute these for audits (don't read, just run):**

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/uxAudit.js` | UX Psychology & Accessibility Audit | `node scripts/uxAudit.js <project_path>` |

---

## ⚠️ CRITICAL: ASK BEFORE ASSUMING (MANDATORY)

> **STOP! If the user's request is open-ended, DO NOT default to your favorites.**

### When User Prompt is Vague, ASK:

**Color not specified?** Ask:
> "What color palette do you prefer? (blue/green/orange/neutral/other?)"

**Style not specified?** Ask: 
> "What style are you going for? (minimal/bold/retro/futuristic/organic?)"

**Layout not specified?** Ask:
> "Do you have a layout preference? (single column/grid/asymmetric/full-width?)"

### ⛔ DEFAULT TENDENCIES TO AVOID (ANTI-SAFE HARBOR):

| AI Default Tendency | Why It's Bad | Think Instead |
|---------------------|--------------|---------------|
| **Bento Grids (Modern Cliché)** | Used in every AI design | Why does this content NEED a grid? |
| **Hero Split (Left/Right)** | Predictable & Boring | How about Massive Typography or Vertical Narrative? |
| **Mesh/Aurora Gradients** | The "new" lazy background | What's a radical color pairing? |
| **Glassmorphism** | AI's idea of "premium" | How about solid, high-contrast flat? |
| **Deep Cyan / Fintech Blue** | Safe harbor from purple ban | Why not Red, Black, or Neon Green? |
| **"Orchestrate / Empower"** | AI-generated copywriting | How would a human say this? |
| Dark background + neon glow | Overused, "AI look" | What does the BRAND actually need? |
| **Rounded everything** | Generic/Safe | Where can I use sharp, brutalist edges? |

> 🔴 **"Every 'safe' structure you choose brings you one step closer to a generic template. TAKE RISKS."**

---

## 1. Constraint Analysis & Design Thinking (ALWAYS FIRST)

Before coding, understand the context and commit to a BOLD aesthetic direction:

| Constraint | Question | Why It Matters |
|------------|----------|----------------|
| **Purpose** | What problem does this solve? | Drives feature prioritization |
| **Tone** | What's the aesthetic extreme? | Brutally minimal, maximalist chaos, retro-futuristic, elegant luxury? |
| **Content** | Ready or placeholder? | Affects layout flexibility |
| **Brand** | Existing guidelines? | May dictate colors/fonts |
| **Tech** | What stack? | Affects capabilities |
| **Differentiation** | What makes it UNFORGETTABLE? | What's the one thing someone will remember? |

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

### Audience → Design Approach

| Audience | Think About |
|----------|-------------|
| **Gen Z** | Bold, fast, mobile-first, authentic |
| **Millennials** | Clean, minimal, value-driven |
| **Gen X** | Familiar, trustworthy, clear |
| **Boomers** | Readable, high contrast, simple |
| **B2B** | Professional, data-focused, trust |
| **Luxury** | Restrained elegance, whitespace |

---

## 2. UX Psychology Principles

### Core Laws (Internalize These)

| Law | Principle | Application |
|-----|-----------|-------------|
| **Hick's Law** | More choices = slower decisions | Limit options, use progressive disclosure |
| **Fitts' Law** | Bigger + closer = easier to click | Size CTAs appropriately |
| **Miller's Law** | ~7 items in working memory | Chunk content into groups |
| **Von Restorff** | Different = memorable | Make CTAs visually distinct |
| **Serial Position** | First/last remembered most | Key info at start/end |

### Emotional Design Levels

```
VISCERAL (instant)  → First impression: colors, imagery, overall feel
BEHAVIORAL (use)    → Using it: speed, feedback, efficiency
REFLECTIVE (memory) → After: "I like what this says about me"
```

---

## 3. Layout Principles & Spatial Composition

### Spatial Composition

Focus on unexpected layouts rather than safe formulas: Asymmetry, overlap, diagonal flow, and grid-breaking elements. Choose between generous negative space OR controlled density. Match the implementation complexity to the aesthetic vision. Elegance comes from executing the vision well.

### Golden Ratio (φ = 1.618)

```
Use for proportional harmony:
├── Content : Sidebar = roughly 62% : 38%
├── Each heading size = previous × 1.618 (for dramatic scale)
├── Spacing can follow: sm → md → lg (each × 1.618)
```

### 8-Point Grid Concept

```
All spacing and sizing in multiples of 8:
├── Tight: 4px (half-step for micro)
├── Small: 8px
├── Medium: 16px
├── Large: 24px, 32px
├── XL: 48px, 64px, 80px
└── Adjust based on content density
```

---

## 4. Color & Theme Principles

Commit to a cohesive aesthetic. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Vary between light and dark themes—never converge on common choices across projects.

### 60-30-10 Rule

```
60% → Primary/Background (calm, neutral base)
30% → Secondary (supporting areas)
10% → Accent (CTAs, highlights, attention)
```

### Selection Process

1. **What's the industry?** (narrows options)
2. **What's the emotion?** (picks primary)
3. **Light or dark mode?** (sets foundation)
4. **ASK USER** if not specified

---

## 5. Typography Principles

Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial, Inter, Roboto, or system fonts; opt instead for unexpected, characterful font choices that elevate the frontend's aesthetics. Pair a distinctive display font with a refined body font.

### Scale Selection

| Content Type | Scale Ratio | Feel |
|--------------|-------------|------|
| General web | 1.25 | Balanced (most common) |
| Editorial | 1.333 | Readable, spacious |
| Hero/display | 1.5-1.618 | Dramatic impact |

### Readability Rules

- **Line length**: 45-75 characters optimal
- **Line height**: 1.4-1.6 for body text
- **Contrast**: Check WCAG requirements

---

## 6. Visual Details & Backgrounds

Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

### Glassmorphism (When Appropriate)

```
Key properties:
├── Semi-transparent background
├── Backdrop blur
└── ⚠️ **WARNING:** Standard blue/white glassmorphism is a modern cliché. Use it radically or not at all.
```

### Shadow Hierarchy

```
Elevation concept:
├── Higher elements = larger shadows
└── Y-offset > X-offset (light from above)
```

---

## 7. Animation Principles & Motion

Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML, or motion libraries when available. 
Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.

### Timing Concept

```
Duration based on:
├── Distance (further = longer)
├── Size (larger = slower)
└── Context (urgent = fast, luxury = slow)
```

### Easing Selection

| Action | Easing | Why |
|--------|--------|-----|
| Entering | Ease-out | Decelerate, settle in |
| Leaving | Ease-in | Accelerate, exit |

---

## 8. "Wow Factor" Checklist

### Premium Indicators
- [ ] Generous whitespace OR clearly intentional maximalist density
- [ ] Distinctive, non-default typography choices
- [ ] Smooth, purposeful high-impact animations
- [ ] Attention to detail (alignment, consistency, custom cursors)
- [ ] Cohesive visual rhythm
- [ ] Atmospheric backgrounds with textures or intentional shadows

### Trust Builders
- [ ] Clear value proposition
- [ ] Professional aesthetics
- [ ] Consistent design language

---

## 9. Anti-Patterns (What NOT to Do)

### ❌ Generic AI Slop Aesthetics (AVOID!)
- Overusing **Inter, Roboto, Arial, Space Grotesk, or system fonts**.
- **Purple gradients on white backgrounds.**
- Cookie-cutter design that lacks context-specific character.
- Same layout structure / clone patterns.
- Not asking user preferences.
- Dark + neon default for everything.

### ❌ Lazy Design Indicators
- Default system fonts without consideration.
- Stock imagery that doesn't match the vibe.
- Inconsistent spacing.
- Too many competing colors without a dominant hierarchy.
- Inaccessible contrast.

---

## 10. Decision Process Summary

```
For EVERY design task:

1. CONSTRAINTS & TONE
   └── What's the audience, brand, tech, and aesthetic extreme?
   └── If unclear → ASK

2. CONTENT
   └── What content exists?
   └── What's the hierarchy?

3. STYLE DIRECTION
   └── What's appropriate for context?
   └── If unclear → ASK (don't default!)

4. EXECUTION
   └── Apply principles above (Typography, Spatial Layout, Motion)
   └── Check against AI-slop anti-patterns

5. REVIEW
   └── "Does this serve the user?"
   └── "Is this different from my defaults?"
   └── "Would I be proud of this?"
```

---

## Reference Files

For deeper guidance on specific areas:

- [color-system.md](color-system.md) - Color theory and selection process
- [typography-system.md](typography-system.md) - Font pairing and scale decisions
- [visual-effects.md](visual-effects.md) - Effects principles and techniques
- [animation-guide.md](animation-guide.md) - Motion design principles
- [motion-graphics.md](motion-graphics.md) - Advanced: Lottie, GSAP, SVG, 3D, Particles
- [decision-trees.md](decision-trees.md) - Context-specific templates
- [ux-psychology.md](ux-psychology.md) - User psychology deep dive

---

> **Remember:** Claude is capable of extraordinary creative work. Don't hold back. Every project deserves fresh consideration based on its unique context and users. **Avoid the Modern SaaS Safe Harbor and generic AI aesthetics!**

---

## Related Skills & Workflows

| Need | Skill / Workflow |
|------|-----------------|
| CSS Modules (class naming) | `coding-standards` skill |
| i18n for user-facing text | `i18n-localization` skill |
| React component patterns | `module-development` skill |
| Extension UI injection (slots) | `extension-development` skill |
| Accessibility validation | `scripts/a11yCheck.js` (this skill) |
| Code review (CSS section) | `code-review` skill (§8) |
| Adding a page route | `/add-view` workflow |
