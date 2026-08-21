import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  getPresalesRepositoryGitMetadata,
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


export const presalesRepositoryGitMetadata =
  createTool({
    id:
      "presales-repository-git-metadata",

    description: `
Return immutable Git identity information for the server-authorized
presales repository.

The tool verifies current HEAD against the persisted exact commit.

No arbitrary Git command is accepted from model input.
READ-ONLY. No checkout, fetch, commit, push, merge or network operation.
`.trim(),

    inputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),
      }),

    requestContextSchema,

    outputSchema:
      z.object({
        presalesSourceId:
          z.string()
            .uuid(),

        resolvedRef:
          z.string(),

        resolvedCommit:
          z.string(),

        headCommit:
          z.string(),

        detachedHead:
          z.boolean(),
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

        const metadata =
          await getPresalesRepositoryGitMetadata(
            resolved,
          );

        return {
          presalesSourceId:
            resolved.presalesSourceId,

          ...metadata,
        };
      },
  });
