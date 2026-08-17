import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  loadDeveloperExecutionContext,
} from "../projects/developer-contract-manager";

import {
  writeDeveloperFile,
} from "../projects/developer-filesystem-gateway";


export const developerWriteFile =
  createTool({
    id:
      "developer-write-file",

    description: `
Write or modify one UTF-8 project file under a persisted,
server-authorized DeveloperWorkOrder.

AUTHORIZATION MODEL:

- The Developer provides only:
  - workOrderId
  - relativePath
  - content

- The tool loads the persisted DeveloperWorkOrder from PostgreSQL.
- The tool loads the exact persisted ProjectDefinitionPackage version.
- The projectId is NOT accepted from model input.
- allowedScope is NOT accepted from model input.
- allowCreate / allowModify are NOT accepted from model input.
- executionPolicy is NOT accepted from model input.
- workspacePath is NEVER accepted from model input.

FILESYSTEM SAFETY:

- The registered project workspace must be READY.
- The canonical workspace path is resolved server-side.
- relativePath must remain inside the persisted allowed scope.
- Absolute paths are prohibited.
- Path traversal is prohibited.
- .git access is prohibited.
- Symlink traversal is prohibited.
- Creation and modification permissions come only from the
  persisted DeveloperWorkOrder.

CAPABILITY LIMITS:

- No shell execution.
- No Git commit.
- No Git push.
- No network access.
- No direct ERP database execution.
- No SoftOne write execution.

Use this tool only when an approved persisted DeveloperWorkOrder
authorizes the requested file operation.
`.trim(),

    inputSchema:
      z.object({
        workOrderId:
          z.string()
            .uuid(),

        relativePath:
          z.string()
            .min(1)
            .max(1024),

        content:
          z.string()
            .max(
              1_048_576,
            ),
      }),

    outputSchema:
      z.object({
        workOrderId:
          z.string()
            .uuid(),

        projectId:
          z.string()
            .uuid(),

        relativePath:
          z.string(),

        operation:
          z.enum([
            "CREATED",
            "MODIFIED",
          ]),

        bytesWritten:
          z.number()
            .int()
            .nonnegative(),
      }),

    execute:
      async (
        input,
      ) => {
        /*
         * Critical authorization boundary:
         *
         * No work-order authority comes from model input.
         * The DB record is the authority.
         */
        const context =
          await loadDeveloperExecutionContext(
            input.workOrderId,
          );


        const result =
          await writeDeveloperFile({
            workOrder:
              context.workOrder,

            projectDefinition:
              context.projectDefinition,

            relativePath:
              input.relativePath,

            content:
              input.content,
          });


        /*
         * Do not expose the absolute server filesystem path
         * back to the model.
         */
        return {
          workOrderId:
            context.workOrderRecordId,

          projectId:
            result.projectId,

          relativePath:
            result.relativePath,

          operation:
            result.operation,

          bytesWritten:
            result.bytesWritten,
        };
      },
  });
