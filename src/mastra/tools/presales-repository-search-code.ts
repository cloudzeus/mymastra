import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  resolvePresalesRepositoryAuthority,
  searchPresalesRepository,
} from "../presales/presales-repository-gateway";

import {
  getPresalesRepositoryAuthorityFromContext,
} from "./presales-repository-authority";


const requestContextSchema =
  z.object({
    tenantId:
      z.string()
        .uuid(),

    customerId:
      z.string()
        .uuid(),

    opportunityId:
      z.string()
        .uuid(),
  });


export const presalesRepositorySearchCode =
  createTool({
    id:
      "presales-repository-search-code",

    description: `
Search UTF-8 source files inside a READY presales repository.

This is literal text search, not arbitrary shell or regex execution.

.git, node_modules, generated build directories, symlinks, binary files
and oversized files are ignored.

READ-ONLY. No shell. No Git mutation. No network.
`.trim(),

    inputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),

        query:
          z.string()
            .min(1)
            .max(500),

        caseSensitive:
          z.boolean()
            .optional(),

        maxResults:
          z.number()
            .int()
            .min(1)
            .max(200)
            .optional(),
      }),

    requestContextSchema,

    outputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),

        resolvedCommit:
          z.string(),

        matches:
          z.array(
            z.object({
              path:
                z.string(),

              line:
                z.number()
                  .int()
                  .positive(),

              preview:
                z.string(),
            }),
          ),
      }),

    execute:
      async (
        input,
        {
          requestContext,
        },
      ) => {
        const resolved =
          await resolvePresalesRepositoryAuthority(
            getPresalesRepositoryAuthorityFromContext(
              requestContext,
            ),

            input.presalesSourceId,
          );

        const matches =
          await searchPresalesRepository(
            resolved,
            input.query,
            {
              caseSensitive:
                input.caseSensitive,

              maxResults:
                input.maxResults,
            },
          );

        return {
          presalesSourceId:
            resolved.presalesSourceId,

          resolvedCommit:
            resolved.resolvedCommit,

          matches,
        };
      },
  });
