# Mastra AI Workforce — System Architecture

## Purpose

The platform manages the complete lifecycle from a potential customer request
through proposal, project delivery, QA, deployment and post-launch growth work.

The chat conversation is not the source of truth.
The repository, PostgreSQL persistence and immutable artifacts are the source
of truth.

## Core Lifecycle

CUSTOMER / PROSPECT
        ↓
OPPORTUNITY
        ↓
CUSTOMER REQUEST
+
ADMIN INITIAL SOLUTION APPROACH
        ↓
BUSINESS & TECHNICAL ANALYSIS
        ↓
RESEARCH / COMPETITOR ANALYSIS
        ↓
OPTIONAL CONCEPT UI/UX
        ↓
DRAFT PROPOSAL
        ↓
ADMIN REVIEW
        ↓
CUSTOMER DECISION
        ↓
ACCEPTED
        ↓
DELIVERY PROJECT
        ↓
FULL DESIGN
        ↓
DEVELOPMENT
        ↓
QA
        ↓
STAGING
        ↓
PRODUCTION
        ↓
SEO / GEO / AEO / CONTENT / VIDEO

## Domain Separation

The following entities MUST remain distinct:

- Customer
- Opportunity
- Proposal
- Project

An Opportunity MUST NOT automatically become a Project.

A Project is created only when a customer opportunity is accepted or otherwise
explicitly authorized for delivery.

## Human Approval Principle

Material commercial, design and production transitions require explicit human
approval.

Agents do not implicitly approve:

- customer proposals;
- pricing;
- final design;
- production deployment;
- commercial commitments.

## Artifact Principle

Agent outputs are structured, versioned artifacts.

Artifacts must be:

- tenant scoped;
- customer/opportunity/project scoped where applicable;
- attributable;
- revision aware;
- traceable to evidence;
- immutable once superseded or approved.

## Language

Customer-facing proposals and competitor analysis are produced in Greek unless
explicitly requested otherwise.

Official company names, product names, URLs and technical identifiers remain in
their canonical form when translation would reduce accuracy.
