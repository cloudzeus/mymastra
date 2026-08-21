import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  listPresalesRepositoryTree,
  resolvePresalesRepositoryAuthority,
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


export const presalesRepositoryTree =
  createTool({
    id:
      "presales-repository-tree",

    description: `
List the structure of one READY presales repository.

Only presalesSourceId and an optional relative directory are model input.
The canonical filesystem root is resolved server-side.

.git, node_modules, build artifacts, symlinks, absolute paths and path
traversal are excluded or blocked.

READ-ONLY. No shell. No Git mutation. No network.
`.trim(),

    inputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),

        relativePath:
          z.string()
            .min(1)
            .max(1024)
            .optional(),

        maxDepth:
          z.number()
            .int()
            .min(0)
            .max(12)
            .optional(),

        maxEntries:
          z.number()
            .int()
            .min(1)
            .max(4000)
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

        entries:
          z.array(
            z.object({
              path:
                z.string(),

              type:
                z.enum([
                  "FILE",
                  "DIRECTORY",
                ]),

              size:
                z.number()
                  .int()
                  .nonnegative()
                  .optional(),
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

        const entries =
          await listPresalesRepositoryTree(
            resolved,
            {
              relativePath:
                input.relativePath,

              maxDepth:
                input.maxDepth,

              maxEntries:
                input.maxEntries,
            },
          );

        return {
          presalesSourceId:
            resolved.presalesSourceId,

          resolvedCommit:
            resolved.resolvedCommit,

          entries,
        };
      },
  });
