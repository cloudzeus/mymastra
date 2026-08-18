import {
  createHash,
} from "node:crypto";

import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  tavilySearch,
} from "../integrations/adapters/tavily";

import {
  recordExternalCost,
} from "../accounting/ai-run-recorder";


const INTERNAL_AI_RUN_ID_KEY =
  "__dgsmart.aiAccounting.runId";


function createSourceId(
  url: string,
): string {
  const digest =
    createHash(
      "sha256",
    )
      .update(
        url,
        "utf8",
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        20,
      );

  return `web:${digest}`;
}


export const researchWebSearch =
  createTool({
    id:
      "research-web-search",

    description: `
Searches the public web through the tenant-scoped Tavily integration.

Use this tool for current external research such as:

- competitor discovery;
- official company websites;
- products and services;
- market positioning;
- reviews and directories;
- news and announcements;
- industry references;
- customer and market research.

The tool returns real source URLs and deterministic sourceIds.

Evidence rules:

- never claim a URL was searched unless it is returned by this tool;
- prefer official/primary sources for factual company and product claims;
- use independent secondary sources where useful;
- a search snippet is evidence for what the snippet states, not
  automatically for everything on the linked page;
- use returned sourceId values when grounding VERIFIED findings.

This tool performs read-only public web research.
It does not write files, modify projects or access ERP systems.
`.trim(),

    inputSchema:
      z
        .object({
          environment:
            z
              .enum([
                "PRODUCTION",
                "TEST",
                "DEVELOPMENT",
              ])
              .optional()
              .default(
                "PRODUCTION",
              ),

          connectionId:
            z
              .string()
              .min(1)
              .optional(),

          query:
            z
              .string()
              .trim()
              .min(2)
              .max(500),

          searchDepth:
            z
              .enum([
                "basic",
                "advanced",
                "fast",
                "ultra-fast",
              ])
              .optional(),

          topic:
            z
              .enum([
                "general",
                "news",
                "finance",
              ])
              .optional(),

          country:
            z
              .string()
              .trim()
              .min(2)
              .max(100)
              .optional(),

          maxResults:
            z
              .number()
              .int()
              .min(1)
              .max(20)
              .optional()
              .default(
                10,
              ),

          includeAnswer:
            z
              .boolean()
              .optional()
              .default(
                false,
              ),

          includeRawContent:
            z
              .boolean()
              .optional()
              .default(
                false,
              ),
        })
        .strict(),

    execute:
      async (
        {
          environment,
          connectionId,
          query,
          searchDepth,
          topic,
          country,
          maxResults,
          includeAnswer,
          includeRawContent,
        },
        context,
      ) => {
        const tenantIdValue =
          context.requestContext?.get(
            "tenantId",
          );

        const tenantId =
          typeof tenantIdValue ===
            "string" &&
          tenantIdValue.trim()
            ? tenantIdValue.trim()
            : undefined;

        if (!tenantId) {
          throw new Error(
            "researchWebSearch requires tenantId in runtime requestContext",
          );
        }

        const internalRunIdValue =
          context.requestContext?.get(
            INTERNAL_AI_RUN_ID_KEY,
          );

        const internalRunId =
          typeof internalRunIdValue ===
            "string" &&
          internalRunIdValue.trim()
            ? internalRunIdValue.trim()
            : undefined;

        const result =
          await tavilySearch({
            tenantId,

            environment,

            connectionId,

            query,

            searchDepth,

            topic,

            country,

            maxResults,

            includeAnswer,

            includeRawContent,
          });

        if (
          internalRunId &&
          result.usageCredits !==
            undefined &&
          result.usageCredits !==
            null
        ) {
          await recordExternalCost({
            runId:
              internalRunId,

            lineType:
              "WEB_SEARCH",

            provider:
              "tavily",

            service:
              "research.tavily",

            unit:
              "CREDIT",

            quantity:
              result.usageCredits,

            unitPrice:
              result.pricePerCredit ??
              null,

            currency:
              result.currency ??
              "USD",

            sourceRef:
              result.requestId ??
              undefined,

            metadata: {
              query,

              searchDepth:
                searchDepth ??
                null,

              topic:
                topic ??
                null,

              country:
                country ??
                null,

              maxResults,

              includeAnswer,

              includeRawContent,

              responseTime:
                result.responseTime ??
                null,
            },
          });
        }

        return {
          query:
            result.query,

          answer:
            result.answer ??
            null,

          results:
            result.results.map(
              (
                item,
                index,
              ) => ({
                sourceId:
                  createSourceId(
                    item.url,
                  ),

                rank:
                  index + 1,

                title:
                  item.title,

                url:
                  item.url,

                content:
                  item.content,

                score:
                  item.score,

                rawContent:
                  item.rawContent ??
                  null,
              }),
            ),

          responseTime:
            result.responseTime ??
            null,

          requestId:
            result.requestId ??
            null,
        };
      },
  });
