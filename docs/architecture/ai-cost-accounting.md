# AI Cost and Token Accounting

## Objective

The platform must know:

1. estimated AI/API cost before execution;
2. actual usage after execution;
3. cost by customer/opportunity/project;
4. cost by agent/model/provider;
5. estimate variance;
6. budget utilization.

## Pre-Run Estimate

Each planned run may include:

- estimated input tokens;
- estimated output tokens;
- estimated cached tokens;
- estimated reasoning tokens;
- estimated tool calls;
- estimated external API calls;
- best-case cost;
- expected cost;
- worst-case cost;
- confidence.

## Actual Usage

Each execution records where available:

- input tokens;
- output tokens;
- cached input tokens;
- reasoning tokens;
- total tokens;
- provider;
- model;
- run id;
- agent;
- timestamp.

## Model Pricing

Pricing must be versioned.

Required conceptual fields:

- provider
- model
- input_price_per_million
- output_price_per_million
- cached_input_price_per_million
- reasoning_price_per_million
- currency
- effective_from
- effective_to
- source

Historical runs must retain the pricing basis applicable at execution time.

## Non-LLM Costs

The Cost Ledger must support:

- Tavily;
- browser/research services;
- embeddings;
- image generation;
- video generation;
- storage;
- paid integrations;
- other metered APIs.

Therefore the canonical concept is:

AI / AUTOMATION COST LEDGER

not merely a token counter.

## Ownership

Every cost-bearing run must be attributable where applicable to:

- tenant
- customer
- opportunity
- proposal
- project
- artifact
- agent
- workflow

## Budget Controls

Supported budget scopes:

- Opportunity budget
- Project budget
- Tenant monthly budget

Policy examples:

- WARN_AT_70_PERCENT
- REQUIRE_APPROVAL_AT_90_PERCENT
- BLOCK_AT_100_PERCENT

Soft and hard limits must be distinguishable.

## Reporting

Required questions include:

- What did this proposal cost?
- What did competitive research cost?
- What did design cost?
- What did development cost?
- Which agent consumes the most?
- Which model is the most expensive?
- Estimated vs actual cost?
- Cost per accepted opportunity?
- Cost per delivered project?
