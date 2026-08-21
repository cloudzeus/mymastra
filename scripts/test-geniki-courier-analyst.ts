import {
  readFile,
} from "node:fs/promises";

import {
  analystAgent,
} from "../src/mastra/agents/analyst";

import {
  enrichSoftOneImplementationMetadata,
  redactImplementationSecrets,
} from "../src/mastra/softone/implementation-metadata-enricher";


function compactResolution(
  evidence:
    Awaited<
      ReturnType<
        typeof enrichSoftOneImplementationMetadata
      >
    >["verified"][number],
) {
  const {
    identifier,
    resolution,
  } = evidence;


  return {
    reference:
      identifier.reference,

    origin:
      identifier.origin,

    object:
      identifier.object,

    logicalTable:
      resolution.table?.name ??
      identifier.logicalTable,

    physicalTable:
      resolution.table?.physicalName ??
      identifier.physicalTable,

    field:
      resolution.field
        ? {
            name:
              resolution.field.name,

            fullname:
              resolution.field.fullname,

            caption:
              resolution.field.caption,

            type:
              resolution.field.type,

            editor:
              resolution.field.editor,

            required:
              resolution.field.required,
          }
        : undefined,

    evidence: {
      source:
        resolution.source,

      liveRequestPerformed:
        resolution.liveRequestPerformed,

      scope:
        resolution.source ===
          "GLOBAL_BASELINE"
          ? "GLOBAL_OR_REFERENCE_BASELINE"
          : "AUTHENTICATED_CONTEXT",
    },
  };
}


