import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  composeSemanticKnowledge,
} from "../softone/semantic-compose";

import {
  buildStructuredSqlPlan,
} from "../softone/structured-sql-plan-builder";

import {
  getSemanticTenantContext,
} from "../softone/semantic-tenant";


export const softoneStructuredSqlPlan =
  createTool({
    id: "softone-structured-sql-plan",

    description: `
Build a deterministic, read-only Structured SQL Plan for a
SoftOne business question.

Use this tool for business questions that require:

- datasets
- aggregates
- rankings
- reports
- combinations of verified SoftOne business metrics

The tool:

- resolves the real tenant from connectionId
- composes tenant-safe semantic knowledge
- matches a verified SoftOne business recipe when available
- identifies physical ERP sources
- identifies expressions, joins and filters
- identifies verified recipe parameters
- preserves verified SQL templates when available
- reports unresolved runtime parameters
- reports whether a SoftOne execution adapter is required

IMPORTANT EXECUTION SAFETY:

- It NEVER executes SQL.
- It NEVER connects directly to the ERP database.
- SoftOne SQL may only execute inside the SoftOne environment
  or through a SoftOne SQL script exposed through Web Services.
- INTERNAL_SEMANTIC_TOKENS such as {{COMPANY}} are planning
  placeholders and are NOT SoftOne execution syntax.
- PLAN_READY means the logical structured plan is ready for the
  next development stage. It does NOT mean executable SQL is ready.
`,

    inputSchema:
      z.object({
        connectionId:
          z.string()
            .min(1),

        concepts:
          z.array(
            z.string()
              .min(1),
          )
            .min(1)
            .max(10),

        executionChannel:
          z.enum([
            "SOFTONE_INTERNAL",
            "SOFTONE_WEBSERVICE_SCRIPT",
          ])
            .default(
              "SOFTONE_WEBSERVICE_SCRIPT",
            ),

        intent:
          z.enum([
            "DATASET",
            "AGGREGATE",
            "RANKING",
            "REPORT",
          ])
            .optional(),

        limitPerConcept:
          z.number()
            .int()
            .min(1)
            .max(25)
            .default(10),
      }),

    outputSchema:
      z.any(),

    execute:
      async (input) => {
        const tenant =
          await getSemanticTenantContext(
            input.connectionId,
          );

        const composition =
          composeSemanticKnowledge({
            tenantCode:
              tenant.tenantCode,

            concepts:
              input.concepts,

            limitPerConcept:
              input.limitPerConcept,
          });

        const plan =
          buildStructuredSqlPlan({
            composition,

            executionChannel:
              input.executionChannel,

            intent:
              input.intent,
          });

        return {
          tenant: {
            tenantId:
              tenant.tenantId,

            tenantCode:
              tenant.tenantCode,

            connectionId:
              tenant.connectionId,
          },

          composition: {
            status:
              composition.compositionStatus,

            requestedConcepts:
              composition.requestedConcepts,

            resolvedConcepts:
              composition
                .resolvedConcepts
                .map(
                  resolved => ({
                    requested:
                      resolved.concept,

                    id:
                      resolved
                        .selectedNode
                        .id,

                    type:
                      resolved
                        .selectedNode
                        .type,

                    scope:
                      resolved
                        .selectedNode
                        .scope,

                    evidence:
                      resolved
                        .selectedNode
                        .evidence,
                  }),
                ),

            unresolvedConcepts:
              composition.unresolvedConcepts,

            blockers:
              composition.blockers,
          },

          plan,
        };
      },
  });
