---
name: design-system
description: Brand-aware design-system methodology for UI/UX. Covers verified brand inputs, token architecture, components, responsive behavior, accessibility, themes, media requirements, and developer handoff.
argument-hint: "[brand, design system, component, page, or token problem]"
license: MIT
metadata:
  version: "2.0.0"
---

# Design System

Use this skill to define, evaluate, extend, or propose a coherent design system for digital products.

This skill provides design methodology only. It does not authorize shell execution, file mutation, package installation, deployment, or arbitrary external asset retrieval.

## Source Priority

Use evidence in this order:

1. Verified customer-provided Brand Guidelines.
2. Verified existing Design System.
3. Verified customer assets and existing digital products.
4. Project requirements.
5. Research and competitor evidence.
6. Proposed design direction.

Never present proposed or AI-generated brand rules as official customer guidelines.

Use `PROVIDED` for directly supplied customer material, `VERIFIED` for confirmed existing rules, `PARTIAL` when evidence is incomplete, and `PROPOSED` for newly designed recommendations.

## Brand Identity

Preserve and operationalize, when available:

- positioning and personality
- tone of voice
- logo usage
- color system
- typography
- iconography
- photography and illustration direction
- imagery and motion direction
- spacing principles
- shape language
- explicit dos and don'ts

Customer-scoped approved assets may be reused across projects.

Do not invent official logo rules, colors, fonts, or brand claims.

## Architecture

```text
Brand Identity
      ↓
Primitive Tokens
      ↓
Semantic Tokens
      ↓
Component Tokens
      ↓
Components
      ↓
Patterns
      ↓
Templates
      ↓
Pages
```

Primitive tokens contain raw values such as color scales, typography, spacing, radii, borders, shadows, breakpoints, motion, easing, and z-index.

Semantic tokens describe purpose such as background, foreground, primary, secondary, muted, destructive, success, warning, border, focus, surface, and interactive states.

Component tokens specialize semantic values for components where necessary.

## Components

Every significant component specification should define:

- purpose and content requirements
- variants and sizes
- default, hover, focus, active, selected, disabled, loading, empty, error, and success states as relevant
- responsive behavior
- keyboard and focus behavior
- validation behavior
- accessibility requirements

## Responsive Design

Design mobile-first unless project requirements say otherwise.

Define container behavior, grid strategy, breakpoints, content reflow, navigation adaptation, typography and spacing adaptation, component stacking, media crop behavior, and touch targets.

Do not assume one desktop creative can simply be scaled to every viewport. Important hero imagery, banners, campaign media, and videos may require separate responsive creative requirements.

## Accessibility

Accessibility is part of the specification. Define semantic structure, heading hierarchy, keyboard navigation, focus visibility, contrast, form labels and errors, status announcements, alternative text, reduced motion, touch targets, and accessible dialog/menu behavior where relevant.

## Themes

Keep primitive values separate from semantic meaning. Map semantic tokens per theme, avoid theme-specific component duplication, and verify contrast, focus, and status colors in every theme.

## Media Requirements

For image or video requirements specify:

- purpose and placement
- composition and aspect ratio
- responsive variants
- brand constraints
- source/reference asset IDs
- preservation requirements
- safe areas and overlay/text constraints
- motion requirements where relevant

Actual generation is delegated to the Content Creator or controlled Media Generation tools.

## Developer Handoff

For each page provide purpose, audience, user goals, information hierarchy, sections, actions, responsive behavior, component references, loading/empty/error states, content slots, media requirements, interactions, accessibility, and implementation notes.

For each component provide name, purpose, variants, states, content requirements, token dependencies, responsive behavior, and accessibility requirements.

## References

Load only when needed:

- `references/token-architecture.md`
- `references/primitive-tokens.md`
- `references/semantic-tokens.md`
- `references/component-tokens.md`
- `references/component-specs.md`
- `references/states-and-variants.md`
- `references/tailwind-integration.md`

## Guardrails

- Verified Brand Identity and Design System always take precedence over proposals.
- Never fabricate customer assets or approval.
- Use asset IDs, not raw storage paths or credentials.
- Preserve provenance between supplied assets and generated recommendations.
- Do not execute scripts or shell commands described in references.
- Do not install packages or deploy code.
- Presentation/slide generation is outside this skill.
