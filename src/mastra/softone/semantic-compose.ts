import type {
  SoftOneSemanticNode,
} from "./semantic-types";

import {
  searchSemanticKnowledge,
  getSemanticDependencies,
} from "./semantic-index";

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function visibleToTenant(
  node: SoftOneSemanticNode,
  tenantCode: string,
): boolean {
  /*
   * GLOBAL:
   * version/tenant-independent reusable knowledge.
   *
   * RECIPE:
   * reusable verified implementation knowledge whose literals,
   * conditions and semantics remain bound to the stored recipe.
   * Visibility does NOT promote those literals to tenant-global
   * configuration.
   */
  if (
    node.scope === "GLOBAL" ||
    node.scope === "RECIPE"
  ) {
    return true;
  }

  /*
   * TENANT knowledge is visible only to the explicitly bound
   * tenant.
   */
  if (
    node.scope === "TENANT" &&
    node.tenantCode
  ) {
    return node.tenantCode === tenantCode;
  }

  return false;
}

function nodePreference(node: SoftOneSemanticNode): number {
  switch (node.type) {
    case "METRIC":
      return 100;
    case "DATASET":
      return 90;
    case "RANKING":
      return 80;
    case "RECIPE":
      return 70;
    case "FACT":
      return 50;
    case "TENANT_RULE":
      return 10;
    default:
      return 0;
  }
}

function choosePrimaryNode(
  concept: string,
  nodes: SoftOneSemanticNode[],
): SoftOneSemanticNode | undefined {
  if (nodes.length === 0) {
    return undefined;
  }

  const q = normalize(concept);

  /*
   * Exact ID or exact concept always wins.
   */
  const exact = nodes.find(
    (node) =>
      normalize(node.id) === q ||
      normalize(node.concept) === q,
  );

  if (exact) {
    return exact;
  }

  /*
   * Otherwise prefer composable business entities
   * over raw facts and tenant rules.
   */
  return [...nodes].sort(
    (a, b) =>
      nodePreference(b) - nodePreference(a),
  )[0];
}

function intersection(
  lists: string[][],
): string[] {
  const nonEmpty = lists.filter(
    (list) => list.length > 0,
  );

  if (nonEmpty.length === 0) {
    return [];
  }

  return nonEmpty[0].filter((value) =>
    nonEmpty.every((list) =>
      list.includes(value),
    ),
  );
}

export type SemanticCompositionResult = {
  tenantCode: string;

  requestedConcepts: string[];

  resolvedConcepts: Array<{
    concept: string;
    selectedNode: SoftOneSemanticNode;
    alternatives: SoftOneSemanticNode[];
    dependencies: SoftOneSemanticNode[];
  }>;

  unresolvedConcepts: string[];

  plan: {
    businessObjects: string[];
    physicalSources: string[];
    dimensions: string[];
    sharedDimensions: string[];

    expressions: Array<{
      sourceId: string;
      expression: string;
    }>;

    metricExpressions: Array<{
      sourceId: string;
      aggregate?: string;
      expressionDescription: string;
    }>;

    conditions: Array<{
      sourceId: string;
      condition: string;
    }>;

    joins: Array<{
      sourceId: string;
      join: string;
    }>;

    tenantRules: SoftOneSemanticNode[];
  };

  evidence: {
    allSelectedVerified: boolean;
    allDependenciesVerified: boolean;
  };

  compositionStatus:
    | "DERIVED_COMPOSITION"
    | "PARTIAL"
    | "BLOCKED";

  sqlGenerationReady: boolean;

  blockers: string[];

  safety: {
    tenantIsolated: true;
    crossTenantKnowledgeUsed: false;
    writeAuthority: false;
    writePerformed: false;
  };
};

