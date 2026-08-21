# Delivery Lifecycle

## Opportunity Conversion

An accepted Opportunity may be converted into a Delivery Project.

The conversion must:

1. preserve the original Opportunity;
2. preserve Proposal revisions;
3. link approved artifacts;
4. create a Project;
5. provision a dedicated delivery workspace;
6. create initial delivery work orders.

## Workspace Separation

Pre-sales and delivery content remain isolated.

Recommended logical structure:

/opt/mastra-workspaces/customers/<customer-code>/...
/opt/mastra-workspaces/delivery/<customer-code>/<project-code>/...

## Full UI/UX Design

After customer acceptance, UI/UX enters full-delivery mode.

For web projects:

- Next.js 16+
- App Router
- React Server Components by default
- shadcn/ui
- Tailwind CSS 4+
- semantic design tokens
- GSAP only where it materially improves UX
- server-side metadata
- responsive/mobile-first
- accessibility-first
- performance-first

For mobile projects:

- React Native
- platform-aware UX
- reusable design tokens
- accessibility requirements

## Design Approval

Full design must be reviewable through a controlled preview.

Possible review states:

- CREATING
- READY
- IN_REVIEW
- CHANGES_REQUESTED
- APPROVED
- SUPERSEDED

Approved design becomes authoritative input to Development.

## Development

Developer work begins from approved requirements and approved design.

## QA Gate

Completion requires applicable validation such as:

- TypeScript validation;
- lint;
- unit tests;
- integration tests;
- API tests;
- component tests;
- E2E tests;
- build validation;
- security checks.

Lifecycle:

DEVELOPMENT_COMPLETE
↓
QA_IN_PROGRESS
↓
QA_PASSED | QA_FAILED

Production deployment requires QA_PASSED and explicit deployment approval.

## Deployment

QA_PASSED
↓
STAGING_DEPLOYED
↓
STAGING_APPROVED
↓
PRODUCTION_DEPLOYED

Agents must not self-authorize production deployment.
