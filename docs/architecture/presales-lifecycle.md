# Pre-Sales Lifecycle

## Customer / Prospect

Every commercial interaction belongs to a Customer record.

A Customer may be:

- PROSPECT
- ACTIVE
- INACTIVE

A Prospect does not imply that a delivery Project exists.

## Opportunity

An Opportunity represents a potential piece of work.

Typical lifecycle:

DRAFT
↓
QUALIFYING
↓
ANALYSIS
↓
PROPOSAL_DRAFT
↓
INTERNAL_REVIEW
↓
READY_TO_SEND
↓
SENT
↓
AWAITING_CUSTOMER
↓
ACCEPTED | REJECTED | ON_HOLD | EXPIRED

## Customer Request

The Administrator records:

- original customer request;
- source/channel;
- business problem;
- customer goals;
- known constraints;
- attachments;
- URLs;
- notes;
- budget if known;
- target timeline if known.

The original request must remain preserved.

## Initial Solution Approach

The Administrator may provide an initial proposed approach.

This is input to the Analyst, not an authoritative final solution.

## Analysis

The Business & Technical Analyst produces a structured analysis containing:

- interpreted business need;
- functional requirements;
- non-functional requirements;
- technical architecture;
- integrations;
- risks;
- dependencies;
- assumptions;
- alternatives;
- unresolved questions;
- recommended approach.

## Research

When useful, the Research / Competitor Agent produces a ResearchPackage.

Research must distinguish:

- VERIFIED
- DERIVED
- HYPOTHESIS
- UNRESOLVED

## Concept UI/UX

Concept UI/UX is activated during pre-sales when the opportunity includes:

- website;
- e-commerce;
- web application;
- portal;
- mobile application;
- React Native application.

Pre-sales concept design is intentionally lighter than full delivery design.

It may include representative screens and an interactive temporary preview.

## Proposal

The Proposal Agent consumes:

- Customer Request;
- Initial Solution Approach;
- Analysis Artifact;
- ResearchPackage;
- ConceptDesignPackage where applicable;
- approved commercial inputs.

Proposal output:

- DOCX
- PDF

## Internal Review

Administrator decisions:

- APPROVED
- CHANGES_REQUESTED
- REJECTED

Proposal revisions are immutable and versioned.

## Customer Decision

Customer decision:

- ACCEPTED
- REJECTED
- CHANGES_REQUESTED
- ON_HOLD
- EXPIRED

Only ACCEPTED or explicit administrative authorization may trigger conversion to a Delivery Project.
