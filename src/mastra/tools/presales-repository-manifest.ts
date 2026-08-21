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


const MANIFEST_FILES =
  [
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "tsconfig.json",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.js",
    "vite.config.ts",
    "prisma/schema.prisma",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    "requirements.txt",
    "pyproject.toml",
    "composer.json",
    "go.mod",
    "Cargo.toml",
  ] as const;


export const presalesRepositoryManifest =
  createTool({
    id:
      "presales-repository-manifest",

    description: `
Read known application manifest/configuration files from one READY
presales repository.

The model chooses only the presales source. File paths come from a fixed
server-owned allowlist.

READ-ONLY. No arbitrary filesystem path. No shell. No Git mutation.
No network.
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

        resolvedCommit:
          z.string(),

        manifests:
          z.array(
            z.object({
              path:
                z.string(),

              content:
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

        const manifests:
          {
            path: string;
            content: string;
          }[] =
          [];


        for (
          const manifestPath
          of MANIFEST_FILES
        ) {
          try {
            const result =
              await readPresalesRepositoryFile(
                resolved,
                manifestPath,
              );

            manifests.push({
              path:
                result.relativePath,

              content:
                result.content,
            });
          }
          catch (
            error
          ) {
            const message =
              error instanceof Error
                ? error.message
                : String(
                    error,
                  );

            if (
              message.includes(
                "ENOENT",
              )
            ) {
              continue;
            }

            /*
             * A missing candidate manifest is normal.
             * Other authorization/safety failures must remain fail-closed.
             */
            if (
              message.includes(
                "no such file or directory",
              )
            ) {
              continue;
            }

            throw error;
          }
        }


        return {
          presalesSourceId:
            resolved.presalesSourceId,

          resolvedCommit:
            resolved.resolvedCommit,

          manifests,
        };
      },
  });
