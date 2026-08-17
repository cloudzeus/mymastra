import crypto from "node:crypto";

import type {
  SemanticCompositionResult,
} from "./semantic-compose";

import {
  SOFTONE_BUSINESS_RECIPES,
  type SoftOneBusinessRecipe,
} from "./business-recipes";

import type {
  StructuredSqlFilter,
  StructuredSqlJoin,
  StructuredSqlOrderBy,
  StructuredSqlOutputProjection,
  StructuredSqlParameter,
  StructuredSqlPlan,
  StructuredSqlProvenance,
  StructuredSqlSelect,
  StructuredSqlSource,
  SoftOneSqlExecutionChannel,
  SoftOneSqlIntent,
  SoftOneSqlParameterStyle,
} from "./structured-sql-plan-types";


function unique<T>(
  values: T[],
): T[] {
  return [
    ...new Set(values),
  ];
}


function deterministicPlanId(
  tenantCode: string,
  concepts: string[],
  executionChannel:
    SoftOneSqlExecutionChannel,
): string {
  const material =
    [
      tenantCode,
      executionChannel,
      ...concepts,
    ].join("|");

  const digest =
    crypto
      .createHash("sha256")
      .update(material)
      .digest("hex")
      .slice(0, 16)
      .toUpperCase();

  return `SOFTONE_SQL_PLAN_${digest}`;
}


function inferIntent(
  composition:
    SemanticCompositionResult,
): SoftOneSqlIntent {
  const selectedTypes =
    composition.resolvedConcepts.map(
      item =>
        item.selectedNode.type,
    );


  if (
    selectedTypes.includes(
      "RANKING",
    )
  ) {
    return "RANKING";
  }


  if (
    selectedTypes.includes(
      "METRIC",
    ) ||
    composition.plan.metricExpressions.some(
      item =>
        item.aggregate &&
        item.aggregate !== "NONE",
    )
  ) {
    return "AGGREGATE";
  }


  if (
    selectedTypes.includes(
      "DATASET",
    )
  ) {
    return "DATASET";
  }


  return "REPORT";
}


function nodeEvidenceStatus(
  evidence:
    "VERIFIED"
    | "DERIVED"
    | "HYPOTHESIS",
) {
  return evidence;
}


function buildSources(
  composition:
    SemanticCompositionResult,
): StructuredSqlSource[] {
  /*
   * Physical source names come from semantic knowledge.
   *
   * We intentionally do NOT invent aliases, table types,
   * database engines, schemas or direct DB connection data.
   */
  /*
   * Semantic dependencies may expose both relation names and
   * field references through physicalSources.
   *
   * StructuredSqlPlan.sources contains relations only.
   * Qualified field references such as MTRL.CODE or
   * MTRLINES.WHOUSE must never be mislabeled as TABLE sources.
   */
  const relationSources =
    unique(
      composition.plan.physicalSources.filter(
        source =>
          !source.includes("."),
      ),
    );

  return relationSources.map(
    source => ({
      name:
        source,

      sourceType:
        "TABLE" as const,

      evidenceStatus:
        (
          composition.evidence
            .allSelectedVerified &&
          composition.evidence
            .allDependenciesVerified
        )
          ? "VERIFIED" as const
          : "DERIVED" as const,

      provenance: [
        "SEMANTIC_COMPOSITION",
      ],

      notes: [
        "Relation source collected from tenant-isolated semantic composition.",
        "Qualified field references are intentionally excluded from the relation-source list.",
        "Source presence in this plan does not authorize direct database execution.",
      ],
    }),
  );
}


