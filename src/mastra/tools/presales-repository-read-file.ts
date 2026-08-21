import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  readPresalesRepositoryFile,
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


export const presalesRepositoryReadFile =
  createTool({
    id:
      "presales-repository-read-file",

    description: `
Read one existing UTF-8 text file from a READY presales repository.

The model supplies only:
- presalesSourceId
- relativePath

Absolute paths, traversal, .git access and symlink traversal are blocked.
Maximum file size is 1 MiB.

READ-ONLY. No file mutation. No shell. No Git mutation. No network.
`.trim(),

    inputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),

        relativePath:
          z.string()
            .min(1)
            .max(1024),
      }),

    requestContextSchema,

    outputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),

        resolvedCommit:
          z.string(),

        relativePath:
          z.string(),

        content:
          z.string(),

        bytesRead:
          z.number()
            .int()
            .nonnegative(),
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

        const result =
          await readPresalesRepositoryFile(
            resolved,
            input.relativePath,
          );

        return {
          presalesSourceId:
            resolved.presalesSourceId,

          resolvedCommit:
            resolved.resolvedCommit,

          ...result,
        };
      },
  });
