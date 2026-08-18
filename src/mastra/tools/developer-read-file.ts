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
  readDeveloperFile,
} from "../projects/developer-filesystem-gateway";


export const developerReadFile =
  createTool({
    id:
      "developer-read-file",

    description: `
Read one existing UTF-8 project file under a persisted,
server-authorized DeveloperWorkOrder.

AUTHORIZATION MODEL:

- The Developer provides only:
  - workOrderId
  - relativePath

- The tool loads the persisted DeveloperWorkOrder from PostgreSQL.
- The tool loads the exact persisted ProjectDefinitionPackage version.
- projectId is NOT accepted from model input.
- allowedScope is NOT accepted from model input.
- workspacePath is NEVER accepted from model input.

FILESYSTEM SAFETY:

- The registered project workspace must be READY.
- The canonical workspace path is resolved server-side.
- relativePath must remain inside the persisted allowed scope.
- Absolute paths are prohibited.
- Path traversal is prohibited.
- .git access is prohibited.
- Symlink traversal is prohibited.
- The target must already exist.
- The target must be a regular file.
- Maximum readable file size is 1 MiB.
- The target must contain valid UTF-8 text.

CAPABILITY LIMITS:

- Read-only.
- No file creation.
- No file modification.
- No file deletion.
- No shell execution.
- No Git execution.
- No network access.
- No direct ERP database execution.
- No SoftOne write execution.

Use this tool before modifying an existing authorized project file.
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
      ) => {
        /*
         * The model supplies only the persisted work-order UUID.
         * All authorization is loaded server-side.
         */
        const context =
          await loadDeveloperExecutionContext(
            input.workOrderId,
          );


        const result =
          await readDeveloperFile({
            workOrder:
              context.workOrder,

            projectDefinition:
              context.projectDefinition,

            relativePath:
              input.relativePath,
          });


        /*
         * Never expose the absolute server filesystem path.
         */
        return {
          workOrderId:
            context.workOrderRecordId,

          projectId:
            result.projectId,

          relativePath:
            result.relativePath,

          content:
            result.content,

          bytesRead:
            result.bytesRead,
        };
      },
  });
