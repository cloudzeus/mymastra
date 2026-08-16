import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  composeSemanticKnowledge,
} from "../softone/semantic-compose";

import {
  getSemanticTenantContext,
} from "../softone/semantic-tenant";

export const softoneSemanticCompose = createTool({
  id: "softone-semantic-compose",

  description: `
Compose multiple SoftOne business concepts into one
tenant-isolated semantic query plan.

Use this tool when a business question combines concepts,
for example:

- reserved stock versus available stock
- gross profit plus stock availability
- document lines plus last purchase
- turnover versus credits
- open supplier orders plus item availability

The tool:
- resolves the tenant from connectionId
- searches verified semantic knowledge
- selects composable metrics/datasets/rankings
- expands their dependencies
- collects physical sources
- collects expressions
- collects conditions
- collects joins
- identifies shared dimensions
- reports unresolved concepts

It DOES NOT generate executable SQL.
It DOES NOT perform writes.

A DERIVED_COMPOSITION means the semantic components are
verified and were combined logically. It does not mean
the final SQL has been validated.
`,

  inputSchema: z.object({
    connectionId:
      z.string().min(1),

    concepts:
      z.array(
        z.string().min(1),
      )
      .min(2)
      .max(10),

    limitPerConcept:
      z.number()
      .int()
      .min(1)
      .max(25)
      .default(10),
  }),

  outputSchema: z.any(),

  execute: async (input) => {
    const tenant =
      await getSemanticTenantContext(
        input.connectionId,
      );

    return composeSemanticKnowledge({
      tenantCode: tenant.tenantCode,
      concepts: input.concepts,
      limitPerConcept:
        input.limitPerConcept,
    });
  },
});
