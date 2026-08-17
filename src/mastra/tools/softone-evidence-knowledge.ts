import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  getSoftOneEvidenceRecord,
  searchSoftOneEvidenceCatalog,
  getSoftOneEvidenceCatalogStats,
} from "../softone/evidence-catalog";

export const softoneEvidenceKnowledge =
  createTool({
    id: "softone-evidence-knowledge",

    description:
      "Searches the SoftOne evidence catalog for source-backed technical claims, including official documentation, community evidence, tenant verification, user-verified SQL and working SoftOne JavaScript. Read-only.",

    inputSchema:
      z.object({
        id:
          z
            .string()
            .min(1)
            .optional(),

        query:
          z
            .string()
            .min(1)
            .optional(),

        status:
          z
            .enum([
              "VERIFIED",
              "DERIVED",
              "HYPOTHESIS",
            ])
            .optional(),

        kind:
          z
            .enum([
              "API_BEHAVIOR",
              "FUNCTION",
              "OBJECT_BEHAVIOR",
              "FIELD_SEMANTICS",
              "RELATION",
              "PHYSICAL_MAPPING",
              "SQL_PATTERN",
              "SCRIPT_PATTERN",
              "FORM_BEHAVIOR",
              "EVENT_BEHAVIOR",
              "TENANT_RULE",
              "VERSION_BEHAVIOR",
              "BUSINESS_SEMANTIC",
            ])
            .optional(),

        scope:
          z
            .enum([
              "GLOBAL",
              "TENANT",
              "VERSION",
              "RECIPE",
            ])
            .optional(),

        tenantCode:
          z
            .string()
            .min(1)
            .optional(),

        softOneVersion:
          z
            .string()
            .min(1)
            .optional(),

        productArea:
          z
            .enum([
              "WEB_SERVICES",
              "OBJECT_MODEL",
              "DATABASE_DESIGNER",
              "FORM_DESIGN",
              "DATA_FLOWS",
              "SCRIPTING",
              "EVENTS",
              "SQL",
              "SQLDATA",
              "BROWSERS",
              "REPORTING",
              "CUSTOMIZATION",
              "INTEGRATIONS",
              "SCHEMA",
              "RELATIONS",
              "PHYSICAL_DATABASE",
              "TENANT_CONFIGURATION",
            ])
            .optional(),

        sourceId:
          z
            .string()
            .min(1)
            .optional(),

        includeStats:
          z
            .boolean()
            .default(false),

        limit:
          z
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20),
      }),

    execute: async (input) => {
      const context = input;

      if (
        !context.id &&
        !context.query &&
        !context.includeStats
      ) {
        return {
          success: false,

          error:
            "Provide id, query or includeStats=true.",

          safety: {
            readOnly: true,
            writePerformed: false,
          },
        };
      }

      const exact =
        context.id
          ? getSoftOneEvidenceRecord(
              context.id,
            )
          : undefined;

      const results =
        context.query
          ? searchSoftOneEvidenceCatalog({
              query:
                context.query,

              status:
                context.status,

              kind:
                context.kind,

              scope:
                context.scope,

              tenantCode:
                context.tenantCode,

              softOneVersion:
                context.softOneVersion,

              productArea:
                context.productArea,

              sourceId:
                context.sourceId,

              limit:
                context.limit,
            })
          : [];

      return {
        success: true,

        exact:
          exact ?? null,

        results,

        stats:
          context.includeStats
            ? getSoftOneEvidenceCatalogStats()
            : undefined,

        policy: {
          communityEvidence:
            "Community-only evidence must not be treated as VERIFIED unless corroborated by an authoritative or verified source.",

          tenantEvidence:
            "Tenant-specific claims require tenant-scoped evidence.",

          provenance:
            "Always preserve sourceId and source metadata when using evidence.",
        },

        safety: {
          readOnly: true,
          writePerformed: false,
        },
      };
    },
  });
