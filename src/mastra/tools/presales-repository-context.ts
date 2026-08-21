import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
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


export const presalesRepositoryContext =
  createTool({
    id:
      "presales-repository-context",

    description: `
Load authoritative information for one READY presales repository.

The model supplies only presalesSourceId.

tenantId, customerId and opportunityId come exclusively from trusted
RequestContext and are revalidated against PostgreSQL.

This tool is READ-ONLY.

It never exposes server filesystem paths and cannot:
- write files,
- execute arbitrary shell,
- change Git state,
- fetch network resources,
- commit,
- push,
- merge,
- deploy.
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

        repositoryUrl:
          z.string(),

        requestedRef:
          z.string()
            .optional(),

        resolvedRef:
          z.string(),

        resolvedCommit:
          z.string(),

        accessMode:
          z.literal(
            "READ_ONLY",
          ),

        safety:
          z.object({
            exactCommitVerified:
              z.literal(
                true,
              ),

            filesystemWrite:
              z.literal(
                false,
              ),

            shellExecution:
              z.literal(
                false,
              ),

            modelGitExecution:
              z.literal(
                false,
              ),

            networkExecution:
              z.literal(
                false,
              ),
          }),
      }),

    execute:
      async (
        input,
        {
          requestContext,
        },
      ) => {
        const authority =
          getPresalesRepositoryAuthorityFromContext(
            requestContext,
          );

        const resolved =
          await resolvePresalesRepositoryAuthority(
            authority,
            input.presalesSourceId,
          );

        return {
          presalesSourceId:
            resolved.presalesSourceId,

          repositoryUrl:
            resolved.repositoryUrl,

          requestedRef:
            resolved.requestedRef,

          resolvedRef:
            resolved.resolvedRef,

          resolvedCommit:
            resolved.resolvedCommit,

          accessMode:
            "READ_ONLY" as const,

          safety: {
            exactCommitVerified:
              true as const,

            filesystemWrite:
              false as const,

            shellExecution:
              false as const,

            modelGitExecution:
              false as const,

            networkExecution:
              false as const,
          },
        };
      },
  });
