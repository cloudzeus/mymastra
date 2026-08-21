import type {
  CreateProjectExecutionPlanInput,
  ProjectExecutionDependencyDefinition,
  ProjectExecutionStageDefinition,
} from "./types";


export type ExecutionPlanValidation = {
  valid: boolean;

  errors: string[];
};


function nonBlank(
  value: string,
): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


function validateStages(
  stages:
    ProjectExecutionStageDefinition[],
  errors: string[],
): Set<string> {
  const keys =
    new Set<string>();

  if (
    !Array.isArray(stages) ||
    stages.length === 0
  ) {
    errors.push(
      "Execution plan requires at least one stage",
    );

    return keys;
  }

  for (
    const stage of stages
  ) {
    if (
      !nonBlank(
        stage.stageKey,
      )
    ) {
      errors.push(
        "Every execution stage requires a nonblank stageKey",
      );

      continue;
    }

    const key =
      stage.stageKey.trim();

    if (
      keys.has(key)
    ) {
      errors.push(
        `Duplicate stageKey: ${key}`,
      );
    }

    keys.add(key);


    if (
      !nonBlank(
        stage.agentRole,
      )
    ) {
      errors.push(
        `Stage ${key} requires agentRole`,
      );
    }


    if (
      stage.executionKind ===
        "SPECIALIST_ARTIFACT"
    ) {
      if (
        !stage.expectedArtifactType
      ) {
        errors.push(
          `SPECIALIST_ARTIFACT stage ${key} requires expectedArtifactType`,
        );
      }

    }


    if (
      stage.executionKind ===
        "DEVELOPER_WORK_ORDER"
    ) {
      if (
        stage.agentRole !==
          "DEVELOPER"
      ) {
        errors.push(
          `Stage ${key}: DEVELOPER_WORK_ORDER requires DEVELOPER role`,
        );
      }

      if (
        stage.expectedArtifactType !==
          undefined
      ) {
        errors.push(
          `Stage ${key}: DEVELOPER_WORK_ORDER must not declare expectedArtifactType`,
        );
      }
    }


    if (
      stage.configuration !==
        undefined &&
      (
        typeof stage.configuration !==
          "object" ||
        stage.configuration ===
          null ||
        Array.isArray(
          stage.configuration,
        )
      )
    ) {
      errors.push(
        `Stage ${key}: configuration must be an object`,
      );
    }
  }

  return keys;
}


function validateDependencies(
  stageKeys: Set<string>,
  dependencies:
    ProjectExecutionDependencyDefinition[],
  errors: string[],
): void {
  const edges =
    new Set<string>();

  for (
    const dependency of dependencies
  ) {
    const stageKey =
      dependency.stageKey
        ?.trim();

    const parentKey =
      dependency
        .dependsOnStageKey
        ?.trim();

    if (
      !stageKey ||
      !parentKey
    ) {
      errors.push(
        "Dependency stage keys must be nonblank",
      );

      continue;
    }

    if (
      !stageKeys.has(
        stageKey,
      )
    ) {
      errors.push(
        `Dependency references unknown stage: ${stageKey}`,
      );
    }

    if (
      !stageKeys.has(
        parentKey,
      )
    ) {
      errors.push(
        `Dependency references unknown parent stage: ${parentKey}`,
      );
    }

    if (
      stageKey ===
        parentKey
    ) {
      errors.push(
        `Stage ${stageKey} cannot depend on itself`,
      );
    }

    const edge =
      `${stageKey}::${parentKey}`;

    if (
      edges.has(edge)
    ) {
      errors.push(
        `Duplicate dependency: ${stageKey} -> ${parentKey}`,
      );
    }

    edges.add(edge);
  }
}


function detectCycle(
  stages:
    ProjectExecutionStageDefinition[],
  dependencies:
    ProjectExecutionDependencyDefinition[],
): string | null {
  const graph =
    new Map<
      string,
      string[]
    >();

  for (
    const stage of stages
  ) {
    graph.set(
      stage.stageKey.trim(),
      [],
    );
  }

  for (
    const dependency of dependencies
  ) {
    const child =
      dependency.stageKey
        .trim();

    const parent =
      dependency
        .dependsOnStageKey
        .trim();

    /*
     * child depends on parent.
     * For cycle detection direction
     * does not affect cyclicity.
     */
    graph.get(parent)
      ?.push(child);
  }


  const visiting =
    new Set<string>();

  const visited =
    new Set<string>();


  function walk(
    node: string,
  ): string | null {
    if (
      visiting.has(node)
    ) {
      return node;
    }

    if (
      visited.has(node)
    ) {
      return null;
    }

    visiting.add(node);

    for (
      const next of
        graph.get(node) ??
        []
    ) {
      const cycle =
        walk(next);

      if (cycle) {
        return cycle;
      }
    }

    visiting.delete(node);

    visited.add(node);

    return null;
  }


  for (
    const node of graph.keys()
  ) {
    const cycle =
      walk(node);

    if (cycle) {
      return cycle;
    }
  }

  return null;
}


export function validateProjectExecutionPlan(
  input:
    CreateProjectExecutionPlanInput,
): ExecutionPlanValidation {
  const errors:
    string[] = [];

  if (
    !input.tenantId?.trim()
  ) {
    errors.push(
      "tenantId is required",
    );
  }

  if (
    !input.projectId?.trim()
  ) {
    errors.push(
      "projectId is required",
    );
  }

  if (
    !input.projectDefinitionId
      ?.trim()
  ) {
    errors.push(
      "projectDefinitionId is required",
    );
  }

  if (
    !Number.isInteger(
      input.projectDefinitionVersion,
    ) ||
    input.projectDefinitionVersion <
      1
  ) {
    errors.push(
      "projectDefinitionVersion must be a positive integer",
    );
  }


  const stageKeys =
    validateStages(
      input.stages,
      errors,
    );


  const dependencies =
    input.dependencies ??
    [];

  validateDependencies(
    stageKeys,
    dependencies,
    errors,
  );


  if (
    errors.length === 0
  ) {
    const cycle =
      detectCycle(
        input.stages,
        dependencies,
      );

    if (cycle) {
      errors.push(
        `Execution plan contains dependency cycle involving stage ${cycle}`,
      );
    }
  }


  return {
    valid:
      errors.length === 0,

    errors,
  };
}
