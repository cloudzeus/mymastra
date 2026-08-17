import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  loadDeveloperExecutionContext,
} from "../projects/developer-contract-manager";


export const developerWorkOrderContext =
  createTool({
    id:
      "developer-work-order-context",

    description: `
Load the authoritative persisted DeveloperWorkOrder and its exact
ProjectDefinitionPackage for a development task.

Use this tool before implementing a persisted DeveloperWorkOrder.

AUTHORITY RULES:

- The only model-supplied authority selector is workOrderId.
- The DeveloperWorkOrder is loaded from PostgreSQL.
- The exact ProjectDefinitionPackage version is loaded server-side.
- Both persisted records must be READY.
- The model cannot override projectId, allowedScope, executionPolicy,
  definition version, acceptance criteria, blockers or permissions.

This tool is READ-ONLY.

It does not:
- write files,
- execute shell commands,
- execute Git,
- access the network,
- execute ERP SQL,
- perform SoftOne writes.

The returned allowedScope is informational for planning.
Actual filesystem authorization is independently revalidated by
developer-write-file on every write.
`.trim(),

    inputSchema:
      z.object({
        workOrderId:
          z.string()
            .uuid(),
      }),

    outputSchema:
      z.any(),

    execute:
      async (
        input,
      ) => {
        const context =
          await loadDeveloperExecutionContext(
            input.workOrderId,
          );


        const workOrder =
          context.workOrder;

        const definition =
          context.projectDefinition;


        return {
          workOrder: {
            recordId:
              context.workOrderRecordId,

            id:
              workOrder.id,

            projectId:
              workOrder.projectId,

            projectDefinitionId:
              workOrder.projectDefinitionId,

            projectDefinitionVersion:
              workOrder.projectDefinitionVersion,

            taskId:
              workOrder.taskId,

            taskType:
              workOrder.taskType,

            objective:
              workOrder.objective,

            allowedScope:
              workOrder.allowedScope,

            requiredArtifacts:
              workOrder.requiredArtifacts,

            acceptanceCriteria:
              workOrder.acceptanceCriteria,

            executionPolicy:
              workOrder.executionPolicy,

            status:
              workOrder.status,

            blockers:
              workOrder.blockers,
          },

          projectDefinition: {
            recordId:
              context.projectDefinitionRecordId,

            id:
              definition.id,

            version:
              definition.version,

            projectId:
              definition.projectId,

            tenantId:
              definition.tenantId,

            tenantCode:
              definition.tenantCode,

            status:
              definition.status,

            requirements:
              definition.requirements,

            knowledgeReferences:
              definition.knowledgeReferences,

            structuredSqlPlans:
              definition.structuredSqlPlans,

            integrationRequirements:
              definition.integrationRequirements,

            unresolved:
              definition.unresolved,

            blockers:
              definition.blockers,

            provenance:
              definition.provenance,
          },

          safety: {
            authoritativePersistence:
              true,

            readyWorkOrderRequired:
              true,

            readyProjectDefinitionRequired:
              true,

            writeAuthority:
              false,

            shellExecution:
              false,

            gitExecution:
              false,

            networkExecution:
              false,

            directErpDatabaseExecution:
              false,

            softOneWriteExecution:
              false,
          },
        };
      },
  });