async function main() {
  const [
    connectionId,
    objectName,
    sourcePath,
  ] =
    process.argv.slice(
      2,
    );


  if (
    !connectionId ||
    !objectName ||
    !sourcePath
  ) {
    throw new Error(
      [
        "Usage:",
        "test-geniki-courier-analyst",
        "<connectionId>",
        "<SoftOne object>",
        "<javascript-file>",
      ].join(
        " ",
      ),
    );
  }


  const originalSource =
    await readFile(
      sourcePath,
      "utf8",
    );


  /*
   * Never expose implementation credentials
   * to the LLM.
   */
  const safeSource =
    redactImplementationSecrets(
      originalSource,
    );


  console.error(
    safeSource ===
      originalSource
      ? "INFO: no secrets matched redaction rules"
      : "OK: secrets redacted before LLM usage",
  );


  console.error(
    "\n=== RESOLVING SOFTONE IMPLEMENTATION METADATA ===\n",
  );


  const enrichment =
    await enrichSoftOneImplementationMetadata({
      connectionId,
      object:
        objectName,

      sourceCode:
        safeSource,
    });


  const verifiedMetadata =
    enrichment.verified.map(
      compactResolution,
    );


  const compactEvidence = {
    softOneObject:
      enrichment.object,

    verifiedIdentifiers:
      verifiedMetadata,

    unresolvedIdentifiers:
      enrichment.unresolved.map(
        identifier => ({
          reference:
            identifier.reference,

          logicalTable:
            identifier.logicalTable,

          physicalTable:
            identifier.physicalTable,

          field:
            identifier.field,

          origin:
            identifier.origin,
        }),
      ),

    unresolvedSqlTables:
      enrichment.unresolvedSqlTables,
  };


  console.error(
    JSON.stringify(
      {
        verifiedCount:
          verifiedMetadata.length,

        unresolvedCount:
          enrichment.unresolved.length,

        unresolvedSqlTables:
          enrichment.unresolvedSqlTables,

        verifiedIdentifiers:
          verifiedMetadata.map(
            item => ({
              reference:
                item.reference,

              logicalTable:
                item.logicalTable,

              physicalTable:
                item.physicalTable,

              field:
                item.field?.name,

              source:
                item.evidence.source,
            }),
          ),
      },
      null,
      2,
    ),
  );


  const prompt =
    `
You are acting as the Business and Technical Analyst for a real implementation task.

TASK

Design a reusable server-side Web Service for the courier integration represented by the supplied existing SoftOne JavaScript implementation.

The new service must be usable by:

1. the existing SoftOne integration,
2. an e-commerce application,
3. future applications without requiring knowledge of SoftOne FINDOC/MTRDOC runtime objects.

The existing implementation is working implementation evidence.

Do NOT rewrite the SoftOne script yet.

Your job in this stage is to reverse-engineer the implementation, derive the canonical courier domain contract, and produce a precise implementation specification that can subsequently be passed to the Developer agent.

IMPORTANT EVIDENCE RULES

Classify conclusions conceptually as:

VERIFIED
- directly demonstrated by supplied source code,
- or directly supplied in VERIFIED SOFTONE METADATA.

DERIVED
- a strong interpretation derived from verified implementation evidence.

HYPOTHESIS
- plausible but not established by available evidence.

Do not convert DERIVED or HYPOTHESIS information into verified facts.

You MAY perform useful technical and business inference when clearly qualified.

Do not claim that implementation-specific endpoints are official courier-provider endpoints unless the evidence proves that.

Do not invent undocumented request fields, response fields, SoftOne relations, tables, fields, credentials, identifiers, or API behavior.

Never reveal, reconstruct or request secrets.

The supplied source has already been redacted.

ARCHITECTURAL OBJECTIVE

Separate the implementation into:

e-shop / SoftOne / other client
        |
        v
canonical courier application API
        |
        v
CourierProvider interface
        |
        v
Geniki provider adapter
        |
        v
existing upstream courier gateway/API

The new application-layer contract must NOT expose SoftOne-specific names such as FINDOC, MTRDOC, VARCHAR02 or ccc* fields.

SOFTONE-SPECIFIC mappings must live in a SoftOne adapter/mapping layer.

REQUIRED ANALYSIS

Produce:

1. Executive technical summary.

2. Reverse-engineered business workflow:
   - create voucher/shipment,
   - cancellation,
   - label retrieval/printing,
   - closing pending jobs,
   - COD decision logic,
   - service selection logic,
   - validations demonstrated by the source.

3. Existing upstream API contract discovered from source:
   - endpoint paths,
   - methods,
   - request structures,
   - response structures,
   - error handling.
   Clearly identify what is VERIFIED versus DERIVED.

4. SoftOne field usage.
   Use the verified metadata supplied below.
   Explain how the implementation uses the fields.
   Do not claim global SoftOne meaning when evidence is tenant/context specific.

5. SoftOne -> canonical domain mappings.

Example conceptual direction:

SoftOne field
    -> implementation meaning
    -> canonical courier property

Do not blindly use this example; derive mappings from the actual source.

6. Canonical TypeScript domain model.

Define appropriate interfaces/types for at least:
   - CreateShipmentRequest
   - CreateShipmentResult
   - CancelShipmentRequest/Result
   - Label request/result
   - ClosePendingShipments request/result
   - Destination/address/contact
   - Courier service codes if evidence supports them

7. CourierProvider abstraction.

Propose a TypeScript interface that allows future providers such as other courier companies without changing the e-shop application layer.

8. Geniki provider adapter.

Specify precisely how the existing implementation maps to the provider adapter.

Do not hardcode credentials into source code.

9. HTTP API design for the new reusable Web Service.

Specify routes, methods, input/output contracts and HTTP error behavior.

Prefer domain-oriented routes.

10. Persistence model.

Determine what should be persisted independently of SoftOne.

Consider:
   - external order reference,
   - voucher number,
   - provider job ID,
   - status,
   - COD amount,
   - timestamps,
   - provider,
   - label metadata.

Only include data justified by the workflow or clearly mark architectural additions as DERIVED.

11. Idempotency and duplicate voucher prevention.

The existing source does not necessarily establish full behavior here.
Separate existing verified behavior from recommended service behavior.

12. Security design.

Credentials must be server-side configuration/secrets.
Clients must never send courier-provider credentials.

13. Migration strategy.

Explain how:
   a. the e-shop can start using the new service,
   b. SoftOne can later call the same service,
   c. existing behavior can be preserved during transition.

14. Unresolved questions.

Anything that cannot be established from the source or metadata must be explicitly listed.

15. IMPLEMENTATION BLUEPRINT.

Before the Developer Work Order, produce a concrete implementation blueprint
covering BOTH sides of the integration.

A. SOFTONE ADVANCED JAVASCRIPT IMPLEMENTATION

The SoftOne adapter is IN SCOPE.

Specify the Advanced JavaScript that must be installed in SoftOne.

For every required SoftOne function specify:

- proposed JavaScript function name,
- business purpose,
- SoftOne event/button/command that may invoke it where supported by evidence,
- FINDOC/MTRDOC/custom fields read,
- validation performed before the HTTP call,
- exact canonical REST endpoint called,
- HTTP method,
- canonical request payload mapping,
- response mapping back to SoftOne fields,
- SoftOne error handling using X.EXCEPTION / X.WARNING where appropriate,
- whether the function replaces an existing function from the supplied implementation.

At minimum cover the equivalents of:

- getGenikiVoucher
- cancelGenikiVoucher
- printGenikiVoucher
- closePendingJobs

Clearly distinguish:
existing VERIFIED behavior
from
new DERIVED implementation design.

Also specify what existing code becomes obsolete after migration.

B. WEB SERVICE IMPLEMENTATION

For each HTTP endpoint specify the complete processing path:

route
-> validation
-> application service
-> persistence
-> CourierProvider
-> Geniki provider mapping
-> upstream endpoint
-> response normalization
-> persistence update
-> client response.

For every endpoint include:

- route URL,
- HTTP method,
- request DTO,
- response DTO,
- authentication requirement,
- validation,
- application service function,
- provider function,
- exact verified upstream endpoint,
- upstream request mapping,
- upstream response mapping,
- persistence effects,
- error behavior.

C. E-SHOP INTEGRATION MAPPING

Describe explicitly how an e-shop order is transformed into the same
canonical CreateShipmentRequest used by the SoftOne adapter.

The e-shop MUST NOT know SoftOne field names.

Show:

E-shop order fields
-> canonical courier fields
-> Web Service endpoint.

Do not invent a specific e-shop schema if none is supplied.
Where exact e-shop fields are unknown, define the required semantic inputs.

D. END-TO-END MAPPING MATRIX

Produce a matrix with columns:

Operation
SoftOne function
SoftOne input fields
Canonical endpoint
Canonical DTO
Application service
Provider method
Upstream URL
SoftOne fields updated
E-shop equivalent

This matrix must make the implementation path unambiguous.

16. DEVELOPER WORK ORDER.

Finish with a concrete implementation work order suitable for a coding agent.

The Developer Work Order MUST include BOTH:

1. the reusable Web Service,
2. the SoftOne Advanced JavaScript adapter.

Do not place the SoftOne adapter out of scope.

The SoftOne Advanced JavaScript is an explicit deliverable.
Because it cannot be installed automatically, produce it as an artifact/file
with installation instructions for the SoftOne administrator.

The Developer must not directly modify SoftOne or its database.
Installation and testing of the Advanced JavaScript in SoftOne is manual.

The work order must define:
   - objective,
   - boundaries,
   - modules/components,
   - interfaces,
   - API routes,
   - persistence,
   - validation,
   - error handling,
   - security constraints,
   - acceptance criteria,
   - facts that must NOT be invented.

Do NOT write the entire implementation in this Analyst stage.

VERIFIED SOFTONE METADATA

${JSON.stringify(
  compactEvidence,
  null,
  2,
)}

EXISTING WORKING IMPLEMENTATION EVIDENCE

===== GenikiTaxidromiki SoftOne JavaScript =====

${safeSource}

===== END IMPLEMENTATION =====
`.trim();


  console.error(
    "\n=== RUNNING BUSINESS/TECHNICAL ANALYST ===\n",
  );


  const response =
    await analystAgent.generate(
      [
        {
          role:
            "user" as const,

          content:
            prompt,
        },
      ],
      {
        toolChoice:
          "none",

        maxSteps:
          1,

        abortSignal:
          AbortSignal.timeout(
            240_000,
          ),
      },
    );


  if (
    !response.text?.trim()
  ) {
    throw new Error(
      "Analyst returned an empty response",
    );
  }


  console.log(
    "\n=== ANALYST RESULT ===\n",
  );


  console.log(
    response.text,
  );
}


main().catch(
  error => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
