# Implementation Status

Last updated: 2026-08-17

## Completed Foundations

- SoftOne metadata discovery and canonical registry
- SoftOne object profiles and reference resolution
- Structured SoftOne SQL planning
- SoftOne execution safety invariants
- Integration Registry foundation
- encrypted integration credentials
- tenant-scoped integration connections
- Project/workspace database foundation
- Project Manager
- Workspace Manager
- filesystem workspace provisioning
- Git workspace provisioning
- integration project bindings
- Developer Work Order contracts
- Developer Work Order resolver
- safe Developer filesystem write gateway
- persistent Developer authorization
- Developer write tool
- Developer context tool
- Developer Agent
- Specialist artifact contract foundation
- Specialist role/artifact invariant
- approved skill inventory
- Research / Competitor Agent
- Tavily RESEARCH provider
- Tavily runtime adapter
- researchWebSearch
- researchFetchUrl
- Research Agent E2E verification

## Research Agent Runtime Verification

Verified real-world test:

Euronics Greece vs Kotsovolos

Observed:

- real Tavily search;
- official and independent sources;
- controlled URL fetching;
- VERIFIED / DERIVED / HYPOTHESIS discipline;
- Greek final analysis;
- structured ResearchPackage;
- natural completion;
- finishReason=stop;
- 13 steps from a max budget of 30.

## Current Architecture Decisions

- Customer != Opportunity != Proposal != Project
- pre-sales and delivery workspaces are separate
- UI/UX has PRE_SALES_CONCEPT and DELIVERY_DESIGN modes
- proposals are versioned DOCX/PDF artifacts
- proposal approval is human controlled
- customer acceptance converts Opportunity to Project
- full design is approved before Developer handoff
- QA is a deployment gate
- production deployment requires human authorization
- SEO/GEO/AEO/content/video specialists activate by project scope
- AI cost estimation and actual accounting are first-class capabilities

## Current Implementation Phase

IN PROGRESS:

Pre-Sales Domain + AI Cost / Token Accounting Foundation

## Planned Next Database Domains

### Pre-Sales

- customers
- opportunities
- customer_requests
- initial_solution_approaches
- opportunity_artifact_links
- proposals
- proposal_revisions
- proposal_reviews
- customer_decisions

### AI / Automation Cost

- ai_model_pricing
- ai_cost_estimates
- ai_runs
- ai_token_usage
- ai_cost_ledger
- ai_budgets

## Next Step

Inspect the existing PostgreSQL migrations, Project schema, tenant schema and artifact persistence before creating the next immutable migration.

No schema names, foreign keys or columns should be guessed.

## Important Invariants

- never invent SoftOne mappings
- never directly execute ERP SQL from Mastra
- no plaintext integration credentials
- no arbitrary Developer filesystem authority
- skills do not grant runtime capabilities
- agent output does not imply persistence
- no Project before Opportunity acceptance
- no production deployment without approval
- historical AI cost uses historical pricing
- proposals and approved artifacts retain revision history
