import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  getSemanticNode,
  searchSemanticKnowledge,
  getSemanticDependencies,
} from "../softone/semantic-index";

import {
  getSemanticTenantContext,
} from "../softone/semantic-tenant";

const inputSchema = z.object({
  connectionId: z.string().min(1),

  query: z.string().min(1).optional(),

  id: z.string().min(1).optional(),

  type: z
    .enum([
      "FACT",
      "METRIC",
      "DATASET",
      "RECIPE",
      "RANKING",
      "TENANT_RULE",
    ])
    .optional(),

  includeDependencies: z.boolean().default(true),

  limit: z.number().int().min(1).max(50).default(20),
}).refine(
  (value) => Boolean(value.query || value.id),
  {
    message: "Either query or id is required",
  },
);

export const softoneSemanticKnowledge = createTool({
  id: "softone-semantic-knowledge",

  description: `
Search and inspect the SoftOne semantic business knowledge graph.

Use this tool for business concepts such as:
- reserved stock
- available stock
- supplier pending quantities
- customer turnover
- debit/credit metrics
- document lines
- open supplier orders
- last purchase
- sales performance
- gross profit
- product rankings

The tool is connection-aware.

It resolves the tenant from connectionId server-side and returns:
- global knowledge
- knowledge belonging only to that tenant
- verified dependencies
- provenance and evidence levels

Never provide or guess tenantCode manually.

Important:
Tenant-specific SERIES, FPRMS, RESTCATEG, PAYMENT,
TRDCATEGORY and custom mappings must never leak between tenants.

This tool performs no SoftOne write operation.
`,

  inputSchema,

  outputSchema: z.any(),

  execute: async (input) => {
    const tenant = await getSemanticTenantContext(
      input.connectionId,
    );

    if (input.id) {
      const node = getSemanticNode(input.id);

      if (!node) {
        return {
          found: false,
          tenant: {
            tenantCode: tenant.tenantCode,
          },
          id: input.id,
          writePerformed: false,
        };
      }

      /*
       * Tenant isolation for direct ID lookup.
       */
      if (
        node.scope === "TENANT" &&
        node.tenantCode !== tenant.tenantCode
      ) {
        return {
          found: false,
          tenant: {
            tenantCode: tenant.tenantCode,
          },
          id: input.id,
          reason: "TENANT_SCOPE_MISMATCH",
          writePerformed: false,
        };
      }

      const dependencies =
        input.includeDependencies
          ? getSemanticDependencies(node.id)
              .filter((dependency) => {
                if (dependency.scope !== "TENANT") {
                  return true;
                }

                return (
                  dependency.tenantCode ===
                  tenant.tenantCode
                );
              })
          : [];

      return {
        found: true,

        tenant: {
          tenantCode: tenant.tenantCode,
        },

        node,

        dependencies,

        safety: {
          tenantIsolated: true,
          writeAuthority: false,
          writePerformed: false,
        },
      };
    }

    const results = searchSemanticKnowledge({
      query: input.query!,
      type: input.type,
      tenantCode: tenant.tenantCode,
      limit: input.limit,
    });

    return {
      found: results.length > 0,

      tenant: {
        tenantCode: tenant.tenantCode,
      },

      query: input.query,

      count: results.length,

      results: results.map((node) => ({
        node,

        dependencies:
          input.includeDependencies
            ? getSemanticDependencies(node.id)
                .filter((dependency) => {
                  if (
                    dependency.scope !== "TENANT"
                  ) {
                    return true;
                  }

                  return (
                    dependency.tenantCode ===
                    tenant.tenantCode
                  );
                })
            : [],
      })),

      safety: {
        tenantIsolated: true,
        writeAuthority: false,
        writePerformed: false,
      },
    };
  },
});
