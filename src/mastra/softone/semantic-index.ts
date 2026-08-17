import type {
  SoftOneSemanticNode,
  SemanticNodeType,
} from "./semantic-types";

import {
  SOFTONE_SEMANTIC_FACTS,
} from "./semantic-facts";

import {
  SOFTONE_BUSINESS_METRICS,
} from "./business-metrics";

import {
  SOFTONE_BUSINESS_RECIPES,
} from "./business-recipes";

import {
  SOFTONE_BUSINESS_DATASETS,
} from "./business-datasets";

import {
  SOFTONE_BUSINESS_RANKINGS,
} from "./business-rankings";

import {
  SOFTONE_TENANT_RULES,
} from "./tenant-rules";

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function legacyFacts(): SoftOneSemanticNode[] {
  return SOFTONE_SEMANTIC_FACTS.map((fact) => {
    const recipeScoped =
      fact.provenance.includes("USER_VERIFIED_SQL");

    return {
      id: fact.id,
      type: "FACT",
      concept: fact.concept,
      description: fact.description,

      businessObjects: fact.businessObject
        ? [fact.businessObject]
        : undefined,

      scope: recipeScoped ? "RECIPE" : "GLOBAL",

      evidence: fact.evidenceStatus,
      provenance: fact.provenance,

      physicalSources: fact.sources,

      dimensions: fact.dimensions,

      expression: fact.expression,
      conditions: fact.conditions,
      joins: fact.joins,

      notes: fact.notes,

      tags: [
        fact.id,
        fact.concept,
      ],
    };
  });
}

function legacyMetrics(): SoftOneSemanticNode[] {
  const promotedDatasets = new Set([
    "DOCUMENT_ITEM_LINES",
    "OPEN_SUPPLIER_ORDERS",
  ]);

  return SOFTONE_BUSINESS_METRICS
    .filter((metric) => !promotedDatasets.has(metric.id))
    .map((metric) => {
      const recipeScoped =
        metric.provenance.includes("USER_VERIFIED_SQL");

      return {
        id: metric.id,
        type: "METRIC",
        concept: metric.concept,
        description: metric.description,

        businessObjects: [metric.businessObject],

        scope: recipeScoped ? "RECIPE" : "GLOBAL",

        evidence: metric.evidenceStatus,
        provenance: metric.provenance,

        dependsOn: metric.factDependencies,
        physicalSources: metric.physicalSources,
        dimensions: metric.dimensions,

        outputs: [
          metric.outputAlias,
        ],

        aggregate: metric.aggregate,
        expressionDescription: metric.expressionDescription,

        notes: metric.notes,

        tags: [
          metric.id,
          metric.concept,
        ],
      };
    });
}

function legacyRecipes(): SoftOneSemanticNode[] {
  return SOFTONE_BUSINESS_RECIPES.map((recipe) => {
    const recipeScoped =
      recipe.provenance.includes("USER_VERIFIED_SQL");

    return {
      id: recipe.id,
      type: "RECIPE",
      concept: recipe.intent[0] ?? recipe.id,
      description: recipe.description,

      businessObjects: [recipe.businessObject],

      scope: recipeScoped ? "RECIPE" : "GLOBAL",

      evidence: recipe.evidenceStatus,
      provenance: recipe.provenance,

      dependsOn: recipe.metricDependencies,
      physicalSources: recipe.physicalSources,

      outputs: recipe.output.map((x) => x.name),

      executionStrategy: recipe.executionStrategy,

      parameters: recipe.parameters,
      sqlTemplate: recipe.sqlTemplate,
      templateParameterStyle: recipe.templateParameterStyle,

      notes: recipe.notes,

      tags: [
        recipe.id,
        ...recipe.intent,
      ],
    };
  });
}

export const SOFTONE_SEMANTIC_INDEX: SoftOneSemanticNode[] = [
  ...legacyFacts(),
  ...legacyMetrics(),
  ...SOFTONE_BUSINESS_DATASETS,
  ...legacyRecipes(),
  ...SOFTONE_BUSINESS_RANKINGS,
  ...SOFTONE_TENANT_RULES,
];

export function getSemanticNode(
  id: string,
): SoftOneSemanticNode | undefined {
  const normalized = normalize(id);

  return SOFTONE_SEMANTIC_INDEX.find(
    (node) => normalize(node.id) === normalized,
  );
}

export function searchSemanticKnowledge(options: {
  query: string;
  type?: SemanticNodeType;
  tenantCode?: string;
  limit?: number;
}): SoftOneSemanticNode[] {
  const q = normalize(options.query);
  const tokens = q
    .split(/\s+/)
    .filter(Boolean);

  const limit = options.limit ?? 20;

  return SOFTONE_SEMANTIC_INDEX
    .filter((node) => {
      if (options.type && node.type !== options.type) {
        return false;
      }

      if (node.scope === "TENANT") {
        if (!options.tenantCode) {
          return false;
        }

        if (
          !node.tenantCode ||
          node.tenantCode !== options.tenantCode
        ) {
          return false;
        }
      }

      return true;
    })
    .map((node) => {
      const haystack = normalize([
        node.id,
        node.concept,
        node.description,
        ...(node.tags ?? []),
        ...(node.outputs ?? []),
        ...(node.physicalSources ?? []),
      ].join(" "));

      let score = 0;

      if (normalize(node.id) === q) score += 1000;
      if (normalize(node.concept) === q) score += 700;

      if (haystack.includes(q)) score += 300;

      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += 50;
        }
      }

      return {
        node,
        score,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (
        a.node.evidence === "VERIFIED" &&
        b.node.evidence !== "VERIFIED"
      ) {
        return -1;
      }

      if (
        b.node.evidence === "VERIFIED" &&
        a.node.evidence !== "VERIFIED"
      ) {
        return 1;
      }

      return a.node.id.localeCompare(b.node.id);
    })
    .slice(0, limit)
    .map((x) => x.node);
}

export function getSemanticDependencies(
  id: string,
  maxDepth = 5,
): SoftOneSemanticNode[] {
  const root = getSemanticNode(id);

  if (!root) {
    return [];
  }

  const result: SoftOneSemanticNode[] = [];
  const visited = new Set<string>();

  function visit(
    node: SoftOneSemanticNode,
    depth: number,
  ) {
    if (depth > maxDepth) return;

    for (const dependencyId of node.dependsOn ?? []) {
      if (visited.has(dependencyId)) continue;

      visited.add(dependencyId);

      const dependency = getSemanticNode(dependencyId);

      if (!dependency) continue;

      result.push(dependency);
      visit(dependency, depth + 1);
    }
  }

  visit(root, 1);

  return result;
}
