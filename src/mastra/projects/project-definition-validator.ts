import type {
  ProjectDefinitionPackage,
  ProjectDefinitionStatus,
  ProjectDefinitionValidation,
} from "./project-definition-types";


function hasText(
  value: string | undefined,
): boolean {
  return Boolean(
    value?.trim(),
  );
}


function uniqueIds(
  ids: string[],
): boolean {
  return (
    new Set(
      ids,
    ).size ===
    ids.length
  );
}


export function validateProjectDefinitionPackage(
  definition:
    ProjectDefinitionPackage,
): ProjectDefinitionValidation {
  const errors:
    string[] =
    [];

  const warnings:
    string[] =
    [];


  if (
    !hasText(
      definition.id,
    )
  ) {
    errors.push(
      "Project definition id is required",
    );
  }


  if (
    !hasText(
      definition.projectId,
    )
  ) {
    errors.push(
      "projectId is required",
    );
  }


  if (
    !hasText(
      definition.tenantId,
    )
  ) {
    errors.push(
      "tenantId is required",
    );
  }


  if (
    !hasText(
      definition.tenantCode,
    )
  ) {
    errors.push(
      "tenantCode is required",
    );
  }


  if (
    !Number.isInteger(
      definition.version,
    ) ||
    definition.version <
      1
  ) {
    errors.push(
      "Project definition version must be a positive integer",
    );
  }


  const requirementIds =
    definition.requirements.map(
      (
        requirement,
      ) =>
        requirement.id,
    );


  if (
    !uniqueIds(
      requirementIds,
    )
  ) {
    errors.push(
      "Project requirement ids must be unique",
    );
  }


  for (
    const requirement
    of definition.requirements
  ) {
    if (
      !hasText(
        requirement.id,
      )
    ) {
      errors.push(
        "Project requirement id must not be blank",
      );
    }


    if (
      !hasText(
        requirement.statement,
      )
    ) {
      errors.push(
        `Project requirement ${requirement.id || "<unknown>"} statement must not be blank`,
      );
    }


    if (
      requirement.requiredForDevelopment &&
      requirement.status ===
        "UNRESOLVED"
    ) {
      warnings.push(
        `Required requirement remains unresolved: ${requirement.id}`,
      );
    }


    if (
      requirement.requiredForDevelopment &&
      requirement.status ===
        "BLOCKED"
    ) {
      warnings.push(
        `Required requirement is blocked: ${requirement.id}`,
      );
    }
  }


  const knowledgeIds =
    definition.knowledgeReferences.map(
      (
        reference,
      ) =>
        reference.id,
    );


  if (
    !uniqueIds(
      knowledgeIds,
    )
  ) {
    errors.push(
      "Project knowledge reference ids must be unique",
    );
  }


  for (
    const reference
    of definition.knowledgeReferences
  ) {
    if (
      !hasText(
        reference.referenceId,
      )
    ) {
      errors.push(
        `Knowledge reference ${reference.id || "<unknown>"} has no referenceId`,
      );
    }


    if (
      reference.tenantScoped &&
      !hasText(
        reference.tenantCode,
      )
    ) {
      errors.push(
        `Tenant-scoped knowledge reference ${reference.id || "<unknown>"} requires tenantCode`,
      );
    }


    if (
      reference.tenantScoped &&
      reference.tenantCode !==
        definition.tenantCode
    ) {
      errors.push(
        `Tenant-scoped knowledge reference ${reference.id || "<unknown>"} belongs to a different tenant`,
      );
    }
  }


  for (
    const plan
    of definition.structuredSqlPlans
  ) {
    if (
      plan.tenantCode !==
      definition.tenantCode
    ) {
      errors.push(
        `Structured SQL plan ${plan.id} belongs to tenant ${plan.tenantCode}, expected ${definition.tenantCode}`,
      );
    }


    if (
      plan.safety.directDatabaseExecution !==
        false ||
      plan.safety.requiresSoftOneRuntime !==
        true ||
      plan.safety.executable !==
        false ||
      plan.safety.writeAuthority !==
        false ||
      plan.safety.writePerformed !==
        false
    ) {
      errors.push(
        `Structured SQL plan ${plan.id} violates Developer handoff safety invariants`,
      );
    }


    if (
      plan.status ===
        "BLOCKED"
    ) {
      warnings.push(
        `Structured SQL plan is blocked: ${plan.id}`,
      );
    }
  }


  const integrationIds =
    definition.integrationRequirements.map(
      (
        integration,
      ) =>
        integration.id,
    );


  if (
    !uniqueIds(
      integrationIds,
    )
  ) {
    errors.push(
      "Integration requirement ids must be unique",
    );
  }


  const requiredUnresolved =
    definition.unresolved.filter(
      (
        item,
      ) =>
        item.requiredForDevelopment,
    );


  const requiredBlockedRequirements =
    definition.requirements.filter(
      (
        requirement,
      ) =>
        requirement.requiredForDevelopment &&
        requirement.status ===
          "BLOCKED",
    );


  let effectiveStatus:
    ProjectDefinitionStatus;


  if (
    errors.length >
      0 ||
    definition.blockers.length >
      0 ||
    requiredBlockedRequirements.length >
      0
  ) {
    effectiveStatus =
      "BLOCKED";
  }
  else if (
    requiredUnresolved.length >
      0 ||
    definition.requirements.some(
      (
        requirement,
      ) =>
        requirement.requiredForDevelopment &&
        requirement.status ===
          "UNRESOLVED",
    ) ||
    definition.structuredSqlPlans.some(
      (
        plan,
      ) =>
        plan.status !==
        "PLAN_READY",
    )
  ) {
    effectiveStatus =
      "PARTIAL";
  }
  else if (
    definition.requirements.length ===
      0
  ) {
    effectiveStatus =
      "DRAFT";

    warnings.push(
      "Project definition has no requirements",
    );
  }
  else {
    effectiveStatus =
      "READY";
  }


  if (
    definition.status !==
    effectiveStatus
  ) {
    errors.push(
      `Project definition status mismatch: declared=${definition.status} effective=${effectiveStatus}`,
    );
  }


  return {
    valid:
      errors.length ===
      0,

    errors,

    warnings,

    effectiveStatus,
  };
}
