import path from "node:path";

import type {
  DeveloperRequiredArtifact,
  DeveloperWorkOrder,
  DeveloperWorkOrderValidation,
} from "./developer-work-order-types";

import type {
  ProjectDefinitionPackage,
} from "./project-definition-types";

import {
  validateProjectDefinitionPackage,
} from "./project-definition-validator";


function hasText(
  value: string | undefined,
): boolean {
  return Boolean(
    value?.trim(),
  );
}


function validateRelativeScopePath(
  value: string,
): string | undefined {
  const normalized =
    value.trim();


  if (!normalized) {
    return "Allowed scope path must not be blank";
  }


  if (
    path.isAbsolute(
      normalized,
    )
  ) {
    return `Allowed scope path must be relative: ${normalized}`;
  }


  if (
    normalized ===
      "." ||
    normalized ===
      ".."
  ) {
    return `Allowed scope path is too broad: ${normalized}`;
  }


  const segments =
    normalized
      .replaceAll(
        "\\",
        "/",
      )
      .split(
        "/",
      );


  if (
    segments.some(
      (
        segment,
      ) =>
        segment ===
        "..",
    )
  ) {
    return `Allowed scope path contains traversal: ${normalized}`;
  }


  if (
    segments.some(
      (
        segment,
      ) =>
        segment ===
        ".git",
    )
  ) {
    return `Allowed scope path may not target .git: ${normalized}`;
  }


  if (
    normalized.startsWith(
      "-",
    )
  ) {
    return `Allowed scope path must not start with '-': ${normalized}`;
  }


  return undefined;
}


function artifactExists(
  artifact:
    DeveloperRequiredArtifact,
  definition:
    ProjectDefinitionPackage,
): boolean {
  switch (
    artifact.type
  ) {
    case "REQUIREMENT":
      return definition.requirements.some(
        (
          requirement,
        ) =>
          requirement.id ===
          artifact.referenceId,
      );


    case "KNOWLEDGE_REFERENCE":
      return definition.knowledgeReferences.some(
        (
          reference,
        ) =>
          reference.id ===
            artifact.referenceId ||
          reference.referenceId ===
            artifact.referenceId,
      );


    case "STRUCTURED_SQL_PLAN":
      return definition.structuredSqlPlans.some(
        (
          plan,
        ) =>
          plan.id ===
          artifact.referenceId,
      );


    case "INTEGRATION_REQUIREMENT":
      return definition.integrationRequirements.some(
        (
          requirement,
        ) =>
          requirement.id ===
          artifact.referenceId,
      );


    case "USER_VERIFIED_ARTIFACT":
      return definition.knowledgeReferences.some(
        (
          reference,
        ) =>
          reference.kind ===
            "USER_VERIFIED_ARTIFACT" &&
          (
            reference.id ===
              artifact.referenceId ||
            reference.referenceId ===
              artifact.referenceId
          ),
      );
  }
}


export function validateDeveloperWorkOrder(
  workOrder:
    DeveloperWorkOrder,
  definition:
    ProjectDefinitionPackage,
): DeveloperWorkOrderValidation {
  const errors:
    string[] =
    [];

  const warnings:
    string[] =
    [];


  const definitionValidation =
    validateProjectDefinitionPackage(
      definition,
    );


  if (
    !definitionValidation.valid
  ) {
    errors.push(
      ...definitionValidation.errors.map(
        (
          error,
        ) =>
          `Project definition invalid: ${error}`,
      ),
    );
  }


  warnings.push(
    ...definitionValidation.warnings,
  );


  if (
    !hasText(
      workOrder.id,
    )
  ) {
    errors.push(
      "Developer work order id is required",
    );
  }


  if (
    !hasText(
      workOrder.taskId,
    )
  ) {
    errors.push(
      "Developer taskId is required",
    );
  }


  if (
    !hasText(
      workOrder.objective,
    )
  ) {
    errors.push(
      "Developer objective is required",
    );
  }


  if (
    workOrder.projectId !==
    definition.projectId
  ) {
    errors.push(
      "Developer work order projectId does not match ProjectDefinitionPackage",
    );
  }


  if (
    workOrder.projectDefinitionId !==
    definition.id
  ) {
    errors.push(
      "Developer work order projectDefinitionId does not match ProjectDefinitionPackage",
    );
  }


  if (
    workOrder.projectDefinitionVersion !==
    definition.version
  ) {
    errors.push(
      "Developer work order ProjectDefinitionPackage version mismatch",
    );
  }


  if (
    definition.status !==
    "READY"
  ) {
    errors.push(
      `Developer execution BLOCKED: ProjectDefinitionPackage status is ${definition.status}`,
    );
  }


  if (
    workOrder.allowedScope.paths.length ===
    0
  ) {
    errors.push(
      "Developer work order requires at least one allowed relative path",
    );
  }


  for (
    const scopePath
    of workOrder.allowedScope.paths
  ) {
    const scopeError =
      validateRelativeScopePath(
        scopePath,
      );


    if (
      scopeError
    ) {
      errors.push(
        scopeError,
      );
    }
  }


  if (
    workOrder.acceptanceCriteria.length ===
    0
  ) {
    errors.push(
      "Developer work order requires acceptance criteria",
    );
  }


  for (
    const artifact
    of workOrder.requiredArtifacts
  ) {
    if (
      artifact.required &&
      !artifactExists(
        artifact,
        definition,
      )
    ) {
      errors.push(
        `Required Developer artifact not found in ProjectDefinitionPackage: ${artifact.type}:${artifact.referenceId}`,
      );
    }
  }


  const policy =
    workOrder.executionPolicy;


  if (
    policy.workspaceResolvedByProjectId !==
      true ||
    policy.arbitraryWorkspacePathAllowed !==
      false
  ) {
    errors.push(
      "Developer workspace policy invariant violated",
    );
  }


  if (
    policy.shellExecutionAllowed !==
      false
  ) {
    errors.push(
      "Developer shell execution is not enabled at this stage",
    );
  }


  if (
    policy.directErpDatabaseExecutionAllowed !==
      false
  ) {
    errors.push(
      "Direct ERP database execution is prohibited",
    );
  }


  if (
    policy.softOneWriteExecutionAllowed !==
      false
  ) {
    errors.push(
      "SoftOne write execution is prohibited",
    );
  }


  if (
    policy.gitCommitAllowed !==
      false ||
    policy.gitPushAllowed !==
      false
  ) {
    errors.push(
      "Git write authority is not enabled at this stage",
    );
  }


  if (
    policy.networkAccessAllowed !==
      false
  ) {
    errors.push(
      "Developer network access is not enabled at this stage",
    );
  }


  if (
    workOrder.status ===
      "READY" &&
    workOrder.blockers.length >
      0
  ) {
    errors.push(
      "READY Developer work order may not contain blockers",
    );
  }


  return {
    valid:
      errors.length ===
      0,

    errors,

    warnings,

    projectDefinition:
      definition,
  };
}