function buildSelect(
  composition:
    SemanticCompositionResult,
): StructuredSqlSelect[] {
  const select:
    StructuredSqlSelect[] =
      [];


  /*
   * Raw semantic expressions.
   */
  for (
    const expression of
      composition.plan.expressions
  ) {
    select.push({
      expression:
        expression.expression,

      sourceIds: [
        expression.sourceId,
      ],

      evidenceStatus:
        "DERIVED",

      meaning:
        "Expression supplied by semantic knowledge composition.",
    });
  }


  /*
   * Metric expressions are descriptions rather than guaranteed
   * executable SQL expressions.
   *
   * Preserve them exactly instead of trying to synthesize SQL.
   */
  for (
    const metric of
      composition.plan.metricExpressions
  ) {
    select.push({
      expression:
        metric.expressionDescription,

      aggregate:
        (
          metric.aggregate ??
          "NONE"
        ) as StructuredSqlSelect["aggregate"],

      sourceIds: [
        metric.sourceId,
      ],

      evidenceStatus:
        "DERIVED",

      meaning:
        "Metric expression description from semantic composition; not automatically executable SQL.",
    });
  }


  return select;
}


function parseJoinType(
  join: string,
): StructuredSqlJoin["type"] {
  const normalized =
    join
      .trim()
      .toUpperCase();


  if (
    normalized.startsWith(
      "LEFT ",
    )
  ) {
    return "LEFT";
  }


  if (
    normalized.startsWith(
      "RIGHT ",
    )
  ) {
    return "RIGHT";
  }


  if (
    normalized.startsWith(
      "FULL ",
    )
  ) {
    return "FULL";
  }


  if (
    normalized.startsWith(
      "CROSS ",
    )
  ) {
    return "CROSS";
  }


  return "INNER";
}


function buildJoins(
  composition:
    SemanticCompositionResult,
): StructuredSqlJoin[] {
  return composition.plan.joins.map(
    item => ({
      type:
        parseJoinType(
          item.join,
        ),

      /*
       * At semantic-plan stage we do not safely know how to
       * split arbitrary verified join text into target-source
       * and ON condition components.
       *
       * Preserve the full expression in condition and leave
       * source unresolved.
       */
      source:
        "UNRESOLVED",

      condition:
        item.join,

      sourceIds: [
        item.sourceId,
      ],

      evidenceStatus:
        "DERIVED",

      notes: [
        "Join expression preserved from semantic knowledge.",
        "Target source parsing is intentionally deferred to a verified SQL recipe or Developer-stage adapter.",
      ],
    }),
  );
}


function buildFilters(
  composition:
    SemanticCompositionResult,
): StructuredSqlFilter[] {
  return composition.plan.conditions.map(
    item => ({
      expression:
        item.condition,

      sourceIds: [
        item.sourceId,
      ],

      evidenceStatus:
        "DERIVED",

      notes: [
        "Condition preserved from semantic composition.",
      ],
    }),
  );
}


function buildParameters(
  composition:
    SemanticCompositionResult,
): StructuredSqlParameter[] {
  const parameters =
    new Map<
      string,
      StructuredSqlParameter
    >();


  const nodes =
    composition.resolvedConcepts.flatMap(
      resolved => [
        resolved.selectedNode,
        ...resolved.dependencies,
      ],
    );


  for (
    const node of nodes
  ) {
    for (
      const parameter of
        node.parameters ?? []
    ) {
      if (
        parameters.has(
          parameter.name,
        )
      ) {
        continue;
      }


      parameters.set(
        parameter.name,
        {
          name:
            parameter.name,

          description:
            parameter.description,

          required:
            parameter.required,

          source:
            "UNRESOLVED",

          semanticToken:
            `{{${parameter.name}}}`,

          evidenceStatus:
            nodeEvidenceStatus(
              node.evidence,
            ),

          resolved:
            false,

          notes: [
            "Semantic parameter only.",
            "No SoftOne execution syntax is inferred.",
          ],
        },
      );
    }
  }


  /*
   * Tenant rules may imply values/configuration, but the generic
   * builder must never convert them automatically into runtime
   * parameters or literals.
   */
  for (
    const tenantRule of
      composition.plan.tenantRules
  ) {
    for (
      const parameter of
        tenantRule.parameters ?? []
    ) {
      const existing =
        parameters.get(
          parameter.name,
        );

      if (
        existing
      ) {
        existing.notes = [
          ...(existing.notes ?? []),
          `Tenant rule available: ${tenantRule.id}`,
        ];

        continue;
      }


      parameters.set(
        parameter.name,
        {
          name:
            parameter.name,

          description:
            parameter.description,

          required:
            parameter.required,

          source:
            "TENANT_CONTEXT",

          semanticToken:
            `{{${parameter.name}}}`,

          evidenceStatus:
            nodeEvidenceStatus(
              tenantRule.evidence,
            ),

          resolved:
            false,

          notes: [
            `Parameter associated with tenant rule ${tenantRule.id}.`,
            "Tenant-rule presence does not itself prove SoftOne runtime parameter syntax.",
          ],
        },
      );
    }
  }


  return [
    ...parameters.values(),
  ];
}