export function composeSemanticKnowledge(options: {
  tenantCode: string;
  concepts: string[];
  limitPerConcept?: number;
}): SemanticCompositionResult {
  const limitPerConcept =
    options.limitPerConcept ?? 10;

  const resolvedConcepts:
    SemanticCompositionResult["resolvedConcepts"] = [];

  const unresolvedConcepts: string[] = [];

  for (const concept of options.concepts) {
    const matches = searchSemanticKnowledge({
      query: concept,
      tenantCode: options.tenantCode,
      limit: limitPerConcept,
    }).filter((node) =>
      visibleToTenant(
        node,
        options.tenantCode,
      ),
    );

    const selectedNode =
      choosePrimaryNode(concept, matches);

    if (!selectedNode) {
      unresolvedConcepts.push(concept);
      continue;
    }

    const dependencies =
      getSemanticDependencies(
        selectedNode.id,
      ).filter((node) =>
        visibleToTenant(
          node,
          options.tenantCode,
        ),
      );

    resolvedConcepts.push({
      concept,
      selectedNode,
      alternatives: matches.filter(
        (node) =>
          node.id !== selectedNode.id,
      ),
      dependencies,
    });
  }

  const allNodes = unique(
    resolvedConcepts.flatMap((resolved) => [
      resolved.selectedNode,
      ...resolved.dependencies,
    ]),
  );

  /*
   * De-duplicate nodes by ID.
   */
  const nodesById = new Map<
    string,
    SoftOneSemanticNode
  >();

  for (const node of allNodes) {
    nodesById.set(node.id, node);
  }

  const nodes = [...nodesById.values()];

  const businessObjects = unique(
    nodes.flatMap(
      (node) => node.businessObjects ?? [],
    ),
  );

  const physicalSources = unique(
    nodes.flatMap(
      (node) => node.physicalSources ?? [],
    ),
  );

  const dimensions = unique(
    nodes.flatMap(
      (node) => node.dimensions ?? [],
    ),
  );

  const selectedDimensionLists =
    resolvedConcepts.map(
      (resolved) =>
        resolved.selectedNode.dimensions ?? [],
    );

  const sharedDimensions =
    intersection(selectedDimensionLists);

  const expressions = nodes.flatMap(
    (node) =>
      node.expression
        ? [{
            sourceId: node.id,
            expression: node.expression,
          }]
        : [],
  );

  const metricExpressions =
    nodes.flatMap((node) =>
      node.expressionDescription
        ? [{
            sourceId: node.id,
            aggregate: node.aggregate,
            expressionDescription:
              node.expressionDescription,
          }]
        : [],
    );

  const conditions = nodes.flatMap(
    (node) =>
      (node.conditions ?? []).map(
        (condition) => ({
          sourceId: node.id,
          condition,
        }),
      ),
  );

  const joins = nodes.flatMap(
    (node) =>
      (node.joins ?? []).map(
        (join) => ({
          sourceId: node.id,
          join,
        }),
      ),
  );

  const tenantRules = nodes.filter(
    (node) => node.type === "TENANT_RULE",
  );

  const selectedNodes =
    resolvedConcepts.map(
      (resolved) => resolved.selectedNode,
    );

  const dependencyNodes =
    resolvedConcepts.flatMap(
      (resolved) => resolved.dependencies,
    );

  const allSelectedVerified =
    selectedNodes.every(
      (node) => node.evidence === "VERIFIED",
    );

  const allDependenciesVerified =
    dependencyNodes.every(
      (node) => node.evidence === "VERIFIED",
    );

  const blockers: string[] = [];

  for (const concept of unresolvedConcepts) {
    blockers.push(
      `UNRESOLVED_CONCEPT:${concept}`,
    );
  }

  if (!allSelectedVerified) {
    blockers.push(
      "NON_VERIFIED_SELECTED_COMPONENT",
    );
  }

  if (!allDependenciesVerified) {
    blockers.push(
      "NON_VERIFIED_DEPENDENCY",
    );
  }

  let compositionStatus:
    SemanticCompositionResult["compositionStatus"];

  if (resolvedConcepts.length === 0) {
    compositionStatus = "BLOCKED";
  }
  else if (
    blockers.length > 0
  ) {
    compositionStatus = "PARTIAL";
  }
  else {
    compositionStatus =
      "DERIVED_COMPOSITION";
  }

  /*
   * Deliberately false in this phase.
   *
   * Having verified semantic components does NOT yet
   * prove that a safe executable SQL query has been
   * generated and validated.
   */
  const sqlGenerationReady = false;

  return {
    tenantCode: options.tenantCode,

    requestedConcepts:
      options.concepts,

    resolvedConcepts,

    unresolvedConcepts,

    plan: {
      businessObjects,
      physicalSources,
      dimensions,
      sharedDimensions,
      expressions,
      metricExpressions,
      conditions,
      joins,
      tenantRules,
    },

    evidence: {
      allSelectedVerified,
      allDependenciesVerified,
    },

    compositionStatus,
    sqlGenerationReady,

    blockers,

    safety: {
      tenantIsolated: true,
      crossTenantKnowledgeUsed: false,
      writeAuthority: false,
      writePerformed: false,
    },
  };
}
