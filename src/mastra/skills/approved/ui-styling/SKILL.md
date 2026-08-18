---
name: ui-styling
description: UI composition and implementation guidance for responsive, accessible web interfaces using component-driven patterns, Tailwind CSS, shadcn/ui, and project design systems.
argument-hint: "[page, component, interaction, or responsive layout]"
license: MIT
metadata:
  version: "2.0.0"
---

# UI Styling

Use this skill for page-level and component-level UI composition.

This skill provides design and implementation guidance only. It does not authorize package installation, shell execution, code mutation, deployment, or arbitrary file access.

## Existing System First

Before proposing new styling:

1. inspect verified Brand Identity
2. inspect verified Design System
3. inspect existing components
4. inspect customer assets and previous project patterns
5. identify what can be reused
6. extend only where necessary

Do not create a parallel design language when an existing system can be extended.

## Visual Hierarchy

Use hierarchy intentionally through:

- size
- spacing
- typography
- weight
- grouping
- alignment
- contrast
- whitespace
- surface elevation
- progressive disclosure

The primary action and primary information should be visually obvious.

## Layout

Prefer predictable layout primitives:

- container
- stack
- cluster
- grid
- split layout
- sidebar
- master/detail
- cards
- data table
- dashboard grid
- responsive shell

Specify maximum content width, gutters, vertical rhythm, grid columns, alignment rules, breakpoint transitions, and overflow behavior.

## Responsive Behavior

Use mobile-first behavior unless requirements state otherwise.

For each important layout define:

- mobile structure
- tablet adaptation
- desktop structure
- navigation changes
- column stacking
- visibility changes
- content priority changes
- media adaptation
- touch behavior

Responsive design should preserve task priority, not merely resize desktop UI.

## Component Selection

Prefer existing project components before introducing new ones.

When shadcn/ui or similar primitives are available, prefer composition over rebuilding low-level accessible behavior.

Typical categories include buttons, inputs, forms, cards, tabs, accordions, navigation, dialogs, drawers, popovers, alerts, progress, skeletons, tables, badges, avatars, and command interfaces.

A component recommendation is not permission to install it automatically.

## Component States

Define relevant states explicitly:

- default
- hover
- focus
- active
- selected
- disabled
- loading
- empty
- error
- success

Avoid designing only the ideal populated state.

## Forms

Forms should specify labels, required/optional indicators, help text, validation timing, error placement, success feedback, loading/submitting state, disabled state, keyboard flow, and mobile input behavior.

Error messaging should explain how the user can recover.

## Data-Dense Interfaces

For tables, dashboards, ERP-style views, and administration screens consider:

- column priority
- sticky headers where justified
- pagination or virtualization strategy
- sorting
- filtering
- search
- bulk actions
- row actions
- empty state
- loading state
- error state
- responsive fallback
- keyboard accessibility

Do not sacrifice usability for visual minimalism.

## Tailwind Guidance

Use project-defined tokens and utilities.

Prefer semantic token-backed classes, consistent spacing scales, responsive variants, reusable composition patterns, and project theme variables.

Avoid repeated arbitrary values without reason, dynamic class construction that build tooling cannot detect, hard-coded brand values when semantic tokens exist, and duplicated utility sequences when a true reusable component is appropriate.

## shadcn/ui Guidance

Use shadcn/ui as composable source components, not as an immutable external black box.

When applicable:

- preserve accessible Radix behavior
- adapt styling through the project Design System
- define variants systematically
- retain keyboard navigation
- retain focus management
- retain semantic HTML
- retain form accessibility

Do not assume every project must use shadcn/ui.

## Accessibility

For every interactive surface consider:

- semantic HTML
- keyboard access
- visible focus
- accessible names
- labels
- descriptions
- error associations
- screen-reader announcements
- contrast
- reduced motion
- touch target size

Do not use color alone to communicate state.

## Theme Support

When theme support exists:

- consume semantic theme tokens
- ensure every interactive state has a theme mapping
- verify surfaces, borders, text, focus, and status colors
- avoid hard-coded light/dark colors inside components

## Media Integration

When pages use customer or generated assets:

- refer to assets by asset ID
- preserve brand and reference constraints
- define crop behavior
- define focal point requirements
- define overlays and safe areas
- define responsive variants
- define loading and fallback behavior
- define accessible alternative-text requirements

The UI/UX Designer specifies how media participates in the page. Media generation itself is handled through the appropriate controlled workflow.

## Developer Handoff

Provide actionable implementation guidance:

- component mapping
- token usage
- responsive utilities
- page structure
- component states
- interaction rules
- accessibility behavior
- media placement
- theme behavior
- unresolved design dependencies

Avoid vague handoff statements such as "make it modern" or "make it premium".

## References

Load only when needed:

- `references/shadcn-components.md`
- `references/shadcn-theming.md`
- `references/shadcn-accessibility.md`
- `references/tailwind-utilities.md`
- `references/tailwind-responsive.md`
- `references/tailwind-customization.md`

## Guardrails

- Existing verified Brand Identity and Design System take precedence.
- Do not invent official customer styles.
- Do not install packages.
- Do not execute shell or Python helpers.
- Do not mutate project code.
- Do not deploy.
- Do not load arbitrary bundled font files.
- Do not treat canvas/poster generation as part of normal UI styling.
- Do not expose storage paths or credentials.