function findMatchingRecipe(
  composition:
    SemanticCompositionResult,
): SoftOneBusinessRecipe | undefined {
  const selectedIds =
    new Set(
      composition.resolvedConcepts.flatMap(
        resolved => [
          resolved.selectedNode.id,
          ...resolved.dependencies.map(
            dependency =>
              dependency.id,
          ),
        ],
      ),
    );


  const requested =
    composition.requestedConcepts
      .map(
        concept =>
          concept
            .trim()
            .toLowerCase(),
      );


  const candidates =
    SOFTONE_BUSINESS_RECIPES
      .filter(
        recipe =>
          recipe.status ===
            "VERIFIED" &&
          recipe.evidenceStatus ===
            "VERIFIED" &&
          recipe.executionStrategy ===
            "SQLDATA",
      )
      .map(
        recipe => {
          const metricCoverage =
            recipe.metricDependencies.filter(
              dependency =>
                selectedIds.has(
                  dependency,
                ),
            ).length;


          const intentCoverage =
            requested.filter(
              concept =>
                recipe.intent.some(
                  intent =>
                    intent
                      .trim()
                      .toLowerCase() ===
                    concept,
                ),
            ).length;


          return {
            recipe,
            metricCoverage,
            intentCoverage,
          };
        },
      )
      .filter(
        item =>
          item.metricCoverage > 0 ||
          item.intentCoverage > 0,
      )
      .sort(
        (
          a,
          b,
        ) => {
          if (
            b.metricCoverage !==
            a.metricCoverage
          ) {
            return (
              b.metricCoverage -
              a.metricCoverage
            );
          }

          if (
            b.intentCoverage !==
            a.intentCoverage
          ) {
            return (
              b.intentCoverage -
              a.intentCoverage
            );
          }

          return (
            a.recipe.id.localeCompare(
              b.recipe.id,
            )
          );
        },
      );


  const best =
    candidates[0];


  if (
    !best
  ) {
    return undefined;
  }


  /*
   * Require meaningful structural overlap.
   *
   * A recipe that matches only one incidental term must not
   * silently dominate a multi-concept composition.
   */
  const selectedMetricIds =
    composition.resolvedConcepts
      .filter(
        resolved =>
          resolved.selectedNode.type ===
          "METRIC",
      )
      .map(
        resolved =>
          resolved.selectedNode.id,
      );


  if (
    selectedMetricIds.length > 0
  ) {
    const matchedSelectedMetrics =
      selectedMetricIds.filter(
        id =>
          best.recipe.metricDependencies.includes(
            id,
          ),
      ).length;


    if (
      matchedSelectedMetrics === 0
    ) {
      return undefined;
    }
  }


  return best.recipe;
}


