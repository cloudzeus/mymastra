---
name: seo-audit
description: Use for technical SEO audits, crawlability, indexability, on-page SEO, international SEO, site architecture, internal linking, content quality, structured-data review, and prioritized search visibility recommendations.
metadata:
  version: 3.0.0
---

# SEO Audit

Use this skill to identify grounded SEO issues and produce prioritized,
evidence-based recommendations.

This skill provides methodology only.

It does not grant authority to crawl, modify, deploy, publish, submit,
or alter a website.


## Authoritative Context

Use available authoritative context such as:

- verified customer requirements;
- approved product and service documentation;
- ResearchPackage evidence;
- UXDesignPackage requirements;
- SearchVisibilityPackage context;
- verified analytics;
- Search Console exports;
- crawler exports;
- verified technical reports;
- supplied site documentation.

Do not access arbitrary filesystem paths to search for context.


## Audit Priorities

Evaluate in this order where relevant:

1. crawlability;
2. indexability;
3. canonicalization;
4. technical accessibility;
5. site architecture;
6. internal linking;
7. on-page relevance;
8. content quality;
9. structured data;
10. international SEO;
11. measurement and monitoring.

Issues that prevent discovery or indexing take precedence over
optimizations that only affect presentation or refinement.


## Crawlability

Review:

- robots directives;
- sitemap availability;
- sitemap scope;
- internal link discovery;
- redirect behavior;
- broken links;
- orphan pages;
- URL parameters;
- faceted navigation;
- pagination;
- session identifiers;
- authentication barriers;
- rendering dependencies.

Do not claim that a page is crawlable or blocked without evidence.


## Indexability

Review:

- index directives;
- canonical targets;
- redirect chains;
- soft-error conditions;
- duplicate content;
- conflicting canonical signals;
- protocol/domain consistency;
- indexable versus non-indexable page intent.

Do not infer actual index status solely from page HTML.

Use authoritative indexation data when available.


## Canonicalization

Evaluate whether canonical signals are:

- intentional;
- internally consistent;
- aligned with redirects;
- aligned with hreflang where applicable;
- aligned with sitemap URLs;
- aligned with protocol and hostname policy.

Do not treat a canonical tag as proof that a search engine selected the
same canonical.


## Technical Accessibility

Review:

- HTTPS;
- mixed content;
- server response behavior;
- rendering;
- JavaScript dependency;
- mobile usability;
- performance;
- accessibility-relevant markup;
- semantic HTML;
- resource delivery.

Do not fabricate Core Web Vitals or performance measurements.

Use measured data when available.


## Structured Data

Structured data findings require evidence.

Review:

- presence;
- semantic appropriateness;
- consistency with visible content;
- syntax validity;
- duplication;
- conflicting values;
- required versus recommended properties.

Do not report "no schema exists" unless the evidence source can actually
observe the rendered or delivered structured data.

Static fetches may miss dynamically injected JSON-LD.

Do not execute browser scripts or external validators unless an
authorized tool explicitly provides that capability.


## Site Architecture

Evaluate:

- logical hierarchy;
- discoverability of important pages;
- topic grouping;
- navigation consistency;
- URL consistency;
- orphan pages;
- internal linking depth;
- duplicate routes;
- unnecessary indexable variants.

Do not impose a universal click-depth threshold.

Use business importance and crawl/discovery evidence.


## On-Page SEO

Evaluate:

- page purpose;
- search intent;
- title relevance;
- meta description quality;
- heading clarity;
- semantic hierarchy;
- body relevance;
- entity coverage;
- terminology consistency;
- image accessibility;
- internal linking;
- content differentiation.

Do not enforce arbitrary universal limits for:

- title length;
- meta-description length;
- number of H1 elements;
- keyword position;
- keyword density;
- word count.

Use readability, rendering behavior, intent, and evidence instead.


## Search Intent

Determine the primary intent where supported:

- INFORMATIONAL;
- NAVIGATIONAL;
- COMMERCIAL;
- TRANSACTIONAL;
- LOCAL.

A page should have a clear purpose and satisfy the relevant intent.

Do not invent keyword demand, search volume, rankings or SERP behavior.


## Content Quality

Review whether content is:

- accurate;
- useful;
- sufficiently complete;
- original where appropriate;
- clearly written;
- supported by evidence;
- current where freshness matters;
- aligned with user needs;
- internally consistent;
- non-duplicative.

Avoid recommending more content merely to increase page length.


## Evidence and Claims

For important findings, record:

- observed issue;
- evidence;
- impact;
- confidence;
- recommendation;
- priority.

Never fabricate:

- traffic loss;
- ranking loss;
- impressions;
- clicks;
- search volume;
- CTR;
- conversion impact;
- competitor performance;
- algorithm effects.

If impact is inferred rather than measured, label it as inference.


## Internal Linking

Evaluate:

- orphan pages;
- important-page support;
- descriptive anchor text;
- contextual relevance;
- duplicate navigation patterns;
- broken links;
- excessive low-value links;
- topical relationships.

Do not recommend manipulative anchor-text patterns.


## International SEO

For multilingual or multi-regional sites, review:

- hreflang relationships;
- reciprocal annotations;
- self references;
- language/region codes;
- canonical consistency;
- locale URL strategy;
- sitemap consistency;
- x-default where appropriate;
- content completeness across locales;
- locale-specific signals;
- redirects based on geography or language.

Use the International SEO reference for implementation methodology.

Do not treat historical error rates, percentages or studies as current
site facts.


## Local SEO

Where relevant, review:

- consistent business identity;
- location information;
- local landing pages;
- local structured data;
- verified business profiles;
- local intent alignment.

Do not claim a profile exists, is optimized, or is verified without
evidence.


## Content Refresh

Recommend refresh when evidence indicates:

- stale facts;
- changed product information;
- changed pricing;
- outdated sources;
- regulatory changes;
- technical changes;
- broken links;
- changed search intent;
- verified performance deterioration.

Do not impose fixed refresh schedules.


## Measurement

Where data is available, consider:

- impressions;
- clicks;
- CTR;
- indexed pages;
- crawl issues;
- Core Web Vitals;
- organic sessions;
- conversions;
- landing-page performance;
- query coverage.

Use only verified analytics or supplied measurements.


## Prioritization

Prioritize findings based on:

- blocking severity;
- business importance;
- affected scope;
- confidence;
- implementation effort;
- dependency order.

Suggested qualitative levels:

- CRITICAL;
- HIGH;
- MEDIUM;
- LOW.

Do not fabricate numerical impact estimates.


## Output

A useful SEO audit should include:

- executive summary;
- audit scope;
- authoritative evidence used;
- technical findings;
- crawlability findings;
- indexability findings;
- canonicalization findings;
- architecture findings;
- on-page findings;
- content findings;
- international SEO findings where applicable;
- structured-data findings;
- measurement gaps;
- prioritized recommendations;
- unresolved dependencies.


## Guardrails

- Skills provide methodology only.
- Do not access arbitrary filesystem paths.
- Do not execute shell commands.
- Do not crawl websites unless an authorized tool provides that ability.
- Do not modify files.
- Do not modify robots.txt.
- Do not modify sitemaps.
- Do not implement schema.
- Do not deploy or publish.
- Do not submit URLs.
- Do not log into external services.
- Do not fabricate SEO findings.
- Do not fabricate measurements.
- Do not convert generic SEO heuristics into universal rules.
- Current platform-specific behavior requires fresh authoritative
  verification.


## References

- [International SEO](references/international-seo.md)
