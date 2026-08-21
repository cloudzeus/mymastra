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
  writeDeveloperFile,
} from "../projects/developer-filesystem-gateway";


function normalize(
  value:
    string,
): string {
  return value
    .replaceAll(
      "\\",
      "/",
    )
    .replace(
      /^\.\/+/,
      "",
    );
}


function assertQaWritablePath(
  relativePath:
    string,

  collectionName:
    string,
): void {
  const path =
    normalize(
      relativePath,
    );

  const root =
    `artifacts/${collectionName}`;

  const qaRoot =
    `${root}/qa/`;

  const documentationRoot =
    `${root}/documentation/`;


  if (
    !(
      path.startsWith(
        qaRoot,
      ) ||
      path.startsWith(
        documentationRoot,
      )
    )
  ) {
    throw new Error(
      [
        "QA filesystem BLOCKED:",
        "write path is outside QA authority.",
        `allowed=${qaRoot}*`,
        `allowed=${documentationRoot}*`,
        `requested=${path}`,
      ].join(
        " ",
      ),
    );
  }
}


export const qaReadFile =
  createTool({
    id:
      "qa-read-file",

    description: `
Read one UTF-8 project file through the filesystem authority of an
existing persisted DeveloperWorkOrder.

QA may inspect implementation files and release artifacts that were
inside the DeveloperWorkOrder authorized scope.

QA does not receive a workspace path and cannot broaden filesystem
scope.

No shell, Git, network, ERP or arbitrary filesystem access is provided.
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

        relativePath:
          z.string(),

        content:
          z.string(),
      }),

    execute:
      async input => {
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


        return {
          workOrderId:
            context.workOrderRecordId,

          relativePath:
            result.relativePath,

          content:
            result.content,
        };
      },
  });


export const qaWriteFile =
  createTool({
    id:
      "qa-write-file",

    description: `
Create or modify QA and documentation artifacts for one persisted
DeveloperWorkOrder.

WRITE AUTHORITY IS STRICTLY LIMITED TO:

artifacts/<collectionName>/qa/*
artifacts/<collectionName>/documentation/*

QA cannot modify application source, SoftOne Advanced JavaScript,
OpenAPI, Postman, database schema, .git, or arbitrary project files.

The persisted DeveloperWorkOrder remains the filesystem authority.
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
      async input => {
        const context =
          await loadDeveloperExecutionContext(
            input.workOrderId,
          );


        const collectionName =
          context
            .workOrder
            .artifactContract
            .collectionName;


        assertQaWritablePath(
          input.relativePath,
          collectionName,
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