function buildRequestedOutputProjection(
  composition:
    SemanticCompositionResult,
  recipe:
    SoftOneBusinessRecipe,
): StructuredSqlOutputProjection | undefined {
  /*
   * Projection metadata must be explicit in the verified recipe.
   *
   * Never infer output-to-metric mappings from output names,
   * descriptions, SQL aliases or free-text meanings.
   */
  const hasProjectionMetadata =
    recipe.output.some(
      output =>
        output.role !== undefined ||
        output.metricDependencyId !== undefined ||
        output.alwaysInclude === true,
    );


  if (
    !hasProjectionMetadata
  ) {
    return undefined;
  }


  const selectedMetricIds =
    new Set(
      composition.resolvedConcepts
        .filter(
          resolved =>
            resolved.selectedNode.type ===
            "METRIC",
        )
        .map(
          resolved =>
            resolved.selectedNode.id,
        ),
    );


  const outputs:
    StructuredSqlOutputProjection["outputs"] =
    recipe.output.flatMap<
      StructuredSqlOutputProjection["outputs"][number]
    >(
      output => {
        if (
          output.role ===
            "IDENTITY" &&
          output.alwaysInclude ===
            true
        ) {
          return [{
            name:
              output.name,

            meaning:
              output.meaning,

            role:
              "IDENTITY" as const,

            inclusionReason:
              "IDENTITY" as const,

            evidenceStatus:
              recipe.evidenceStatus,
          }];
        }


        if (
          output.role ===
            "METRIC" &&
          output.metricDependencyId &&
          selectedMetricIds.has(
            output.metricDependencyId,
          )
        ) {
          return [{
            name:
              output.name,

            meaning:
              output.meaning,

            role:
              "METRIC" as const,

            metricDependencyId:
              output.metricDependencyId,

            inclusionReason:
              "REQUESTED_METRIC" as const,

            evidenceStatus:
              recipe.evidenceStatus,
          }];
        }


        return [];
      },
    );


  const includedNames =
    new Set(
      outputs.map(
        output =>
          output.name,
      ),
    );


  const omittedRecipeOutputs =
    recipe.output
      .filter(
        output =>
          !includedNames.has(
            output.name,
          ),
      )
      .map(
        output =>
          output.name,
      );


  const mappedSelectedMetricIds =
    new Set(
      recipe.output
        .filter(
          output =>
            output.role ===
              "METRIC" &&
            output.metricDependencyId,
        )
        .map(
          output =>
            output.metricDependencyId as string,
        ),
    );


  const unmappedSelectedMetricIds =
    [
      ...selectedMetricIds,
    ].filter(
      metricId =>
        !mappedSelectedMetricIds.has(
          metricId,
        ),
    );


  return {
    recipeId:
      recipe.id,

    outputs,

    omittedRecipeOutputs,

    complete:
      unmappedSelectedMetricIds.length ===
      0,

    notes: [
      "Projection is derived only from explicit verified recipe output metadata.",
      "The verified recipe sqlTemplate remains immutable and may contain additional columns.",
      "Downstream Developer-stage SQL generation must expose only projected outputs unless the user explicitly requests additional recipe outputs.",
      ...(
        unmappedSelectedMetricIds.length >
        0
          ? [
              `UNMAPPED_REQUESTED_METRICS:${unmappedSelectedMetricIds.join(",")}`,
            ]
          : []
      ),
    ],
  };
}


function buildRecipeParameters(
  recipe:
    SoftOneBusinessRecipe,
): StructuredSqlParameter[] {
  return recipe.parameters.map(
    parameter => ({
      name:
        parameter.name,

      description:
        parameter.description,

      required:
        parameter.required,

      source:
        "RECIPE" as const,

      semanticToken:
        `{{${parameter.name}}}`,

      evidenceStatus:
        recipe.evidenceStatus,

      resolved:
        false,

      notes: [
        `Parameter defined by verified business recipe ${recipe.id}.`,
        "Parameter definition is verified within recipe scope.",
        "Runtime value and execution syntax remain unresolved until a verified SoftOne execution adapter is applied.",
      ],
    }),
  );
}


function buildProvenance(
  composition:
    SemanticCompositionResult,
): StructuredSqlProvenance[] {
  const records:
    StructuredSqlProvenance[] =
      [];


  const seen =
    new Set<string>();


  for (
    const resolved of
      composition.resolvedConcepts
  ) {
    const nodes = [
      resolved.selectedNode,
      ...resolved.dependencies,
    ];


    for (
      const node of nodes
    ) {
      if (
        seen.has(node.id)
      ) {
        continue;
      }


      seen.add(
        node.id,
      );


      records.push({
        sourceId:
          node.id,

        sourceType:
          node.type ===
            "TENANT_RULE"
            ? "TENANT_RULE"
            : "SEMANTIC_NODE",

        evidenceStatus:
          nodeEvidenceStatus(
            node.evidence,
          ),

        description:
          node.description,
      });
    }
  }


  return records;
}


