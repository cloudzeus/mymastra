export type SoftOneSqlIntent =
  | "DATASET"
  | "AGGREGATE"
  | "RANKING"
  | "REPORT";


export type SoftOneSqlExecutionStrategy =
  | "SQLDATA";


export type SoftOneSqlExecutionChannel =
  | "SOFTONE_INTERNAL"
  | "SOFTONE_WEBSERVICE_SCRIPT";


export type SoftOneSqlPlanStatus =
  | "PLAN_READY"
  | "PARTIAL"
  | "BLOCKED";


export type SoftOneSqlEvidenceStatus =
  | "VERIFIED"
  | "DERIVED"
  | "HYPOTHESIS";


export type SoftOneSqlParameterStyle =
  | "INTERNAL_SEMANTIC_TOKENS"
  | "SOFTONE_LITERAL_PLACEHOLDERS"
  | "SOFTONE_SYSTEM_CONTEXT";


export type SoftOneSqlDeploymentMode =
  | "EXISTING_SOFTONE_SCRIPT"
  | "CREATE_SOFTONE_SCRIPT"
  | "INLINE_INTERNAL";


export type SoftOneSqlJoinType =
  | "INNER"
  | "LEFT"
  | "RIGHT"
  | "FULL"
  | "CROSS";


export type SoftOneSqlSortDirection =
  | "ASC"
  | "DESC";


export type SoftOneSqlAggregate =
  | "SUM"
  | "COUNT"
  | "MIN"
  | "MAX"
  | "AVG"
  | "NONE";


export type StructuredSqlSource = {
  name: string;

  alias?: string;

  sourceType:
    | "TABLE"
    | "VIEW"
    | "FUNCTION"
    | "DERIVED";

  evidenceStatus:
    SoftOneSqlEvidenceStatus;

  provenance: string[];

  notes?: string[];
};


export type StructuredSqlSelect = {
  expression: string;

  alias?: string;

  aggregate?: SoftOneSqlAggregate;

  meaning?: string;

  sourceIds?: string[];

  evidenceStatus:
    SoftOneSqlEvidenceStatus;
};


export type StructuredSqlJoin = {
  type:
    SoftOneSqlJoinType;

  source: string;

  alias?: string;

  condition: string;

  evidenceStatus:
    SoftOneSqlEvidenceStatus;

  sourceIds?: string[];

  notes?: string[];
};


export type StructuredSqlFilter = {
  expression: string;

  sourceIds?: string[];

  evidenceStatus:
    SoftOneSqlEvidenceStatus;

  tenantScoped?: boolean;

  notes?: string[];
};


export type StructuredSqlGroupBy = {
  expression: string;

  sourceIds?: string[];
};


export type StructuredSqlOrderBy = {
  expression: string;

  direction:
    SoftOneSqlSortDirection;

  sourceIds?: string[];
};


export type StructuredSqlParameter = {
  name: string;

  description: string;

  required: boolean;

  source:
    | "USER_INPUT"
    | "TENANT_CONTEXT"
    | "SOFTONE_SYSTEM_CONTEXT"
    | "RECIPE"
    | "UNRESOLVED";

  semanticToken?: string;

  softOneExpression?: string;

  evidenceStatus:
    SoftOneSqlEvidenceStatus;

  resolved: boolean;

  notes?: string[];
};


export type StructuredSqlProjectedOutput = {
  name: string;

  meaning: string;

  role:
    | "IDENTITY"
    | "METRIC";

  metricDependencyId?: string;

  inclusionReason:
    | "IDENTITY"
    | "REQUESTED_METRIC";

  evidenceStatus:
    SoftOneSqlEvidenceStatus;
};


export type StructuredSqlOutputProjection = {
  recipeId: string;

  outputs:
    StructuredSqlProjectedOutput[];

  omittedRecipeOutputs:
    string[];

  complete:
    boolean;

  notes:
    string[];
};


export type StructuredSqlParameterContract = {
  style:
    SoftOneSqlParameterStyle;

  executionAdapterRequired:
    boolean;

  verifiedForExecution:
    boolean;

  notes: string[];
};


export type StructuredSqlDeployment = {
  mode:
    SoftOneSqlDeploymentMode;

  scriptName?: string;

  webServiceCallable:
    boolean;

  notes?: string[];
};


export type StructuredSqlProvenance = {
  sourceId: string;

  sourceType:
    | "SEMANTIC_NODE"
    | "BUSINESS_RECIPE"
    | "BUSINESS_METRIC"
    | "EVIDENCE"
    | "USER_VERIFIED_SQL"
    | "SCHEMA_CACHE"
    | "RELATIONS_CACHE"
    | "CANONICAL_REGISTRY"
    | "TENANT_RULE";

  evidenceStatus:
    SoftOneSqlEvidenceStatus;

  description?: string;
};


export type StructuredSqlPlan = {
  id: string;

  tenantCode: string;

  requestedConcepts: string[];

  intent:
    SoftOneSqlIntent;

  executionStrategy:
    SoftOneSqlExecutionStrategy;

  executionChannel:
    SoftOneSqlExecutionChannel;

  sources:
    StructuredSqlSource[];

  select:
    StructuredSqlSelect[];

  joins:
    StructuredSqlJoin[];

  filters:
    StructuredSqlFilter[];

  groupBy:
    StructuredSqlGroupBy[];

  orderBy:
    StructuredSqlOrderBy[];

  parameters:
    StructuredSqlParameter[];

  /*
   * Explicit output projection requested from the matching recipe.
   *
   * The verified sqlTemplate remains immutable. This projection tells
   * the downstream Developer stage which recipe outputs are actually
   * required for this request.
   */
  requestedOutputProjection?:
    StructuredSqlOutputProjection;

  sqlTemplate?: string;

  parameterContract:
    StructuredSqlParameterContract;

  deployment:
    StructuredSqlDeployment;

  provenance:
    StructuredSqlProvenance[];

  status:
    SoftOneSqlPlanStatus;

  blockers:
    string[];

  warnings:
    string[];

  safety: {
    readOnly: true;

    tenantIsolated: true;

    crossTenantKnowledgeUsed: false;

    directDatabaseExecution: false;

    requiresSoftOneRuntime: true;

    executable: false;

    writeAuthority: false;

    writePerformed: false;
  };
};