export function buildStructuredSqlPlan(
  options: {
    composition:
      SemanticCompositionResult;

    executionChannel:
      SoftOneSqlExecutionChannel;

    intent?:
      SoftOneSqlIntent;

    parameterStyle?:
      SoftOneSqlParameterStyle;
  },
): StructuredSqlPlan {
  const {
    composition,
  } =
    options;


  const blockers =
    [
      ...composition.blockers,
    ];


  const warnings:
    string[] =
      [];


  const sources =
    buildSources(
      composition,
    );


  const select =
    buildSelect(
      composition,
    );


  const joins =
    buildJoins(
      composition,
    );


  const filters =
    buildFilters(
      composition,
    );


  const matchingRecipe =
    findMatchingRecipe(
      composition,
    );


  const requestedOutputProjection =
    matchingRecipe
      ? buildRequestedOutputProjection(
          composition,
          matchingRecipe,
        )
      : undefined;


  const semanticParameters =
    buildParameters(
      composition,
    );


  const recipeParameters =
    matchingRecipe
      ? buildRecipeParameters(
          matchingRecipe,
        )
      : [];


  const parameterMap =
    new Map<
      string,
      StructuredSqlParameter
    >();


  for (
    const parameter of [
      ...semanticParameters,
      ...recipeParameters,
    ]
  ) {
    const existing =
      parameterMap.get(
        parameter.name,
      );


    if (
      !existing
    ) {
      parameterMap.set(
        parameter.name,
        parameter,
      );

      continue;
    }


    /*
     * VERIFIED recipe parameter definition wins over a generic
     * unresolved semantic parameter with the same name.
     */
    if (
      parameter.source ===
        "RECIPE" &&
      parameter.evidenceStatus ===
        "VERIFIED"
    ) {
      parameterMap.set(
        parameter.name,
        parameter,
      );
    }
  }


  const parameters =
    [
      ...parameterMap.values(),
    ];


  const unresolvedParameters =
    parameters.filter(
      parameter =>
        !parameter.resolved,
    );


  /*
   * Unresolved runtime parameters do not invalidate the semantic
   * structure of the plan, but they prevent claiming that the
   * result is execution-ready.
   */
  if (
    unresolvedParameters.length >
    0
  ) {
    warnings.push(
      `UNRESOLVED_RUNTIME_PARAMETERS:${unresolvedParameters
        .map(
          parameter =>
            parameter.name,
        )
        .join(",")}`,
    );
  }


  if (
    sources.length === 0
  ) {
    blockers.push(
      "NO_PHYSICAL_SOURCES",
    );
  }


  if (
    select.length === 0
  ) {
    blockers.push(
      "NO_SELECT_EXPRESSIONS",
    );
  }


  if (
    joins.some(
      join =>
        join.source ===
        "UNRESOLVED",
    )
  ) {
    warnings.push(
      "JOIN_TARGET_PARSING_DEFERRED",
    );
  }


  const parameterStyle =
    options.parameterStyle ??
    matchingRecipe
      ?.templateParameterStyle ??
    "INTERNAL_SEMANTIC_TOKENS";


  /*
   * Semantic tokens are deliberately never treated as verified
   * runtime syntax.
   */
  const parameterContractVerified =
    Boolean(
      parameterStyle !==
        "INTERNAL_SEMANTIC_TOKENS" &&
      matchingRecipe &&
      matchingRecipe.status ===
        "VERIFIED" &&
      matchingRecipe.evidenceStatus ===
        "VERIFIED" &&
      matchingRecipe.templateParameterStyle &&
      matchingRecipe.templateParameterStyle ===
        parameterStyle,
    );


  if (
    !matchingRecipe
  ) {
    warnings.push(
      "NO_VERIFIED_MATCHING_BUSINESS_RECIPE",
    );
  }


  if (
    matchingRecipe &&
    !requestedOutputProjection
  ) {
    warnings.push(
      "RECIPE_OUTPUT_PROJECTION_METADATA_UNAVAILABLE",
    );
  }


  if (
    requestedOutputProjection &&
    !requestedOutputProjection.complete
  ) {
    warnings.push(
      "REQUESTED_OUTPUT_PROJECTION_INCOMPLETE",
    );
  }


  if (
    !parameterContractVerified
  ) {
    warnings.push(
      "SOFTONE_EXECUTION_PARAMETER_ADAPTER_REQUIRED",
    );
  }


  let status:
    StructuredSqlPlan["status"];


  if (
    composition.compositionStatus ===
      "BLOCKED" ||
    blockers.length > 0
  ) {
    status =
      "BLOCKED";
  }
  else if (
    composition.compositionStatus ===
      "PARTIAL"
  ) {
    status =
      "PARTIAL";
  }
  else {
    /*
     * PLAN_READY means the structured logical plan is complete
     * enough for the next stage.
     *
     * It explicitly does NOT mean executable SQL is ready.
     */
    status =
      "PLAN_READY";
  }


  const deploymentMode =
    options.executionChannel ===
      "SOFTONE_WEBSERVICE_SCRIPT"
      ? "CREATE_SOFTONE_SCRIPT" as const
      : "INLINE_INTERNAL" as const;


  return {
    id:
      deterministicPlanId(
        composition.tenantCode,
        composition.requestedConcepts,
        options.executionChannel,
      ),

    tenantCode:
      composition.tenantCode,

    requestedConcepts:
      composition.requestedConcepts,

    intent:
      options.intent ??
      inferIntent(
        composition,
      ),

    executionStrategy:
      "SQLDATA",

    executionChannel:
      options.executionChannel,

    sources,

    select,

    joins,

    filters,

    groupBy:
      composition.plan.sharedDimensions.map(
        expression => ({
          expression,
        }),
      ),

    orderBy:
      [] as StructuredSqlOrderBy[],

    parameters,

    requestedOutputProjection,

    /*
     * Keep the verified recipe template immutable.
     *
     * requestedOutputProjection defines which outputs the downstream
     * Developer stage is allowed/expected to expose for this request.
     */
    sqlTemplate:
      matchingRecipe
        ?.sqlTemplate,

    parameterContract: {
      style:
        parameterStyle,

      executionAdapterRequired:
        !parameterContractVerified,

      verifiedForExecution:
        parameterContractVerified,

      notes: [
        "Mastra must never execute SoftOne SQL directly against the ERP database.",
        "Execution is allowed only inside the SoftOne runtime or through a SoftOne SQL script exposed through Web Services.",
        parameterContractVerified
          ? `Parameter style is inherited from verified recipe ${matchingRecipe?.id}; downstream execution must preserve that exact verified recipe syntax.`
          : "Internal semantic tokens are planning placeholders only and require a verified SoftOne execution adapter.",
      ],
    },

    deployment: {
      mode:
        deploymentMode,

      webServiceCallable:
        options.executionChannel ===
        "SOFTONE_WEBSERVICE_SCRIPT",

      notes:
        options.executionChannel ===
          "SOFTONE_WEBSERVICE_SCRIPT"
          ? [
              "Developer stage may generate a SoftOne SQL script and its Web Service invocation contract.",
              "The Analyst does not create or deploy the script.",
            ]
          : [
              "Plan targets SQL execution inside the SoftOne environment.",
              "The Analyst does not execute the SQL.",
            ],
    },

    provenance: [
      ...buildProvenance(
        composition,
      ),

      ...(
        matchingRecipe
          ? [{
              sourceId:
                matchingRecipe.id,

              sourceType:
                "BUSINESS_RECIPE" as const,

              evidenceStatus:
                matchingRecipe.evidenceStatus,

              description:
                matchingRecipe.description,
            }]
          : []
      ),
    ],

    status,

    blockers:
      unique(
        blockers,
      ),

    warnings:
      unique(
        warnings,
      ),

    safety: {
      readOnly:
        true,

      tenantIsolated:
        true,

      crossTenantKnowledgeUsed:
        false,

      directDatabaseExecution:
        false,

      requiresSoftOneRuntime:
        true,

      executable:
        false,

      writeAuthority:
        false,

      writePerformed:
        false,
    },
  };
}
